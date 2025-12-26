/**
 * Simple parser implementation for the format string.
 * This should transform a stream of tokens into an AST (FormatNode).
 */

import { Token, TokenType, ASTNode, FormatNode, ItemNode, NumberNode, BinOpNode, LoopNode } from './types';

export class Parser {
  private tokens: Token[];
  private pos: number = 0;

  constructor(tokens: Token[]) {
    this.tokens = tokens.filter(t => t.type !== 'space');
  }

  public parse(): FormatNode {
    const children: ASTNode[] = [];
    while (this.peek().type !== 'eof') {
        const stmt = this.parseStatement();
        if (stmt) children.push(stmt);
    }
    return { type: 'format', children };
  }

  private parseStatement(): ASTNode | null {
    const token = this.peek();

    if (token.type === 'ident') {
        return this.parseItem();
    }
    if (token.type === 'newline') {
        this.consume();
        return { type: 'break' };
    }
    if (token.type === 'dots' || token.type === 'vdots') {
        this.consume();
        return { type: 'dots' };
    }
    // Skip commas
    if (token.type === 'comma') {
        this.consume();
        return null; // Skip
    }

    // Skip unexpected? Or error?
    // For now, consume and ignore to be robust
    this.consume();
    return null;
  }

  private parseItem(): ItemNode {
    const token = this.consume(); // ident
    const name = token.value as string;
    const indices: ASTNode[] = [];

    // Check for subscripts
    // Support A_i and A_i,j and A_{i,j} if lexer supports it
    // My lexer setup: _ -> subscript.
    // If we see subscript, we expect an index.

    while (this.peek().type === 'subscript') {
        this.consume(); // consume '_'
        // Parse index expression
        // It could be 'i', '1', 'N-1', '(N-1)'
        // Or if comma separation is used: '_ i, j' (rare in raw subscript, usually _{i,j})
        // Since lexer handles unicode subscripts by inserting _, let's assume one index per _ or sequence of indices?
        // Usually A_i_j means A[i][j].
        indices.push(this.parseExpression());
    }

    return { type: 'item', name, indices };
  }

  private parseExpression(): ASTNode {
    return this.parseAddSub();
  }

  private parseAddSub(): ASTNode {
    let left = this.parseMulDiv();
    while (this.peek().type === 'binop' && (this.peek().value === '+' || this.peek().value === '-')) {
        const op = this.consume().value as string;
        const right = this.parseMulDiv();
        left = { type: 'binop', op, left, right } as BinOpNode;
    }
    return left;
  }

  private parseMulDiv(): ASTNode {
    let left = this.parseAtom();
    while (this.peek().type === 'binop' && (this.peek().value === '*' || this.peek().value === '/')) {
        const op = this.consume().value as string;
        const right = this.parseAtom();
        left = { type: 'binop', op, left, right } as BinOpNode;
    }
    return left;
  }

  private parseAtom(): ASTNode {
      const token = this.peek();
      if (token.type === 'lparen') {
          this.consume();
          const expr = this.parseExpression();
          if (this.peek().type === 'rparen') {
              this.consume();
          }
          return expr;
      }
      if (token.type === 'ident') {
          // If the identifier is followed by _, it's an ItemNode (variable with index?)
          // But usually inside an index, we just have variables like 'i', 'N'.
          // Does 'N' have indices? N_i? Usually not.
          // But technically 'A_{B_i}' is possible.
          // So recursively call parseItem?
          return this.parseItem();
      }
      if (token.type === 'number') {
          this.consume();
          return { type: 'number', value: token.value as number };
      }

      // Error recovery
      this.consume();
      // Use 'item' type as fallback, but ideally should be error
      return { type: 'item', name: 'ERROR', indices: [] };
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    return this.tokens[this.pos++];
  }
}
