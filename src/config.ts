import JSON5 from "json5";
import { modify, applyEdits, parse as parseJsonc, ParseError } from "jsonc-parser";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { FileStore } from "./file-store.js";
import { expandHomeDir } from "./utils.js";
const require = createRequire(import.meta.url);

const { version } = require("../package.json");

const __dirname = dirname(fileURLToPath(import.meta.url));

const FORMATTING = {
  formattingOptions: { tabSize: 2, insertSpaces: true },
};

export interface AppConfig {
  theme?: "light" | "dark";
  defaultUrl?: string;
  windowSize?: {
    width: number;
    height: number;
  };
  workspaceDir?: string;
  language?: string;
  buildCommand?: {
    cpp?: string;
  };
  runCommand?: {
    python?: string;
    cpp?: string;
  };
  allowedCommands?: string[];
  createContestDirectory?: boolean;
  preProcess?: {
    execOnEachProblemDir?: string;
  };
  postProcess?: {
    execOnEachProblemDir?: string;
  };
  onEnter?: {
    execOnEachProblemDir?: string;
  };
}

export class ConfigManager extends FileStore<AppConfig> {
  private templateSource: string;
  private userConfigEnabled: boolean;

  constructor(useUserConfig: boolean = false, cwd?: string) {
    const templatePath = join(__dirname, "config.json5");
    const templateSource = readFileSync(templatePath, "utf-8");
    const defaults = (JSON5.parse(templateSource) ?? {}) as AppConfig;

    super("config.json5", defaults, useUserConfig, cwd);
    this.templateSource = templateSource;
    this.userConfigEnabled = useUserConfig;
  }

  /**
   * Initialize user config file with default template and specified settings
   */
  public setupUserConfig(language: string, workspaceDir: string): void {
    try {
      this.set("language", language);
      this.set("workspaceDir", workspaceDir);
      console.log(`Config file created at: ${this.path}`);

      const expandedDir = expandHomeDir(workspaceDir);
      if (!existsSync(expandedDir)) {
        mkdirSync(expandedDir, { recursive: true });
        console.log(`Created workspace directory at: ${expandedDir}`);
      }

      const configDir = dirname(this.path);
      const languageFiles = [
        { src: join(__dirname, "generator/config/cpp.json5"), dest: "cpp.json5" },
        { src: join(__dirname, "generator/config/python.json5"), dest: "python.json5" },
        { src: join(__dirname, "generator/templates/cpp.njk"), dest: "cpp.njk" },
        { src: join(__dirname, "generator/templates/python.njk"), dest: "python.njk" },
      ];

      for (const { src, dest } of languageFiles) {
        if (existsSync(src)) {
          const destPath = join(configDir, dest);
          if (!existsSync(destPath)) {
            writeFileSync(destPath, readFileSync(src));
            console.log(`Template created at: ${destPath}`);
          }
        }
      }
    } catch (error) {
      console.warn("Failed to initialize user config file:", error);
    }
  }

  getConfig(): AppConfig {
    return this.store;
  }

  setMultiple(config: Partial<AppConfig>): void {
    for (const [key, value] of Object.entries(config)) {
      this.set(key as keyof AppConfig, value as AppConfig[keyof AppConfig]);
    }
  }

  clear(): void {
    this.store = (JSON5.parse(this.templateSource) ?? {}) as AppConfig;
    this.atomicWrite(this.templateSource);
  }

  getConfigPath(): string {
    return this.path;
  }

  getConfigDirPath(): string {
    return dirname(this.path);
  }

  getSize(): number {
    return Object.keys(this.store).length;
  }

  isUserConfigEnabled(): boolean {
    return this.userConfigEnabled;
  }

  getVersion(): string {
    return version;
  }

  getPackageRoot(): string {
    return dirname(__dirname);
  }

  protected deserialize(text: string): Partial<AppConfig> {
    return JSON5.parse(text) as Partial<AppConfig>;
  }

  protected persist(key: string, value: unknown): void {
    let source: string;
    if (existsSync(this.path)) {
      source = readFileSync(this.path, "utf-8");
      // If existing file isn't valid JSONC (e.g., legacy unquoted keys),
      // rebuild from template with all current store values applied.
      const errors: ParseError[] = [];
      parseJsonc(source, errors, { allowTrailingComma: true });
      if (errors.length > 0) {
        source = this.renderFromTemplate();
      }
    } else {
      source = this.templateSource;
    }

    const edits = modify(source, [key], value, FORMATTING);
    const next = applyEdits(source, edits);
    this.atomicWrite(next);
  }

  private renderFromTemplate(): string {
    let s = this.templateSource;
    for (const [k, v] of Object.entries(this.store)) {
      if (v === undefined) continue;
      const edits = modify(s, [k], v, FORMATTING);
      s = applyEdits(s, edits);
    }
    return s;
  }
}
