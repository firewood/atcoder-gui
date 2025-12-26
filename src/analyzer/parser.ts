import { Token, FormatNode, ASTNode, TokenType, VariableNode, NumberNode, LoopNode, BinOpNode } from './types.js';

export class Parser {
  private tokens: Token[];
  private pos: number;

  constructor(tokens: Token[]) {
    this.tokens = tokens;
    this.pos = 0;
  }

  private isAtEnd(): boolean {
    return this.pos >= this.tokens.length || this.tokens[this.pos].type === 'eof';
  }

  private peek(): Token {
    return this.tokens[this.pos];
  }

  private consume(): Token {
    return this.tokens[this.pos++];
  }

  private match(type: TokenType): boolean {
    if (this.isAtEnd()) return false;
    return this.peek().type === type;
  }

  public parse(): FormatNode {
    const children: ASTNode[] = [];
    while (!this.isAtEnd()) {
        if (this.match('newline')) {
            this.consume();
            continue;
        }

        // Try to parse a variable declaration
        if (this.match('ident')) {
            const node = this.parseVariable();

            // If followed by dots, it's likely a loop
            if (this.match('dots')) {
               this.consume(); // eat dots

               // Expect another variable of the same name
               if (this.match('ident')) {
                   const endNode = this.parseVariable();

                   // Convert to LoopNode
                   // Pattern: StartNode ... EndNode
                   // Assume indices[0] is the loop variable

                   const startVar = node as VariableNode;
                   const endVar = endNode as VariableNode;

                   if (startVar.name === endVar.name && startVar.indices.length > 0 && endVar.indices.length > 0) {
                       // Heuristic:
                       // startVar.indices[0] is start (e.g., 0)
                       // endVar.indices[0] is end expression (e.g., n-1)

                       // Typically loop is i=0 to n, access a[i]
                       // If pattern is a_0 ... a_{n-1}
                       // Loop var: i (generated)
                       // Start: 0
                       // End: n (derived from n-1)

                       const loopVarName = 'i'; // Simplified

                       // Construct LoopNode
                       const loopNode: LoopNode = {
                           type: 'loop',
                           variable: loopVarName,
                           start: startVar.indices[0],
                           end: this.deriveLoopEnd(endVar.indices[0]),
                           body: [{
                               type: 'variable',
                               name: startVar.name,
                               indices: [{ type: 'variable', name: loopVarName, indices: [] } as VariableNode]
                           } as VariableNode]
                       };
                       children.push(loopNode);
                       continue;
                   }
               }

               // If fallback, push start node.
               // (Ideally we should handle error or partial match, but for now push start node)
               children.push(node);
            } else {
                children.push(node);
            }
        } else {
            this.consume();
        }
    }
    return { type: 'format', children };
  }

  // Helper to convert n-1 to n
  private deriveLoopEnd(endExpr: ASTNode): ASTNode {
      if (endExpr.type === 'binop') {
          const bin = endExpr as BinOpNode;
          if (bin.op === '-' && bin.right.type === 'number' && (bin.right as NumberNode).value === 1) {
              return bin.left;
          }
      }
      // Fallback
      return endExpr;
  }

  private parseVariable(): VariableNode {
    const nameToken = this.consume(); // ident
    const indices: ASTNode[] = [];

    while (this.match('subscript')) {
        this.consume(); // eat '_'
        if (this.match('number')) {
            const num = this.consume();
            indices.push({ type: 'number', value: Number(num.value) } as NumberNode);
        } else if (this.match('ident')) {
            const id = this.consume();
            let indexNode: ASTNode = { type: 'variable', name: String(id.value), indices: [] } as VariableNode;

            // Handle simple binary op in index like n-1
            if (this.match('binop')) {
               const opToken = this.consume(); // eat op
               if (this.match('number')) {
                   const numToken = this.consume(); // eat number

                   indexNode = {
                       type: 'binop',
                       op: String(opToken.value),
                       left: indexNode,
                       right: { type: 'number', value: Number(numToken.value) } as NumberNode
                   } as BinOpNode;
               }
            }
            indices.push(indexNode);
        }
    }

    return {
        type: 'variable',
        name: String(nameToken.value),
        indices
    };
  }
}
