import { FormatNode, ASTNode, ItemNode, LoopNode, VarType } from '../analyzer/types.js';

export interface VariableInfo {
  name: string;
  type: VarType;
  dims: number;
  indices: ASTNode[];
}

export class VariableExtractor {
  private vars = new Map<string, { dims: number; indices: ASTNode[] }>();

  extract(node: FormatNode): void {
    this.visit(node, []);
  }

  private visit(node: ASTNode, loops: LoopNode[]) {
    if (!node) return;

    if (node.type === 'format') {
      (node as FormatNode).children.forEach((c) => this.visit(c, loops));
    } else if (node.type === 'loop') {
      const loop = node as LoopNode;
      // Visit bounds first
      this.visit(loop.start, loops);
      this.visit(loop.end, loops);
      // Visit body with updated loop stack
      loop.body.forEach((c) => this.visit(c, [...loops, loop]));
    } else if (node.type === 'item') {
      const item = node as ItemNode;
      const existing = this.vars.get(item.name) || { dims: 0, indices: [] };

      // We only update if we find a usage with MORE dimensions, or if it's new.
      // Usually the usage with most dimensions defines the array.
      // E.g. A_i ... A_N implies A is vector.
      if (item.indices.length >= existing.dims) {
        const indices: ASTNode[] = [];
        for (const idx of item.indices) {
            let resolvedSize: ASTNode = idx;
            // Try to resolve index to a loop bound
            // Heuristic: if index is a simple variable and matches a loop variable, use loop end
            if (idx.type === 'item') {
                const idxName = (idx as ItemNode).name;
                const loop = loops.find(l => l.variable === idxName);
                if (loop) {
                    resolvedSize = loop.end;
                }
            }
            indices.push(resolvedSize);
        }

        // If we already have an entry with same dims, we might want to check for consistency?
        // But for now, just overwrite or keep first?
        // Usually, definitions come first or are consistent.
        // Let's stick with "max dimensions wins", and if equal, maybe latest or first?
        // In simple formats, A is used as A_i inside loop i..N. Dimensions = 1, size = N.
        this.vars.set(item.name, { dims: item.indices.length, indices });
      }
    } else if (node.type === 'binop') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const bin = node as any;
        this.visit(bin.left, loops);
        this.visit(bin.right, loops);
    }
  }

  getVariables(types: Record<string, VarType>): VariableInfo[] {
    return Array.from(this.vars.entries()).map(([name, info]) => ({
      name,
      type: types[name] || VarType.ValueInt, // Default to int if unknown
      dims: info.dims,
      indices: info.indices,
    }));
  }
}
