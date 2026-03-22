import fs from "fs";
import { fetchProblemContent } from "./src/generator/fetcher.js";
import { generateParseResult } from "./src/generator/pipeline.js";

async function dump(taskId: string) {
  const html = await fetchProblemContent(taskId);
  const url = `https://atcoder.jp/contests/${taskId.split('_')[0]}/tasks/${taskId}`;
  const result = generateParseResult(html, taskId, url);
  console.log(JSON.stringify(result.formatTree, (key, value) => {
    if (key === 'children' || key === 'body' || key === 'indices') return value;
    if (typeof value === 'object' && value !== null && value.type) {
        const {type, ...rest} = value;
        return {type, ...rest};
    }
    return value;
  }, 2));
}

const taskId = process.argv[2] || "abc430_b";
dump(taskId);
