import fs from "fs";
import path from "path";
import * as cheerio from "cheerio";
import { BrowserManager } from "./browser";
import { CPlusPlusGenerator } from "./generator/cplusplus.js";
import { generateParseResult } from "./generator/pipeline.js";
import { ConfigManager } from "./config.js";
import { AtCoderToolsMetadata } from "./types";

export class Gen2Manager {
  private browserManager: BrowserManager;
  private configManager: ConfigManager;

  constructor(browserManager: BrowserManager, configManager: ConfigManager) {
    this.browserManager = browserManager;
    this.configManager = configManager;
  }

  async run(args: string[]): Promise<void> {
    if (args.length > 1) {
      const contestId = args[1];
      console.log(`Generating directories for contest: ${contestId}`);

      const contestUrl = `https://atcoder.jp/contests/${contestId}/tasks`;

      try {
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

        const workspaceDir = this.configManager.getConfig().workspaceDir;
        if (!workspaceDir) {
          console.error("Error: workspaceDir is not configured.");
          return;
        }

        const contestDirPath = path.join(workspaceDir, contestId);
        if (!fs.existsSync(contestDirPath)) {
          fs.mkdirSync(contestDirPath, { recursive: true });
        }

        for (const problem of problems) {
          const problemDirPath = path.join(contestDirPath, problem.alphabet);
          if (!fs.existsSync(problemDirPath)) {
            fs.mkdirSync(problemDirPath, { recursive: true });
          }

          const metadata: AtCoderToolsMetadata = {
            code_filename: "main.cpp",
            judge: {
              judge_type: "normal",
            },
            lang: "cpp",
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
        }
      } catch (e) {
        console.error("Error during generation:", e);
      }
    } else {
      const url = this.browserManager.getCurrentUrl();
      if (!url || !url.includes("atcoder.jp/contests/")) {
        console.error("Error: Not on an AtCoder contest page. Please navigate to a problem page.");
        return;
      }

      const match = url.match(/tasks\/([^\/?#]+)/);
      const taskId = match ? match[1] : undefined;

      if (!taskId) {
        console.error("Error: Could not extract task ID from the URL.");
        return;
      }

      console.log(`Generating main.cpp for task: ${taskId}`);

      try {
        const html = await this.browserManager.fetchRawHtml(url);
        if (!html) {
          console.error("Error: Could not get page content.");
          return;
        }

        // Pipeline
        const { multipleCases, queryType, variables, formatTree } = generateParseResult(
          html,
          taskId,
          url,
        );

        console.log("Generating C++ Code...");
        if (!formatTree) throw new Error("Format tree is undefined");

        const generator = new CPlusPlusGenerator(this.configManager);
        const code = generator.generate(formatTree, variables, multipleCases, queryType);

        fs.writeFileSync("main.cpp", code);
        console.log("Saved C++ code to main.cpp");
      } catch (e) {
        console.error("Error during generation:", e);
      }
    }
  }
}
