import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GenManager } from '../gen';
import { BrowserManager } from '../browser';
import { ConfigManager } from '../config';
import fs from 'fs';
import * as pipeline from '../generator/pipeline';

describe('GenManager line endings', () => {
  let browserManager: BrowserManager;
  let configManager: ConfigManager;
  let genManager: GenManager;
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock SessionManager/Conf used by BrowserManager to avoid SyntaxError
    vi.mock('../session', () => {
      const SessionManager = vi.fn();
      SessionManager.prototype.getCookieJar = vi.fn();
      SessionManager.prototype.isLoggedIn = vi.fn().mockReturnValue(true);
      return { SessionManager };
    });

    // Mock ConfigManager to return an object that won't try to read from disk or use Conf if possible
    // Or just let it use mocked fs
    configManager = new ConfigManager();
    vi.spyOn(configManager, 'getConfig').mockReturnValue({ workspaceDir: './temp' });

    browserManager = new BrowserManager();
    genManager = new GenManager(browserManager, configManager);

    vi.spyOn(browserManager, 'fetchRawHtml').mockResolvedValue('<html></html>');
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);
    vi.spyOn(fs, 'readdirSync').mockReturnValue([]);
    vi.spyOn(fs, 'existsSync').mockImplementation((path: any) => {
      if (path.toString().includes('.config')) return false;
      if (path.toString().includes('session.json')) return false;
      if (path.toString().includes('config.json5')) return false;
      return true;
    });
    vi.spyOn(fs, 'readFileSync').mockImplementation((path: any) => {
      if (path.toString().includes('cpp.json5')) return '{}';
      if (path.toString().includes('cpp.njk')) return '';
      if (path.toString().includes('metadata.json')) return '{}';
      if (path.toString().includes('config.json5')) return '{}';
      return '';
    });

    vi.spyOn(pipeline, 'generateParseResult').mockReturnValue({
      contestId: 'abc123',
      problemId: 'a',
      taskId: 'abc123_a',
      url: 'https://atcoder.jp/contests/abc123/tasks/abc123_a',
      multipleCases: false,
      queryType: false,
      samples: [
        { input: '1\n2\n', output: '3\n' }
      ],
      variables: [],
      formatTree: { type: 'root', children: [] } as any
    });
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform
    });
  });

  it('should use CRLF on win32', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32'
    });

    await genManager.generateCode('abc123', 'abc123_a', '.');

    const inCall = vi.mocked(fs.writeFileSync).mock.calls.find(call => call[0].toString().includes('in_1.txt'));
    const outCall = vi.mocked(fs.writeFileSync).mock.calls.find(call => call[0].toString().includes('out_1.txt'));

    expect(inCall![1]).toBe('1\r\n2\r\n');
    expect(outCall![1]).toBe('3\r\n');
  });

  it('should use LF (or preserve) on linux', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'linux'
    });

    await genManager.generateCode('abc123', 'abc123_a', '.');

    const inCall = vi.mocked(fs.writeFileSync).mock.calls.find(call => call[0].toString().includes('in_1.txt'));
    const outCall = vi.mocked(fs.writeFileSync).mock.calls.find(call => call[0].toString().includes('out_1.txt'));

    expect(inCall![1]).toBe('1\n2\n');
    expect(outCall![1]).toBe('3\n');
  });
});
