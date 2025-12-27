import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../');
const CACHE_DIR = path.join(PROJECT_ROOT, '.cache');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

export async function fetchProblemContent(taskId: string): Promise<string> {
  const problemId = taskId.split('_').at(-1) || '';
  const contestId = taskId.slice(0, taskId.length - (problemId.length + 1));
  const url = `https://atcoder.jp/contests/${contestId}/tasks/${taskId}`;

  const cachePath = path.join(CACHE_DIR, `${taskId}.html`);

  if (fs.existsSync(cachePath)) {
    console.log(`Using cached HTML: ${cachePath}`);
    return fs.readFileSync(cachePath, 'utf-8');
  } else {
    console.log(`Fetching ${url}...`);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
      }
      const html = await response.text();
      fs.writeFileSync(cachePath, html);
      console.log(`Saved HTML to ${cachePath}`);
      return html;
    } catch (e) {
      console.error(`Error fetching URL:`, e);
      throw e;
    }
  }
}
