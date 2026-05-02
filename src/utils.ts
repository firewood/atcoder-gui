/**
 * Utility functions for atcoder-gui
 */

import os from "os";
import path from "path";
import { execSync } from "child_process";

/**
 * Expand home directory (~) in a path
 * @param filepath Path to expand
 * @returns Path with ~ replaced by home directory
 */
export function expandHomeDir(filepath: string): string {
  if (filepath === "~" || filepath.startsWith("~/")) {
    const home = os.homedir();
    return filepath === "~" ? home : path.join(home, filepath.slice(2));
  }
  return filepath;
}

/**
 * Compact home directory in a path to ~
 * @param filepath Path to compact
 * @returns Path with home directory replaced by ~ if it is a prefix
 */
export function compactHomeDir(filepath: string): string {
  const home = os.homedir();
  const absolutePath = path.resolve(filepath);
  const absoluteHome = path.resolve(home);

  if (absolutePath === absoluteHome) {
    return "~";
  }

  const prefix = absoluteHome + path.sep;
  if (absolutePath.startsWith(prefix)) {
    return "~" + path.sep + absolutePath.slice(prefix.length);
  }

  return filepath;
}

/**
 * Format date for Python LWPCookieJar format: "2026-05-22 13:20:38Z"
 * @param date Date object to format
 * @returns Formatted date string in LWP format
 */
export function formatLWPDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}Z`;
}

/**
 * Log a success message in green.
 * @param message Message to log
 */
export function logSuccess(message: string): void {
  console.log(`\x1b[32m${message}\x1b[0m`);
}

/**
 * Log an error message in red.
 * @param message Message to log
 * @param error Optional error object to log
 */
export function logError(message: string, error?: unknown): void {
  console.error(`\x1b[31m\x1b[7m ERROR \x1b[27m ${message}\x1b[0m`);
  if (error) {
    console.error(error);
  }
}

/**
 * Execute a command in a directory.
 * @param command Command string to execute
 * @param dir Directory to execute the command in
 */
export function executeCommand(command: string | undefined, dir: string): void {
  if (!command) return;
  try {
    console.log(`Executing: ${command} in ${dir}`);
    execSync(command, { cwd: dir, stdio: "inherit" });
  } catch (e) {
    logError(`Failed to execute command: ${command}`, e);
  }
}

/**
 * Get source filename for a given language.
 * @param language Language name (e.g., "cpp", "python")
 * @returns Filename (e.g., "main.cpp", "main.py")
 */
export function getSourceFilename(language: string): string {
  if (language === "python" || language === "py") {
    return "main.py";
  }
  return "main.cpp";
}
