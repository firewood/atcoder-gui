import { FormatNode, ItemNode, ASTNode, LoopNode, DotsNode, BinOpNode } from './types';

export class Analyzer {
  public analyze(root: FormatNode): FormatNode {
    const newChildren = this.normalize(root.children);
    return { ...root, children: newChildren };
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
          if (l.name !== r.name) return false;
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
          return (a as any).value === (b as any).value;
      }
      if (a.type === 'binop') {
          const ba = a as any;
          const bb = b as any;
          return ba.op === bb.op && this.areNodesEqual(ba.left, bb.left) && this.areNodesEqual(ba.right, bb.right);
      }
      return JSON.stringify(a) === JSON.stringify(b);
  }
}
