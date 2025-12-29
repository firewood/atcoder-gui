import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { fetchProblemContent } from '../generator/fetcher.js';
import { generateParseResult, ParseResult } from '../generator/pipeline.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../');
const EXPECTED_RESULTS_DIR = path.join(
  PROJECT_ROOT,
  'test-resources/expected-results'
);

// Helper to read JSON
function readJson(filepath: string) {
  return JSON.parse(fs.readFileSync(filepath, 'utf-8'));
}

describe('Scenario Tests: Expected Results', () => {
  // Get all JSON files in the expected-results directory
  const files = fs
    .readdirSync(EXPECTED_RESULTS_DIR)
    .filter((f) => f.endsWith('.json'));

  if (files.length === 0) {
    console.warn('No expected result files found. Skipping scenario tests.');
  }

  files.forEach((file) => {
    it(`should match expected result for ${file}`, async () => {
      const expected = readJson(path.join(EXPECTED_RESULTS_DIR, file));
      const { taskId, url } = expected;

      expect(taskId).toBeDefined();
      expect(url).toBeDefined();

      const html = await fetchProblemContent(taskId);
      const result = generateParseResult(html, taskId, url);

      // Remove formatTree from result as it is not in the expected JSON
      const { formatTree, ...actual } = result;

      // Ensure variables are sorted or consistent if needed,
      // but usually JSON equality is enough if order matches.
      // Expected JSON seems to match the structure of `variables`.

      expect(actual).toEqual(expected);
    });
  });
});
