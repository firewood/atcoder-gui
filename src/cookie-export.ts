import { writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';
import { BrowserManager } from './browser.js';
import { formatLWPDate } from './utils.js';

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
   * Get the oj (online-judge-tools) cookie path by running oj command
   */
  private static getOjCookiePath(): string {
    try {
      // Run oj command to get help output which includes the default cookie path
      const output = execSync('oj --help', { encoding: 'utf-8', timeout: 5000 });

      // Parse the output to find the cookie path line
      const match = output.match(/path to cookie\.\s*\(default:\s*([^)]+)\)/);
      if (match && match[1]) {
        return match[1].trim();
      }

      throw new Error('Could not parse oj cookie path from command output');
    } catch (error) {
      throw new Error(`Failed to get oj cookie path: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get the atcoder-cli session.json path by running acc config-dir command
   */
  private static getAtCoderCliSessionPath(): string {
    try {
      // Run acc command to get config directory
      const configDir = execSync('acc config-dir', { encoding: 'utf-8', timeout: 5000 }).trim();
      return join(configDir, 'session.json');
    } catch (error) {
      throw new Error(`Failed to get atcoder-cli config directory: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Get AtCoder cookies from current browser session
   */
  private async getAtCoderCookies(): Promise<PlaywrightCookie[]> {
    // Ensure browser is running and we have current session
    if (!this.browserManager.isRunning()) {
      throw new Error('Browser is not running. Please open a browser session first.');
    }

    // Save current session to get latest cookies
    await this.browserManager.saveSession();

    // Get cookies from session manager
    const sessionManager = this.browserManager.getSessionManager();
    const sessionData = sessionManager.getStorageState();

    if (!sessionData || !sessionData.cookies.length) {
      throw new Error('No cookies found in current session');
    }

    // Filter AtCoder cookies (REVEL_FLASH and REVEL_SESSION)
    const atcoderCookies = sessionData.cookies.filter(cookie =>
      cookie.domain.includes('atcoder.jp') &&
      (cookie.name === 'REVEL_FLASH' || cookie.name === 'REVEL_SESSION')
    );

    if (atcoderCookies.length === 0) {
      throw new Error('No AtCoder cookies (REVEL_FLASH or REVEL_SESSION) found. Make sure you are logged in to AtCoder in the browser');
    }

    return atcoderCookies;
  }

  /**
   * Export cookies to atcoder-tools cookie.txt file
   */
  async exportCookiesForAtCoderTools(): Promise<void> {
    await this.exportCookies(CookieExporter.getAtCoderToolsCookiePath());
    console.log('✓ Cookies exported successfully to atcoder-tools');
  }

  /**
   * Export cookies to oj (online-judge-tools) cookie.jar file
   */
  async exportCookiesForOj(): Promise<void> {
    await this.exportCookies(CookieExporter.getOjCookiePath());
    console.log('✓ Cookies exported successfully to oj (online-judge-tools)');
  }

  /**
   * Export cookies to atcoder-cli session.json file
   */
  async exportCookiesForAtCoderCli(): Promise<void> {
    try {
      const atcoderCookies = await this.getAtCoderCookies();
      const sessionPath = CookieExporter.getAtCoderCliSessionPath();

      // Check if session.json file exists
      if (!existsSync(sessionPath)) {
        throw new Error(`Session file does not exist: ${sessionPath}\nPlease ensure atcoder-cli is installed and has been used at least once to create the session.json file.`);
      }

      // Convert cookies to atcoder-cli format (array of "name=value" strings)
      const cookieStrings = atcoderCookies.map(cookie => `${cookie.name}=${cookie.value}`);

      // Create the session.json content
      const sessionContent = {
        cookies: cookieStrings
      };

      // Write to session.json file
      writeFileSync(sessionPath, JSON.stringify(sessionContent, null, '\t'), {
        encoding: 'utf-8',
        mode: 0o600 // Set file permissions (readable/writable by owner only)
      });

      console.log(`✓ Cookies exported successfully to atcoder-cli session.json`);
      console.log(`Session file updated: ${sessionPath}`);
    } catch (error) {
      console.error('Error during atcoder-cli cookie export:', error);
    }
  }

  /**
   * Export cookies to oj (online-judge-tools) cookie.jar file
   */
  async exportCookies(cookiePath: string): Promise<void> {
    try {
      const atcoderCookies = await this.getAtCoderCookies();

      // Generate LWP-Cookies-2.0 format content
      const cookieContent = this.generateLWPCookiesContent(atcoderCookies);

      // Write to oj cookie.jar file
      await this.writeCookieFile(cookiePath, cookieContent);
    } catch (error) {
      console.error('Error during oj cookie export:', error);
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
      // Convert Unix timestamp to Python LWPCookieJar format: "YYYY-MM-DD hh:mm:ssZ"
      const expiresDate = new Date(cookie.expires * 1000);
      parts.push(`expires="${formatLWPDate(expiresDate)}"`);
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
  private async writeCookieFile(cookiePath: string, content: string): Promise<void> {
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
   * Get the path to atcoder-tools cookie.txt file
   */
  static getAtCoderToolsCookiePath(): string {
    return join(homedir(), '.local', 'share', 'atcoder-tools', 'cookie.txt');
  }
}
