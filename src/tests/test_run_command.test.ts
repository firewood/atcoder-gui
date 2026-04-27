import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TestManager } from "../test.js";
import { ConfigManager } from "../config.js";
import { BuildManager } from "../build.js";
import * as fs from "fs";
import { execSync } from "child_process";

vi.mock("fs");
vi.mock("child_process");
vi.mock("../config.js");
vi.mock("../build.js");
vi.mock("../utils.js");

describe("TestManager with runCommand", () => {
  let testManager: TestManager;
  let configManager: ConfigManager;
  let buildManager: BuildManager;

  beforeEach(() => {
    vi.resetAllMocks();
    configManager = new ConfigManager() as any;
    buildManager = new BuildManager(configManager) as any;
    testManager = new TestManager(configManager, buildManager);

    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should use runCommand.python from config and replace main.py", async () => {
    const metadata = {
      code_filename: "solution.py",
      timeout_ms: 1000,
    };

    (fs.existsSync as any).mockImplementation((_: string) => true);
    (fs.readFileSync as any).mockImplementation((path: string) => {
      if (path === "metadata.json") return JSON.stringify(metadata);
      if (path === "in_1.txt") return "input";
      if (path === "out_1.txt") return "output";
      return "";
    });
    (fs.readdirSync as any).mockReturnValue(["solution.py", "metadata.json", "in_1.txt", "out_1.txt"]);
    (buildManager.run as any).mockResolvedValue(true);
    (execSync as any).mockReturnValue("output");

    (configManager.get as any).mockImplementation((key: string) => {
      if (key === "runCommand") return { python: "python3 main.py" };
      return undefined;
    });

    await testManager.run([]);

    expect(execSync).toHaveBeenCalledWith("python3 solution.py", expect.any(Object));
  });

  it("should use runCommand.cpp from config", async () => {
    const metadata = {
      code_filename: "main.cpp",
      timeout_ms: 1000,
    };

    (fs.existsSync as any).mockImplementation((_: string) => true);
    (fs.readFileSync as any).mockImplementation((path: string) => {
      if (path === "metadata.json") return JSON.stringify(metadata);
      if (path === "in_1.txt") return "input";
      if (path === "out_1.txt") return "output";
      return "";
    });
    (fs.readdirSync as any).mockReturnValue(["main.cpp", "metadata.json", "in_1.txt", "out_1.txt"]);
    (buildManager.run as any).mockResolvedValue(true);
    (execSync as any).mockReturnValue("output");

    (configManager.get as any).mockImplementation((key: string) => {
      if (key === "runCommand") return { cpp: "./custom_bin" };
      return undefined;
    });

    await testManager.run([]);

    expect(execSync).toHaveBeenCalledWith("./custom_bin", expect.any(Object));
  });

  it("should fall back to default when runCommand is not in config", async () => {
    const metadata = {
      code_filename: "main.py",
      timeout_ms: 1000,
    };

    (fs.existsSync as any).mockImplementation((_: string) => true);
    (fs.readFileSync as any).mockImplementation((path: string) => {
      if (path === "metadata.json") return JSON.stringify(metadata);
      if (path === "in_1.txt") return "input";
      if (path === "out_1.txt") return "output";
      return "";
    });
    (fs.readdirSync as any).mockReturnValue(["main.py", "metadata.json", "in_1.txt", "out_1.txt"]);
    (buildManager.run as any).mockResolvedValue(true);
    (execSync as any).mockReturnValue("output");

    (configManager.get as any).mockImplementation((_: string) => {
      return undefined;
    });

    await testManager.run([]);

    expect(execSync).toHaveBeenCalledWith("python3 main.py", expect.any(Object));
  });
});
