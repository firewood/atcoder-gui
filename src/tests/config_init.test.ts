import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConfigManager } from "../config";
import * as fs from "fs";

vi.mock("fs");

describe("ConfigManager setupUserConfig", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should copy template files and set language in config", () => {
    // Mock existsSync
    (fs.existsSync as any).mockImplementation((p: string) => {
      const pathStr = p.toString();
      // Source files exist
      if (pathStr.includes("/src/")) return true;
      // Target directory exists
      if (pathStr.includes(".config") && !pathStr.includes(".")) return true;
      // Target files do not exist
      if (pathStr.includes(".config")) return false;
      return true;
    });

    (fs.readFileSync as any).mockReturnValue("{}");

    const configManager = new ConfigManager(true);
    configManager.setupUserConfig("python");

    // Check if language is set in config manager
    expect(configManager.get("language")).toBe("python");

    // Check if language-specific files were copied
    const calls = (fs.writeFileSync as any).mock.calls;
    const filenames = calls.map((call: any[]) => call[0]);
    expect(filenames.some((f: string) => f.includes("cpp.json5"))).toBe(true);
    expect(filenames.some((f: string) => f.includes("python.json5"))).toBe(true);
    expect(filenames.some((f: string) => f.includes("cpp.njk"))).toBe(true);
    expect(filenames.some((f: string) => f.includes("python.njk"))).toBe(true);
  });
});
