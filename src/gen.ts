import { execSync } from 'child_process';

export class GenManager {
  /**
   * Check if atcoder-tools is installed
   */
  isAtCoderToolsInstalled(): boolean {
    try {
      execSync('atcoder-tools version', { stdio: 'ignore' });
      return true;
    } catch (error) {
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
      const output = execSync(command_line, { encoding: 'utf-8' });
      console.log(output);
    } catch (error) {
      // Don't log the error object itself, as it might contain sensitive information
      // or be too verbose. The command's output to stderr is usually sufficient.
      console.error(`Error executing 'atcoder-tools ${args.join(' ')}'`);
    }
  }
}
