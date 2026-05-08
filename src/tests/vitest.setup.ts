import { mkdtempSync } from "fs";
import { join } from "path";
import os from "os";

// Redirect env-paths (used by FileStore) to an isolated tmp dir so tests can
// never write to the developer's real ~/.config/atcoder-gui-nodejs/.
// env-paths reads these envs at call time, so setting them before tests load
// any module that uses env-paths is sufficient.
const testHome = mkdtempSync(join(os.tmpdir(), "atcoder-gui-test-home-"));

process.env.HOME = testHome;
process.env.USERPROFILE = testHome;
process.env.XDG_CONFIG_HOME = join(testHome, ".config");
process.env.XDG_DATA_HOME = join(testHome, ".local/share");
process.env.XDG_CACHE_HOME = join(testHome, ".cache");
process.env.XDG_STATE_HOME = join(testHome, ".local/state");
process.env.LOCALAPPDATA = testHome;
process.env.APPDATA = testHome;
