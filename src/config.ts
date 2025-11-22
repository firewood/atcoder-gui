import * as fs from 'fs';
import * as path from 'path';
import JSON5 from 'json5';

export interface AppConfig {
  browser: {
    headless: boolean;
    devtools: boolean;
    viewport: {
      width: number;
      height: number;
    };
  };
  defaultUrl: string;
  timeout: number;
}

const DEFAULT_CONFIG: AppConfig = {
  browser: {
    headless: false,
    devtools: true,
    viewport: {
      width: 1280,
      height: 720
    }
  },
  defaultUrl: 'https://atcoder.jp',
  timeout: 30000
};

export class ConfigManager {
  private config: AppConfig;
  private configPath: string;

  constructor(configPath: string = 'config/config.json5') {
    this.configPath = path.resolve(configPath);
    this.config = this.loadConfig();
  }

  /**
   * Load configuration from file or use defaults
   */
  private loadConfig(): AppConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const configContent = fs.readFileSync(this.configPath, 'utf8');
        const userConfig = JSON5.parse(configContent);

        // Merge user config with defaults
        return this.mergeConfigs(DEFAULT_CONFIG, userConfig);
      } else {
        // Create default config file if it doesn't exist
        this.saveConfig(DEFAULT_CONFIG);
        return DEFAULT_CONFIG;
      }
    } catch (error) {
      console.warn(`Failed to load config from ${this.configPath}:`, error);
      console.warn('Using default configuration');
      return DEFAULT_CONFIG;
    }
  }

  /**
   * Deep merge configuration objects
   */
  private mergeConfigs(defaultConfig: AppConfig, userConfig: Partial<AppConfig>): AppConfig {
    return {
      browser: {
        ...defaultConfig.browser,
        ...userConfig.browser,
        viewport: {
          ...defaultConfig.browser.viewport,
          ...userConfig.browser?.viewport
        }
      },
      defaultUrl: userConfig.defaultUrl ?? defaultConfig.defaultUrl,
      timeout: userConfig.timeout ?? defaultConfig.timeout
    };
  }

  /**
   * Save configuration to file
   */
  private saveConfig(config: AppConfig): void {
    try {
      const configDir = path.dirname(this.configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }

      const configContent = JSON5.stringify(config, null, 2);
      fs.writeFileSync(this.configPath, configContent, 'utf8');
    } catch (error) {
      console.error(`Failed to save config to ${this.configPath}:`, error);
    }
  }

  /**
   * Get the current configuration
   */
  getConfig(): AppConfig {
    return this.config;
  }

  /**
   * Update configuration and save to file
   */
  updateConfig(newConfig: Partial<AppConfig>): void {
    this.config = this.mergeConfigs(this.config, newConfig);
    this.saveConfig(this.config);
  }

  /**
   * Reset configuration to defaults
   */
  resetConfig(): void {
    this.config = DEFAULT_CONFIG;
    this.saveConfig(this.config);
  }
}