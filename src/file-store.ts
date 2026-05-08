import { existsSync, readFileSync, writeFileSync, mkdirSync, renameSync } from "fs";
import { join, dirname } from "path";
import os from "os";
import envPaths from "env-paths";

const PROJECT_NAME = "atcoder-gui";

/**
 * Resolve the directory where a store file lives.
 * - Explicit `cwd`: used as-is (tests, checker).
 * - `useUserConfig=true`: env-paths user config dir (production).
 * - Otherwise: os tmpdir (avoids polluting user config from tests/CLI tools).
 */
export function resolveStoreDir(useUserConfig: boolean, cwd?: string): string {
  if (cwd) return cwd;
  return useUserConfig ? envPaths(PROJECT_NAME).config : os.tmpdir();
}

/**
 * Abstract base for file-backed stores. Subclasses choose the on-disk format
 * (deserialize / persist) while sharing path resolution, in-memory caching,
 * and atomic writes.
 */
export abstract class FileStore<T extends object> {
  public readonly path: string;
  protected store: T;

  constructor(filename: string, defaults: T, useUserConfig: boolean, cwd?: string) {
    this.path = join(resolveStoreDir(useUserConfig, cwd), filename);

    let loaded: Partial<T> = {};
    if (existsSync(this.path)) {
      try {
        loaded = this.deserialize(readFileSync(this.path, "utf-8")) ?? {};
      } catch {
        loaded = {};
      }
    }
    this.store = { ...defaults, ...loaded } as T;
  }

  get<K extends keyof T>(key: K): T[K] {
    return this.store[key];
  }

  set<K extends keyof T>(key: K, value: T[K]): void {
    this.store[key] = value;
    this.persist(String(key), value);
  }

  delete<K extends keyof T>(key: K): void {
    delete this.store[key];
    this.persist(String(key), undefined);
  }

  has<K extends keyof T>(key: K): boolean {
    return key in this.store && this.store[key] !== undefined;
  }

  protected atomicWrite(content: string): void {
    mkdirSync(dirname(this.path), { recursive: true });
    const tmp = `${this.path}.tmp`;
    writeFileSync(tmp, content);
    renameSync(tmp, this.path);
  }

  protected abstract deserialize(text: string): Partial<T>;
  protected abstract persist(key: string, value: unknown): void;
}
