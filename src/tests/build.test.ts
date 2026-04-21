import { describe, it, expect, vi, beforeEach } from "vitest";
import * as fs from "fs";
import { execSync } from "child_process";
import { BuildManager } from "../build.js";
import { ConfigManager } from "../config.js";
import * as utils from "../utils.js";

vi.mock("fs");
vi.mock("child_process");
vi.mock("../config.js");
vi.mock("../utils.js");

describe("BuildManager", () => {
  let buildManager: BuildManager;
  let configManager: ConfigManager;

  beforeEach(() => {
    vi.resetAllMocks();
    configManager = new ConfigManager();
    vi.spyOn(configManager, "getConfig").mockReturnValue({
      buildCommand: { cpp: "g++ main.cpp" },
    });
    buildManager = new BuildManager(configManager);
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  it("should log error and return false if metadata.json is missing", async () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(false);
    const result = await buildManager.run([]);
    expect(result).toBe(false);
    expect(utils.logError).toHaveBeenCalledWith("metadata.json not found in the current directory.");
  });

  it("should log error and return false if build command fails", async () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify({ code_filename: "main.cpp" }));
    vi.mocked(execSync).mockImplementation(() => {
      throw new Error("spawnSync g++ ENOENT");
    });

    const result = await buildManager.run([]);
    expect(result).toBe(false);
    expect(utils.logError).toHaveBeenCalledWith("Build failed.");
  });

  it("should return true if build command succeeds", async () => {
    vi.spyOn(fs, "existsSync").mockReturnValue(true);
    vi.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify({ code_filename: "main.cpp" }));
    vi.mocked(execSync).mockReturnValue("" as any);

    const result = await buildManager.run([]);
    expect(result).toBe(true);
    expect(utils.logError).not.toHaveBeenCalled();
  });
});
