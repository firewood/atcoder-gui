import * as fs from "fs";
import { execSync } from "child_process";
import { ConfigManager } from "./config.js";

export class BuildManager {
  private configManager: ConfigManager;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }

  async run(_args: string[]): Promise<void> {
    if (!fs.existsSync("metadata.json")) {
      console.error("Error: metadata.json not found in the current directory.");
      return;
    }

    try {
      const metadata: any = JSON.parse(fs.readFileSync("metadata.json", "utf-8"));
      const codeFilename = metadata.code_filename;

      if (!codeFilename) {
        console.error("Error: code_filename not found in metadata.json");
        return;
      }

      if (codeFilename.endsWith(".cpp")) {
        const buildCommand =
          this.configManager.getConfig().build_command_cpp ||
          "g++ -O3 -std=c++23 -DNDEBUG main.cpp -o main";
        console.log(`Executing build command: ${buildCommand}`);
        try {
          execSync(buildCommand, { encoding: "utf-8", stdio: "inherit" });
        } catch (_) {}
      } else {
        console.log(`Build not supported for ${codeFilename}`);
      }
    } catch (error) {
      console.error("Error reading or parsing metadata.json:", error);
    }
  }
}
