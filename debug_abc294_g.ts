import { fetchProblemContent } from "./src/generator/fetcher.js";
import { generateParseResult } from "./src/generator/pipeline.js";
import { matchFormat } from "./src/analyzer/match.js";
import { Lexer } from "./src/analyzer/lexer.js";
import { Parser } from "./src/analyzer/parser.js";
import { Analyzer } from "./src/analyzer/analyzer.js";
import { parseHtml } from "./src/analyzer/html-parser.js";

async function debug(taskId: string) {
  const url = `https://atcoder.jp/contests/${taskId.split('_')[0]}/tasks/${taskId}`;
  try {
    const html = await fetchProblemContent(taskId);
    const { samples, inputFormat } = parseHtml(html);

    console.log("Input Format:", inputFormat);
    const lexer = new Lexer(inputFormat);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const rawAst = parser.parse();
    const analyzer = new Analyzer();
    const formatTree = analyzer.analyze(rawAst);

    console.log("Analyzed Tree:", JSON.stringify(formatTree, null, 2));

    const sampleInput = samples[0].input;
    console.log("Sample Input:", sampleInput);

    const { env, consumedAll } = matchFormat(formatTree, sampleInput);
    console.log("Consumed All:", consumedAll);

  } catch (e) {
    console.error("Failed for", taskId, ":", e);
  }
}

debug("abc294_g");
