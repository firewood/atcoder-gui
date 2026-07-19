import { describe, it, expect, vi, beforeEach } from "vitest";
import { GenManager } from "../gen";
import { BrowserManager } from "../browser";
import { ConfigManager } from "../config";
import fs from "fs";
import * as pipeline from "../generator/pipeline";

vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

vi.mock("../generator/pipeline", () => ({
  generateParseResult: vi.fn(),
}));

// generateCode must never reject: run() processes every problem in a contest
// sequentially and relies on a boolean result, so a thrown error would abort
// the whole contest generation.
describe("GenManager.generateCode error handling", () => {
  let browserManager: BrowserManager;
  let configManager: ConfigManager;
  let genManager: GenManager;

  beforeEach(() => {
    vi.clearAllMocks();
    browserManager = new BrowserManager();
    configManager = new ConfigManager();
    genManager = new GenManager(browserManager, configManager);

    vi.spyOn(configManager, "getConfig").mockReturnValue({});
    vi.spyOn(fs, "writeFileSync").mockImplementation(() => undefined);
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readdirSync").mockReturnValue([]);

    (pipeline.generateParseResult as any).mockReturnValue({
      samples: [],
      variables: [],
      formatTree: { children: [] },
      multipleCases: false,
      queryType: false,
      judgeType: "normal",
      returnType: "void",
      multipleColumns: false,
      multipleRows: false,
    });
  });

  it("returns false (does not throw) when HTML fetch rejects", async () => {
    vi.spyOn(browserManager, "fetchRawHtml").mockRejectedValue(new Error("network down"));

    await expect(genManager.generateCode("abc123", "abc123_a", "./out")).resolves.toBe(false);
  });

  it("returns false (does not throw) when HTML fetch yields empty content", async () => {
    vi.spyOn(browserManager, "fetchRawHtml").mockResolvedValue("");

    await expect(genManager.generateCode("abc123", "abc123_a", "./out")).resolves.toBe(false);
  });

  it("returns false (does not throw) when writing generated files fails", async () => {
    vi.spyOn(browserManager, "fetchRawHtml").mockResolvedValue("<html></html>");
    (fs.writeFileSync as any).mockImplementation(() => {
      throw new Error("disk full");
    });

    await expect(genManager.generateCode("abc123", "abc123_a", "./out")).resolves.toBe(false);
  });

  it("still emits a skeleton and returns false when prediction fails", async () => {
    vi.spyOn(browserManager, "fetchRawHtml").mockResolvedValue("<html></html>");
    (pipeline.generateParseResult as any).mockImplementation(() => {
      throw new Error("cannot parse format");
    });

    const result = await genManager.generateCode("abc123", "abc123_a", "./out");

    expect(result).toBe(false);
    // The skeleton source file is still written despite the prediction failure.
    expect(fs.writeFileSync).toHaveBeenCalled();
  });
});
