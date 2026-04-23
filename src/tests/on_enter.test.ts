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

import * as fs from "fs";

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

    vi.mocked(fs.existsSync).mockImplementation((p: string) => {
      if (p.endsWith("metadata.json")) return true;
      if (p.endsWith("contest.acc.json")) return true;
      if (p.endsWith("/a") || p.endsWith("/A") || p === "a" || p === "A" || p.endsWith("\\a") || p.endsWith("\\A"))
        return true;
      return false;
    });
    vi.mocked(fs.readFileSync).mockImplementation(((p: string) => {
      if (p.endsWith("metadata.json")) {
        return JSON.stringify({
          problem: {
            contest: { contest_id: "abc001" },
            problem_id: "a",
          },
        });
      }
      if (p.endsWith("contest.acc.json")) {
        return JSON.stringify({
          contest: { id: "abc001" },
          tasks: [],
        });
      }
      return "";
    }) as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should call executeCommand when navigating to a problem", async () => {
    await problemManager.navigateToProblem("a");

    expect(utils.executeCommand).toHaveBeenCalledWith("echo hello", expect.stringContaining("a"));
  });
});
