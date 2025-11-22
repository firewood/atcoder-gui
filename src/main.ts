#!/usr/bin/env node

import { BrowserManager } from './browser.js';
import { ConfigManager } from './config.js';

export class AtCoderGUI {
  private browserManager: BrowserManager;
  private configManager: ConfigManager;

  constructor() {
    this.browserManager = new BrowserManager();
    this.configManager = new ConfigManager();
  }

  /**
   * Initialize the application
   */
  async init(): Promise<void> {
    await this.browserManager.launch();
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
      throw error;
    }
  }

  /**
   * Close the application
   */
  async close(): Promise<void> {
    await this.browserManager.close();
    console.log('AtCoder GUI closed');
  }

  /**
   * Get the current configuration
   */
  getConfig(): unknown {
    return this.configManager.getConfig();
  }
}

/**
 * Parse command line arguments and execute commands
 */
async function parseAndExecuteCommand(): Promise<void> {
  const args = process.argv.slice(2);
  const app = new AtCoderGUI();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down...');
    await app.close();
    process.exit(0);
  });

  try {
    if (args.length === 0) {
      // No arguments - show help
      showHelp();
      return;
    }

    const command = args[0].toLowerCase();

    switch (command) {
      case 'open':
        if (args.length < 2) {
          console.error('Error: URL is required for open command');
          console.error('Usage: atcoder-gui open <URL>');
          process.exit(1);
        }
        await app.openUrl(args[1]);
        break;

      case 'config':
        console.log('Current configuration:');
        console.log(JSON.stringify(app.getConfig(), null, 2));
        await app.close();
        break;

      case 'help':
      case '--help':
      case '-h':
        showHelp();
        break;

      default:
        console.error(`Unknown command: ${command}`);
        showHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error);
    await app.close();
    process.exit(1);
  }
}

/**
 * Show help message
 */
function showHelp(): void {
  console.log(`
AtCoder GUI - Browser automation tool for AtCoder

Usage:
  atcoder-gui open <URL>    Open a URL in the browser
  atcoder-gui config        Show current configuration
  atcoder-gui help          Show this help message

Examples:
  atcoder-gui open https://atcoder.jp
  atcoder-gui open https://atcoder.jp/contests/abc123

Options:
  -h, --help                Show help
`);
}

// Run the CLI if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  parseAndExecuteCommand();
}