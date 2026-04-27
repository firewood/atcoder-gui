import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConfigManager } from "../config";
import * as fs from "fs";

vi.mock("fs");

describe("ConfigManager setupUserConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should copy template files and set language and workspaceDir in config", () => {
    // Mock existsSync
    (fs.existsSync as any).mockImplementation((p: string) => {
      const pathStr = p.toString();
      // Source files exist
      if (pathStr.includes("/src/")) return true;
      // Target directory exists for config files, but NOT for workspace
      if (pathStr.includes(".config") && !pathStr.includes(".")) return true;
      if (pathStr.includes("my-atcoder")) return false;
      // Target files do not exist
      if (pathStr.includes(".config")) return false;
      return true;
    });

    (fs.readFileSync as any).mockReturnValue("{}");

    const configManager = new ConfigManager(true);
    configManager.setupUserConfig("python", "~/my-atcoder");

    // Check if language and workspaceDir are set in config manager
    expect(configManager.get("language")).toBe("python");
    expect(configManager.get("workspaceDir")).toBe("~/my-atcoder");

    // Check if workspace directory was created
    expect(fs.mkdirSync).toHaveBeenCalledWith(
      expect.stringContaining("my-atcoder"),
      expect.objectContaining({ recursive: true }),
    );

    // Check if language-specific files were copied
    const calls = (fs.writeFileSync as any).mock.calls;
    const filenames = calls.map((call: any[]) => call[0]);
    expect(filenames.some((f: string) => f.includes("cpp.json5"))).toBe(true);
    expect(filenames.some((f: string) => f.includes("python.json5"))).toBe(true);
    expect(filenames.some((f: string) => f.includes("cpp.njk"))).toBe(true);
    expect(filenames.some((f: string) => f.includes("python.njk"))).toBe(true);
  });
});
