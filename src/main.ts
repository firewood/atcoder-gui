#!/usr/bin/env node

import * as readline from 'readline';
import { BrowserManager } from './browser.js';
import { ConfigManager, AppConfig } from './config.js';

export class AtCoderGUI {
  private browserManager: BrowserManager;
  private configManager: ConfigManager;
  private rl: readline.Interface | null = null;

  constructor() {
    this.browserManager = new BrowserManager();
    this.configManager = new ConfigManager();
  }

  /**
   * Initialize the application
   */
  async init(): Promise<void> {
    await this.browserManager.launch();

    await this.browserManager.openUrl(this.getConfig().defaultUrl || 'https://atcoder.jp');

    this,this.browserManager.closeCallback = () => {
      this.close();
    };

    console.log('AtCoder GUI initialized successfully');
  }

  /**
   * Open a URL in the browser
   */
  async openUrl(url: string): Promise<void> {
    if (!this.browserManager.isRunning()) {
      await this.init();
    }

    try {
      await this.browserManager.openUrl(url);
      console.log(`Opened URL: ${url}`);
    } catch (error) {
      console.error(`Failed to open URL ${url}:`, error);
    }
  }

  /**
   * Close the application
   */
  async close(): Promise<void> {
    if (this.rl) {
      this.rl.close();
    }
    await this.browserManager.close();
  }

  /**
   * Get the current configuration
   */
  getConfig(): AppConfig {
    return this.configManager.getConfig();
  }

  /**
   * Start interactive CLI
   */
  async startInteractiveCLI(): Promise<void> {
    // Launch browser automatically on startup
    await this.init();

    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: 'command> '
    });

    console.log('AtCoder GUI Interactive CLI');
    console.log('Type "help" for available commands or "exit" to quit');
    this.rl.prompt();

    this.rl.on('line', async (input: string) => {
      const trimmedInput = input.trim();

      if (trimmedInput === '') {
        this.rl!.prompt();
        return;
      }

      await this.handleCommand(trimmedInput);
      this.rl!.prompt();
    });

    this.rl.on('close', async () => {
      console.log('\nGoodbye!');
      await this.close();
      process.exit(0);
    });

    // Handle Ctrl+C
    process.on('SIGINT', async () => {
      console.log('\nShutting down...');
      await this.close();
      process.exit(0);
    });
  }

  /**
   * Handle CLI commands
   */
  private async handleCommand(input: string): Promise<void> {
    const args = input.split(' ').filter(arg => arg.length > 0);
    const command = args[0].toLowerCase();

    try {
      switch (command) {
        case 'open':
          if (args.length < 2) {
            console.log('Error: URL is required for open command');
            console.log('Usage: open <URL>');
            return;
          }
          await this.openUrl(args[1]);
          break;

        case 'config':
          console.log('Current configuration:');
          console.log(JSON.stringify(this.getConfig(), null, 2));
          break;

        case 'help':
          this.showHelp();
          break;

        case 'exit':
        case 'quit':
          this.rl?.close();
          break;

        default:
          console.log(`Unknown command: ${command}`);
          console.log('Type "help" for available commands');
      }
    } catch (error) {
      console.error('Error:', error);
    }
  }

  /**
   * Show help message
   */
  private showHelp(): void {
    console.log(`
Available commands:
  open <URL>      Open a URL in the browser
  config          Show current configuration
  close           Close the browser (if running)
  help            Show this help message
  exit            Exit the application

Examples:
  open https://atcoder.jp
  open https://atcoder.jp/contests/abc123
`);
  }
}

/**
 * Main function to start the interactive CLI
 */
async function main(): Promise<void> {
  const app = new AtCoderGUI();
  await app.startInteractiveCLI();
}

// Run the CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}