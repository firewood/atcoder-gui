import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { BrowserManager } from './browser.js';

interface PlaywrightCookie {
  name: string;
  value: string;
  domain: string;
  path: string;
  expires: number;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'Strict' | 'Lax' | 'None';
}

export class CookieExporter {
  private browserManager: BrowserManager;

  constructor(browserManager: BrowserManager) {
    this.browserManager = browserManager;
  }

  /**
   * Export cookies to atcoder-tools cookie.txt file
   */
  async exportCookies(): Promise<void> {
    try {
      // Ensure browser is running and we have current session
      if (!this.browserManager.isRunning()) {
        console.error('Error: Browser is not running. Please open a browser session first.');
        return;
      }

      // Save current session to get latest cookies
      await this.browserManager.saveSession();

      // Get cookies from session manager
      const sessionManager = this.browserManager.getSessionManager();
      const sessionData = sessionManager.getStorageState();

      if (!sessionData || !sessionData.cookies.length) {
        console.error('Error: No cookies found in current session');
        return;
      }

      // Filter AtCoder cookies (REVEL_FLASH and REVEL_SESSION)
      const atcoderCookies = sessionData.cookies.filter(cookie =>
        cookie.domain.includes('atcoder.jp') &&
        (cookie.name === 'REVEL_FLASH' || cookie.name === 'REVEL_SESSION')
      );

      if (atcoderCookies.length === 0) {
        console.error('Error: No AtCoder cookies (REVEL_FLASH or REVEL_SESSION) found');
        console.log('Make sure you are logged in to AtCoder in the browser');
        return;
      }

      // Generate LWP-Cookies-2.0 format content
      const cookieContent = this.generateLWPCookiesContent(atcoderCookies);

      // Write to atcoder-tools cookie.txt
      await this.writeCookieFile(cookieContent);

      console.log('✓ Cookies exported successfully to atcoder-tools');
      console.log(`Found ${atcoderCookies.length} AtCoder cookies:`);
      atcoderCookies.forEach(cookie => {
        console.log(`  - ${cookie.name} (${cookie.domain})`);
      });

    } catch (error) {
      console.error('Error during cookie export:', error);
    }
  }

  /**
   * Generate LWP-Cookies-2.0 format content from Playwright cookies
   */
  private generateLWPCookiesContent(cookies: PlaywrightCookie[]): string {
    const lines: string[] = ['#LWP-Cookies-2.0'];

    for (const cookie of cookies) {
      // Convert Playwright cookie format to LWP format
      const lwpCookie = this.convertToLWPFormat(cookie);
      lines.push(lwpCookie);
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Convert Playwright cookie to LWP-Cookies-2.0 Set-Cookie3 format
   */
  private convertToLWPFormat(cookie: PlaywrightCookie): string {
    const parts: string[] = [];

    // Basic cookie value
    parts.push(`Set-Cookie3: ${cookie.name}="${cookie.value}"`);

    // Path
    parts.push(`path="${cookie.path}"`);

    // Domain
    parts.push(`domain=${cookie.domain}`);

    // Path specification (always include for AtCoder)
    parts.push('path_spec');

    // Secure flag
    if (cookie.secure) {
      parts.push('secure');
    }

    // Expires handling - if expires is -1 or in the past, mark as discard
    if (cookie.expires === -1 || cookie.expires < Date.now() / 1000) {
      parts.push('discard');
    } else {
      // Convert Unix timestamp to LWP format (if needed)
      const expiresDate = new Date(cookie.expires * 1000);
      parts.push(`expires="${expiresDate.toUTCString()}"`);
    }

    // HttpOnly
    if (cookie.httpOnly) {
      parts.push('HttpOnly=None');
    }

    // Version (always 0 for compatibility)
    parts.push('version=0');

    return parts.join('; ');
  }

  /**
   * Write cookie content to atcoder-tools cookie.txt file
   * Only overwrites existing cookie.txt files
   */
  private async writeCookieFile(content: string): Promise<void> {
    const cookiePath = join(homedir(), '.local', 'share', 'atcoder-tools', 'cookie.txt');

    // Check if cookie.txt file exists
    if (!existsSync(cookiePath)) {
      throw new Error(`Cookie file does not exist: ${cookiePath}\nPlease ensure atcoder-tools is installed and has been used at least once to create the cookie.txt file.`);
    }

    // Write cookie file (overwrite existing)
    writeFileSync(cookiePath, content, {
      encoding: 'utf-8',
      mode: 0o600 // Set file permissions (readable/writable by owner only)
    });

    console.log(`Cookie file updated: ${cookiePath}`);
  }

  /**
   * Check if atcoder-tools directory exists
   */
  static checkAtCoderToolsSetup(): boolean {
    const atcoderToolsDir = join(homedir(), '.local', 'share', 'atcoder-tools');
    return existsSync(atcoderToolsDir);
  }

  /**
   * Get the path to atcoder-tools cookie.txt file
   */
  static getCookiePath(): string {
    return join(homedir(), '.local', 'share', 'atcoder-tools', 'cookie.txt');
  }
}