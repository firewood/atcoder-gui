import { Browser, chromium, Page } from 'playwright';

export class BrowserManager {
  private browser: Browser | null = null;
  private page: Page | null = null;

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

    this.page = await this.browser.newPage();
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
    if (this.page) {
      await this.page.close();
      this.page = null;
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
}