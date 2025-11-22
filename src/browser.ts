import { Browser, chromium, Page, BrowserContext } from 'playwright';
import { SessionManager } from './session.js';

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private sessionManager: SessionManager;

  constructor() {
    this.sessionManager = new SessionManager();
  }

  /**
   * Launch a new browser instance with UI
   */
  async launch(): Promise<void> {
    if (this.browser) {
      await this.close();
    }

    this.browser = await chromium.launch({
      headless: false, // UI mode
      devtools: true
    });

    // Create context with existing storage state if available
    const storageState = this.sessionManager.getStorageState();
    this.context = await this.browser.newContext({
      storageState: storageState
    });

    this.page = await this.context.newPage();

    // Log session restoration status
    const sessionInfo = this.sessionManager.getSessionInfo();
    if (sessionInfo.hasSession) {
      console.log(`Session restored: ${sessionInfo.cookieCount} cookies, ${sessionInfo.originCount} origins`);
    } else {
      console.log('Starting with fresh session');
    }
  }

  /**
   * Open a URL in the browser
   */
  async openUrl(url: string): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not launched. Call launch() first.');
    }

    await this.page.goto(url);
  }

  /**
   * Get the current page instance
   */
  getCurrentPage(): Page | null {
    return this.page;
  }

  /**
   * Get the current browser instance
   */
  getBrowser(): Browser | null {
    return this.browser;
  }

  /**
   * Close the browser
   */
  async close(): Promise<void> {
    // Save storage state before closing
    if (this.context) {
      await this.sessionManager.saveStorageState(this.context);
    }

    if (this.page) {
      await this.page.close();
      this.page = null;
    }

    if (this.context) {
      await this.context.close();
      this.context = null;
    }

    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Check if browser is running
   */
  isRunning(): boolean {
    return this.browser !== null && this.page !== null;
  }

  /**
   * Get session manager for manual session operations
   */
  getSessionManager(): SessionManager {
    return this.sessionManager;
  }

  /**
   * Manually save the current session state
   */
  async saveSession(): Promise<void> {
    if (this.context) {
      await this.sessionManager.saveStorageState(this.context);
    } else {
      console.log('No browser context available to save');
    }
  }

  /**
   * Clear the stored session data
   */
  clearSession(): void {
    this.sessionManager.clearSession();
  }

  /**
   * Get session information
   */
  getSessionInfo(): { hasSession: boolean; lastSaved?: string; cookieCount: number; originCount: number } {
    return this.sessionManager.getSessionInfo();
  }
}