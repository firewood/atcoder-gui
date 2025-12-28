import {
  ASTNode,
  FormatNode,
  ItemNode,
  LoopNode,
  VarType,
  BinOpNode,
  NumberNode,
} from '../analyzer/types.js';
import { CodeGeneratorConfig, QueryCase, TemplateContext } from './types.js';

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

    const setupPart = parts[0];
    const setupLines: string[] = [];

    // 1. Setup (Part 0)
    for (const variable of setupPart.variables) {
      setupLines.push(this.generateDeclaration(variable));
    }
    setupLines.push(...this.generateInput(setupPart.formatTree.children, setupPart.variables));

    const querySetupInputPart = setupLines.map((line) => this.indent + line).join('\n');


    // 2. Loop Q
    let loopVarName = setupPart.variables.find(v => v.name === 'Q' || v.name === 'q')?.name;
    if (!loopVarName) {
        // Fallback: look for any scalar int variable in Setup.
        const scalarInts = setupPart.variables.filter(v => v.dims === 0 && (v.type === 'int' || v.type === 'index_int'));
        if (scalarInts.length > 0) {
            loopVarName = scalarInts[scalarInts.length - 1].name;
        } else {
            loopVarName = 'Q';
        }
    }

    // 3. Dispatch Logic
    const queryCases: QueryCase[] = [];

    for (let i = 1; i < parts.length; i++) {
        const part = parts[i];
        const format = part.formatTree;
        // Check first child of format
        let firstTokenValue: string | number | undefined;
        if (format.children.length > 0) {
            const firstNode = format.children[0];
            if (firstNode.type === 'number') {
                firstTokenValue = (firstNode as NumberNode).value;
            }
        }

        const discriminator = firstTokenValue !== undefined ? String(firstTokenValue) : String(i);

        const partLines: string[] = [];
        for (const variable of part.variables) {
            partLines.push(this.generateDeclaration(variable));
        }
        partLines.push(...this.generateInput(part.formatTree.children, part.variables));

        const caseInputPart = partLines.map(l => this.indent + this.indent + this.indent + l).join('\n');

        // Combine setup variables + case variables for arguments
        // Use references for queries to avoid copying
        const caseFormalArgs = this.generateFormalArguments([...setupPart.variables, ...part.variables], true);
        const caseActualArgs = this.generateActualArguments([...setupPart.variables, ...part.variables]);

        queryCases.push({
            value: discriminator,
            input_part: caseInputPart,
            formal_arguments: caseFormalArgs,
            actual_arguments: caseActualArgs
        });
    }

    // Legacy support for monolithic input_part
    const monolithicLines = [...setupLines];
    monolithicLines.push(`while(${loopVarName}--){`);
    monolithicLines.push(`${this.indent}int type; cin >> type;`);
    for (let i = 0; i < queryCases.length; i++) {
        const c = queryCases[i];
        const branchType = i === 0 ? 'if' : 'else if';
        monolithicLines.push(`${this.indent}${branchType} (type == ${c.value}) {`);

        const part = parts[i + 1];
        const partLines: string[] = [];
        for (const variable of part.variables) {
            partLines.push(this.generateDeclaration(variable));
        }
        partLines.push(...this.generateInput(part.formatTree.children, part.variables));
        monolithicLines.push(...partLines.map(l => this.indent + this.indent + l));

        monolithicLines.push(`${this.indent}}`);
    }
    monolithicLines.push(`}`);
    const inputPart = monolithicLines.map((line) => this.indent + line).join('\n');

    // Use references for Setup solve as well
    return {
      prediction_success: true,
      formal_arguments: this.generateFormalArguments(setupPart.variables, true),
      actual_arguments: this.generateActualArguments(setupPart.variables),
      input_part: inputPart,
      multiple_cases: multipleCases,
      target_structure: 'query_problem',
      query_loop_var: loopVarName,
      query_setup_input_part: querySetupInputPart,
      query_cases: queryCases,
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
      target_structure: 'model_solution',
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

  private generateFormalArguments(variables: Variable[], useReferences: boolean = false): string {
    const seen = new Set<string>();
    const uniqueVars: Variable[] = [];

    // De-duplicate variables by name (handling potential conflicts between setup and query vars)
    for (const v of variables) {
        if (!seen.has(v.name)) {
            seen.add(v.name);
            uniqueVars.push(v);
        }
    }

    return uniqueVars.map(v => {
        const typeKey = this.mapVarType(v.type);
        const innerType = this.config.type[typeKey as keyof typeof this.config.type];

        let result = '';
        if (v.dims === 0) {
             result = this.formatString(this.config.arg[typeKey as keyof typeof this.config.arg], {
                name: v.name,
                type: innerType
            });
        } else if (v.dims === 1) {
            result = this.formatString(this.config.arg.seq, {
                name: v.name,
                type: innerType
            });
        } else if (v.dims === 2) {
             result = this.formatString(this.config.arg['2d_seq'], {
                name: v.name,
                type: innerType
            });
        }

        if (useReferences && v.dims > 0) {
            // HACK: Insert '&' before variable name if it's not already there.
            // Assumption: config.arg.* patterns are like "type name" or "vector<type> name".
            // We want "vector<type>& name".
            // We can replace " name" with "& name" or find the last space.
            // But if the type includes pointer, it might be tricky.
            // Safer: split by name and rejoin.
            const name = v.name;
            const idx = result.lastIndexOf(name);
            if (idx !== -1) {
                // Check if preceded by space
                if (result[idx-1] === ' ') {
                    return result.slice(0, idx-1) + '& ' + result.slice(idx);
                }
            }
        }
        return result;
    }).join(', ');
  }

  private generateActualArguments(variables: Variable[]): string {
    const seen = new Set<string>();
    const uniqueVars: Variable[] = [];

    for (const v of variables) {
        if (!seen.has(v.name)) {
            seen.add(v.name);
            uniqueVars.push(v);
        }
    }

     return uniqueVars.map(v => {
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
