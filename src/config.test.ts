import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigManager } from './config.js';
import * as fs from 'fs';
import * as path from 'path';

describe('ConfigManager', () => {
  const testConfigPath = 'test-config.json5';

  afterEach(() => {
    // Clean up test config file
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  it('should load default configuration when no config file exists', () => {
    const configManager = new ConfigManager(testConfigPath);
    const config = configManager.getConfig();

    expect(config.browser.headless).toBe(false);
    expect(config.browser.devtools).toBe(true);
    expect(config.defaultUrl).toBe('https://atcoder.jp');
    expect(config.timeout).toBe(30000);
  });

  it('should merge user config with defaults', () => {
    // Create test config file
    const userConfig = {
      browser: {
        headless: true
      },
      timeout: 10000
    };

    fs.writeFileSync(testConfigPath, JSON.stringify(userConfig), 'utf8');

    const configManager = new ConfigManager(testConfigPath);
    const config = configManager.getConfig();

    expect(config.browser.headless).toBe(true); // User override
    expect(config.browser.devtools).toBe(true); // Default value
    expect(config.timeout).toBe(10000); // User override
    expect(config.defaultUrl).toBe('https://atcoder.jp'); // Default value
  });

  it('should update configuration', () => {
    const configManager = new ConfigManager(testConfigPath);

    configManager.updateConfig({
      defaultUrl: 'https://example.com',
      timeout: 5000
    });

    const config = configManager.getConfig();
    expect(config.defaultUrl).toBe('https://example.com');
    expect(config.timeout).toBe(5000);
  });
});