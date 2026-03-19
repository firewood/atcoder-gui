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

  const mockProblemPage = `
    <html>
      <body>
        <section>
          <h3>Input Format</h3><pre>N</pre>
        </section>
        <section>
          <h3>Sample Input 1</h3><pre>1</pre>
        </section>
        <section>
          <h3>Sample Output 1</h3><pre>1</pre>
        </section>
      </body>
    </html>
  `;

  const mockCppConfig = JSON.stringify({
    indent_width: 1,
    indent_type: "tab",
    type: { int: "long long" },
    default: { int: "0" },
    arg: { int: "{name}" },
    declare: { int: "long long {name};" },
    input: { int: "std::cin >> {name};" },
    loop: { header: "for", footer: "}" }
  });

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock fs before anything else
    vi.spyOn(fs, 'existsSync').mockImplementation(() => true);
    vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
    vi.spyOn(fs, 'writeFileSync').mockImplementation(() => undefined);
    vi.spyOn(fs, 'readFileSync').mockImplementation((p: any) => {
        if (p.toString().endsWith('.json5')) return mockCppConfig;
        if (p.toString().endsWith('.njk')) return '{{ input_part }}';
        if (p.toString().includes('session.json')) return '{}';
        return '';
    });
    vi.spyOn(fs, 'readdirSync').mockReturnValue([]);

    browserManager = new BrowserManager();
    configManager = new ConfigManager();
    genManager = new GenManager(browserManager, configManager);

    // Mock other dependencies
    vi.spyOn(browserManager, 'fetchRawHtml').mockResolvedValue(''); // Placeholder HTML
    vi.spyOn(browserManager, 'openUrl').mockResolvedValue(undefined);
    vi.spyOn(configManager, 'getConfig').mockReturnValue({ workspaceDir: './temp' });
    vi.spyOn(process, 'chdir').mockImplementation(() => undefined);

    // Suppress console.log
    vi.spyOn(console, 'log').mockImplementation(() => {});
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

    (browserManager.fetchRawHtml as any).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) {
        return Promise.resolve(mockProblemPage);
      }
      return Promise.resolve(mockHtml);
    });

    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
        if (p.toString() === path.join('./temp', contestId)) return false;
        if (p.toString().endsWith('A')) return false;
        if (p.toString().endsWith('B')) return false;
        return true;
    });

    await genManager.run(['gen', contestId]);

    expect(browserManager.openUrl).toHaveBeenCalledWith(`https://atcoder.jp/contests/${contestId}`);

    const contestPath = path.join('./temp', contestId);
    expect(fs.mkdirSync).toHaveBeenCalledWith(contestPath, { recursive: true });

    const problemAPath = path.join(contestPath, 'A');
    expect(fs.mkdirSync).toHaveBeenCalledWith(problemAPath, { recursive: true });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join(problemAPath, 'metadata.json'),
      expect.stringContaining('"problem_id": "abc123_a"')
    );

    const problemBPath = path.join(contestPath, 'B');
    expect(fs.mkdirSync).toHaveBeenCalledWith(problemBPath, { recursive: true });
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join(problemBPath, 'metadata.json'),
      expect.stringContaining('"problem_id": "abc123_b"')
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
    (browserManager.fetchRawHtml as any).mockImplementation((url: string) => {
      if (url.includes('/tasks/')) {
        return Promise.resolve(mockProblemPage);
      }
      return Promise.resolve(mockHtml);
    });

    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
        const expectedPath = path.join(mockHomeDir, 'atcoder', contestId);
        if (p.toString() === expectedPath) return false;
        if (p.toString().endsWith('A')) return false;
        return true;
    });

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
