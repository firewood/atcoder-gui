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
  onDemandArray?: boolean;
}

export class VariableExtractor {
  private vars = new Map<
    string,
    {
      dims: number;
      indices: ASTNode[];
      loopDepth: number;
      onDemandArray?: boolean;
    }
  >();
  private collapsedVars = new Set<string>();

  setCollapsedVars(collapsedVars: Set<string>) {
    this.collapsedVars = collapsedVars;
  }

  extract(node: FormatNode): void {
    this.visit(node, []);
  }

  private dependsOnLoopVariable(node: ASTNode, activeLoops: LoopNode[]): boolean {
    const loopVars = new Set(activeLoops.map((l) => l.variable));
    let depends = false;
    const visit = (n: ASTNode) => {
      if (!n || depends) return;
      if (n.type === "item") {
        if (loopVars.has((n as ItemNode).name)) {
          depends = true;
          return;
        }
        (n as ItemNode).indices.forEach(visit);
      } else if (n.type === "binop") {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bin = n as any;
        visit(bin.left);
        visit(bin.right);
      }
    };
    visit(node);
    return depends;
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
        let onDemandArray = false;
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

          if (this.dependsOnLoopVariable(resolvedSize, loops)) {
            onDemandArray = true;
          }
        }

        if (onDemandArray) {
          item.onDemandArray = true;
        }

        // Keep the MAX loop depth seen for this variable (or should we strictly bind depth to definition?)
        // If defined in Loop, depth is > 0.
        // We use the depth at the point of definition (maximum dimensions).
        this.vars.set(item.name, {
          dims: item.indices.length,
          indices,
          loopDepth: currentLoopDepth,
          onDemandArray: onDemandArray || existing.onDemandArray,
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
      let onDemandArray = info.onDemandArray;

      // Rule 1: Explicitly collapsed variables (Standard match failed, Collapse succeeded)
      if (this.collapsedVars.has(name) && dims > 0) {
        dims -= 1;
        indices = indices.slice(0, -1);
      }
      // Rule 2: String anomaly (Standard match succeeded, but Analyzer produced disconnected dimensions)
      // If type is String, and dimensions exceed the loop depth, it implies we are indexing implicitly into the string.
      // e.g. loops=1, indices=2 (S[N][i]). This means S[i] is a string. We drop the extra index.
      else if (type === VarType.String && dims > info.loopDepth) {
        // const excess = dims - info.loopDepth;
        dims = info.loopDepth;
        // Keep the last 'dims' indices (assuming loop vars are inner)
        // E.g. [N, i], depth=1. excess=1. slice(-1) -> [i].
        // If depth=0 (scalar usage outside loop), but indices=1? -> dims=0.
        if (dims === 0) {
          indices = [];
        } else {
          indices = indices.slice(-dims);
        }
      }

      // If dimensions were reduced, onDemandArray status might need re-evaluation,
      // but usually the outermost dimensions are the ones that could be on-demand in a way that matters for allocation.
      // Actually, if we collapsed a loop, it was likely the innermost dimension.
      // If the NEW last dimension is dependent on a loop variable that's still active...
      // For now, let's keep the flag if it was ever set.

      return {
        name,
        type,
        dims,
        indices,
        onDemandArray,
      };
    });
  }
}
