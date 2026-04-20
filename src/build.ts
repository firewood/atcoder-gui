import * as fs from "fs";
import { execSync } from "child_process";
import { ConfigManager } from "./config.js";

export class BuildManager {
  private configManager: ConfigManager;

  constructor(configManager: ConfigManager) {
    this.configManager = configManager;
  }

  async run(_args: string[]): Promise<boolean> {
    if (!fs.existsSync("metadata.json")) {
      console.error("Error: metadata.json not found in the current directory.");
      return false;
    }

    try {
      const metadata: any = JSON.parse(fs.readFileSync("metadata.json", "utf-8"));
      const codeFilename = metadata.code_filename;

      if (!codeFilename) {
        console.error("Error: code_filename not found in metadata.json");
        return false;
      }

      if (codeFilename.endsWith(".py")) {
        // needless to build
        return true;
      } else if (codeFilename.endsWith(".cpp")) {
        const buildCommand =
          this.configManager.getConfig().buildCommand?.cpp || "g++ -O3 -std=c++23 -DNDEBUG main.cpp -o main";
        console.log(`Executing build command: ${buildCommand}`);
        try {
          execSync(buildCommand, { encoding: "utf-8", stdio: "inherit" });
          return true;
        } catch (_) {
          return false;
        }
      } else {
        console.log(`Build not supported for ${codeFilename}`);
        return true;
      }
    } catch (error) {
      console.error("Error reading or parsing metadata.json:", error);
      return false;
    }
  }
}
