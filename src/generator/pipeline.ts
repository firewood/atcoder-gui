import { parseHtml } from '../analyzer/html-parser.js';
import { Lexer } from '../analyzer/lexer.js';
import { Parser } from '../analyzer/parser.js';
import { Analyzer } from '../analyzer/analyzer.js';
import { inferTypesFromInstances } from '../analyzer/typing.js';
import { VariableExtractor, VariableInfo } from './variable-extractor.js';
import { FormatNode, VarType, ItemNode, ASTNode, LoopNode, BinOpNode } from '../analyzer/types.js';

function transformToQueryNode(
  node: ASTNode,
  targetName: string,
  newName: string,
): void {
  if (!node) return;

  if (node.type === 'format') {
    (node as FormatNode).children.forEach((c) =>
      transformToQueryNode(c, targetName, newName),
    );
  } else if (node.type === 'loop') {
    const loop = node as LoopNode;
    transformToQueryNode(loop.start, targetName, newName);
    transformToQueryNode(loop.end, targetName, newName);
    loop.body.forEach((c) => transformToQueryNode(c, targetName, newName));
  } else if (node.type === 'item') {
    const item = node as ItemNode;
    if (item.name === targetName) {
      item.name = newName;
      // Change type to query
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (item as any).type = 'query';
    }
    // Also traverse indices as they might contain nested stuff?
    // Usually query variable itself is the item.
    // If we have query[i], item is 'query', index is 'i'.
    // We do NOT want to change 'i' to query node.
    // So we don't recurse into indices unless targetName could be an index?
    // User request: "query variable to query node".
    // Assuming we stop here.
  } else if (node.type === 'binop') {
    const bin = node as BinOpNode;
    transformToQueryNode(bin.left, targetName, newName);
    transformToQueryNode(bin.right, targetName, newName);
  }
}

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
      const originalName = candidates[0].name;
      console.log(`Renaming variable ${originalName} to query`);
      candidates[0].name = 'query';
      queryType = true;
      transformToQueryNode(formatTree, originalName, 'query');
    }
  }

  const queryVar = variables.find((v) => v.name === 'query');
  if (queryVar) {
    queryType = true;
    queryVar.type = VarType.Query;
    transformToQueryNode(formatTree, 'query', 'query');
    if (queryVar.indices.length === 1 && queryVar.indices[0].type === 'item') {
      queryVar.indices[0] = {
        ...queryVar.indices[0],
        type: 'query',
      } as any;
    }
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
