import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import os from 'os';
import path from 'path';

vi.mock('../browser.js', () => ({
  BrowserManager: class {
    launch = vi.fn().mockResolvedValue(undefined);
    close = vi.fn().mockResolvedValue(undefined);
    setOnPageClose = vi.fn();
    openUrl = vi.fn().mockResolvedValue(undefined);
    setOnPageCloseCallback = vi.fn();
  }
}));

vi.mock('../config.js', () => ({
  ConfigManager: class {
    getConfig = vi.fn().mockReturnValue({ workspaceDir: '/mock/workspace' });
  }
}));

vi.mock('../submit.js', () => ({
  SubmitManager: class {}
}));

vi.mock('../cookie-export.js', () => ({
  CookieExporter: class {}
}));

vi.mock('../gen.js', () => ({
  GenManager: class {
    run = vi.fn().mockResolvedValue(undefined);
  }
}));

vi.mock('../problem.js', () => ({
  ProblemManager: class {
    navigateToProblem = vi.fn().mockResolvedValue(false);
  }
}));

import { AtCoderGUI } from '../main.js';

describe('AtCoderGUI CLI Commands', () => {
  let gui: AtCoderGUI;

  beforeEach(() => {
    gui = new AtCoderGUI();
    // Mock process.chdir and console.log/error
    vi.spyOn(process, 'chdir').mockImplementation(() => {});
    vi.spyOn(process, 'cwd').mockReturnValue('/mock/cwd');
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('cd command', () => {
    it('should expand ~ to home directory', async () => {
      // @ts-ignore - accessing private method for testing
      await gui.handleCommand('cd ~');
      expect(process.chdir).toHaveBeenCalledWith(os.homedir());
    });

    it('should expand ~/path to home directory with path', async () => {
      const home = os.homedir();
      // @ts-ignore
      await gui.handleCommand('cd ~/documents');
      expect(process.chdir).toHaveBeenCalledWith(path.join(home, 'documents'));
    });

    it('should NOT expand path/~/other', async () => {
      // @ts-ignore
      await gui.handleCommand('cd documents/~/other');
      expect(process.chdir).toHaveBeenCalledWith('documents/~/other');
    });

    it('should use workspaceDir if no argument provided', async () => {
      // @ts-ignore
      await gui.handleCommand('cd');
      expect(process.chdir).toHaveBeenCalledWith('/mock/workspace');
    });
  });
});
