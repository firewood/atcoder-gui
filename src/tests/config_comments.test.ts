import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { ConfigManager } from "../config";
import { readFileSync, mkdtempSync, rmSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import os from "os";

describe("ConfigManager comment preservation", () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(os.tmpdir(), "atcoder-gui-cfg-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("preserves existing comments when set() updates a value", () => {
    const seed = `{
  // top-level comment
  "theme": "light",

  // language comment
  "language": null,
}
`;
    const configPath = join(tmpDir, "config.json5");
    writeFileSync(configPath, seed);

    const cm = new ConfigManager(false, tmpDir);
    cm.set("language", "python");

    const written = readFileSync(configPath, "utf-8");
    expect(written).toContain("// top-level comment");
    expect(written).toContain("// language comment");
    expect(written).toContain('"language": "python"');
    expect(written).toContain('"theme": "light"');
  });

  it("seeds from template (with comments) on first write", () => {
    const cm = new ConfigManager(false, tmpDir);
    expect(existsSync(cm.path)).toBe(false);

    cm.set("language", "cpp");

    const written = readFileSync(cm.path, "utf-8");
    expect(written).toContain("// atcoder-gui configuration");
    expect(written).toContain("// UI Theme");
    expect(written).toContain('"language": "cpp"');
  });

  it("round-trips multiple set() calls without losing comments", () => {
    const cm = new ConfigManager(false, tmpDir);
    cm.set("language", "cpp");
    cm.set("workspaceDir", "~/atcoder");
    cm.set("theme", "dark");

    const written = readFileSync(cm.path, "utf-8");
    expect(written).toContain("// atcoder-gui configuration");
    expect(written).toContain("// Browser window size");
    expect(written).toContain('"language": "cpp"');
    expect(written).toContain('"workspaceDir": "~/atcoder"');
    expect(written).toContain('"theme": "dark"');
  });
});
