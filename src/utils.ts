/**
 * Utility functions for atcoder-gui
 */

/**
 * Format date for Python LWPCookieJar format: "2026-05-22 13:20:38Z"
 * @param date Date object to format
 * @returns Formatted date string in LWP format
 */
export function formatLWPDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}Z`;
}
