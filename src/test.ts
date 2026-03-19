import * as fs from "fs";
import { execSync } from "child_process";
import { ConfigManager } from "./config.js";
import { BuildManager } from "./build.js";

export class TestManager {
  private configManager: ConfigManager;
  private buildManager: BuildManager;

  constructor(configManager: ConfigManager, buildManager: BuildManager) {
    this.configManager = configManager;
    this.buildManager = buildManager;
  }

  async run(args: string[]): Promise<void> {
    if (!fs.existsSync("metadata.json")) {
      console.error("Error: metadata.json not found in the current directory.");
      return;
    }

    // Run build before testing
    await this.buildManager.run(args);

    try {
      const metadata: any = JSON.parse(fs.readFileSync("metadata.json", "utf-8"));
      const codeFilename = metadata.code_filename;
      const timeoutMs = metadata.timeout_ms;

      if (!codeFilename) {
        console.error("Error: code_filename not found in metadata.json");
        return;
      }

      let execCommand = "";
      if (codeFilename.endsWith(".cpp")) {
        execCommand = process.platform === "win32" ? "main" : "./main";
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

      for (const inFile of inputFiles) {
        const testId = inFile.match(/^in_(.+)\.txt$/)?.[1];
        const outFile = `out_${testId}.txt`;

        if (!fs.existsSync(outFile)) {
          console.warn(`Warning: Output file ${outFile} not found for ${inFile}. Skipping.`);
          continue;
        }

        const input = fs.readFileSync(inFile, "utf-8");
        const expectedOutput = fs.readFileSync(outFile, "utf-8").trim();

        try {
          const stdout = execSync(execCommand, {
            input: input,
            encoding: "utf-8",
            stdio: ["pipe", "pipe", "inherit"],
            timeout: timeoutMs,
          }).trim();

          if (stdout === expectedOutput) {
            console.log(`# ${inFile} ... \x1b[32mPASSED\x1b[0m`);
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
              console.error(error.stderr);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error reading or parsing metadata.json:", error);
    }
  }
}
