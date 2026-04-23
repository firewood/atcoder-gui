import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ProblemManager } from "../problem.js";
import { BrowserManager } from "../browser.js";
import { ConfigManager } from "../config.js";
import * as utils from "../utils.js";

// Mock utilities
vi.mock("../utils.js", async () => {
  const actual: any = await vi.importActual("../utils.js");
  return {
    ...actual,
    executeCommand: vi.fn(),
  };
});

import fs, { PathLike, PathOrFileDescriptor } from "fs";

vi.mock("fs");
vi.mock("../browser.js");
vi.mock("../config.js");

describe("ProblemManager onEnter hooks", () => {
  let problemManager: ProblemManager;
  let browserManager: any;
  let configManager: any;

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
      if (
        filePath.endsWith("/a") ||
        filePath.endsWith("/A") ||
        filePath === "a" ||
        filePath === "A" ||
        filePath.endsWith("\\a") ||
        filePath.endsWith("\\A")
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
            problem_id: "a",
          },
        });
      }
      if (filePath.endsWith("contest.acc.json")) {
        return JSON.stringify({
          contest: { id: "abc001" },
          tasks: [],
        });
      }
      return "";
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should call executeCommand when navigating to a problem", async () => {
    await problemManager.navigateToProblem("a");

    expect(utils.executeCommand).toHaveBeenCalledWith("echo hello", expect.stringContaining("a"));
  });
});
