import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GenManager } from '../gen';
import { BrowserManager } from '../browser';
import { ConfigManager } from '../config';
import fs from 'fs';
import path from 'path';

describe('GenManager with create_contest_directory config', () => {
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
    vi.spyOn(browserManager, 'fetchRawHtml').mockResolvedValue('');
    vi.spyOn(browserManager, 'openUrl').mockResolvedValue(undefined);
    vi.spyOn(process, 'chdir').mockImplementation(() => undefined);
    // Suppress console.log
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  it('should create problem directory directly under workspaceDir when create_contest_directory is false', async () => {
    const contestId = 'abc123';
    const workspaceDir = './temp';
    vi.spyOn(configManager, 'getConfig').mockReturnValue({
      workspaceDir: workspaceDir,
      create_contest_directory: false
    });

    const mockHtml = `
      <html>
        <body>
          <table>
            <tbody>
              <tr>
                <td><a href="/contests/abc123/tasks/abc123_a">A</a></td>
                <td><a href="/contests/abc123/tasks/abc123_a">Problem A</a></td>
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

    // Mock existsSync specifically for this test's expectations
    vi.spyOn(fs, 'existsSync').mockImplementation((p: any) => {
      if (p.toString() === path.join(workspaceDir, contestId)) return false;
      if (p.toString().endsWith('A')) return false;
      return true;
    });

    await genManager.run(['gen', contestId]);

    // Should NOT create contest directory
    const contestPath = path.join(workspaceDir, contestId);
    expect(fs.mkdirSync).not.toHaveBeenCalledWith(contestPath, { recursive: true });

    // Should create problem directory directly under workspaceDir using problem.alphabet
    const problemDirPath = path.join(workspaceDir, 'A');
    expect(fs.mkdirSync).toHaveBeenCalledWith(problemDirPath, { recursive: true });

    // metadata.json should be in the problem directory
    expect(fs.writeFileSync).toHaveBeenCalledWith(
      path.join(problemDirPath, 'metadata.json'),
      expect.stringContaining('"problem_id": "abc123_a"')
    );

    // Should chdir to workspaceDir
    expect(process.chdir).toHaveBeenCalledWith(workspaceDir);
  });

  it('should delete existing sample files when create_contest_directory is false', async () => {
    const contestId = 'abc123';
    const workspaceDir = './temp';
    vi.spyOn(configManager, 'getConfig').mockReturnValue({
      workspaceDir: workspaceDir,
      create_contest_directory: false
    });

    const mockHtml = `
      <html>
        <body>
          <table>
            <tbody>
              <tr>
                <td><a href="/contests/abc123/tasks/abc123_a">A</a></td>
                <td><a href="/contests/abc123/tasks/abc123_a">Problem A</a></td>
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

    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'readdirSync').mockReturnValue(['in_1.txt', 'out_1.txt', 'main.cpp', 'metadata.json'] as any);
    const unlinkSpy = vi.spyOn(fs, 'unlinkSync').mockImplementation(() => undefined);

    await genManager.run(['gen', contestId]);

    // Should delete old sample files
    expect(unlinkSpy).toHaveBeenCalledWith(expect.stringContaining('in_1.txt'));
    expect(unlinkSpy).toHaveBeenCalledWith(expect.stringContaining('out_1.txt'));
    // Should NOT delete other files
    expect(unlinkSpy).not.toHaveBeenCalledWith(expect.stringContaining('main.cpp'));
    expect(unlinkSpy).not.toHaveBeenCalledWith(expect.stringContaining('metadata.json'));
  });

  it('should follow default behavior when create_contest_directory is true', async () => {
    const contestId = 'abc123';
    const workspaceDir = './temp';
    vi.spyOn(configManager, 'getConfig').mockReturnValue({
      workspaceDir: workspaceDir,
      create_contest_directory: true
    });

    const mockHtml = `
      <html>
        <body>
          <table>
            <tbody>
              <tr>
                <td><a href="/contests/abc123/tasks/abc123_a">A</a></td>
                <td><a href="/contests/abc123/tasks/abc123_a">Problem A</a></td>
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
        if (p.toString() === path.join(workspaceDir, contestId)) return false;
        if (p.toString().endsWith('A')) return false;
        return true;
    });

    const unlinkSpy = vi.spyOn(fs, 'unlinkSync').mockImplementation(() => undefined);
    await genManager.run(['gen', contestId]);

    // Should NOT delete any files when create_contest_directory is true
    expect(unlinkSpy).not.toHaveBeenCalled();

    // Should create contest directory
    const contestPath = path.join(workspaceDir, contestId);
    expect(fs.mkdirSync).toHaveBeenCalledWith(contestPath, { recursive: true });

    // Should create problem directory under contest directory using problem.alphabet
    const problemDirPath = path.join(contestPath, 'A');
    expect(fs.mkdirSync).toHaveBeenCalledWith(problemDirPath, { recursive: true });

    // Should chdir to contestDirPath
    expect(process.chdir).toHaveBeenCalledWith(contestPath);
  });
});
