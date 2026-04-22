import { describe, it, expect, vi, beforeEach } from "vitest";
import { GenManager } from "../gen";
import { BrowserManager } from "../browser";
import { ConfigManager } from "../config";
import fs from "fs";
import * as child_process from "child_process";
import * as pipeline from "../generator/pipeline";

vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

vi.mock("../generator/pipeline", () => ({
  generateParseResult: vi.fn(),
}));

describe("GenManager Process Hooks", () => {
  let browserManager: BrowserManager;
  let configManager: ConfigManager;
  let genManager: GenManager;

  beforeEach(() => {
    vi.clearAllMocks();
    browserManager = new BrowserManager();
    configManager = new ConfigManager();
    genManager = new GenManager(browserManager, configManager);

    // Mock dependencies
    vi.spyOn(browserManager, "fetchRawHtml").mockResolvedValue("<html></html>");
    vi.spyOn(fs, "writeFileSync").mockImplementation(() => undefined);
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readdirSync").mockReturnValue([]);

    (pipeline.generateParseResult as any).mockReturnValue({
      samples: [],
      variables: [],
      formatTree: { children: [] },
      multipleCases: false,
    });
  });

  it("should execute preProcess and postProcess commands", async () => {
    const contestId = "abc123";
    const taskId = "abc123_a";
    const savePath = "./test-dir";

    vi.spyOn(configManager, "getConfig").mockReturnValue({
      preProcess: { execOnEachProblemDir: 'echo "pre"' },
      postProcess: { execOnEachProblemDir: 'echo "post"' },
    });

    await genManager.generateCode(contestId, taskId, savePath);

    expect(child_process.execSync).toHaveBeenCalledWith('echo "pre"', expect.objectContaining({ cwd: savePath }));
    expect(child_process.execSync).toHaveBeenCalledWith('echo "post"', expect.objectContaining({ cwd: savePath }));
  });

  it("should not throw if preProcess or postProcess are not configured", async () => {
    const contestId = "abc123";
    const taskId = "abc123_a";
    const savePath = "./test-dir";

    vi.spyOn(configManager, "getConfig").mockReturnValue({});

    await genManager.generateCode(contestId, taskId, savePath);

    expect(child_process.execSync).not.toHaveBeenCalled();
  });
});
