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
    const setupPart = parts[0];
    const allVariables: Variable[] = setupPart.variables;

    // 1. Setup (Part 0)
    for (const variable of setupPart.variables) {
      lines.push(this.generateDeclaration(variable));
    }
    lines.push(...this.generateInput(setupPart.formatTree.children, setupPart.variables));

    const inputPart = lines.map((line) => this.indent + line).join('\n');

    return {
      prediction_success: true,
      formal_arguments: this.generateFormalArguments(allVariables),
      actual_arguments: this.generateActualArguments(allVariables),
      input_part: inputPart,
      multiple_cases: multipleCases,
      query_cases: true,
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
