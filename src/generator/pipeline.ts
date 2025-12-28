import { parseHtml } from '../analyzer/html-parser.js';
import { Lexer } from '../analyzer/lexer.js';
import { Parser } from '../analyzer/parser.js';
import { Analyzer } from '../analyzer/analyzer.js';
import { inferTypesFromInstances } from '../analyzer/typing.js';
import { VariableExtractor, VariableInfo } from './variable-extractor.js';
import { FormatNode, VarType, ItemNode } from '../analyzer/types.js';

export interface ParseResult {
  contestId: string;
  problemId: string;
  taskId: string;
  url: string;
  multipleCases: boolean;
  queryType: boolean;
  variables: VariableInfo[];
  formatTree?: FormatNode; // Optional, if we want to expose it
}

export function generateParseResult(html: string, taskId: string, url: string): ParseResult {
  const problemId = taskId.split('_').at(-1) || '';
  const contestId = taskId.slice(0, taskId.length - (problemId.length + 1));

  console.log('Parsing HTML...');
  // eslint-disable-next-line prefer-const
  let { inputFormat, samples, multipleCases, queryType } = parseHtml(html);

  if (!inputFormat) {
      throw new Error('Could not find Input Format section in HTML.');
  }
  if (multipleCases) {
      console.log('Multiple cases detected.');
  }
  if (queryType) {
      console.log('Query type problem detected.');
  }
  // console.log('Input Format:', inputFormat);

  console.log('Tokenizing...');
  const lexer = new Lexer(inputFormat);
  const tokens = lexer.tokenize();

  console.log('Parsing Format...');
  const parser = new Parser(tokens);
  const rawAst = parser.parse();

  console.log('Analyzing...');
  const analyzer = new Analyzer();
  const formatTree = analyzer.analyze(rawAst);
  // console.log('AST:', JSON.stringify(formatTree, null, 2));

  console.log('Inferring Types...');
  const sampleInputs = samples.map(s => s.input);
  const { types, collapsedVars } = inferTypesFromInstances(formatTree, sampleInputs);
  // console.log('Inferred Types:', types);

  console.log('Extracting Variables...');
  const extractor = new VariableExtractor();
  extractor.setCollapsedVars(collapsedVars);
  extractor.extract(formatTree);
  const variables = extractor.getVariables(types);

  // Heuristic: Rename single list variable depending on Q to "query"
  const queryCountVar = variables.find(
    (v) => v.dims === 0 && (v.name === 'Q' || v.name === 'q'),
  );
  if (queryCountVar) {
    const candidates = variables.filter(
      (v) =>
        v.dims === 1 &&
        v.indices.length === 1 &&
        v.indices[0].type === 'item' &&
        (v.indices[0] as ItemNode).name === queryCountVar.name,
    );

    if (candidates.length === 1 && candidates[0].name !== 'query') {
      console.log(`Renaming variable ${candidates[0].name} to query`);
      candidates[0].name = 'query';
      queryType = true;
    }
  }

  const queryVar = variables.find(v => v.name === 'query');
  if (queryType) {
    if (queryVar) {
      queryVar.type = VarType.Query;
    }
  } else if (queryVar) {
    // Fallback: if variable named 'query' exists, treat as query type
    queryType = true;
    queryVar.type = VarType.Query;
  }

  return {
    contestId,
    problemId,
    taskId,
    url,
    multipleCases,
    queryType,
    variables,
    formatTree
  };
}
