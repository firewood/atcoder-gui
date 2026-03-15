import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Gen2Manager } from '../gen2';
import { BrowserManager } from '../browser';
import { ConfigManager } from '../config';
import fs from 'fs';
import path from 'path';

describe('Gen2Manager Python Integration', () => {
  let browserManager: BrowserManager;
  let configManager: ConfigManager;
  let gen2Manager: Gen2Manager;

  beforeEach(() => {
    vi.clearAllMocks();
    browserManager = new BrowserManager();
    configManager = new ConfigManager();
    gen2Manager = new Gen2Manager(browserManager, configManager);

    // Mock dependencies
    vi.spyOn(browserManager, 'fetchRawHtml').mockResolvedValue('');
    vi.spyOn(configManager, 'getConfig').mockReturnValue({ workspaceDir: './temp' });
    vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    vi.spyOn(fs, 'mkdirSync').mockReturnValue(undefined);
    vi.spyOn(fs, 'writeFileSync').mockReturnValue(undefined);
    
    // Mock generateCode to avoid hitting real AtCoder or complex pipeline logic in this test
    vi.spyOn(gen2Manager, 'generateCode').mockResolvedValue(true);
  });

  it('should use main.py and python lang in metadata when --lang python is provided', async () => {
    const contestId = 'abc123';
    const mockHtml = `
      <table>
        <tbody>
          <tr>
            <td><a href="/contests/abc123/tasks/abc123_a">A</a></td>
            <td><a href="/contests/abc123/tasks/abc123_a">Problem A</a></td>
          </tr>
        </tbody>
      </table>
    `;

    (browserManager.fetchRawHtml as any).mockResolvedValue(mockHtml);

    await gen2Manager.run(['gen2', contestId, '--lang', 'python']);

    // Check if metadata.json was written with python settings
    const problemAPath = path.join('./temp', contestId, 'A');
    const metadataCall = (fs.writeFileSync as any).mock.calls.find((call: any[]) => 
      call[0].endsWith('metadata.json')
    );
    
    expect(metadataCall).toBeDefined();
    const metadata = JSON.parse(metadataCall[1]);
    expect(metadata.code_filename).toBe('main.py');
    expect(metadata.lang).toBe('python');
    
    // Check if generateCode was called with 'python' lang
    expect(gen2Manager.generateCode).toHaveBeenCalledWith(contestId, 'abc123_a', problemAPath, 'python');
  });

  it('should use main.cpp by default', async () => {
    const contestId = 'abc123';
    const mockHtml = `
      <table>
        <tbody>
          <tr>
            <td><a href="/contests/abc123/tasks/abc123_a">A</a></td>
            <td><a href="/contests/abc123/tasks/abc123_a">Problem A</a></td>
          </tr>
        </tbody>
      </table>
    `;

    (browserManager.fetchRawHtml as any).mockResolvedValue(mockHtml);

    await gen2Manager.run(['gen2', contestId]);

    const metadataCall = (fs.writeFileSync as any).mock.calls.find((call: any[]) => 
      call[0].endsWith('metadata.json')
    );
    
    const metadata = JSON.parse(metadataCall[1]);
    expect(metadata.code_filename).toBe('main.cpp');
    expect(metadata.lang).toBe('cpp');
  });
});
