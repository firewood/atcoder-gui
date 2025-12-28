import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CPlusPlusGenerator } from './cplusplus.js';
import { fetchProblemContent } from './fetcher.js';
import { generateParseResult } from './pipeline.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../');
const TEMP_DIR = path.join(PROJECT_ROOT, '.temp');

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

async function main() {
  const taskId = process.argv[2];
  if (!taskId) {
    console.error('Please provide a task ID (e.g., abc400_a)');
    process.exit(1);
  }

  const problemId = taskId.split('_').at(-1) || '';
  const contestId = taskId.slice(0, taskId.length - (problemId.length + 1));
  const url = `https://atcoder.jp/contests/${contestId}/tasks/${taskId}`;

  const cppPath = path.join(TEMP_DIR, `${taskId}.cpp`);
  const resultPath = path.join(TEMP_DIR, `${taskId}.json`);

  try {
    const html = await fetchProblemContent(taskId);

    // Pipeline
    const { multipleCases, queryType, variables, formatTree } = generateParseResult(html, taskId, url);

    const parseResult = JSON.stringify({contestId, problemId, taskId, url, multipleCases, queryType, variables}, null, 2);
    console.log('Parse result:', parseResult);
    fs.writeFileSync(resultPath, parseResult);

    console.log('Generating C++ Code...');
    if (!formatTree) throw new Error("Format tree is undefined");

    const generator = new CPlusPlusGenerator();
    const code = generator.generate(formatTree, variables, multipleCases, queryType);

    fs.writeFileSync(cppPath, code);
    console.log(`Saved C++ code to ${cppPath}`);

  } catch (e) {
    console.error('Error during generation:', e);
    process.exit(1);
  }
}

main();
