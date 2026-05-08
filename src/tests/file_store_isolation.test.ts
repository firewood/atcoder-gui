import { describe, it, expect } from "vitest";
import os from "os";
import { ConfigManager } from "../config";
import { SessionManager } from "../session";

describe("FileStore test isolation", () => {
  it("ConfigManager(useUserConfig=true) resolves under tmp dir, not real ~/.config", () => {
    const cm = new ConfigManager(true);
    expect(cm.path.startsWith(os.tmpdir())).toBe(true);
    expect(cm.path).not.toMatch(/^\/home\/[^/]+\/\.config/);
    expect(cm.path).not.toMatch(/^\/Users\/[^/]+\/Library/);
  });

  it("SessionManager (defaults to useUserConfig=true) resolves under tmp dir", () => {
    const sm = new SessionManager();
    expect(sm.path.startsWith(os.tmpdir())).toBe(true);
  });
});
