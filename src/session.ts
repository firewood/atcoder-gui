import Conf from 'conf';
import { BrowserContext } from 'playwright';

export interface SessionData {
  cookies: Array<{
    name: string;
    value: string;
    domain: string;
    path: string;
    expires: number;
    httpOnly: boolean;
    secure: boolean;
    sameSite: 'Strict' | 'Lax' | 'None';
  }>;
  origins: Array<{
    origin: string;
    localStorage: Array<{
      name: string;
      value: string;
    }>;
  }>;
}

export class SessionManager {
  private conf: Conf<SessionData>;

  constructor() {
    this.conf = new Conf<SessionData>({
      projectName: 'atcoder-gui',
      configName: 'session',
      defaults: {
        cookies: [],
        origins: []
      }
    });
  }

  /**
   * Get the stored browser state for restoration
   */
  getStorageState(): SessionData | undefined {
    const sessionData = this.conf.store;
    if (!sessionData || (!sessionData.cookies.length && !sessionData.origins.length)) {
      return undefined;
    }
    return sessionData;
  }

  /**
   * Save the current browser context state
   */
  async saveStorageState(context: BrowserContext): Promise<void> {
    try {
      const storageState = await context.storageState();

      // Save cookies and origins directly at top level
      this.conf.set('cookies', storageState.cookies || []);
      this.conf.set('origins', storageState.origins || []);
    } catch (error) {
      console.error('Failed to save browser state:', error);
    }
  }

  /**
   * Clear the stored session data
   */
  clearSession(): void {
    this.conf.clear();
    console.log('Session data cleared');
  }

  /**
   * Check if session data exists
   */
  hasSession(): boolean {
    const cookies = this.conf.get('cookies');
    const origins = this.conf.get('origins');
    return !!(cookies.length || origins.length);
  }

  /**
   * Get session information
   */
  getSessionInfo(): { hasSession: boolean; cookieCount: number; originCount: number } {
    const cookies = this.conf.get('cookies');
    const origins = this.conf.get('origins');

    return {
      hasSession: this.hasSession(),
      cookieCount: cookies.length || 0,
      originCount: origins.length || 0
    };
  }

  /**
   * Get the path to the session file
   */
  getSessionPath(): string {
    return this.conf.path;
  }
}