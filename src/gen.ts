import * as fs from 'fs';
import { execSync } from 'child_process';
import { BrowserManager } from './browser';

export class GenManager {
  private browserManager: BrowserManager;

  constructor(browserManager: BrowserManager) {
    this.browserManager = browserManager;
  }

  /**
   * Check if atcoder-tools is installed
   */
  isAtCoderToolsInstalled(): boolean {
    try {
      execSync('atcoder-tools version', { stdio: 'ignore' });
      return true;
    } catch (_) {
      return false;
    }
  }

  /**
   * Run atcoder-tools gen command
   */
  run(args: string[]): void {
    if (!this.isAtCoderToolsInstalled()) {
      console.error('Error: atcoder-tools command not found.');
      console.error('Please install atcoder-tools and ensure it is in your PATH.');
      return;
    }

    try {
      const command_line = 'atcoder-tools ' + args.join(' ');
      execSync(command_line, { encoding: 'utf-8', stdio: 'inherit' });

      const contest_id = args[1].match(/^\w+\d+$/)?.[0];
      if (contest_id) {
        const url = `https://atcoder.jp/contests/${contest_id}`;
        // avoid 429 error
        setTimeout(() => {
          this.browserManager.openUrl(url);
        }, 250);

        if (fs.existsSync(contest_id)) {
            process.chdir(contest_id);
        }
      }
    } catch (_) {
      ;
    }
  }
}
