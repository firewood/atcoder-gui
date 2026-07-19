import { parseHtml, Sample } from "../analyzer/html-parser.js";
import { Lexer } from "../analyzer/lexer.js";
import { Parser } from "../analyzer/parser.js";
import { Analyzer } from "../analyzer/analyzer.js";
import { inferTypesFromInstances } from "../analyzer/typing.js";
import { VariableExtractor, VariableInfo } from "./variable-extractor.js";
import { ASTNode, BinOpNode, FormatNode, ItemNode, LoopNode, VarType } from "../analyzer/types.js";

/**
 * Fold literal alphabetic subscripts into the variable name.
 *
 * AtCoder writes coordinates and similar values as e.g. `P_x P_y Q_x Q_y`.
 * The parser treats `P_x` as variable `P` indexed by `x`, but `x` is a
 * constant letter, not a loop index, so evaluation later fails with
 * "Variable x not found". When a subscript is a bare identifier that is not a
 * loop variable *in scope*, it is really part of the name, so merge it in: `P_x`.
 *
 * `activeLoopVars` holds only the loop variables currently in scope: a loop's
 * variable is in scope inside its body, but not in its own bounds nor in
 * sibling/ancestor scopes. This is threaded through the recursion (rather than
 * collected globally) so that an `i` used as a real index in one loop does not
 * suppress folding of an unrelated literal `P_i` elsewhere. Loop bounds
 * (`start`/`end`) and arithmetic subscripts (`binop`) are folded too, so a bound
 * like `A_1 ... A_{N_x}` stays consistent with the scalar `N_x`.
 */
function foldLiteralSubscripts(node: ASTNode, activeLoopVars: Set<string>): ASTNode {
  if (node.type === "format") {
    const fmt = node as FormatNode;
    return {
      ...fmt,
      children: fmt.children.map((child) => foldLiteralSubscripts(child, activeLoopVars)),
    } as FormatNode;
  }
  if (node.type === "loop") {
    const loop = node as LoopNode;
    // The loop variable is only in scope within the body, not in the bounds.
    const bodyLoopVars = new Set(activeLoopVars).add(loop.variable);
    return {
      ...loop,
      start: foldLiteralSubscripts(loop.start, activeLoopVars),
      end: foldLiteralSubscripts(loop.end, activeLoopVars),
      body: loop.body.map((child) => foldLiteralSubscripts(child, bodyLoopVars)),
    } as LoopNode;
  }
  if (node.type === "binop") {
    const bin = node as BinOpNode;
    return {
      ...bin,
      left: foldLiteralSubscripts(bin.left, activeLoopVars),
      right: foldLiteralSubscripts(bin.right, activeLoopVars),
    } as BinOpNode;
  }
  if (node.type === "item") {
    const item = node as ItemNode;
    let name = item.name;
    const indices: ASTNode[] = [];
    for (const idx of item.indices) {
      if (
        idx.type === "item" &&
        (idx as ItemNode).indices.length === 0 &&
        !activeLoopVars.has((idx as ItemNode).name)
      ) {
        // Literal subscript (e.g. the `x` in `P_x`): merge into the name.
        name += `_${(idx as ItemNode).name}`;
      } else {
        indices.push(foldLiteralSubscripts(idx, activeLoopVars));
      }
    }
    return { ...item, name, indices } as ItemNode;
  }
  return node;
}

export interface ParseResult {
  contestId: string;
  problemId: string;
  taskId: string;
  url: string;
  multipleCases: boolean;
  queryType: boolean;
  judgeType: string;
  errorTolerance?: number;
  yesStr?: string;
  noStr?: string;
  mod?: number;
  returnType: string;
  multipleColumns: boolean;
  multipleRows: boolean;
  variableArray?: boolean;
  samples: Sample[];
  variables: VariableInfo[];
  formatTree?: FormatNode; // Optional, if we want to expose it
}

export function generateParseResult(html: string, taskId: string, url: string): ParseResult {
  const problemId = taskId.split("_").at(-1) || "";
  const contestId = taskId.slice(0, taskId.length - (problemId.length + 1));

  console.log("Parsing HTML...");

  let {
    inputFormat,
    samples,
    multipleCases,
    queryType,
    judgeType,
    errorTolerance,
    yesStr,
    noStr,
    mod,
    returnType,
    multipleColumns,
    multipleRows,
    variableArray,
  } = parseHtml(html);

  if (!inputFormat) {
    throw new Error("Could not find Input Format section in HTML.");
  }
  if (multipleCases) {
    console.log("Multiple cases detected.");
  }
  if (queryType) {
    console.log("Query type problem detected.");
  }
  // console.log('Input Format:', inputFormat);

  console.log("Tokenizing...");
  const lexer = new Lexer(inputFormat);
  const tokens = lexer.tokenize();

  console.log("Parsing Format...");
  const parser = new Parser(tokens);
  const rawAst = parser.parse();

  console.log("Analyzing...");
  const analyzer = new Analyzer();
  let formatTree = analyzer.analyze(rawAst);
  formatTree = foldLiteralSubscripts(formatTree, new Set<string>()) as FormatNode;
  console.log("Inferring Types...");
  let sampleInputs = samples.map((s) => s.input);
  if (multipleCases) {
    sampleInputs = sampleInputs.map((input) => {
      const lines = input.split("\n");
      if (lines.length > 0) {
        lines.shift();
      }
      return lines.join("\n");
    });
  }
  let { types, collapsedVars, collapsedAst: finalFormatTree } = inferTypesFromInstances(formatTree, sampleInputs);

  if (collapsedVars.size > 0) {
    finalFormatTree = analyzer.analyze(finalFormatTree);
  }
  // console.log('Inferred Types:', types);

  console.log("Extracting Variables...");
  const extractor = new VariableExtractor();
  extractor.setCollapsedVars(collapsedVars);
  extractor.extract(formatTree); // Use original formatTree
  const variables = extractor.getVariables(types);

  const queryVar = variables.find((v) => v.name === "query");
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
    judgeType,
    errorTolerance,
    yesStr,
    noStr,
    mod,
    returnType,
    multipleColumns,
    multipleRows,
    variableArray,
    samples,
    variables,
    formatTree: finalFormatTree,
  };
}
