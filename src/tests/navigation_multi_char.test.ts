import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ProblemManager } from "../problem";
import { BrowserManager } from "../browser";
import { ConfigManager } from "../config";
import * as fs from "fs";
import { PathLike, PathOrFileDescriptor } from "fs";

vi.mock("fs");
vi.mock("../utils");
vi.mock("../browser");
vi.mock("../config");

describe("ProblemManager navigateToProblem", () => {
  let problemManager: ProblemManager;
  let browserManager: BrowserManager;
  let configManager: ConfigManager;

  beforeEach(() => {
    vi.clearAllMocks();
    browserManager = new BrowserManager();
    configManager = new ConfigManager();
    configManager.getConfig.mockReturnValue({
      onEnter: { execOnEachProblemDir: "echo hello" },
    });
    problemManager = new ProblemManager(browserManager, configManager);

    vi.spyOn(process, "chdir").mockImplementation(() => {});

    vi.mocked(fs.existsSync).mockImplementation((p: PathLike) => {
      const filePath = String(p);
      if (filePath.endsWith("metadata.json")) return true;
      if (filePath.endsWith("contest.acc.json")) return true;
      // Mock folders 'a', 'A', 'AA'
      if (
        filePath.endsWith("/a") ||
        filePath.endsWith("/A") ||
        filePath.endsWith("/AA") ||
        filePath === "a" ||
        filePath === "A" ||
        filePath === "AA"
      )
        return true;
      return false;
    });

    vi.mocked(fs.readFileSync).mockImplementation((p: PathOrFileDescriptor) => {
      const filePath = String(p);
      if (filePath.endsWith("metadata.json")) {
        return JSON.stringify({
          problem: {
            contest: { contest_id: "abc001" },
            problem_id: filePath.split("/").slice(-2)[0],
          },
        });
      }
      return "";
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should navigate to 1-character problem", async () => {
    const result = await problemManager.navigateToProblem("a");
    expect(result).toBe(true);
    expect(process.chdir).toHaveBeenCalledWith(expect.stringContaining("a"));
  });

  it("should navigate to valid 2-character problem (aa-bz)", async () => {
    // Mock 'AA' existence
    const result = await problemManager.navigateToProblem("aa");
    expect(result).toBe(true);
  });

  it("should fail for invalid 2-character problem (e.g., ca)", async () => {
    const result = await problemManager.navigateToProblem("ca");
    expect(result).toBe(false);
  });

  it("should return false for invalid command", async () => {
    const result = await problemManager.navigateToProblem("aaa");
    expect(result).toBe(false);
  });
});
