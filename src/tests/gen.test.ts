import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GenManager } from '../gen';
import { BrowserManager } from '../browser';
import { ConfigManager } from '../config';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('GenManager', () => {
  let browserManager: BrowserManager;
  let configManager: ConfigManager;
  let genManager: GenManager;

  beforeEach(() => {
    vi.clearAllMocks();
    browserManager = new BrowserManager();
    configManager = new ConfigManager();
    genManager = new GenManager(browserManager, configManager);

    // Mock dependencies
    vi.spyOn(browserManager, 'fetchRawHtml').mockResolvedValue(''); // Placeholder HTML
    vi.spyOn(browserManager, 'openUrl').mockResolvedValue(undefined);
    vi.spyOn(configManager, 'getConfig').mockReturnValue({ workspaceDir: './temp' });
    vi.spyOn(fs, 'existsSync').mockReturnValue(false);
    vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined); // Mock mkdirSync to do nothing
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined); // Mock writeFileSync
    vi.spyOn(process, 'chdir').mockImplementation(() => undefined);
  });

  it('should create directories and metadata.json for a contest', async () => {
    const contestId = 'abc123';
    const mockHtml = `
      <html>
        <body>
          <table>
            <tbody>
              <tr>
                <td><a href="/contests/abc123/tasks/abc123_a">A</a></td>
                <td><a href="/contests/abc123/tasks/abc123_a">Problem A</a></td>
              </tr>
              <tr>
                <td><a href="/contests/abc123/tasks/abc123_b">B</a></td>
                <td><a href="/contests/abc123/tasks/abc123_b">Problem B</a></td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `;

    (browserManager.fetchRawHtml as any).mockResolvedValue(mockHtml);

    await genManager.run(['gen', contestId]);

    expect(browserManager.openUrl).toHaveBeenCalledWith(`https://atcoder.jp/contests/${contestId}`);

    const contestPath = path.join('./temp', contestId);
    expect(fs.mkdirSync).toHaveBeenCalledWith(contestPath, { recursive: true });

    const problemAPath = path.join(contestPath, 'A');
    expect(fs.mkdirSync).toHaveBeenCalledWith(problemAPath, { recursive: true });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join(problemAPath, 'metadata.json'),
      JSON.stringify(
        {
          code_filename: 'main.cpp',
          judge: {
            judge_type: 'normal',
          },
          lang: 'cpp',
          problem: {
            alphabet: 'A',
            contest: {
              contest_id: 'abc123',
            },
            problem_id: 'abc123_a',
          },
          sample_in_pattern: 'in_*.txt',
          sample_out_pattern: 'out_*.txt',
          timeout_ms: 2000,
        },
        null,
        2,
      ),
    );

    const problemBPath = path.join(contestPath, 'B');
    expect(fs.mkdirSync).toHaveBeenCalledWith(problemBPath, { recursive: true });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join(problemBPath, 'metadata.json'),
      JSON.stringify(
        {
          code_filename: 'main.cpp',
          judge: {
            judge_type: 'normal',
          },
          lang: 'cpp',
          problem: {
            alphabet: 'B',
            contest: {
              contest_id: 'abc123',
            },
            problem_id: 'abc123_b',
          },
          sample_in_pattern: 'in_*.txt',
          sample_out_pattern: 'out_*.txt',
          timeout_ms: 2000,
        },
        null,
        2,
      ),
    );
  });

  it('should expand home directory (~) in workspaceDir', async () => {
    const contestId = 'abc999';
    const mockHomeDir = '/mock/home';
    vi.spyOn(os, 'homedir').mockReturnValue(mockHomeDir);
    vi.spyOn(configManager, 'getConfig').mockReturnValue({ workspaceDir: '~/atcoder' });

    const mockHtml = `
      <html>
        <body>
          <table>
            <tbody>
              <tr>
                <td><a href="/contests/abc999/tasks/abc999_a">A</a></td>
                <td><a href="/contests/abc999/tasks/abc999_a">Problem A</a></td>
              </tr>
            </tbody>
          </table>
        </body>
      </html>
    `;
    (browserManager.fetchRawHtml as any).mockResolvedValue(mockHtml);

    await genManager.run(['gen', contestId]);

    expect(browserManager.openUrl).toHaveBeenCalledWith(`https://atcoder.jp/contests/${contestId}`);

    const expectedPath = path.join(mockHomeDir, 'atcoder', contestId);
    expect(fs.mkdirSync).toHaveBeenCalledWith(expectedPath, { recursive: true });
  });

  it('should not open contest page again for a single problem generation', async () => {
    const contestId = 'abc123';
    const taskId = 'abc123_a';
    vi.spyOn(browserManager, 'getCurrentUrl').mockReturnValue(`https://atcoder.jp/contests/${contestId}/tasks/${taskId}`);
    // Mock generateCode to return true
    vi.spyOn(genManager as any, 'generateCode').mockResolvedValue(true);

    await genManager.run(['gen']);

    // openUrl should NOT be called because the page is already open
    expect(browserManager.openUrl).not.toHaveBeenCalled();
  });
});
