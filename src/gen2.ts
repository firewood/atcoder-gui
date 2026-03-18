import fs from "fs";
import path from "path";
import * as cheerio from "cheerio";
import { BrowserManager } from "./browser.js";
import { CPlusPlusGenerator } from "./generator/cplusplus.js";
import { PythonGenerator } from "./generator/python.js";
import { generateParseResult } from "./generator/pipeline.js";
import { ConfigManager } from "./config.js";
import { AtCoderToolsMetadata } from "./types";
import { expandHomeDir } from "./utils.js";

export class Gen2Manager {
  private browserManager: BrowserManager;
  private configManager: ConfigManager;

  constructor(browserManager: BrowserManager, configManager: ConfigManager) {
    this.browserManager = browserManager;
    this.configManager = configManager;
  }

  async run(args: string[]): Promise<void> {
    let lang = "cpp";
    const langIdx = args.findIndex((arg) => arg === "--lang" || arg === "-l");
    if (langIdx !== -1 && langIdx + 1 < args.length) {
      lang = args[langIdx + 1].toLowerCase();
      args.splice(langIdx, 2);
    }

    if (args.length > 1) {
      const contestId = args[1];
      console.log(`Generating directories for contest: ${contestId} (Language: ${lang})`);

      const contestUrl = `https://atcoder.jp/contests/${contestId}/tasks`;

      const html = await this.browserManager.fetchRawHtml(contestUrl);
      if (!html) {
        console.error("Error: Could not get page content.");
        return;
      }

      const $ = cheerio.load(html);
      const problems: { alphabet: string; id: string; url: string }[] = [];
      $("tbody > tr").each((_, element) => {
        const alphabet = $(element).find("td:first-child a").text().trim();
        const link = $(element).find("td:nth-child(2) a");
        const problemUrl = new URL(link.attr("href") ?? "", "https://atcoder.jp").href;
        const problemId = problemUrl.split("/").pop() ?? "";

        if (alphabet && problemId && problemUrl) {
          problems.push({ alphabet, id: problemId, url: problemUrl });
        }
      });

      if (problems.length === 0) {
        console.error("No problems found on the contest page.");
        return;
      }

      console.log(`Found ${problems.length} problems.`);

      let workspaceDir = this.configManager.getConfig().workspaceDir;
      if (!workspaceDir) {
        console.error("Error: workspaceDir is not configured.");
        return;
      }
      workspaceDir = expandHomeDir(workspaceDir);

      const contestDirPath = path.join(workspaceDir, contestId);
      if (!fs.existsSync(contestDirPath)) {
        fs.mkdirSync(contestDirPath, { recursive: true });
      }

      let results = [];
      for (const problem of problems) {
        const problemDirPath = path.join(contestDirPath, problem.alphabet);
        if (!fs.existsSync(problemDirPath)) {
          fs.mkdirSync(problemDirPath, { recursive: true });
        }

        const code_filename = lang === "python" || lang === "py" ? "main.py" : "main.cpp";
        const metadata: AtCoderToolsMetadata = {
          code_filename: code_filename,
          judge: {
            judge_type: "normal",
          },
          lang: lang === "python" || lang === "py" ? "python" : "cpp",
          problem: {
            alphabet: problem.alphabet,
            contest: {
              contest_id: contestId,
            },
            problem_id: problem.id,
          },
          sample_in_pattern: "in_*.txt",
          sample_out_pattern: "out_*.txt",
          timeout_ms: 2000,
        };

        fs.writeFileSync(
          path.join(problemDirPath, "metadata.json"),
          JSON.stringify(metadata, null, 2),
        );
        console.log(`Created metadata.json for problem ${problem.alphabet}`);

        results.push({
          id: problem.alphabet,
          success: await this.generateCode(contestId, problem.id, problemDirPath, lang),
        });
      }

      console.log(`${contestId} code generation results:`);
      for (const result of results) {
        console.log(`  Problem ${result.id}: ${result.success ? "SUCCEEDED" : "FAILED"}`);
      }
    } else {
      const url = this.browserManager.getCurrentUrl();
      const match = url?.match(/\w+:\/\/atcoder\.jp\/contests\/(\w+)\/tasks\/(\w+)/);
      if (!match) {
        console.error("Error: Could not extract task ID from the URL.");
        return;
      }

      const contestId = match[1],
        taskId = match[2];
      const code_filename = lang === "python" || lang === "py" ? "main.py" : "main.cpp";
      console.log(`Generating ${code_filename} for task: ${taskId}`);
      await this.generateCode(contestId, taskId, ".", lang);
    }
  }

  async generateCode(
    contestId: string,
    taskId: string,
    savePath: string,
    lang: string = "cpp",
  ): Promise<boolean> {
    const url = `https://atcoder.jp/contests/${contestId}/tasks/${taskId}`;

    await new Promise((_) => setTimeout(_, 500));
    try {
      const html = await this.browserManager.fetchRawHtml(url);
      if (html) {
        const { multipleCases, queryType, variables, formatTree } = generateParseResult(
          html,
          taskId,
          url,
        );

        if (!formatTree) throw new Error("Format tree is undefined");

        let code = "";
        let filename = "main.cpp";

        if (lang === "python" || lang === "py") {
          console.log("Generating Python Code...");
          const generator = new PythonGenerator(this.configManager);
          code = generator.generate(formatTree, variables, multipleCases, queryType);
          filename = "main.py";
        } else {
          console.log("Generating C++ Code...");
          const generator = new CPlusPlusGenerator(this.configManager);
          code = generator.generate(formatTree, variables, multipleCases, queryType);
          filename = "main.cpp";
        }

        fs.writeFileSync(path.join(savePath, filename), code);
        console.log(`Saved ${lang} code to ${filename}`);
        return true;
      }
    } catch (e) {
      console.error("Error during generation:", e);
    }
    return false;
  }
}
