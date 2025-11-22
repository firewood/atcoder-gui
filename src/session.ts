import Conf from 'conf';
import { BrowserContext } from 'playwright';

export interface SessionData {
  storageState?: {
    cookies?: Array<{
      name: string;
      value: string;
      domain: string;
      path: string;
      expires?: number;
      httpOnly?: boolean;
      secure?: boolean;
      sameSite?: 'Strict' | 'Lax' | 'None';
    }>;
    origins?: Array<{
      origin: string;
      localStorage?: Array<{
        name: string;
        value: string;
      }>;
    }>;
  };
  lastSaved?: string;
}

export class SessionManager {
  private conf: Conf<SessionData>;

  constructor() {
    this.conf = new Conf<SessionData>({
      projectName: 'atcoder-gui',
      configName: 'session',
      defaults: {
        storageState: {
          cookies: [],
          origins: []
        }
      }
    });
  }

  /**
   * Get the stored browser state for restoration
   */
  getStorageState(): any {
    const sessionData = this.conf.get('storageState');
    if (!sessionData || (!sessionData.cookies?.length && !sessionData.origins?.length)) {
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

      this.conf.set('storageState', storageState);
      this.conf.set('lastSaved', new Date().toISOString());

      console.log('Browser state saved successfully');
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
    const storageState = this.conf.get('storageState');
    return !!(storageState && (storageState.cookies?.length || storageState.origins?.length));
  }

  /**
   * Get session information
   */
  getSessionInfo(): { hasSession: boolean; lastSaved?: string; cookieCount: number; originCount: number } {
    const storageState = this.conf.get('storageState');
    const lastSaved = this.conf.get('lastSaved');

    return {
      hasSession: this.hasSession(),
      lastSaved,
      cookieCount: storageState?.cookies?.length || 0,
      originCount: storageState?.origins?.length || 0
    };
  }

  /**
   * Get the path to the session file
   */
  getSessionPath(): string {
    return this.conf.path;
  }
}