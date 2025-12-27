import { parseHtml } from '../analyzer/html-parser.js';
import { Lexer } from '../analyzer/lexer.js';
import { Parser } from '../analyzer/parser.js';
import { Analyzer } from '../analyzer/analyzer.js';
import { inferTypesFromInstances } from '../analyzer/typing.js';
import { VariableExtractor, VariableInfo } from './variable-extractor.js';
import { FormatNode } from '../analyzer/types.js';

export interface ParseResult {
  contestId: string;
  problemId: string;
  taskId: string;
  url: string;
  multipleCases: boolean;
  parts: {
    variables: VariableInfo[];
    formatTree: FormatNode;
  }[];
}

export function generateParseResult(html: string, taskId: string, url: string): ParseResult {
  const problemId = taskId.split('_').at(-1) || '';
  const contestId = taskId.slice(0, taskId.length - (problemId.length + 1));

  console.log('Parsing HTML...');
  const { inputFormats, samples, multipleCases } = parseHtml(html);

  if (!inputFormats || inputFormats.length === 0) {
      throw new Error('Could not find Input Format section in HTML.');
  }
  if (multipleCases) {
      console.log('Multiple cases detected.');
  }
  if (inputFormats.length > 1) {
      console.log(`Multiple input parts detected (${inputFormats.length}).`);
  }

  const parts = [];

  for (let i = 0; i < inputFormats.length; i++) {
      const inputFormat = inputFormats[i];
      console.log(`Processing Part ${i}...`);

      console.log('Tokenizing...');
      const lexer = new Lexer(inputFormat);
      const tokens = lexer.tokenize();

      console.log('Parsing Format...');
      const parser = new Parser(tokens);
      const rawAst = parser.parse();

      console.log('Analyzing...');
      const analyzer = new Analyzer();
      const formatTree = analyzer.analyze(rawAst);

      // Only infer types from instances for the first part, and only if it's the *only* part
      // OR if we come up with a better strategy.
      // For query problems, the sample input contains ALL queries mixed.
      // The first part (setup) usually matches the beginning of the sample.
      // So we can try to infer for part 0. For part > 0, we skip instance inference.

      let types = {};
      let collapsedVars: string[] = [];

      if (i === 0) {
          console.log('Inferring Types (Part 0)...');
          const sampleInputs = samples.map(s => s.input);
          // TODO: For query problems, sample input is much longer than part 0 format.
          // match.ts might fail or match partially.
          // `inferTypesFromInstances` uses `match` which usually expects full match?
          // If strict matching is enforced, this will fail.
          // However, let's try. If it fails, we fall back to defaults.
          try {
              const inference = inferTypesFromInstances(formatTree, sampleInputs);
              types = inference.types;
              collapsedVars = inference.collapsedVars;
          } catch (e) {
              console.warn('Type inference failed for Part 0:', e);
          }
      }

      console.log('Extracting Variables...');
      const extractor = new VariableExtractor();
      extractor.setCollapsedVars(new Set(collapsedVars));
      extractor.extract(formatTree);
      const variables = extractor.getVariables(types);

      parts.push({
          variables,
          formatTree
      });
  }

  return {
    contestId,
    problemId,
    taskId,
    url,
    multipleCases,
    parts,
  };
}
