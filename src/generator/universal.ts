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
    format: FormatNode,
    variables: Variable[],
    multipleCases?: boolean,
    queryCases?: boolean,
  ): TemplateContext {
    let queryLoopVar: string | undefined = undefined;
    if (queryCases) {
      // Heuristic: Find variable named Q or q
      const qVar = variables.find((v) => v.name.toUpperCase() === 'Q');

      if (qVar) {
        queryLoopVar = qVar.name;
      } else {
        // Fallback: Check for last scalar integer, but favor Q if missing
        const lastScalar = [...variables]
          .reverse()
          .find(
            (v) => v.dims === 0 && (v.type === 'int' || v.type === 'index_int'),
          );
        if (
          lastScalar &&
          lastScalar.name.toUpperCase() !== 'N' &&
          lastScalar.name.toUpperCase() !== 'M'
        ) {
          // Use last scalar if it doesn't look like N or M (usually loop bounds for setup)
          queryLoopVar = lastScalar.name;
        } else {
          // Default fallback if no suitable variable found (e.g. Q was in unparsed block)
          queryLoopVar = 'Q';
        }
      }
    }

    const lines: string[] = [];

    // Filter out query variables from declarations and arguments
    const declarableVariables = variables.filter(
      (v) => v.type !== VarType.Query,
    );

    // 1. Variable Declarations
    for (const variable of declarableVariables) {
      lines.push(this.generateDeclaration(variable));
    }

    // 2. Input Reading
    lines.push(...this.generateInput(format.children, variables, queryLoopVar));

    const inputPart = lines.map((line) => this.indent + line).join('\n');

    return {
      prediction_success: true,
      formal_arguments: this.generateFormalArguments(declarableVariables),
      actual_arguments: this.generateActualArguments(declarableVariables),
      input_part: inputPart,
      multiple_cases: multipleCases,
      query_cases: queryCases,
      query_loop_var: queryLoopVar,
      tools: {
        version: '1.0.0', // TODO: Get from package.json
      },
    };
  }

  private generateDeclaration(variable: Variable): string {
    const typeKey = this.mapVarType(variable.type);

    if (variable.dims === 0) {
      return this.formatString(
        this.config.declare[typeKey as keyof typeof this.config.declare],
        {
          name: variable.name,
        },
      );
    } else if (variable.dims === 1) {
      // For vectors, we use declare_and_allocate if possible, or just declare if length is not known (simplified here)
      // Assuming we know length from indices for now
      const len = this.stringifyNode(variable.indices[0]);
      const innerType =
        this.config.type[typeKey as keyof typeof this.config.type];

      return this.formatString(this.config.declare_and_allocate.seq, {
        name: variable.name,
        type: innerType,
        length: len,
      });
    } else if (variable.dims === 2) {
      const lenI = this.stringifyNode(variable.indices[0]);
      const lenJ = this.stringifyNode(variable.indices[1]);
      const innerType =
        this.config.type[typeKey as keyof typeof this.config.type];

      return this.formatString(this.config.declare_and_allocate['2d_seq'], {
        name: variable.name,
        type: innerType,
        length_i: lenI,
        length_j: lenJ,
      });
    }

    return `// TODO: declaration for ${variable.name}`;
  }

  private generateInput(
    nodes: ASTNode[],
    variables: Variable[],
    skipLoopVar?: string,
  ): string[] {
    const lines: string[] = [];

    for (const node of nodes) {
      if (node.type === 'item') {
        lines.push(this.generateItemInput(node as ItemNode, variables));
      } else if (node.type === 'loop') {
        const loopNode = node as LoopNode;
        if (skipLoopVar && this.stringifyNode(loopNode.end) === skipLoopVar) {
          continue;
        }
        lines.push(...this.generateLoopInput(loopNode, variables));
      }
    }
    return lines;
  }

  private generateItemInput(node: ItemNode, variables: Variable[]): string {
    const variable = variables.find((v) => v.name === node.name);
    if (!variable) return `// Unknown variable ${node.name}`;

    if (variable.type === VarType.Query) {
      return '// TODO';
    }

    const typeKey = this.mapVarType(variable.type);

    if (variable.dims === 0) {
      return this.formatString(
        this.config.input[typeKey as keyof typeof this.config.input],
        {
          name: variable.name,
        },
      );
    } else if (variable.dims === 1) {
      // input array item like a[i]
      // The AST for 'item' in a loop has indices.
      const access = this.formatString(this.config.access.seq, {
        name: variable.name,
        index: this.stringifyNode(node.indices[0]),
      });
      return this.formatString(
        this.config.input[typeKey as keyof typeof this.config.input],
        {
          name: access,
        },
      );
    } else if (variable.dims === 2) {
      const access = this.formatString(this.config.access['2d_seq'], {
        name: variable.name,
        index_i: this.stringifyNode(node.indices[0]),
        index_j: this.stringifyNode(node.indices[1]),
      });
      return this.formatString(
        this.config.input[typeKey as keyof typeof this.config.input],
        {
          name: access,
        },
      );
    }

    return `// TODO: input for ${node.name}`;
  }

  private generateLoopInput(node: LoopNode, variables: Variable[]): string[] {
    const lines: string[] = [];
    // Loop header
    // "for(int {loop_var} = 0 ; {loop_var} < {length} ; {loop_var}++){"

    const loopVar = node.variable;
    const length = this.stringifyNode(node.end); // Simplified

    const header = this.formatString(this.config.loop.header, {
      loop_var: loopVar,
      length: length,
    });

    lines.push(header);

    // Body
    const bodyLines = this.generateInput(node.body, variables);
    lines.push(...bodyLines.map((l) => this.indent + l)); // Add indent

    // Footer
    lines.push(this.config.loop.footer);

    return lines;
  }

  private generateFormalArguments(variables: Variable[]): string {
    return variables
      .map((v) => {
        const typeKey = this.mapVarType(v.type);
        const innerType =
          this.config.type[typeKey as keyof typeof this.config.type];

        if (v.dims === 0) {
          return this.formatString(
            this.config.arg[typeKey as keyof typeof this.config.arg],
            {
              name: v.name,
              type: innerType, // Though scalars don't usually use {type} in template
            },
          );
        } else if (v.dims === 1) {
          return this.formatString(this.config.arg.seq, {
            name: v.name,
            type: innerType,
          });
        } else if (v.dims === 2) {
          return this.formatString(this.config.arg['2d_seq'], {
            name: v.name,
            type: innerType,
          });
        }
        return '';
      })
      .join(', ');
  }

  private generateActualArguments(variables: Variable[]): string {
    return variables
      .map((v) => {
        if (v.dims === 0) return v.name;

        const key = v.dims === 1 ? 'seq' : '2d_seq';
        // Check if actual_arg template exists, otherwise just name
        if (this.config.actual_arg && this.config.actual_arg[key]) {
          return this.formatString(this.config.actual_arg[key], {
            name: v.name,
          });
        }
        return v.name;
      })
      .join(', ');
  }

  private mapVarType(type: VarType): string {
    switch (type) {
      case 'int':
        return 'int';
      case 'index_int':
        return 'int'; // treated as int
      case 'float':
        return 'float';
      case 'string':
        return 'str';
      case 'char':
        return 'str'; // Treat char as str for now, or add char to config
      case VarType.Query:
        return 'int'; // Fallback to int for vector<long long> declaration
      default:
        return 'int';
    }
  }

  // Helper to replace {key} with value
  private formatString(
    template: string,
    params: Record<string, string>,
  ): string {
    return template.replace(/{(\w+)}/g, (_, key) => params[key] || `{${key}}`);
  }

  private stringifyNode(node: ASTNode): string {
    if (!node) return '';
    switch (node.type) {
      case 'ident':
        return (node as any).value; // TODO: Check Token vs AST structure. FormatTree uses strings? No, ASTNode.
      // FormatNode children are ASTNode. But ASTNode definition in types.ts is minimal.
      // Looking at types.ts:
      // export interface Token { type: TokenType; value?: string | number; ... }
      // export interface ASTNode { type: string; }
      // export interface NumberNode extends ASTNode { type: 'number'; value: number; }
      // export interface BinOpNode { ... left, right, op ... }

      case 'item':
        return (node as ItemNode).name; // Should not happen in index expression usually, unless variable length
      case 'number':
        return String((node as NumberNode).value);
      case 'binop': {
        const bin = node as BinOpNode;
        return `${this.stringifyNode(bin.left)} ${bin.op} ${this.stringifyNode(
          bin.right,
        )}`;
      }
      default:
        // Check if it has 'name' (ItemNode acting as variable reference)
        if ('name' in node) return (node as any).name;
        // Check if it has 'value' (Token-like)
        if ('value' in node) return String((node as any).value);
        return '';
    }
  }
}
