import * as fs from "fs";
import { execSync } from "child_process";
import { ConfigManager } from "./config.js";
import { BuildManager } from "./build.js";
import { AtCoderToolsMetadata } from "./types.js";
import { logError, logSuccess } from "./utils.js";

export class TestManager {
  private configManager: ConfigManager;
  private buildManager: BuildManager;

  constructor(configManager: ConfigManager, buildManager: BuildManager) {
    this.configManager = configManager;
    this.buildManager = buildManager;
  }

  private compareOutputs(actual: string, expected: string, judgeType: string, errorTolerance: number = 1e-6): boolean {
    const actualTokens = actual.split(/\s+/).filter((t) => t.length > 0);
    const expectedTokens = expected.split(/\s+/).filter((t) => t.length > 0);

    if (actualTokens.length !== expectedTokens.length) {
      return false;
    }

    for (let i = 0; i < actualTokens.length; i++) {
      const actualToken = actualTokens[i];
      const expectedToken = expectedTokens[i];

      if (judgeType === "decimal") {
        const actualNum = parseFloat(actualToken);
        const expectedNum = parseFloat(expectedToken);

        if (!isNaN(actualNum) && !isNaN(expectedNum)) {
          const diff = Math.abs(actualNum - expectedNum);
          const relativeDiff = expectedNum === 0 ? diff : diff / Math.abs(expectedNum);
          if (diff > errorTolerance && relativeDiff > errorTolerance) {
            return false;
          }
          continue;
        }
      }

      if (actualToken !== expectedToken) {
        return false;
      }
    }

    return true;
  }

  async run(args: string[]): Promise<void> {
    if (!fs.existsSync("metadata.json")) {
      logError("metadata.json not found in the current directory.");
      return;
    }

    // Run build before testing
    const buildSuccess = await this.buildManager.run(args);
    if (!buildSuccess) {
      return;
    }

    try {
      const metadata: AtCoderToolsMetadata = JSON.parse(fs.readFileSync("metadata.json", "utf-8"));
      const codeFilename = metadata.code_filename;
      const timeoutMs = metadata.timeout_ms;

      if (!codeFilename) {
        logError("code_filename not found in metadata.json");
        return;
      }

      let execCommand = "";
      const runCommand = this.configManager.get("runCommand");

      if (codeFilename.endsWith(".py")) {
        const pythonRunCommand = runCommand?.python;
        if (pythonRunCommand) {
          execCommand = pythonRunCommand.replace("main.py", codeFilename);
        } else {
          execCommand = `python3 ${codeFilename}`;
        }
      } else if (codeFilename.endsWith(".cpp")) {
        const cppRunCommand = runCommand?.cpp;
        if (cppRunCommand) {
          execCommand = cppRunCommand;
        } else {
          execCommand = process.platform === "win32" ? "main" : "./main";
        }
      } else {
        console.log(`Testing not supported for ${codeFilename}`);
        return;
      }

      const files = fs.readdirSync(".");
      const inputFiles = files.filter((f) => /^in_.+\.txt$/.test(f)).sort();

      if (inputFiles.length === 0) {
        console.log("No test cases (in_?.txt) found.");
        return;
      }

      let passedCount = 0;
      let totalCount = 0;

      for (const inFile of inputFiles) {
        const testId = inFile.match(/^in_(.+)\.txt$/)?.[1];
        const outFile = `out_${testId}.txt`;

        if (!fs.existsSync(outFile)) {
          console.warn(`Warning: Output file ${outFile} not found for ${inFile}. Skipping.`);
          continue;
        }

        totalCount++;
        const input = fs.readFileSync(inFile, "utf-8");
        const expectedOutput = fs.readFileSync(outFile, "utf-8").trim();

        try {
          const stdout = execSync(execCommand, {
            input: input,
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "inherit"],
            timeout: timeoutMs,
          }).trim();

          if (this.compareOutputs(stdout, expectedOutput, metadata.judge?.judge_type, metadata.judge?.diff)) {
            console.log(`# ${inFile} ... \x1b[32mPASSED\x1b[0m`);
            passedCount++;
          } else {
            console.log(`# ${inFile} ... \x1b[31mWA\x1b[0m`);
            console.log("\x1b[95m[Input]\x1b[0m");
            console.log(input.trim());
            console.log("\x1b[95m[Expected]\x1b[0m");
            console.log(expectedOutput);
            console.log("\x1b[95m[Received]\x1b[0m");
            console.log(stdout);
            console.log("");
          }
        } catch (error: any) {
          if (error.code === "ETIMEDOUT" || error.signal === "SIGTERM") {
            console.log(`# ${inFile} ... \x1b[33mTLE\x1b[0m`);
          } else {
            console.log(`# ${inFile} ... \x1b[33mRE\x1b[0m`);
            if (error.stderr) {
              logError("Runtime error output:", error.stderr);
            }
          }
        }
      }

      if (passedCount === totalCount) {
        logSuccess("Passed all test cases!!!");
      } else {
        logError(`Some cases FAILED (passed ${passedCount} of ${totalCount})`);
      }
    } catch (error) {
      logError("Error reading or parsing metadata.json:", error);
    }
  }
}
