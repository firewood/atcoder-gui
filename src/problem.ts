import * as fs from 'fs';
import * as path from 'path';
import { BrowserManager } from './browser.js';
import { AtCoderCliContestConfig, AtCoderToolsMetadata } from './types.js';

export class ProblemManager {
  private browserManager: BrowserManager;

  constructor(browserManager: BrowserManager) {
    this.browserManager = browserManager;
  }

  /**
   * Navigate to problem directory and open problem page if valid
   * Returns true if successful navigation occurred
   */
  async navigateToProblem(command: string): Promise<boolean> {
    // Only handle single alphabetic characters
    if (command.length !== 1 || !/^[a-zA-Z]$/.test(command)) {
      return false;
    }

    // Look for problem directory in current directory and parent directory
    for (const searchPath of ['.', '..']) {
      for (const problem_id of [command.toLowerCase(), command.toUpperCase()]) {
        const problem_dir = path.join(searchPath, problem_id);
        if (fs.existsSync(problem_dir)) {
          // atcoder-tools
          {
            const metadataFilename = path.join(problem_dir, 'metadata.json');
            if (fs.existsSync(metadataFilename)) {
              const metadata: AtCoderToolsMetadata = JSON.parse(fs.readFileSync(metadataFilename, 'utf-8'));
              const problem = metadata.problem;
              process.chdir(problem_dir);
              console.log(`Current directory: ${process.cwd()}`);
              this.browserManager.openUrl(`https://atcoder.jp/contests/${problem.contest.contest_id}/tasks/${problem.problem_id}`);
              return true;
            }
          }
          // atcoder-cli
          {
            const metadataFilename = path.join(searchPath, 'contest.acc.json');
            if (fs.existsSync(metadataFilename)) {
              const metadata: AtCoderCliContestConfig = JSON.parse(fs.readFileSync(metadataFilename, 'utf-8'));
              for (const task of metadata.tasks) {
                if (task.directory?.path == problem_id) {
                  process.chdir(problem_dir);
                  console.log(`Current directory: ${process.cwd()}`);
                  this.browserManager.openUrl(task.url);
                  return true;
                }
              }
            }
          }
        }
      }
    }
    return false;
  }
}
