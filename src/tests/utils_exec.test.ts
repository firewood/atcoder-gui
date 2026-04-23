import { describe, it, expect, vi, beforeEach } from "vitest";
import child_process from "child_process";
import { executeCommand } from "../utils.js";

vi.mock("child_process");

describe("utils execution functions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("executeCommand", () => {
    it("should call execSync with correct arguments", () => {
      executeCommand("echo test", "/some/dir");
      expect(child_process.execSync).toHaveBeenCalledWith("echo test", {
        cwd: "/some/dir",
        stdio: "inherit",
      });
    });

    it("should not call execSync if command is undefined", () => {
      executeCommand(undefined, "/some/dir");
      expect(child_process.execSync).not.toHaveBeenCalled();
    });
  });
});
