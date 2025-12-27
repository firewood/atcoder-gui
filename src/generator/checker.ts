import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseHtml } from '../analyzer/html-parser.js';
import { Lexer } from '../analyzer/lexer.js';
import { Parser } from '../analyzer/parser.js';
import { Analyzer } from '../analyzer/analyzer.js';
import { inferTypesFromInstances } from '../analyzer/typing.js';
import { CPlusPlusGenerator } from './cplusplus.js';
import { FormatNode, ASTNode, ItemNode, LoopNode, VarType } from '../analyzer/types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../../');
const CACHE_DIR = path.join(PROJECT_ROOT, '.cache');
const TEMP_DIR = path.join(PROJECT_ROOT, '.temp');

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

interface VariableInfo {
  name: string;
  type: VarType;
  dims: number;
  indices: ASTNode[];
}

class VariableExtractor {
  private vars = new Map<string, { dims: number; indices: ASTNode[] }>();

  extract(node: FormatNode): void {
    this.visit(node, []);
  }

  private visit(node: ASTNode, loops: LoopNode[]) {
    if (!node) return;

    if (node.type === 'format') {
      (node as FormatNode).children.forEach((c) => this.visit(c, loops));
    } else if (node.type === 'loop') {
      const loop = node as LoopNode;
      // Visit bounds first
      this.visit(loop.start, loops);
      this.visit(loop.end, loops);
      // Visit body with updated loop stack
      loop.body.forEach((c) => this.visit(c, [...loops, loop]));
    } else if (node.type === 'item') {
      const item = node as ItemNode;
      const existing = this.vars.get(item.name) || { dims: 0, indices: [] };

      // We only update if we find a usage with MORE dimensions, or if it's new.
      // Usually the usage with most dimensions defines the array.
      // E.g. A_i ... A_N implies A is vector.
      if (item.indices.length >= existing.dims) {
        const indices: ASTNode[] = [];
        for (const idx of item.indices) {
            let resolvedSize: ASTNode = idx;
            // Try to resolve index to a loop bound
            // Heuristic: if index is a simple variable and matches a loop variable, use loop end
            if (idx.type === 'item') {
                const idxName = (idx as ItemNode).name;
                const loop = loops.find(l => l.variable === idxName);
                if (loop) {
                    resolvedSize = loop.end;
                }
            }
            indices.push(resolvedSize);
        }

        // If we already have an entry with same dims, we might want to check for consistency?
        // But for now, just overwrite or keep first?
        // Usually, definitions come first or are consistent.
        // Let's stick with "max dimensions wins", and if equal, maybe latest or first?
        // In simple formats, A is used as A_i inside loop i..N. Dimensions = 1, size = N.
        this.vars.set(item.name, { dims: item.indices.length, indices });
      }
    } else if (node.type === 'binop') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bin = node as any;
        this.visit(bin.left, loops);
        this.visit(bin.right, loops);
    }
  }

  getVariables(types: Record<string, VarType>): VariableInfo[] {
    return Array.from(this.vars.entries()).map(([name, info]) => ({
      name,
      type: types[name] || VarType.ValueInt, // Default to int if unknown
      dims: info.dims,
      indices: info.indices,
    }));
  }
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

  const cachePath = path.join(CACHE_DIR, `${taskId}.html`);
  const cppPath = path.join(TEMP_DIR, `${taskId}.cpp`);
  const resultPath = path.join(TEMP_DIR, `${taskId}.json`);

  let html: string;

  if (fs.existsSync(cachePath)) {
    console.log(`Using cached HTML: ${cachePath}`);
    html = fs.readFileSync(cachePath, 'utf-8');
  } else {
    console.log(`Fetching ${url}...`);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`);
      }
      html = await response.text();
      fs.writeFileSync(cachePath, html);
      console.log(`Saved HTML to ${cachePath}`);
    } catch (e) {
      console.error(`Error fetching URL:`, e);
      process.exit(1);
    }
  }

  // Pipeline
  try {
    console.log('Parsing HTML...');
    const { inputFormat, samples, multipleCases } = parseHtml(html);

    if (!inputFormat) {
        console.error('Could not find Input Format section in HTML.');
        process.exit(1);
    }
    if (multipleCases) {
        console.log('Multiple cases detected.');
    }
    console.log('Input Format:', inputFormat);

    console.log('Tokenizing...');
    const lexer = new Lexer(inputFormat);
    const tokens = lexer.tokenize();

    console.log('Parsing Format...');
    const parser = new Parser(tokens);
    const rawAst = parser.parse();

    console.log('Analyzing...');
    const analyzer = new Analyzer();
    const formatTree = analyzer.analyze(rawAst);
    console.log('AST:', JSON.stringify(formatTree, null, 2));

    console.log('Inferring Types...');
    const sampleInputs = samples.map(s => s.input);
    const types = inferTypesFromInstances(formatTree, sampleInputs);
    console.log('Inferred Types:', types);

    console.log('Extracting Variables...');
    const extractor = new VariableExtractor();
    extractor.extract(formatTree);
    const variables = extractor.getVariables(types);

    const parseResult = JSON.stringify({contestId, problemId, taskId, url, multipleCases, variables}, null, 2);
    console.log('Parse result:', parseResult);
    fs.writeFileSync(resultPath, parseResult);

    console.log('Generating C++ Code...');
    const generator = new CPlusPlusGenerator();
    const code = generator.generate(formatTree, variables, multipleCases);

    fs.writeFileSync(cppPath, code);
    console.log(`Saved C++ code to ${cppPath}`);

  } catch (e) {
    console.error('Error during generation:', e);
    process.exit(1);
  }
}

main();
