import Conf from 'conf';
import JSON5 from 'json5';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

export interface AppConfig {
  theme?: 'light' | 'dark';
  defaultUrl?: string;
  windowSize?: {
    width: number;
    height: number;
  };
  testCommand?: string;
}

export class ConfigManager {
  private conf: Conf<AppConfig>;

  constructor() {
    this.conf = new Conf<AppConfig>({
      projectName: 'atcoder-gui',
      projectVersion: '0.1.0',
      configName: 'config',
      fileExtension: 'json5',
      serialize: (value: AppConfig): string => JSON5.stringify(value, null, 2),
      deserialize: (text: string): AppConfig => JSON5.parse(text),
      defaults: {}
    });

    // Initialize user config with default template on first launch
    this.initializeUserConfigIfNeeded();
  }

  /**
   * Initialize user config file with default template if it doesn't exist
   */
  private initializeUserConfigIfNeeded(): void {
    try {
      // Check if user config file already exists
      if (!existsSync(this.conf.path)) {
        console.log('First launch detected, creating config file with default template...');

        // Ensure config directory exists
        const configDir = dirname(this.conf.path);
        if (!existsSync(configDir)) {
          mkdirSync(configDir, { recursive: true });
        }

        // Read default config.json5 template
        const defaultConfigPath = dirname(fileURLToPath(import.meta.url));
        const defaultTemplate = readFileSync(join(defaultConfigPath, 'config.json5'), 'utf-8');

        // Write the template directly to user config path using fs
        writeFileSync(this.conf.path, defaultTemplate, 'utf-8');
        console.log(`Config file created at: ${this.conf.path}`);
      }
    } catch (error) {
      console.warn('Failed to initialize user config file:', error);
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
}