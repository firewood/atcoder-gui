import { execSync } from 'child_process';

export class GenManager {
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
    } catch (_) {
      ;
    }
  }
}
