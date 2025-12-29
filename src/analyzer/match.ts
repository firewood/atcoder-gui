import {
  ASTNode,
  BinOpNode,
  FormatNode,
  ItemNode,
  LoopNode,
  NumberNode
} from './types';

export class MatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MatchError';
  }
}

// Helper to evaluate AST expressions (BinOp, Number, Item)
export function evalAST(node: ASTNode, env: Record<string, any>): number {
  if (node.type === 'number') {
    return (node as NumberNode).value;
  }
  if (node.type === 'item') {
    const item = node as ItemNode;
    // Assuming variables used in indices are scalars (integers)
    const val = env[item.name];
    if (val === undefined) {
      throw new MatchError(
        `Variable ${item.name} not found in environment during evaluation`
      );
    }
    // If val is an object (array/map), we can't use it directly in arithmetic unless we have indices
    if (typeof val === 'object') {
      // If indices are provided, we should evaluate them.
      // However, ASTNode for 'item' in LoopNode's start/end usually doesn't have complex indices in simplified AST?
      // Let's handle simple cases first.
      if (item.indices.length > 0) {
        // Recursive evaluation for indices?
        // For now, let's assume scalar variables for loop bounds.
        throw new MatchError(
          `Array access in loop bounds not fully supported yet: ${item.name}`
        );
      }
    }
    return Number(val);
  }
  if (node.type === 'binop') {
    const binop = node as BinOpNode;
    const left = evalAST(binop.left, env);
    const right = evalAST(binop.right, env);
    switch (binop.op) {
      case '+':
        return left + right;
      case '-':
        return left - right;
      case '*':
        return left * right;
      case '/':
        return Math.floor(left / right); // Integer division assumed?
      default:
        throw new MatchError(`Unknown operator ${binop.op}`);
    }
  }
  throw new MatchError(`Unknown node type for evaluation: ${node.type}`);
}

export function matchFormat(
  node: FormatNode,
  input: string
): Record<string, any> {
  // Tokenize input by whitespace
  const tokens = input.trim().split(/\s+/);
  if (tokens.length === 1 && tokens[0] === '') {
    tokens.pop(); // Handle empty input
  }

  const env: Record<string, any> = {};
  let tokenIndex = 0;

  function consume(): string {
    if (tokenIndex >= tokens.length) {
      throw new MatchError('Unexpected end of input');
    }
    return tokens[tokenIndex++];
  }

  function processNode(ast: ASTNode, loopContext: Record<string, number> = {}) {
    if (ast.type === 'format') {
      for (const child of (ast as FormatNode).children) {
        processNode(child, loopContext);
      }
    } else if (ast.type === 'item') {
      const item = ast as ItemNode;
      const value = consume();

      // Determine indices
      const indices: number[] = [];
      for (const idxNode of item.indices) {
        // Evaluate index expression. It might depend on loop variables.
        // We merge env and loopContext for evaluation.
        // loopContext variables (i, j, k) shadow env if conflict (though they shouldn't conflict with global vars usually)
        indices.push(evalAST(idxNode, { ...env, ...loopContext }));
      }

      if (indices.length === 0) {
        // Scalar
        env[item.name] = value;
      } else {
        // Array / Map
        if (!env[item.name]) {
          env[item.name] = {};
        }
        // Store in a nested object or flat map with key?
        // Let's use string keys "i,j" for simplicity and compatibility with Python logic
        const key = indices.join(',');
        env[item.name][key] = value;
      }
    } else if (ast.type === 'loop') {
      const loop = ast as LoopNode;
      const start = evalAST(loop.start, { ...env, ...loopContext });
      const end = evalAST(loop.end, { ...env, ...loopContext });
      // Assuming inclusive range [start, end] ?
      // In Analyzer.createLoop, start and end are indices.
      // Usually standard loops are 0 to N-1 or 1 to N.
      // Let's assume inclusive for now based on Analyzer logic usually preserving exact indices.

      // We need to know if the loop is increasing or decreasing?
      // Usually increasing.
      const step = 1;
      const count = Math.max(0, Math.floor((end - start) / step) + 1);

      for (let i = 0; i < count; i++) {
        const currentVal = start + i;
        // Update loop context
        const newLoopContext = { ...loopContext, [loop.variable]: currentVal };
        for (const child of loop.body) {
          processNode(child, newLoopContext);
        }
      }
    } else if (ast.type === 'break') {
      // Newline checks are implicit in whitespace tokenization
    } else if (ast.type === 'dots') {
      // dots should be handled by loop detection ideally.
      // If we encounter dots here, it means analyzer didn't convert it to a loop?
      // Or maybe it's just decorative?
      // For matching, we might ignore it?
      // But if it implies "read until end", that's hard.
      // We assume AST is fully normalized to Loops.
    }
  }

  processNode(node);
  return env;
}
