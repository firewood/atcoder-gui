#!/usr/bin/env node

import * as readline from "readline";
import { pathToFileURL } from "url";
import * as fs from "fs";
import { BrowserManager } from "./browser.js";
import { ConfigManager, AppConfig } from "./config.js";
import { SubmitManager } from "./submit.js";
import { CookieExporter } from "./cookie-export.js";
import { GenManager } from "./gen.js";
import { Gen2Manager } from "./gen2.js";
import { ProblemManager } from "./problem.js";
import { execSync } from "child_process";

export class AtCoderGUI {
  private browserManager: BrowserManager;
  private configManager: ConfigManager;
  private submitManager: SubmitManager;
  private cookieExporter: CookieExporter;
  private genManager: GenManager;
  private gen2Manager: Gen2Manager;
  private problemManager: ProblemManager;
  private rl: readline.Interface | null = null;

  constructor() {
    this.browserManager = new BrowserManager();
    this.configManager = new ConfigManager();
    this.submitManager = new SubmitManager(this.browserManager);
    this.cookieExporter = new CookieExporter(this.browserManager);
    this.genManager = new GenManager(this.browserManager);
    this.gen2Manager = new Gen2Manager(this.browserManager);
    this.problemManager = new ProblemManager(this.browserManager);
  }

  /**
   * Initialize the application
   */
  async init(): Promise<void> {
    await this.browserManager.launch(this.getConfig());
    const url = this.getConfig().defaultUrl || "https://atcoder.jp";
    await this.browserManager.openUrl(url);
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
      prompt: "command> ",
    });

    this.browserManager.setOnPageClose(() => {
      this.rl?.close();
    });

    console.log('Type "help" for available commands or "exit" to quit');
    this.rl.prompt();

    this.rl.on("line", async (input: string) => {
      const trimmedInput = input.trim();

      if (trimmedInput === "") {
        this.rl!.prompt();
        return;
      }

      await this.handleCommand(trimmedInput);
      this.rl!.prompt();
    });

    this.rl.on("close", async () => {
      console.log("\nGoodbye!");
      await this.close();
      process.exit(0);
    });

    // Handle Ctrl+C
    process.on("SIGINT", async () => {
      console.log("\nShutting down...");
      await this.close();
      process.exit(0);
    });
  }

  /**
   * Handle CLI commands
   */
  private async handleCommand(input: string): Promise<void> {
    const args = input.split(" ").filter((arg) => arg.length > 0);
    const command = args[0].toLowerCase();
    if (command == "") {
      return;
    }

    // Try to navigate to problem directory if command is a single letter
    if (await this.problemManager.navigateToProblem(command)) {
      return;
    }

    try {
      switch (command) {
        case "open":
          if (args.length < 2) {
            console.log("Error: URL is required for open command");
            console.log("Usage: open <URL>");
            return;
          }
          await this.openUrl(args[1]);
          break;

        case "config":
          console.log("Current configuration:");
          console.log(JSON.stringify(this.getConfig(), null, 2));
          break;

        case "help":
          this.showHelp();
          break;

        case "exit":
        case "quit":
          this.rl?.close();
          break;

        case "acc":
        case "oj":
          {
            const command_line = args.join(" ");
            try {
              execSync(command_line, { encoding: "utf-8", stdio: "inherit" });
            } catch (_) {}
          }
          break;

        case "export":
          if (args.length < 2) {
            console.log("Error: Target is required for export command");
            console.log("Usage: export <target>");
            console.log("Available targets:");
            console.log("  atcoder-tools    Export cookies to atcoder-tools cookie.txt");
            console.log("  atcoder-cli      Export cookies to atcoder-cli session.json");
            console.log("  oj               Export cookies to online-judge-tools cookie.jar");
            return;
          }

          {
            const target = args[1].toLowerCase();
            switch (target) {
              case "atcoder-tools":
                await this.cookieExporter.exportCookiesForAtCoderTools();
                break;
              case "atcoder-cli":
                await this.cookieExporter.exportCookiesForAtCoderCli();
                break;
              case "oj":
                await this.cookieExporter.exportCookiesForOj();
                break;
              default:
                console.log(`Unknown export target: ${target}`);
                console.log("Available targets: atcoder-tools, atcoder-cli, oj");
            }
          }
          break;

        case "gen":
          this.genManager.run(args);
          break;

        case "gen2":
          this.gen2Manager.run();
          break;

        case "new":
          this.genManager.runAtcoderCli(args);
          break;

        case "cp":
        case "copy":
        case "del":
        case "dir":
        case "ls":
        case "make":
        case "pwd":
        case "rm":
          {
            const command_line = args.join(" ");
            try {
              execSync(command_line, { encoding: "utf-8", stdio: "inherit" });
            } catch (_) {}
          }
          break;

        case "submit":
          if (!(await this.submitManager.submitSolution(args[1]))) {
            break;
          }
        // eslint-disable-next-line no-fallthrough
        case "test":
          {
            const testCommand = this.getConfig().testCommand;
            if (testCommand) {
              try {
                execSync(testCommand, { encoding: "utf-8", stdio: "inherit" });
              } catch (_) {}
            } else {
              console.log("Error: testCommand is not configured in config.json5");
            }
          }
          break;

        case "cd":
          {
            const dir = args.length < 2 ? this.getConfig().workspaceDir : args[1];
            try {
              process.chdir(dir);
              console.log(`Current directory: ${process.cwd()}`);
            } catch (err) {
              console.error(`Error changing directory: ${err}`);
            }
          }
          break;

        default:
          console.log(`Unknown command: ${command}`);
          console.log('Type "help" for available commands');
      }
    } catch (error) {
      console.error("Error:", error);
    }
  }

  /**
   * Show help message
   */
  private showHelp(): void {
    console.log(`
Available commands:
  open <URL>           Open a URL in the browser
  config               Show current configuration
  submit <filename>    Submit solution to AtCoder
  gen <contest-id>     Generate sample cases using atcoder-tools
  gen2                 Generate main.cpp from current problem page
  new <contest-id>     Generate sample cases using atcoder-cli
  make <args>          Execute make command
  test                 Execute test command
  export <target>      Export data to external tools
  cd <directory>       Change current directory
  close                Close the browser (if running)
  help                 Show this help message
  exit                 Exit the application

Export targets:
  atcoder-tools        Export browser cookies to atcoder-tools cookie.txt
  atcoder-cli          Export browser cookies to atcoder-cli session.json
  oj                   Export browser cookies to online-judge-tools cookie.jar

Examples:
  open https://atcoder.jp
  open https://atcoder.jp/contests/abc123
  submit               (run from atcoder-tools directory)
  gen https://atcoder.jp/contests/abc123/tasks/abc123_a
  export atcoder-tools (export REVEL_FLASH and REVEL_SESSION cookies)
  export atcoder-cli   (export cookies to atcoder-cli session.json)
  export oj            (export cookies to online-judge-tools)
`);
  }
}

/**
 * Main function to start the interactive CLI
 */
async function ui_main(): Promise<void> {
  const app = new AtCoderGUI();
  await app.startInteractiveCLI();
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const configManager = new ConfigManager();

  if (args.includes("version") || args.includes("--version") || args.includes("-v")) {
    console.log(configManager.getVersion());
    return;
  }

  if (args.includes("config-dir") || args.includes("--config-dir")) {
    console.log(configManager.getConfigDirPath());
    return;
  }

  await ui_main();
}

// Run the CLI if this file is executed directly
if (import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
