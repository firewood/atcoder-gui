import { FormatNode, ItemNode, ASTNode, LoopNode, BinOpNode, NumberNode } from './types';

export class Analyzer {
  public analyze(root: FormatNode): FormatNode {
    // Flatten variables pass: Convert single-element constant arrays (e.g. N_1) to scalars (N1)
    // if they are not part of a loop structure (not adjacent to dots).
    const flattenedRoot = this.flattenVariables(root);

    const childrenWithoutBreaks = flattenedRoot.children.filter(n => n.type !== 'break');
    const newChildren = this.normalize(childrenWithoutBreaks);
    return { ...flattenedRoot, children: newChildren };
  }

  private flattenVariables(root: FormatNode): FormatNode {
    // 1. Collect Stats
    const usageStats = new Map<string, {
      hasNonConstIndex: boolean;
      isAdjacentToDots: boolean;
      notSingleDim: boolean;
    }>();

    const getStats = (name: string) => {
      if (!usageStats.has(name)) {
        usageStats.set(name, { hasNonConstIndex: false, isAdjacentToDots: false, notSingleDim: false });
      }
      return usageStats.get(name)!;
    };

    // Helper to check usage inside expressions/indices
    const checkUsage = (node: ASTNode) => {
      if (node.type === 'item') {
        const item = node as ItemNode;
        const stats = getStats(item.name);

        if (item.indices.length !== 1) {
          stats.notSingleDim = true;
        } else {
          const idx = item.indices[0];
          if (idx.type !== 'number') {
            stats.hasNonConstIndex = true;
          }
        }

        // Recursively check inside indices
        item.indices.forEach(checkUsage);
      } else if (node.type === 'binop') {
        const binop = node as BinOpNode;
        checkUsage(binop.left);
        checkUsage(binop.right);
      }
      // Add other node types if they can contain items (loops not yet present)
    };

    // Helper to check adjacency to dots
    const checkAdjacency = (nodes: ASTNode[]) => {
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (node.type !== 'item') continue;

        const item = node as ItemNode;
        const stats = getStats(item.name);

        // Check prev
        let j = i - 1;
        while (j >= 0 && nodes[j].type === 'break') j--;
        if (j >= 0 && (nodes[j].type === 'dots' || nodes[j].type === 'vdots')) {
          stats.isAdjacentToDots = true;
        }

        // Check next
        j = i + 1;
        while (j < nodes.length && nodes[j].type === 'break') j++;
        if (j < nodes.length && (nodes[j].type === 'dots' || nodes[j].type === 'vdots')) {
          stats.isAdjacentToDots = true;
        }
      }
    };

    // Run analysis
    // 1. Usage in indices (deep)
    const traverse = (node: ASTNode) => {
      if (node.type === 'format') {
        (node as FormatNode).children.forEach(traverse);
      } else {
        checkUsage(node);
      }
    };
    traverse(root);

    // 2. Adjacency in top-level structure
    checkAdjacency(root.children);

    // 3. Identify candidates
    const candidates = new Set<string>();
    for (const [name, stats] of usageStats.entries()) {
      if (!stats.hasNonConstIndex && !stats.notSingleDim && !stats.isAdjacentToDots) {
        candidates.add(name);
      }
    }

    if (candidates.size === 0) return root;

    // 4. Transform
    const transform = (node: ASTNode): ASTNode => {
      if (node.type === 'format') {
        return {
          ...node,
          children: (node as FormatNode).children.map(transform)
        } as FormatNode;
      }
      if (node.type === 'item') {
        const item = node as ItemNode;
        const newIndices = item.indices.map(transform);

        if (candidates.has(item.name)) {
          // Should be single constant index due to checks
          const idxNode = newIndices[0] as NumberNode;
          const val = idxNode.value;
          return {
            ...item,
            name: `${item.name}${val}`, // e.g. N1
            indices: [] // Remove index
          };
        }
        return { ...item, indices: newIndices };
      }
      if (node.type === 'binop') {
        const binop = node as BinOpNode;
        return {
          ...binop,
          left: transform(binop.left),
          right: transform(binop.right)
        };
      }
      // pass through others
      return node;
    };

    return transform(root) as FormatNode;
  }

  private normalize(nodes: ASTNode[]): ASTNode[] {
    const result: ASTNode[] = [];
    let i = 0;
    while (i < nodes.length) {
      const node = nodes[i];
      if (node.type === 'dots') {
        const loop = this.detectLoop(nodes, i);
        if (loop) {
          const { K, loopNode } = loop;
          for (let k = 0; k < K; k++) result.pop();

          while (this.tryExtendLoop(result, loopNode)) {
              // extended
          }

          result.push(loopNode);
          i += K + 1; // Skip dots and right side (K items)
          continue;
        }
      }

      result.push(node);
      i++;
    }
    return result;
  }

  private tryExtendLoop(result: ASTNode[], loopNode: LoopNode): boolean {
      if (loopNode.start.type !== 'number') return false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const currentStart = (loopNode.start as any).value;
      const prevIndexVal = currentStart - 1;

      const K = loopNode.body.length;
      if (result.length < K) return false;

      const candidate = result.slice(result.length - K);

      if (this.matchLoopBody(candidate, loopNode, prevIndexVal)) {
          for(let k=0; k<K; k++) result.pop();
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (loopNode.start as any).value = prevIndexVal;
          return true;
      }
      return false;
    }

  private matchLoopBody(nodes: ASTNode[], loopNode: LoopNode, indexVal: number): boolean {
     if (nodes.length !== loopNode.body.length) return false;

     for(let i=0; i<nodes.length; i++) {
         const node = nodes[i];
         const template = loopNode.body[i];
         if (!this.matchesTemplate(node, template, loopNode.variable, indexVal)) return false;
     }
     return true;
  }

  private matchesTemplate(node: ASTNode, template: ItemNode, loopVar: string, indexVal: number): boolean {
      if (node.type !== 'item') return false;
      const itemNode = node as ItemNode;
      if (itemNode.name !== template.name) return false;
      if (itemNode.indices.length !== template.indices.length) return false;

      for(let j=0; j<itemNode.indices.length; j++) {
          const nodeIdx = itemNode.indices[j];
          const templIdx = template.indices[j];

          // Check if templIdx is the loop variable
          if (templIdx.type === 'item' && (templIdx as ItemNode).name === loopVar && (templIdx as ItemNode).indices.length === 0) {
              // Should match indexVal
              if (nodeIdx.type !== 'number' || (nodeIdx as any).value !== indexVal) return false;
          } else {
              // Should be identical
              if (!this.areNodesEqual(nodeIdx, templIdx)) return false;
          }
      }
      return true;
  }

  private detectLoop(nodes: ASTNode[], dotsIndex: number): { K: number, loopNode: LoopNode } | null {
      for (let K = 1; K <= dotsIndex; K++) {
          if (dotsIndex + K >= nodes.length) break;

          const left = nodes.slice(dotsIndex - K, dotsIndex);
          const right = nodes.slice(dotsIndex + 1, dotsIndex + 1 + K);

          if (this.match(left, right)) {
              const loopNode = this.createLoop(left as ItemNode[], right as ItemNode[]);
              if (loopNode) return { K, loopNode };
          }
      }
      return null;
  }

  private match(left: ASTNode[], right: ASTNode[]): boolean {
      if (left.length !== right.length) return false;
      for (let i = 0; i < left.length; i++) {
          const l = left[i];
          const r = right[i];
          if (l.type !== 'item' || r.type !== 'item') return false;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          if ((l as any).name !== (r as any).name) return false;
      }
      return true;
  }

  private createLoop(left: ItemNode[], right: ItemNode[]): LoopNode | null {
      const firstL = left[0];
      const firstR = right[0];

      let diffIndex = -1;
      if (firstL.indices.length !== firstR.indices.length) return null;

      for(let j=0; j<firstL.indices.length; j++) {
          if (!this.areNodesEqual(firstL.indices[j], firstR.indices[j])) {
              diffIndex = j;
              break;
          }
      }

      if (diffIndex === -1) return null;

      const start = firstL.indices[diffIndex];
      const end = firstR.indices[diffIndex];

      const loopVar = this.generateLoopVar(start, end, left, right);

      // Check consistency for other items
      for (let k = 1; k < left.length; k++) {
          const l = left[k];
          const r = right[k];
          if (l.indices.length !== r.indices.length) return null;
          if (l.indices.length <= diffIndex) return null;

          for (let j = 0; j < l.indices.length; j++) {
              if (j === diffIndex) continue;
              if (!this.areNodesEqual(l.indices[j], r.indices[j])) return null;
          }
      }

      const body = left.map(item => {
          const newIndices = [...item.indices];
          newIndices[diffIndex] = { type: 'item', name: loopVar, indices: [] } as ItemNode;
          return { ...item, indices: newIndices };
      });

      return {
          type: 'loop',
          variable: loopVar,
          start,
          end,
          body
      };
  }

  private generateLoopVar(start: ASTNode, end: ASTNode, left: ItemNode[], right: ItemNode[]): string {
      const used = new Set<string>();
      const extract = (node: ASTNode) => {
          if (node.type === 'item') {
              used.add((node as ItemNode).name);
              (node as ItemNode).indices.forEach(extract);
          }
          if (node.type === 'binop') {
              extract((node as BinOpNode).left);
              extract((node as BinOpNode).right);
          }
          if (node.type === 'loop') {
             // Shouldn't happen in raw AST unless recursive?
          }
      };

      extract(start);
      extract(end);
      left.forEach(extract); // Extract from indices of left items
      right.forEach(extract); // Extract from indices of right items

      const candidates = ['i', 'j', 'k', 'l', 'm'];
      for (const c of candidates) {
          if (!used.has(c)) return c;
      }
      return 'i';
  }

  private areNodesEqual(a: ASTNode, b: ASTNode): boolean {
      if (a.type !== b.type) return false;
      if (a.type === 'item') {
          const ia = a as ItemNode;
          const ib = b as ItemNode;
          if (ia.name !== ib.name) return false;
          if (ia.indices.length !== ib.indices.length) return false;
          for (let i=0; i<ia.indices.length; i++) {
              if (!this.areNodesEqual(ia.indices[i], ib.indices[i])) return false;
          }
          return true;
      }
      if (a.type === 'number') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          return (a as any).value === (b as any).value;
      }
      if (a.type === 'binop') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const ba = a as any;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const bb = b as any;
          return ba.op === bb.op && this.areNodesEqual(ba.left, bb.left) && this.areNodesEqual(ba.right, bb.right);
      }
      return JSON.stringify(a) === JSON.stringify(b);
  }
}
