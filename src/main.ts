#!/usr/bin/env node

import * as readline from "readline";
import { pathToFileURL } from "url";
import * as fs from "fs";
import * as path from "path";
import { BrowserManager } from "./browser.js";
import { ConfigManager, AppConfig } from "./config.js";
import { SubmitManager } from "./submit.js";
import { CookieExporter } from "./cookie-export.js";
import { GenManager } from "./gen.js";
import { BuildManager } from "./build.js";
import { TestManager } from "./test.js";
import { ProblemManager } from "./problem.js";
import { expandHomeDir, compactHomeDir, logError, getSourceFilename } from "./utils.js";
import { execSync } from "child_process";

export class AtCoderGUI {
  private browserManager: BrowserManager;
  private configManager: ConfigManager;
  private submitManager: SubmitManager;
  private cookieExporter: CookieExporter;
  private genManager: GenManager;
  private buildManager: BuildManager;
  private testManager: TestManager;
  private problemManager: ProblemManager;
  private rl: readline.Interface | null = null;

  constructor() {
    this.browserManager = new BrowserManager();
    this.configManager = new ConfigManager(true);
    this.submitManager = new SubmitManager(this.browserManager);
    this.cookieExporter = new CookieExporter(this.browserManager);
    this.genManager = new GenManager(this.browserManager, this.configManager);
    this.buildManager = new BuildManager(this.configManager);
    this.testManager = new TestManager(this.configManager, this.buildManager);
    this.problemManager = new ProblemManager(this.browserManager, this.configManager);
  }

  /**
   * Initialize the application
   */
  async init(): Promise<void> {
    try {
      await this.browserManager.launch(this.getConfig());
      const url = this.getConfig().defaultUrl || "https://atcoder.jp";
      await this.browserManager.openUrl(url);
    } catch (error) {
      console.warn("Warning: Failed to launch browser. Some commands may not work.", error);
    }
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
      logError(`open URL: ${url}`, error);
    }
  }

  /**
   * Close the application
   */
  async close(): Promise<void> {
    this.rl?.close();
    this.rl = null;
    await this.browserManager.close();
  }

  /**
   * Get the current configuration
   */
  getConfig(): AppConfig {
    return this.configManager.getConfig();
  }

  /**
   * Check if it is the first launch and prompt for settings if needed
   */
  async checkFirstLaunch(): Promise<void> {
    const config = this.configManager.getConfig();
    if (!config.language || !config.workspaceDir) {
      console.log("Welcome to AtCoder GUI!");
      console.log("It seems like this is your first launch or configuration is incomplete.");

      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });

      try {
        const lang = await this.promptLanguage(rl);
        const workspaceDir = await this.promptWorkspaceDir(rl);
        this.configManager.setupUserConfig(lang, workspaceDir);
      } finally {
        rl.close();
      }
    }
  }

  private async promptLanguage(rl: readline.Interface): Promise<string> {
    return new Promise((resolve) => {
      const ask = () => {
        rl.question("Choose your default language (cpp/python) [cpp]: ", (answer) => {
          const lang = answer.trim().toLowerCase() || "cpp";
          if (lang === "cpp" || lang === "python") {
            resolve(lang);
          } else {
            console.log("Please enter 'cpp' or 'python'.");
            ask();
          }
        });
      };
      ask();
    });
  }

  private async promptWorkspaceDir(rl: readline.Interface): Promise<string> {
    return new Promise((resolve) => {
      rl.question("Enter your workspace directory [~/atcoder]: ", (answer) => {
        const dir = answer.trim() || "~/atcoder";
        resolve(dir);
      });
    });
  }

  /**
   * Start interactive CLI
   */
  async startInteractiveCLI(): Promise<void> {
    await this.checkFirstLaunch();

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

    const workspaceDir = this.getConfig().workspaceDir;
    if (workspaceDir) {
      process.chdir(expandHomeDir(workspaceDir));
      console.log(`Current directory: ${compactHomeDir(process.cwd())}`);
    }

    console.log('Type "help" for available commands or "exit" to quit');
    this.rl.prompt();

    this.rl.on("line", async (input: string) => {
      const trimmedInput = input.trim();

      if (trimmedInput === "") {
        this.rl!.prompt();
        return;
      }

      await this.handleCommand(trimmedInput);
      this.rl?.prompt();
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
   * Setup VSCode configuration files in the workspace directory
   */
  async setupVsCode(): Promise<void> {
    const workspaceDir = this.getConfig().workspaceDir;
    if (!workspaceDir) {
      logError("workspaceDir is not set in config");
      return;
    }

    const expandedDir = expandHomeDir(workspaceDir);
    const packageRoot = this.configManager.getPackageRoot();
    const language = this.getConfig().language || "cpp";
    const vscodeTemplateDir = path.join(packageRoot, "vscode-project-files", language, ".vscode");
    const targetVscodeDir = path.join(expandedDir, ".vscode");
    const codeFilename = getSourceFilename(language);

    if (fs.existsSync(vscodeTemplateDir)) {
      if (!fs.existsSync(targetVscodeDir)) {
        fs.mkdirSync(targetVscodeDir, { recursive: true });
      }
      fs.cpSync(vscodeTemplateDir, targetVscodeDir, { recursive: true });
      console.log(`Copied VSCode templates to ${targetVscodeDir}`);

      if (language === "python") {
        this.setupPythonProject(expandedDir);
      }

      // Set process commands in config
      this.configManager.set("preProcess", {
        execOnEachProblemDir: `cp -a ${workspaceDir}/.vscode .`,
      });
      this.configManager.set("postProcess", {
        execOnEachProblemDir: "cp in_1.txt in.txt",
      });
      this.configManager.set("onEnter", {
        execOnEachProblemDir: `code -r . && code ${codeFilename}`,
      });
      console.log("Updated config with preProcess, postProcess, and onEnter commands");
    } else {
      logError(`VSCode template directory not found at ${vscodeTemplateDir}`);
    }
  }

  /**
   * Initialize a uv project in the workspace if pyproject.toml is missing.
   * Subdirectory `uv run` invocations walk up to this pyproject.toml.
   */
  private setupPythonProject(workspaceDir: string): void {
    const pyprojectPath = path.join(workspaceDir, "pyproject.toml");
    if (fs.existsSync(pyprojectPath)) {
      console.log(`pyproject.toml already exists at ${pyprojectPath}, skipping uv init`);
      return;
    }

    try {
      console.log(`Initializing uv project in ${workspaceDir}...`);
      execSync("uv init", { cwd: workspaceDir, stdio: "inherit" });
      execSync("uv add numpy scipy ac-library-python", { cwd: workspaceDir, stdio: "inherit" });
      console.log("Initialized Python project (numpy, scipy, ac-library-python)");
    } catch (error) {
      logError("Failed to initialize uv project. Ensure 'uv' is installed and on PATH.", error);
    }
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

    switch (command) {
      case "open":
        if (args.length < 2) {
          logError("URL is required for open command");
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

      case "setup-vscode":
        await this.setupVsCode();
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

      case "build":
        await this.buildManager.run(args);
        break;

      case "gen":
        await this.genManager.run(args);
        break;

      case "su":
      case "sub":
      case "subm":
      case "submi":
      case "submit":
        if (!(await this.submitManager.submitSolution(args[1]))) {
          break;
        }
      // eslint-disable-next-line no-fallthrough
      case "te":
      case "tes":
      case "test":
        await this.testManager.run(args);
        break;

      case "cd":
        {
          const dir = args.length >= 2 ? args[1] : this.getConfig().workspaceDir || "~";
          const expandedDir = expandHomeDir(dir);
          try {
            process.chdir(expandedDir);
            const currentDir = process.cwd();
            console.log(`Current directory: ${compactHomeDir(currentDir)}`);
            await this.problemManager.onProblemDirectoryEnter(currentDir);
          } catch (err) {
            logError("changing directory", err);
          }
        }
        break;

      default:
        if (this.getConfig().allowedCommands?.includes(command)) {
          const command_line = args.join(" ");
          try {
            execSync(command_line, { encoding: "utf-8", stdio: "inherit" });
          } catch (_) {}
        } else {
          logError(`Unknown command: ${command}`);
          console.log('Type "help" for available commands');
        }
        break;
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
  setup-vscode         Setup VSCode configuration files in the workspace directory
  submit <filename>    Submit solution to AtCoder
  gen <contest-id>     Generate source code from current problem page or contest ID
  make <args>          Execute make command
  test                 Execute test command
  build                Build the source code specified in metadata.json
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
async function ui_main(app: AtCoderGUI): Promise<void> {
  await app.startInteractiveCLI();
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const configManager = new ConfigManager(true);

  if (args.includes("version") || args.includes("--version") || args.includes("-v")) {
    console.log(configManager.getVersion());
    return;
  }

  if (args.includes("config-dir") || args.includes("--config-dir")) {
    console.log(configManager.getConfigDirPath());
    return;
  }

  const app = new AtCoderGUI();

  if (args[0] === "setup-vscode") {
    await app.checkFirstLaunch();
    await app.setupVsCode();
    return;
  }

  await ui_main(app);
}

// Run the CLI if this file is executed directly
if (import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1])).href) {
  main().catch((error) => {
    logError("fatal error", error);
    process.exit(1);
  });
}
