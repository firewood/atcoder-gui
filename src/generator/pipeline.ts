import { parseHtml } from '../analyzer/html-parser.js';
import { Lexer } from '../analyzer/lexer.js';
import { Parser } from '../analyzer/parser.js';
import { Analyzer } from '../analyzer/analyzer.js';
import { inferTypesFromInstances } from '../analyzer/typing.js';
import { VariableExtractor, VariableInfo } from './variable-extractor.js';
import { FormatNode } from '../analyzer/types.js';

export interface InputPart {
  variables: VariableInfo[];
  format: FormatNode;
}

export interface ParseResult {
  contestId: string;
  problemId: string;
  taskId: string;
  url: string;
  multipleCases: boolean;
  variables: VariableInfo[]; // Main variables (first part)
  formatTree?: FormatNode;   // Main format (first part)
  inputParts: InputPart[];   // All parts including the first one
}

function processFormat(format: string, samples: string[]): InputPart {
  console.log('Tokenizing Format:', format.substring(0, 20) + '...');
  const lexer = new Lexer(format);
  const tokens = lexer.tokenize();

  console.log('Parsing Format...');
  const parser = new Parser(tokens);
  const rawAst = parser.parse();

  console.log('Analyzing...');
  const analyzer = new Analyzer();
  const formatTree = analyzer.analyze(rawAst);

  console.log('Inferring Types...');
  let types: Record<string, any> = {};
  try {
     types = inferTypesFromInstances(formatTree, samples);
  } catch (e) {
      console.warn('Type inference failed or partial match. Falling back to defaults.', e);
  }

  console.log('Extracting Variables...');
  const extractor = new VariableExtractor();
  extractor.extract(formatTree);
  const variables = extractor.getVariables(types);

  return { variables, format: formatTree };
}

export function generateParseResult(html: string, taskId: string, url: string): ParseResult {
  const problemId = taskId.split('_').at(-1) || '';
  const contestId = taskId.slice(0, taskId.length - (problemId.length + 1));

  console.log('Parsing HTML...');
  const { inputFormat, inputFormats, samples, multipleCases } = parseHtml(html);

  if (!inputFormat) {
      throw new Error('Could not find Input Format section in HTML.');
  }
  if (multipleCases) {
      console.log('Multiple cases detected.');
  }

  const sampleInputs = samples.map(s => s.input);
  const inputParts: InputPart[] = [];

  if (inputFormats && inputFormats.length > 0) {
      console.log(`Detected ${inputFormats.length} input formats.`);
      for (const fmt of inputFormats) {
          inputParts.push(processFormat(fmt, sampleInputs));
      }
  } else {
      inputParts.push(processFormat(inputFormat, sampleInputs));
  }

  return {
    contestId,
    problemId,
    taskId,
    url,
    multipleCases,
    variables: inputParts[0].variables,
    formatTree: inputParts[0].format,
    inputParts
  };
}
