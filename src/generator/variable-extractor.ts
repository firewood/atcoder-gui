import {
  FormatNode,
  ASTNode,
  ItemNode,
  LoopNode,
  VarType,
} from "../analyzer/types.js";

export interface VariableInfo {
  name: string;
  type: VarType;
  dims: number;
  indices: ASTNode[];
}

export class VariableExtractor {
  private vars = new Map<
    string,
    { dims: number; indices: ASTNode[]; loopDepth: number }
  >();
  private collapsedVars = new Set<string>();

  setCollapsedVars(collapsedVars: Set<string>) {
    this.collapsedVars = collapsedVars;
  }

  extract(node: FormatNode): void {
    this.visit(node, []);
  }

  private visit(node: ASTNode, loops: LoopNode[]) {
    if (!node) return;

    if (node.type === "format") {
      (node as FormatNode).children.forEach((c) => this.visit(c, loops));
    } else if (node.type === "loop") {
      const loop = node as LoopNode;
      // Visit bounds first
      this.visit(loop.start, loops);
      this.visit(loop.end, loops);
      // Visit body with updated loop stack
      loop.body.forEach((c) => this.visit(c, [...loops, loop]));
    } else if (node.type === "item") {
      const item = node as ItemNode;
      const existing = this.vars.get(item.name) || {
        dims: 0,
        indices: [],
        loopDepth: 0,
      };
      const currentLoopDepth = loops.length;

      // We only update if we find a usage with MORE dimensions, or if it's new.
      // Usually the usage with most dimensions defines the array.
      // E.g. A_i ... A_N implies A is vector.
      if (item.indices.length >= existing.dims) {
        const indices: ASTNode[] = [];
        for (const idx of item.indices) {
          let resolvedSize: ASTNode = idx;
          // Try to resolve index to a loop bound
          // Heuristic: if index is a simple variable and matches a loop variable, use loop end
          if (idx.type === "item") {
            const idxName = (idx as ItemNode).name;
            const loop = loops.find((l) => l.variable === idxName);
            if (loop) {
              resolvedSize = loop.end;
            }
          }
          indices.push(resolvedSize);
        }

        // Keep the MAX loop depth seen for this variable (or should we strictly bind depth to definition?)
        // If defined in Loop, depth is > 0.
        // We use the depth at the point of definition (maximum dimensions).
        this.vars.set(item.name, {
          dims: item.indices.length,
          indices,
          loopDepth: currentLoopDepth,
        });
      }
    } else if (node.type === "binop") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bin = node as any;
      this.visit(bin.left, loops);
      this.visit(bin.right, loops);
    }
  }

  getVariables(types: Record<string, VarType>): VariableInfo[] {
    return Array.from(this.vars.entries()).map(([name, info]) => {
      let dims = info.dims;
      let indices = info.indices;
      const type = types[name] || VarType.ValueInt;

      // If type is String, it takes up one dimension of indices
      if (type === VarType.String && dims > 0) {
          dims -= 1;
          indices = indices.slice(0, dims);
      }

      return {
        name,
        type,
        dims,
        indices,
      };
    });
  }
}
