import { ASTNode, FormatNode, ItemNode, LoopNode, VarType, BinOpNode, NumberNode } from "../analyzer/types.js";
import { CodeGeneratorConfig, TemplateContext } from "./types.js";

type Variable = {
  name: string;
  type: VarType;
  dims: number; // 0 for scalar, 1 for vector, 2 for matrix
  indices: ASTNode[];
  onDemandArray?: boolean;
};

export class UniversalGenerator {
  private config: CodeGeneratorConfig;
  private indent: string;
  private newline: string;
  private inputtedVariables: Set<string> = new Set();

  constructor(config: CodeGeneratorConfig) {
    this.config = config;
    this.indent = (config.indent_type == "tab" ? "\t" : " ").repeat(config.indent_width);
    this.newline = config.newline == "crlf" ? "\r\n" : "\n";
  }

  generate(
    format: FormatNode,
    variables: Variable[],
    multipleCases?: boolean,
    queryCases?: boolean,
    yesStr?: string,
    noStr?: string,
    mod?: number,
    returnType: string = "void",
    multipleColumns?: boolean,
    multipleRows?: boolean,
    variableArray?: boolean,
  ): TemplateContext {
    let queryLoopVar: string | undefined = undefined;
    if (queryCases) {
      // Heuristic: Find variable named Q or q
      const qVar = variables.find((v) => v.name.toUpperCase() === "Q");

      if (qVar) {
        queryLoopVar = qVar.name;
      } else {
        // Fallback: Check for last scalar integer, but favor Q if missing
        const lastScalar = [...variables]
          .reverse()
          .find((v) => v.dims === 0 && (v.type === "int" || v.type === "index_int"));
        if (lastScalar && lastScalar.name.toUpperCase() !== "N" && lastScalar.name.toUpperCase() !== "M") {
          // Use last scalar if it doesn't look like N or M (usually loop bounds for setup)
          queryLoopVar = lastScalar.name;
        } else {
          // Default fallback if no suitable variable found (e.g. Q was in unparsed block)
          queryLoopVar = "Q";
        }
      }
    }

    // Filter out query variables from declarations and arguments
    const declarableVariables = variables.filter((v) => v.type !== VarType.Query);

    const declaredVariables = new Set<string>();
    this.inputtedVariables.clear();
    // Input Reading (and interleaved declaration)
    const inputLines = this.generateInput(format.children, declarableVariables, declaredVariables, queryLoopVar);
    const inputPart = inputLines.map((line) => this.indent + line).join(this.newline);

    return {
      prediction_success: true,
      mod: mod,
      return_type: returnType,
      yes_str: yesStr,
      no_str: noStr,
      formal_arguments: this.generateFormalArguments(declarableVariables),
      actual_arguments: this.generateActualArguments(declarableVariables),
      input_part: inputPart,
      multiple_cases: multipleCases,
      multiple_columns: multipleColumns,
      multiple_rows: multipleRows,
      variable_array: variableArray,
      query_cases: queryCases,
      query_loop_var: queryLoopVar,
      tools: {
        version: "1.0.0", // TODO: Get from package.json
      },
    };
  }

  private getDependencies(node: ASTNode): string[] {
    const deps = new Set<string>();
    const visit = (n: ASTNode) => {
      if (!n) return;
      if (n.type === "ident") {
        deps.add((n as any).value || (n as any).name);
      } else if (n.type === "binop") {
        const bin = n as BinOpNode;
        visit(bin.left);
        visit(bin.right);
      } else if (n.type === "item") {
        deps.add((n as ItemNode).name);
      }
    };
    visit(node);
    return Array.from(deps);
  }

  private areDependenciesMet(variable: Variable): boolean {
    for (const indexNode of variable.indices) {
      const deps = this.getDependencies(indexNode);
      for (const dep of deps) {
        if (!this.inputtedVariables.has(dep)) {
          return false;
        }
      }
    }
    return true;
  }

  private generateDeclarationGroup(variables: Variable[], allVariables: Variable[]): string {
    if (variables.length === 0) return "";

    const firstVar = variables[0];
    const typeKey = this.mapVarType(firstVar.type);
    const defaultValue = this.config.default[typeKey as keyof typeof this.config.default] || "";

    let template = "";
    if (firstVar.dims === 0) {
      template = this.config.declare[typeKey as keyof typeof this.config.declare];
    } else if (firstVar.dims === 1) {
      template = this.config.declare_and_allocate.seq;
    } else if (firstVar.dims === 2) {
      template = this.config.declare_and_allocate["2d_seq"];
    }

    const namePlaceholder = "{name}";
    const placeholderIndex = template.indexOf(namePlaceholder);

    if (placeholderIndex === -1) {
      // Fallback if no {name} placeholder
      return variables.map((v) => this.generateDeclaration(v, allVariables)).join(this.newline);
    }

    const innerType = this.config.type[typeKey as keyof typeof this.config.type];
    const prefix = this.formatString(template.substring(0, placeholderIndex), {
      type: innerType,
    });
    const itemTemplate = template.substring(placeholderIndex);

    const items = variables.map((v) => {
      if (v.dims === 0) {
        return this.formatString(itemTemplate, {
          name: v.name,
          type: innerType,
          default: defaultValue,
        });
      } else if (v.dims === 1) {
        const len = this.stringifyNode(v.indices[0], allVariables);
        return this.formatString(itemTemplate, {
          name: v.name,
          type: innerType,
          length: len,
          default: defaultValue,
        });
      } else if (v.dims === 2) {
        const lenI = this.stringifyNode(v.indices[0], allVariables);
        const lenJ = this.stringifyNode(v.indices[1], allVariables);

        if (v.onDemandArray) {
          // Re-use 1D template but with 2D inner type
          // For C++, declare_and_allocate['2d_seq'] is "std::vector<std::vector<{type}>> {name}({length_i}, std::vector<{type}>({length_j}))"
          // We want "std::vector<std::vector<{type}>> {name}({length_i})"

          // Let's try to detect if it's the 2D template
          if (template === this.config.declare_and_allocate["2d_seq"]) {
            return this.formatString("{name}({length_i})", {
              name: v.name,
              length_i: lenI,
            });
          }
        }

        return this.formatString(itemTemplate, {
          name: v.name,
          type: innerType,
          length_i: lenI,
          length_j: lenJ,
          default: defaultValue,
        });
      }
      return v.name;
    });

    let result = prefix + items.join(", ");
    if (this.config.declare_group && this.config.append_semicolon) {
      result += ";";
    }
    return result;
  }

  private generateDeclaration(variable: Variable, allVariables: Variable[]): string {
    const typeKey = this.mapVarType(variable.type);
    const defaultValue = this.config.default[typeKey as keyof typeof this.config.default] || "";

    let decl = "";
    const innerType = this.config.type[typeKey as keyof typeof this.config.type];
    if (variable.dims === 0) {
      decl = this.formatString(this.config.declare[typeKey as keyof typeof this.config.declare], {
        name: variable.name,
        type: innerType,
        default: defaultValue,
      });
    } else if (variable.dims === 1) {
      // For vectors, we use declare_and_allocate if possible, or just declare if length is not known (simplified here)
      // Assuming we know length from indices for now
      const len = this.stringifyNode(variable.indices[0], allVariables);

      decl = this.formatString(this.config.declare_and_allocate.seq, {
        name: variable.name,
        type: innerType,
        length: len,
        default: defaultValue,
      });
    } else if (variable.dims === 2) {
      const lenI = this.stringifyNode(variable.indices[0], allVariables);
      const lenJ = this.stringifyNode(variable.indices[1], allVariables);

      if (variable.onDemandArray) {
        // For on-demand 2D arrays, we only allocate the first dimension
        decl = this.formatString(this.config.declare_and_allocate["2d_outer_only"], {
          name: variable.name,
          length: lenI,
        });
      } else {
        decl = this.formatString(this.config.declare_and_allocate["2d_seq"], {
          name: variable.name,
          type: innerType,
          length_i: lenI,
          length_j: lenJ,
          default: defaultValue,
        });
      }
    } else {
      decl = `// TODO: declaration for ${variable.name}`;
    }

    if (
      !this.config.declare_group &&
      this.config.append_semicolon &&
      decl &&
      !decl.startsWith("//") &&
      !decl.endsWith(";")
    ) {
      decl += ";";
    }

    return decl;
  }

  private collectVariables(nodes: ASTNode[], variables: Variable[]): string[] {
    const vars = new Set<string>();
    const visit = (node: ASTNode) => {
      if (!node) return;
      if (node.type === "item") {
        const item = node as ItemNode;
        // Check if this item corresponds to a known variable
        if (variables.some((v) => v.name === item.name)) {
          vars.add(item.name);
        }
      } else if (node.type === "loop") {
        const loop = node as LoopNode;
        // Recursively scan loop body
        loop.body.forEach((child) => visit(child));
      }
      // No need to traverse other node types deeply for variable *usage* in input context usually,
      // but 'item' indices might contain variables.
      // However, 'item' node itself is what we are looking for as "being read".
    };
    nodes.forEach((node) => visit(node));
    return Array.from(vars);
  }

  private generateInput(
    nodes: ASTNode[],
    variables: Variable[],
    declaredVariables: Set<string>,
    skipLoopVar?: string,
  ): string[] {
    const lines: string[] = [];

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (node.type === "item") {
        const itemNode = node as ItemNode;
        const variable = variables.find((v) => v.name === itemNode.name);

        // Declare if needed
        if (variable && !declaredVariables.has(variable.name)) {
          if (this.config.declare_group) {
            const sameGroupVars = this.findVariablesInSameGroup(variables, declaredVariables, variable);
            lines.push(this.generateDeclarationGroup(sameGroupVars, variables));
            for (const v of sameGroupVars) {
              declaredVariables.add(v.name);
            }
          } else {
            lines.push(this.generateDeclaration(variable, variables));
            declaredVariables.add(variable.name);
          }
        }

        let groupedInput = "";
        if (this.config.input_separator && this.config.declare_group) {
          const parts = this.getInputTemplateParts(itemNode, variables);
          if (parts) {
            const group: ItemNode[] = [itemNode];
            for (let j = i + 1; j < nodes.length; j++) {
              const nextNode = nodes[j];
              if (nextNode.type !== "item") break;
              const nextItemNode = nextNode as ItemNode;
              const nextParts = this.getInputTemplateParts(nextItemNode, variables);
              if (!nextParts || nextParts.prefix !== parts.prefix || nextParts.suffix !== parts.suffix) break;

              // Also ensure it doesn't need declaration (or it's already declared)
              const nextVariable = variables.find((v) => v.name === nextItemNode.name);
              if (nextVariable && !declaredVariables.has(nextVariable.name)) {
                // If we need to declare it, we check if it belongs to the same group as the current var
                // But simplified: we only group if it's already declared or being declared now.
                // Actually, the current loop handles declaration for current item.
                // If the next item needs declaration, it might not be in the same declaration group.
                // To be safe, let's only group if the next variable doesn't need a new declaration line.
                // (i.e. it was already declared, or it will be part of the same declaration group as a previous one)
                // However, findVariablesInSameGroup is used for declaration grouping.
                // Let's check if the next variable IS already declared or will be.
                // Wait, if it's not in declaredVariables, it will be handled by the next iteration of the outer loop.
                // So we should only consume it here if we can handle its declaration too.
                break;
              }

              group.push(nextItemNode);
            }

            if (group.length > 1) {
              const accesses = group.map((n) => this.generateItemAccess(n, variables));
              groupedInput = parts.prefix + accesses.join(this.config.input_separator) + parts.suffix;
              i += group.length - 1;
              for (const n of group) {
                const v = variables.find((var_) => var_.name === n.name);
                if (v) this.inputtedVariables.add(v.name);
              }
            }
          }
        }

        if (groupedInput) {
          lines.push(groupedInput);
        } else {
          lines.push(this.generateItemInput(itemNode, variables));
          if (variable) {
            this.inputtedVariables.add(variable.name);
          }
        }
      } else if (node.type === "loop") {
        const loopNode = node as LoopNode;
        if (skipLoopVar && this.stringifyNode(loopNode.end, variables) === skipLoopVar) {
          continue;
        }

        // Check for variables inside the loop that need declaration
        const varsInLoopNames = this.collectVariables(loopNode.body, variables);
        for (const varName of varsInLoopNames) {
          if (!declaredVariables.has(varName)) {
            const variable = variables.find((v) => v.name === varName);
            if (variable) {
              if (this.config.declare_group) {
                const sameGroupVars = this.findVariablesInSameGroup(variables, declaredVariables, variable);
                lines.push(this.generateDeclarationGroup(sameGroupVars, variables));
                for (const v of sameGroupVars) {
                  declaredVariables.add(v.name);
                }
              } else {
                lines.push(this.generateDeclaration(variable, variables));
                declaredVariables.add(variable.name);
              }
            }
          }
        }

        // Resize on-demand arrays
        const length = this.stringifyNode(loopNode.end, variables);
        const resizedInThisLoop = new Set<string>();
        for (const varName of varsInLoopNames) {
          const v = variables.find((v) => v.name === varName);
          if (v && v.onDemandArray && v.dims === 2 && !resizedInThisLoop.has(varName)) {
            const itemNode = this.findItemNode(loopNode.body, varName);
            if (itemNode && itemNode.indices.length === 2) {
              const innerIndex = this.stringifyNode(itemNode.indices[1], variables);
              if (innerIndex === loopNode.variable) {
                const outerIndex = this.stringifyNode(itemNode.indices[0], variables);
                const resizeLine = this.generateResize(v, outerIndex, length);
                if (resizeLine) {
                  lines.push(resizeLine);
                  resizedInThisLoop.add(varName);
                }
              }
            }
          }
        }

        lines.push(...this.generateLoopInput(loopNode, variables, declaredVariables));
      }
    }
    return lines;
  }

  private findVariablesInSameGroup(
    allVariables: Variable[],
    declaredVariables: Set<string>,
    currentVar: Variable,
  ): Variable[] {
    const group: Variable[] = [currentVar];

    for (const variable of allVariables) {
      if (
        !declaredVariables.has(variable.name) &&
        !group.some((gv) => gv.name === variable.name) &&
        variable.type === currentVar.type &&
        variable.dims === currentVar.dims &&
        this.areDependenciesMet(variable) &&
        this.areIndicesSame(variable, currentVar)
      ) {
        group.push(variable);
      }
    }

    // Keep the order of variables as they appear in allVariables
    const result: Variable[] = [];
    for (const v of allVariables) {
      if (group.some((gv) => gv.name === v.name)) {
        result.push(v);
      }
    }

    return result;
  }

  private areIndicesSame(v1: Variable, v2: Variable, allVariables: Variable[]): boolean {
    if (v1.dims !== v2.dims) return false;
    for (let i = 0; i < v1.dims; i++) {
      if (this.stringifyNode(v1.indices[i], allVariables) !== this.stringifyNode(v2.indices[i], allVariables)) {
        return false;
      }
    }
    return true;
  }

  private generateItemAccess(node: ItemNode, variables: Variable[]): string {
    const variable = variables.find((v) => v.name === node.name);
    if (!variable) return node.name;

    if (variable.dims === 0) {
      return variable.name;
    } else if (variable.dims === 1) {
      return this.formatString(this.config.access.seq, {
        name: variable.name,
        index: this.stringifyNode(node.indices[0], variables),
      });
    } else if (variable.dims === 2) {
      return this.formatString(this.config.access["2d_seq"], {
        name: variable.name,
        index_i: this.stringifyNode(node.indices[0], variables),
        index_j: this.stringifyNode(node.indices[1], variables),
      });
    }
    return variable.name;
  }

  private getInputTemplateParts(node: ItemNode, variables: Variable[]): { prefix: string; suffix: string } | null {
    const variable = variables.find((v) => v.name === node.name);
    if (!variable || variable.type === VarType.Query) return null;

    const typeKey = this.mapVarType(variable.type);
    const template = this.config.input[typeKey as keyof typeof this.config.input];
    if (!template) return null;

    const placeholder = "{name}";
    const index = template.indexOf(placeholder);
    if (index === -1) return null;

    return {
      prefix: template.substring(0, index),
      suffix: template.substring(index + placeholder.length),
    };
  }

  private generateItemInput(node: ItemNode, variables: Variable[]): string {
    const parts = this.getInputTemplateParts(node, variables);
    if (!parts) {
      const variable = variables.find((v) => v.name === node.name);
      if (variable && variable.type === VarType.Query) return "// TODO";
      return `// Unknown variable ${node.name}`;
    }
    const access = this.generateItemAccess(node, variables);
    return parts.prefix + access + parts.suffix;
  }

  private generateLoopInput(node: LoopNode, variables: Variable[], declaredVariables: Set<string>): string[] {
    const lines: string[] = [];
    // Loop header
    // "for(int {loop_var} = 0 ; {loop_var} < {length} ; {loop_var}++){"

    const loopVar = node.variable;
    const length = this.stringifyNode(node.end, variables);

    const header = this.formatString(this.config.loop.header, {
      loop_var: loopVar,
      length: length,
    });

    lines.push(header);

    // Body
    const bodyLines = this.generateInput(node.body, variables, declaredVariables);
    lines.push(...bodyLines.map((l) => this.indent + l)); // Add indent

    // Footer
    lines.push(this.config.loop.footer);

    return lines;
  }

  private findItemNode(nodes: ASTNode[], name: string): ItemNode | null {
    for (const node of nodes) {
      if (node.type === "item" && (node as ItemNode).name === name) {
        return node as ItemNode;
      }
      if (node.type === "loop") {
        const found = this.findItemNode((node as LoopNode).body, name);
        if (found) return found;
      }
    }
    return null;
  }

  private generateResize(variable: Variable, outerIndex: string, length: string): string {
    if (this.config.type.str === "str") {
      // Python
      return `${variable.name}[${outerIndex}] = [0] * ${length}`;
    } else {
      // C++
      return `${variable.name}[${outerIndex}].resize(${length});`;
    }
  }

  private generateFormalArguments(variables: Variable[]): string {
    return variables
      .map((v) => {
        const typeKey = this.mapVarType(v.type);
        const innerType = this.config.type[typeKey as keyof typeof this.config.type];

        if (v.dims === 0) {
          return this.formatString(this.config.arg[typeKey as keyof typeof this.config.arg], {
            name: v.name,
            type: innerType, // Though scalars don't usually use {type} in template
          });
        } else if (v.dims === 1) {
          return this.formatString(this.config.arg.seq, {
            name: v.name,
            type: innerType,
          });
        } else if (v.dims === 2) {
          return this.formatString(this.config.arg["2d_seq"], {
            name: v.name,
            type: innerType,
          });
        }
        return "";
      })
      .join(", ");
  }

  private generateActualArguments(variables: Variable[]): string {
    return variables
      .map((v) => {
        if (v.dims === 0) return v.name;

        const key = v.dims === 1 ? "seq" : "2d_seq";
        // Check if actual_arg template exists, otherwise just name
        if (this.config.actual_arg && this.config.actual_arg[key]) {
          return this.formatString(this.config.actual_arg[key], {
            name: v.name,
          });
        }
        return v.name;
      })
      .join(", ");
  }

  private mapVarType(type: VarType): string {
    switch (type) {
      case "int":
        return "int";
      case "index_int":
        return "int"; // treated as int
      case "float":
        return "float";
      case "string":
        return "str";
      case "char":
        return "str"; // Treat char as str for now, or add char to config
      case VarType.Query:
        return "int"; // Fallback to int for vector<long long> declaration
      default:
        return "int";
    }
  }

  // Helper to replace {key} with value
  private formatString(template: string, params: Record<string, string>): string {
    return template.replace(/{(\w+)}/g, (_, key) => params[key] || `{${key}}`);
  }

  private stringifyNode(node: ASTNode, variables: Variable[]): string {
    if (!node) return "";
    switch (node.type) {
      case "ident":
        return (node as any).value || (node as any).name;
      case "item": {
        const item = node as ItemNode;
        if (item.indices.length === 0) return item.name;
        // Recursive access
        return this.generateItemAccess(item, variables);
      }
      case "number":
        return String((node as NumberNode).value);
      case "binop": {
        const bin = node as BinOpNode;
        return `${this.stringifyNode(bin.left, variables)} ${bin.op} ${this.stringifyNode(bin.right, variables)}`;
      }
      default:
        // Check if it has 'name' (ItemNode acting as variable reference)
        if ("name" in node) return (node as any).name;
        // Check if it has 'value' (Token-like)
        if ("value" in node) return String((node as any).value);
        return "";
    }
  }
}
