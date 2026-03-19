import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { TestManager } from '../test.js';
import { ConfigManager } from '../config.js';
import { BuildManager } from '../build.js';
import * as fs from 'fs';
import { execSync } from 'child_process';

vi.mock('fs');
vi.mock('child_process');
vi.mock('../config.js');
vi.mock('../build.js');

describe('TestManager timeout handling', () => {
  let testManager: TestManager;
  let configManager: ConfigManager;
  let buildManager: BuildManager;

  beforeEach(() => {
    vi.resetAllMocks();
    configManager = new ConfigManager() as any;
    buildManager = new BuildManager(configManager) as any;
    testManager = new TestManager(configManager, buildManager);

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should handle timeout when execution exceeds timeout_ms', async () => {
    // Mock metadata.json
    const metadata = {
      code_filename: 'main.cpp',
      timeout_ms: 1000
    };

    (fs.existsSync as any).mockImplementation((path: string) => {
      if (path === 'metadata.json') return true;
      if (path === 'in_1.txt') return true;
      if (path === 'out_1.txt') return true;
      return false;
    });

    (fs.readFileSync as any).mockImplementation((path: string) => {
      if (path === 'metadata.json') return JSON.stringify(metadata);
      if (path === 'in_1.txt') return 'input';
      if (path === 'out_1.txt') return 'output';
      return '';
    });

    (fs.readdirSync as any).mockReturnValue(['main.cpp', 'metadata.json', 'in_1.txt', 'out_1.txt']);

    // Mock buildManager.run to do nothing
    (buildManager.run as any).mockResolvedValue(undefined);

    // Mock execSync to throw a timeout error
    const timeoutError = new Error('Command failed: ./main');
    (timeoutError as any).code = 'ETIMEDOUT';
    (execSync as any).mockImplementation(() => {
      throw timeoutError;
    });

    await testManager.run([]);

    expect(execSync).toHaveBeenCalledWith(
      expect.stringMatching(/\.?\/?main/),
      expect.objectContaining({
        timeout: 1000
      })
    );
    // \x1b[33m is yellow (TLE)
    expect(console.log).toHaveBeenCalledWith(expect.stringContaining('# in_1.txt ... \x1b[33mTLE\x1b[0m'));
    expect(console.log).toHaveBeenCalledWith('\x1b[31mSome cases FAILED\x1b[0m (passed 0 of 1)');
  });

  it('should handle WA when output does not match expected', async () => {
    // Mock metadata.json
    const metadata = {
      code_filename: 'main.cpp',
      timeout_ms: 1000
    };

    (fs.existsSync as any).mockImplementation((path: string) => {
      if (path === 'metadata.json') return true;
      if (path === 'in_1.txt') return true;
      if (path === 'out_1.txt') return true;
      return false;
    });

    (fs.readFileSync as any).mockImplementation((path: string) => {
      if (path === 'metadata.json') return JSON.stringify(metadata);
      if (path === 'in_1.txt') return '100\n';
      if (path === 'out_1.txt') return '1\n';
      return '';
    });

    (fs.readdirSync as any).mockReturnValue(['main.cpp', 'metadata.json', 'in_1.txt', 'out_1.txt']);

    // Mock buildManager.run to do nothing
    (buildManager.run as any).mockResolvedValue(undefined);

    // Mock execSync to return incorrect output
    (execSync as any).mockReturnValue('2');

    await testManager.run([]);

    expect(console.log).toHaveBeenCalledWith('# in_1.txt ... \x1b[31mWA\x1b[0m');
    expect(console.log).toHaveBeenCalledWith('\x1b[35m[Input]\x1b[0m');
    expect(console.log).toHaveBeenCalledWith('100');
    expect(console.log).toHaveBeenCalledWith('\x1b[35m[Expected]\x1b[0m');
    expect(console.log).toHaveBeenCalledWith('1');
    expect(console.log).toHaveBeenCalledWith('\x1b[35m[Received]\x1b[0m');
    expect(console.log).toHaveBeenCalledWith('2');
    expect(console.log).toHaveBeenCalledWith('\x1b[31mSome cases FAILED\x1b[0m (passed 0 of 1)');
  });

  it('should print success message when all cases pass', async () => {
    // Mock metadata.json
    const metadata = {
      code_filename: 'main.cpp',
      timeout_ms: 1000
    };

    (fs.existsSync as any).mockImplementation((path: string) => {
      if (path === 'metadata.json') return true;
      if (path === 'in_1.txt') return true;
      if (path === 'out_1.txt') return true;
      return false;
    });

    (fs.readFileSync as any).mockImplementation((path: string) => {
      if (path === 'metadata.json') return JSON.stringify(metadata);
      if (path === 'in_1.txt') return '100\n';
      if (path === 'out_1.txt') return '1\n';
      return '';
    });

    (fs.readdirSync as any).mockReturnValue(['main.cpp', 'metadata.json', 'in_1.txt', 'out_1.txt']);

    // Mock buildManager.run to do nothing
    (buildManager.run as any).mockResolvedValue(undefined);

    // Mock execSync to return correct output
    (execSync as any).mockReturnValue('1');

    await testManager.run([]);

    expect(console.log).toHaveBeenCalledWith('# in_1.txt ... \x1b[32mPASSED\x1b[0m');
    expect(console.log).toHaveBeenCalledWith('\x1b[32mPassed all test cases!!!\x1b[0m');
  });
});
