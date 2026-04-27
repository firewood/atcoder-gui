import Conf from "conf";
import JSON5 from "json5";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import os from "os";
const require = createRequire(import.meta.url);
const { version } = require("../package.json");

const __dirname = dirname(fileURLToPath(import.meta.url));

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

export class ConfigManager {
  private conf: Conf<AppConfig>;
  private userConfigEnabled: boolean;

  constructor(useUserConfig: boolean = false) {
    this.userConfigEnabled = useUserConfig;

    // Read default config.json5 template for defaults
    const defaultTemplatePath = join(__dirname, "config.json5");
    const defaultTemplate = readFileSync(defaultTemplatePath, "utf-8");
    const defaults = JSON5.parse(defaultTemplate);

    this.conf = new Conf<AppConfig>({
      projectName: "atcoder-gui",
      projectVersion: version,
      configName: "config",
      fileExtension: "json5",
      serialize: (value: AppConfig): string => JSON5.stringify(value, null, 2),
      deserialize: (text: string): AppConfig => JSON5.parse(text),
      defaults,
      cwd: useUserConfig ? undefined : os.tmpdir(),
    });
  }

  /**
   * Initialize user config file with default template and specified settings
   */
  public setupUserConfig(language: string, workspaceDir: string): void {
    try {
      // Set settings which will automatically trigger save by 'conf' library
      this.conf.set("language", language);
      this.conf.set("workspaceDir", workspaceDir);
      console.log(`Config file created at: ${this.conf.path}`);

      // Copy language-specific configs and templates
      const configDir = dirname(this.conf.path);
      const languageFiles = [
        { src: join(__dirname, "generator/config/cpp.json5"), dest: "cpp.json5" },
        { src: join(__dirname, "generator/config/python.json5"), dest: "python.json5" },
        { src: join(__dirname, "generator/templates/cpp.njk"), dest: "cpp.njk" },
        { src: join(__dirname, "generator/templates/python.njk"), dest: "python.njk" },
      ];

      for (const { src, dest } of languageFiles) {
        if (existsSync(src)) {
          const destPath = join(configDir, dest);
          // Only copy if it doesn't exist already
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

  /**
   * Get the entire configuration object
   */
  getConfig(): AppConfig {
    return this.conf.store;
  }

  /**
   * Get a specific configuration value
   */
  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.conf.get(key);
  }

  /**
   * Set a specific configuration value
   */
  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.conf.set(key, value);
  }

  /**
   * Set multiple configuration values
   */
  setMultiple(config: Partial<AppConfig>): void {
    for (const [key, value] of Object.entries(config)) {
      this.conf.set(key as keyof AppConfig, value);
    }
  }

  /**
   * Delete a configuration value (revert to default)
   */
  delete<K extends keyof AppConfig>(key: K): void {
    this.conf.delete(key);
  }

  /**
   * Clear all configuration (revert to defaults)
   */
  clear(): void {
    this.conf.clear();
  }

  /**
   * Check if a configuration key exists
   */
  has<K extends keyof AppConfig>(key: K): boolean {
    return this.conf.has(key);
  }

  /**
   * Get the path to the configuration file
   */
  getConfigPath(): string {
    return this.conf.path;
  }

  /**
   * Get the path to the configuration directory
   */
  getConfigDirPath(): string {
    return dirname(this.conf.path);
  }

  /**
   * Get the configuration file size
   */
  getSize(): number {
    return this.conf.size;
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
}
