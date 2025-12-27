import {
  ASTNode,
  FormatNode,
  ItemNode,
  LoopNode,
  VarType,
  BinOpNode,
  NumberNode,
} from '../analyzer/types.js';
import { CodeGeneratorConfig, TemplateContext } from './types.js';

type Variable = {
  name: string;
  type: VarType;
  dims: number; // 0 for scalar, 1 for vector, 2 for matrix
  indices: ASTNode[];
};

export class UniversalGenerator {
  private config: CodeGeneratorConfig;
  private indent: string;

  constructor(config: CodeGeneratorConfig) {
    this.config = config;
    this.indent = ' '.repeat(config.base_indent);
  }

  generate(
    parts: { variables: Variable[]; formatTree: FormatNode }[],
    multipleCases?: boolean,
  ): TemplateContext {
    if (parts.length === 1) {
        return this.generateSingle(parts[0].formatTree, parts[0].variables, multipleCases);
    }

    // Multi-part generation (Query Problem)
    // Part 0 is Setup.
    // Part 1..N are Queries.

    const lines: string[] = [];
    const allVariables: Variable[] = [];

    // Collect all variables for arguments
    for (const part of parts) {
        for (const v of part.variables) {
            // Dedupe by name
            if (!allVariables.find(av => av.name === v.name)) {
                allVariables.push(v);
            }
        }
    }

    // 1. Setup (Part 0)
    const setupPart = parts[0];
    for (const variable of setupPart.variables) {
      lines.push(this.generateDeclaration(variable));
    }
    lines.push(...this.generateInput(setupPart.formatTree.children, setupPart.variables));

    // 2. Loop Q
    // We assume the variable for Q is in the setup variables.
    // If we can't find a variable named 'Q' (case insensitive) or just the last scalar int?
    // Let's look for 'Q' or 'q'.
    let loopVarName = setupPart.variables.find(v => v.name === 'Q' || v.name === 'q')?.name;

    if (!loopVarName) {
        // Fallback: look for any scalar int variable in Setup.
        // Or if Setup has only one variable, use it.
        const scalarInts = setupPart.variables.filter(v => v.dims === 0 && (v.type === 'int' || v.type === 'index_int'));
        if (scalarInts.length > 0) {
            // Pick the last one? Or the one named N/Q?
            loopVarName = scalarInts[scalarInts.length - 1].name;
        } else {
            loopVarName = 'Q'; // Desperate fallback
            lines.push(`int Q; cin >> Q; // TODO: Check variable name`);
        }
    }

    lines.push(`while(${loopVarName}--){`);

    // 3. Dispatch Logic
    // We need to read the discriminator.
    // We look at Part 1..N.
    // We check the first token of their format.

    lines.push(`${this.indent}int type; cin >> type;`);

    for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        const format = part.formatTree;
        // Check first child of format
        let firstTokenValue: string | number | undefined;
        if (format.children.length > 0) {
            const firstNode = format.children[0];
            if (firstNode.type === 'number') {
                firstTokenValue = (firstNode as NumberNode).value;
            } else if ('value' in firstNode) {
                 // Might be a token-like node if analyzer kept it?
                 // Analyzer transforms tokens to nodes.
                 // If it's a fixed ItemNode with no variable? No, ItemNode has name.
                 // If the parser saw '1', it usually becomes a NumberNode.
            }
        }

        // We assume we can find the discriminator value.
        // If not, we might use index i (1-based or 0-based?)
        // Usually queries are 1, 2, 3.
        // Let's assume the index if we can't find it? Or parse the format string raw?
        // Since we have the formatTree, let's trust it.
        // BUT: The analyzer might strip constant numbers if they are not relevant?
        // Let's check Parser/Analyzer logic.
        // Parser produces 'number' nodes. Analyzer keeps them?
        // Looking at `src/analyzer/types.ts`, `FormatNode` has `children: ASTNode[]`.
        // `NumberNode` is an `ASTNode`.

        // If we found a number node at the start, use it.
        // Otherwise, use `i`.
        const discriminator = firstTokenValue !== undefined ? firstTokenValue : i;

        const branchType = i === 1 ? 'if' : 'else if';
        lines.push(`${this.indent}${branchType} (type == ${discriminator}) {`);

        // Generate declarations and input for this part
        // We filter out the discriminator variable if it was part of the input variables?
        // Usually '1 x y' -> variables x, y. The '1' is not a variable.
        // So we just generate declarations for part.variables.

        // Note: We should not redeclare variables if they were declared in Setup (unlikely for query params).
        // But if Query 1 uses 'x' and Query 2 uses 'x', we might have shadowing or redeclaration issues if we declare inside the block.
        // Scoping in C++: declaring inside `if` block is fine.

        const partLines: string[] = [];
        for (const variable of part.variables) {
            partLines.push(this.generateDeclaration(variable));
        }
        partLines.push(...this.generateInput(part.formatTree.children, part.variables));

        lines.push(...partLines.map(l => this.indent + this.indent + l));
        lines.push(`${this.indent}}`);
    }

    lines.push(`}`); // End while

    const inputPart = lines.map((line) => this.indent + line).join('\n');

    return {
      prediction_success: true,
      formal_arguments: this.generateFormalArguments(allVariables),
      actual_arguments: this.generateActualArguments(allVariables), // This might need adjustment if scopes are different
      input_part: inputPart,
      multiple_cases: multipleCases,
      atcodertools: {
        version: '1.0.0', // TODO: Get from package.json
        url: 'https://github.com/firewood/atcoder-gui',
      },
    };
  }

  private generateSingle(
    format: FormatNode,
    variables: Variable[],
    multipleCases?: boolean,
  ): TemplateContext {
    const lines: string[] = [];

    // 1. Variable Declarations
    for (const variable of variables) {
      lines.push(this.generateDeclaration(variable));
    }

    // 2. Input Reading
    lines.push(...this.generateInput(format.children, variables));

    const inputPart = lines.map((line) => this.indent + line).join('\n');

    return {
      prediction_success: true,
      formal_arguments: this.generateFormalArguments(variables),
      actual_arguments: this.generateActualArguments(variables),
      input_part: inputPart,
      multiple_cases: multipleCases,
      atcodertools: {
        version: '1.0.0', // TODO: Get from package.json
        url: 'https://github.com/firewood/atcoder-gui',
      },
    };
  }

  private generateDeclaration(variable: Variable): string {
    const typeKey = this.mapVarType(variable.type);

    if (variable.dims === 0) {
        return this.formatString(this.config.declare[typeKey as keyof typeof this.config.declare], {
            name: variable.name,
        });
    } else if (variable.dims === 1) {
        const len = this.stringifyNode(variable.indices[0]);
        const innerType = this.config.type[typeKey as keyof typeof this.config.type];

        return this.formatString(this.config.declare_and_allocate.seq, {
            name: variable.name,
            type: innerType,
            length: len
        });
    } else if (variable.dims === 2) {
        const lenI = this.stringifyNode(variable.indices[0]);
        const lenJ = this.stringifyNode(variable.indices[1]);
        const innerType = this.config.type[typeKey as keyof typeof this.config.type];

        return this.formatString(this.config.declare_and_allocate['2d_seq'], {
            name: variable.name,
            type: innerType,
            length_i: lenI,
            length_j: lenJ
        });
    }

    return `// TODO: declaration for ${variable.name}`;
  }

  private generateInput(nodes: ASTNode[], variables: Variable[]): string[] {
      const lines: string[] = [];

      for (const node of nodes) {
          if (node.type === 'item') {
              lines.push(this.generateItemInput(node as ItemNode, variables));
          } else if (node.type === 'loop') {
              lines.push(...this.generateLoopInput(node as LoopNode, variables));
          }
      }
      return lines;
  }

  private generateItemInput(node: ItemNode, variables: Variable[]): string {
     const variable = variables.find(v => v.name === node.name);
     if (!variable) return `// Unknown variable ${node.name}`;

     const typeKey = this.mapVarType(variable.type);

     if (variable.dims === 0) {
         return this.formatString(this.config.input[typeKey as keyof typeof this.config.input], {
             name: variable.name
         });
     } else if (variable.dims === 1) {
          const access = this.formatString(this.config.access.seq, {
              name: variable.name,
              index: this.stringifyNode(node.indices[0])
          });
          return this.formatString(this.config.input[typeKey as keyof typeof this.config.input], {
              name: access
          });
     } else if (variable.dims === 2) {
         const access = this.formatString(this.config.access['2d_seq'], {
              name: variable.name,
              index_i: this.stringifyNode(node.indices[0]),
              index_j: this.stringifyNode(node.indices[1])
          });
          return this.formatString(this.config.input[typeKey as keyof typeof this.config.input], {
              name: access
          });
     }

     return `// TODO: input for ${node.name}`;
  }

  private generateLoopInput(node: LoopNode, variables: Variable[]): string[] {
      const lines: string[] = [];
      const loopVar = node.variable;
      const length = this.stringifyNode(node.end);

      const header = this.formatString(this.config.loop.header, {
          loop_var: loopVar,
          length: length
      });

      lines.push(header);

      const bodyLines = this.generateInput(node.body, variables);
      lines.push(...bodyLines.map(l => this.indent + l));

      lines.push(this.config.loop.footer);

      return lines;
  }

  private generateFormalArguments(variables: Variable[]): string {
    return variables.map(v => {
        const typeKey = this.mapVarType(v.type);
        const innerType = this.config.type[typeKey as keyof typeof this.config.type];

        if (v.dims === 0) {
             return this.formatString(this.config.arg[typeKey as keyof typeof this.config.arg], {
                name: v.name,
                type: innerType
            });
        } else if (v.dims === 1) {
            return this.formatString(this.config.arg.seq, {
                name: v.name,
                type: innerType
            });
        } else if (v.dims === 2) {
             return this.formatString(this.config.arg['2d_seq'], {
                name: v.name,
                type: innerType
            });
        }
        return '';
    }).join(', ');
  }

  private generateActualArguments(variables: Variable[]): string {
     return variables.map(v => {
         if (v.dims === 0) return v.name;

         const key = v.dims === 1 ? 'seq' : '2d_seq';
         if (this.config.actual_arg && this.config.actual_arg[key]) {
             return this.formatString(this.config.actual_arg[key], {
                 name: v.name
             });
         }
         return v.name;
     }).join(', ');
  }

  private mapVarType(type: VarType): string {
    switch (type) {
      case 'int': return 'int';
      case 'index_int': return 'int';
      case 'float': return 'float';
      case 'string': return 'str';
      case 'char': return 'str';
      default: return 'int';
    }
  }

  private formatString(template: string, params: Record<string, string>): string {
    return template.replace(/{(\w+)}/g, (_, key) => params[key] || `{${key}}`);
  }

  private stringifyNode(node: ASTNode): string {
      if (!node) return '';
      switch (node.type) {
          case 'ident': return (node as any).value;
          case 'item': return (node as ItemNode).name;
          case 'number': return String((node as NumberNode).value);
          case 'binop': {
            const bin = node as BinOpNode;
            return `${this.stringifyNode(bin.left)} ${bin.op} ${this.stringifyNode(bin.right)}`;
          }
          default:
            if ('name' in node) return (node as any).name;
            if ('value' in node) return String((node as any).value);
            return '';
      }
  }
}
