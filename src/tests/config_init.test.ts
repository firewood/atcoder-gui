import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConfigManager } from "../config";
import * as fs from "fs";

vi.mock("fs");

describe("ConfigManager Initialization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should copy template files on first launch", () => {
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

    new ConfigManager(true);

    // Should call writeFileSync for config.json5 and 4 templates
    expect(fs.writeFileSync).toHaveBeenCalled();
    const calls = (fs.writeFileSync as any).mock.calls;

    const filenames = calls.map((call: any[]) => call[0]);
    expect(filenames.some((f: string) => f.includes("config.json5"))).toBe(true);
    expect(filenames.some((f: string) => f.includes("cpp.json5"))).toBe(true);
    expect(filenames.some((f: string) => f.includes("python.json5"))).toBe(true);
    expect(filenames.some((f: string) => f.includes("cpp.njk"))).toBe(true);
    expect(filenames.some((f: string) => f.includes("python.njk"))).toBe(true);
  });

  it("should not copy anything if config.json5 already exists", () => {
    (fs.existsSync as any).mockReturnValue(true);

    new ConfigManager(true);

    // writeFileSync might be called by Conf to save defaults if they differ,
    // but we want to make sure it's not called for our templates.
    const calls = (fs.writeFileSync as any).mock.calls;
    const templateCalls = calls.filter(
      (call: any[]) =>
        call[0].includes("cpp.json5") ||
        call[0].includes("python.json5") ||
        call[0].includes("cpp.njk") ||
        call[0].includes("python.njk"),
    );
    expect(templateCalls.length).toBe(0);
  });
});
