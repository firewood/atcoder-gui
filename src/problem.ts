import * as fs from "fs";
import * as path from "path";
import { BrowserManager } from "./browser.js";
import { AtCoderCliContestConfig, AtCoderToolsMetadata } from "./types.js";
import { ConfigManager } from "./config.js";
import { executeCommand } from "./utils.js";

export class ProblemManager {
  private browserManager: BrowserManager;
  private configManager: ConfigManager;

  constructor(browserManager: BrowserManager, configManager: ConfigManager) {
    this.browserManager = browserManager;
    this.configManager = configManager;
  }

  /**
   * Actions to perform when entering a problem directory.
   * Checks for metadata, executes configured commands, and opens problem URL.
   * @param dir The directory being entered
   * @returns Promise<boolean> True if it was recognized as a problem directory
   */
  async onProblemDirectoryEnter(dir: string): Promise<boolean> {
    const absoluteDir = path.resolve(dir);
    const problemId = path.basename(absoluteDir);
    const parentDir = path.dirname(absoluteDir);

    // atcoder-tools
    {
      const metadataFilename = path.join(absoluteDir, "metadata.json");
      if (fs.existsSync(metadataFilename)) {
        try {
          const metadata: AtCoderToolsMetadata = JSON.parse(fs.readFileSync(metadataFilename, "utf-8"));
          const problem = metadata.problem;
          executeCommand(this.configManager.getConfig().onEnter?.execOnEachProblemDir, absoluteDir);
          this.browserManager.openUrl(
            `https://atcoder.jp/contests/${problem.contest.contest_id}/tasks/${problem.problem_id}`,
          );
          return true;
        } catch (_) {
          // Ignore parse errors and continue to check other formats
        }
      }
    }

    // atcoder-cli
    {
      const metadataFilename = path.join(parentDir, "contest.acc.json");
      if (fs.existsSync(metadataFilename)) {
        try {
          const metadata: AtCoderCliContestConfig = JSON.parse(fs.readFileSync(metadataFilename, "utf-8"));
          for (const task of metadata.tasks) {
            if (task.directory?.path === problemId) {
              executeCommand(this.configManager.getConfig().onEnter?.execOnEachProblemDir, absoluteDir);
              this.browserManager.openUrl(task.url);
              return true;
            }
          }
        } catch (_) {
          // Ignore parse errors
        }
      }
    }

    return false;
  }

  /**
   * Navigate to problem directory and open problem page if valid
   * Returns true if successful navigation occurred
   */
  async navigateToProblem(command: string): Promise<boolean> {
    // 1 char: a-z, 2 chars: aa-bz
    if (!/^[a-z]$|^[ab][a-z]$/i.test(command)) {
      return false;
    }

    // Look for problem directory in current directory and parent directory
    for (const searchPath of [".", ".."]) {
      for (const problem_id of [command.toLowerCase(), command.toUpperCase()]) {
        const problem_dir = path.join(searchPath, problem_id);
        if (fs.existsSync(problem_dir)) {
          // Check if it's a valid problem directory by attempting to "enter" it
          // We check for metadata files existence before chdir to be safe
          const metadataTools = path.join(problem_dir, "metadata.json");
          const metadataCli = path.join(searchPath, "contest.acc.json");

          let isValid = fs.existsSync(metadataTools);
          if (!isValid && fs.existsSync(metadataCli)) {
            const cliMetadata: AtCoderCliContestConfig = JSON.parse(fs.readFileSync(metadataCli, "utf-8"));
            isValid = cliMetadata.tasks.some((t) => t.directory?.path === problem_id);
          }

          if (isValid) {
            process.chdir(problem_dir);
            console.log(`Current directory: ${process.cwd()}`);
            await this.onProblemDirectoryEnter(process.cwd());
            return true;
          }
        }
      }
    }
    return false;
  }
}
