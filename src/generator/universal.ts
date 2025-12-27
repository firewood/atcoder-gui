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
import { InputPart } from './pipeline.js';

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
    inputParts?: InputPart[]
  ): TemplateContext {
    const lines: string[] = [];
    const allVariables: Variable[] = [];
    const declaredVariables = new Map<string, Variable>();

    // Helper to add variables strictly if not already present
    // Renames if collision with different type occurs
    const resolveVariable = (v: Variable, partIndex: number): Variable => {
        const existing = declaredVariables.get(v.name);
        if (existing) {
             if (existing.type !== v.type || existing.dims !== v.dims) {
                 // Collision! Rename
                 const newName = `${v.name}_${partIndex}`;
                 // We need to clone 'v' and change name
                 const newVar = { ...v, name: newName };
                 return newVar;
             }
             return existing; // Reuse
        }
        return v;
    };

    if (inputParts && inputParts.length > 0) {
        // First pass: Resolve all variables and collect unique ones for declaration/arguments
        inputParts.forEach((part, index) => {
             const resolvedVars: Variable[] = [];
             for (const v of part.variables) {
                 const resolved = resolveVariable(v, index);
                 if (!declaredVariables.has(resolved.name)) {
                     declaredVariables.set(resolved.name, resolved);
                     allVariables.push(resolved);
                 }
                 resolvedVars.push(resolved);
             }
             // Store the resolved variables back into a temporary structure to use for generation
             // We can't modify 'part.variables' directly easily, so we pass a mapping or list to generateInput
             // For simplicity, we'll re-resolve in the generation loop or assume order matches.
             // Actually, `generateInput` needs to find variable by AST name.
        });

        // We need a way to look up the resolved variable given the original AST name *within the context of a part*.
        // So we need `Map<OriginalName, ResolvedVariable>` for each part.

        inputParts.forEach((part, index) => {
             const scopeMap = new Map<string, Variable>();
             part.variables.forEach(v => {
                 const resolved = resolveVariable(v, index); // This should be deterministic and match above
                 scopeMap.set(v.name, resolved);
             });

             if (index > 0) {
                 lines.push('');
                 lines.push(`// Additional Input Format ${index}`);
             }

             // Declarations (if not already declared in lines - wait, lines are sequential)
             // We should declare *all* variables at top (or as they appear).
             // Logic in `generateDeclaration`: check if *this* resolved variable has been declared *in the output code* yet?
             // Since we iterate parts, we can check a set `printedDeclarations`.

        });

        // Let's rewrite the loop with cleaner state
        const printedDeclarations = new Set<string>();

        inputParts.forEach((part, index) => {
             const scopeMap = new Map<string, Variable>();
             // Re-resolve to get the scoped variables for this part
             part.variables.forEach(v => {
                 // Logic must be identical to the first pass
                 const existing = declaredVariables.get(v.name);
                 if (existing && (existing.type !== v.type || existing.dims !== v.dims)) {
                      scopeMap.set(v.name, { ...v, name: `${v.name}_${index}` });
                 } else {
                      scopeMap.set(v.name, existing || v);
                 }
             });

             if (index > 0) {
                 lines.push('');
                 lines.push(`// Additional Input Format ${index}`);
             }

             // Declare variables used in this part if not yet declared
             scopeMap.forEach((resolvedVar) => {
                 if (!printedDeclarations.has(resolvedVar.name)) {
                     lines.push(this.generateDeclaration(resolvedVar));
                     printedDeclarations.add(resolvedVar.name);
                 }
             });

             // Input reading
             lines.push(...this.generateInput(part.format.children, scopeMap));
        });

    } else {
        // Fallback for single format
        variables.forEach(v => {
             declaredVariables.set(v.name, v);
             allVariables.push(v);
        });

        const scopeMap = new Map<string, Variable>();
        variables.forEach(v => scopeMap.set(v.name, v));

        for (const variable of variables) {
             lines.push(this.generateDeclaration(variable));
        }
        lines.push(...this.generateInput(format.children, scopeMap));
    }

    const inputPart = lines.map((line) => this.indent + line).join('\n');

    return {
      prediction_success: true,
      formal_arguments: this.generateFormalArguments(allVariables),
      actual_arguments: this.generateActualArguments(allVariables),
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

  private generateInput(nodes: ASTNode[], scopeMap: Map<string, Variable>): string[] {
      const lines: string[] = [];

      for (const node of nodes) {
          if (node.type === 'item') {
              lines.push(this.generateItemInput(node as ItemNode, scopeMap));
          } else if (node.type === 'loop') {
              lines.push(...this.generateLoopInput(node as LoopNode, scopeMap));
          }
      }
      return lines;
  }

  private generateItemInput(node: ItemNode, scopeMap: Map<string, Variable>): string {
     // Look up variable in the current scope
     const variable = scopeMap.get(node.name);
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

  private generateLoopInput(node: LoopNode, scopeMap: Map<string, Variable>): string[] {
      const lines: string[] = [];
      const loopVar = node.variable;
      const length = this.stringifyNode(node.end);

      const header = this.formatString(this.config.loop.header, {
          loop_var: loopVar,
          length: length
      });

      lines.push(header);

      const bodyLines = this.generateInput(node.body, scopeMap);
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
