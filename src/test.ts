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

      if (!codeFilename) {
        console.error("Error: code_filename not found in metadata.json");
        return;
      }

      let execCommand = "";
      if (codeFilename.endsWith(".cpp")) {
        execCommand = "./main";
      } else {
        console.log(`Testing not supported for ${codeFilename}`);
        return;
      }

      const files = fs.readdirSync(".");
      const inputFiles = files.filter(f => /^in_.+\.txt$/.test(f)).sort();

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
            stdio: ["pipe", "pipe", "inherit"]
          }).trim();

          if (stdout === expectedOutput) {
            console.log(`${inFile}: \x1b[32mPASSED\x1b[0m`);
          } else {
            console.log(`${inFile}: \x1b[31mFAILED\x1b[0m`);
            console.log("Expected:");
            console.log(expectedOutput);
            console.log("Actual:");
            console.log(stdout);
          }
        } catch (error: any) {
          console.log(`${inFile}: \x1b[31mFAILED\x1b[0m (Execution Error)`);
          if (error.stderr) {
            console.error(error.stderr);
          }
        }
      }
    } catch (error) {
      console.error("Error reading or parsing metadata.json:", error);
    }
  }
}
