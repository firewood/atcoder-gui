import { BrowserContext } from "playwright";
import { FileStore } from "./file-store.js";
import { logError } from "./utils.js";

export interface SessionData {
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: "Strict" | "Lax" | "None";
  }>;
  origins: Array<{
    origin: string;
    localStorage: Array<{
      name: string;
      value: string;
    }>;
  }>;
}

const SESSION_DEFAULTS: SessionData = {
  cookies: [],
  origins: [],
};

export class SessionManager extends FileStore<SessionData> {
  constructor(useUserConfig: boolean = true, cwd?: string) {
    super("session.json", SESSION_DEFAULTS, useUserConfig, cwd);
  }

  /**
   * Get the stored browser state for restoration
   */
  getStorageState(): SessionData | undefined {
    if (!this.store.cookies.length && !this.store.origins.length) {
      return undefined;
    }
    return this.store;
  }

  /**
   * Save the current browser context state
   */
  async saveStorageState(context: BrowserContext): Promise<void> {
    try {
      const storageState = await context.storageState();
      this.set("cookies", storageState.cookies || []);
      this.set("origins", storageState.origins || []);
    } catch (error) {
      logError("save browser state", error);
    }
  }

  /**
   * Clear the stored session data
   */
  clearSession(): void {
    this.store = { ...SESSION_DEFAULTS };
    this.flush();
    console.log("Session data cleared");
  }

  /**
   * Check if session data exists
   */
  hasSession(): boolean {
    return !!(this.store.cookies.length || this.store.origins.length);
  }

  /**
   * Get session information
   */
  getSessionInfo(): { hasSession: boolean; cookieCount: number; originCount: number } {
    return {
      hasSession: this.hasSession(),
      cookieCount: this.store.cookies.length || 0,
      originCount: this.store.origins.length || 0,
    };
  }

  /**
   * Get the path to the session file
   */
  getSessionPath(): string {
    return this.path;
  }

  protected deserialize(text: string): Partial<SessionData> {
    return JSON.parse(text) as Partial<SessionData>;
  }

  protected persist(): void {
    this.flush();
  }

  private flush(): void {
    this.atomicWrite(JSON.stringify(this.store, null, 2));
  }
}
