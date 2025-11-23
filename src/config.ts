import Conf from 'conf';
import JSON5 from 'json5';

export interface AppConfig {
  theme?: 'light' | 'dark';
  autoStart?: boolean;
  defaultUrl?: string;
  windowSize?: {
    width: number;
    height: number;
  };
  headless?: boolean;
  devtools?: boolean;
}

export class ConfigManager {
  private conf: Conf<AppConfig>;

  constructor() {
    this.conf = new Conf<AppConfig>({
      projectName: 'atcoder-gui',
      projectVersion: '0.1.0',
      configName: 'config',
      fileExtension: 'json5',
      serialize: (value: any) => JSON5.stringify(value, null, 2),
      deserialize: (text: string) => JSON5.parse(text),
      defaults: {
        theme: 'light',
        autoStart: false,
        defaultUrl: 'https://atcoder.jp',
        windowSize: {
          width: 1200,
          height: 800
        },
        headless: false,
      }
    });
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
   * Get the configuration file size
   */
  getSize(): number {
    return this.conf.size;
  }
}