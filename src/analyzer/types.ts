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

export const VarType = {
  ValueInt: 'int',
  IndexInt: 'index_int',
  Float: 'float',
  String: 'string',
  Char: 'char',
  Query: 'query',
} as const;

// eslint-disable-next-line no-redeclare
export type VarType = typeof VarType[keyof typeof VarType];

export interface ItemNode extends ASTNode {
  type: 'item';
  name: string;
  indices: ASTNode[]; // For array access like a[i]
  inferredType?: VarType;
}

export interface DotsNode extends ASTNode {
  type: 'dots';
}

export interface BreakNode extends ASTNode {
  type: 'break';
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
