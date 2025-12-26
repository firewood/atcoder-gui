export type TokenType =
  | 'ident'
  | 'number'
  | 'newline'
  | 'dots'    // ... or …
  | 'vdots'   // ⋮
  | 'subscript' // _ or implied by unicode subscript
  | 'binop'   // +, -, *, /, etc.
  | 'lparen'
  | 'rparen'
  | 'comma'
  | 'space'   // Usually skipped, but defined for completeness
  | 'eof';

export interface Token {
  type: TokenType;
  value?: string | number;
  line: number;
  column: number;
}

export interface ASTNode {
  type: string;
}

// Basic AST nodes for format description
export interface FormatNode extends ASTNode {
  type: 'format';
  children: ASTNode[];
}

export interface VariableNode extends ASTNode {
  type: 'variable';
  name: string;
  indices: ASTNode[]; // For array access like a[i]
}

export interface NumberNode extends ASTNode {
  type: 'number';
  value: number;
}

export interface BinOpNode extends ASTNode {
  type: 'binop';
  op: string;
  left: ASTNode;
  right: ASTNode;
}

export interface LoopNode extends ASTNode {
  type: 'loop';
  variable: string;
  start: ASTNode;
  end: ASTNode;
  body: ASTNode[];
}
