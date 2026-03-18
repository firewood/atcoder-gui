import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Gen2Manager } from '../gen2';
import { BrowserManager } from '../browser';
import { ConfigManager } from '../config';
import fs from 'fs';
import path from 'path';
import os from 'os';

describe('Gen2Manager', () => {
  let browserManager: BrowserManager;
  let configManager: ConfigManager;
  let gen2Manager: Gen2Manager;

  beforeEach(() => {
    vi.clearAllMocks();
    browserManager = new BrowserManager();
    configManager = new ConfigManager();
    gen2Manager = new Gen2Manager(browserManager, configManager);

    // Mock dependencies
    vi.spyOn(browserManager, 'fetchRawHtml').mockResolvedValue(''); // Placeholder HTML
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

    await gen2Manager.run(['gen2', contestId]);

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

    await gen2Manager.run(['gen2', contestId]);

    const expectedPath = path.join(mockHomeDir, 'atcoder', contestId);
    expect(fs.mkdirSync).toHaveBeenCalledWith(expectedPath, { recursive: true });
  });
});
