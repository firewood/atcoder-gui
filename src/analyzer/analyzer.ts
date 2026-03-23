import { FormatNode, ItemNode, ASTNode, LoopNode, BinOpNode } from "./types";

export class Analyzer {
  public analyze(root: FormatNode): FormatNode {
    const childrenWithoutBreaks = root.children.filter(
      (n) => n.type !== "break",
    );
    const newChildren = this.normalize(childrenWithoutBreaks);
    return { ...root, children: newChildren };
  }

  private normalize(nodes: ASTNode[]): ASTNode[] {
    const result: { node: ASTNode; count: number }[] = [];
    let i = 0;
    while (i < nodes.length) {
      const node = nodes[i];
      if (node.type === "dots") {
        const loop = this.detectLoop(nodes, i, result);
        if (loop) {
          const { K_nodes, K_result, loopNode } = loop;
          for (let k = 0; k < K_result; k++) result.pop();

          while (this.tryExtendLoop(result, loopNode)) {
            // extended
          }

          result.push({ node: loopNode, count: K_nodes * 2 + 1 });
          i += K_nodes + 1; // Skip dots and right side
          continue;
        }
      }

      result.push({ node, count: 1 });
      i++;
    }
    return result.map((r) => r.node);
  }

  private tryExtendLoop(
    result: { node: ASTNode; count: number }[],
    loopNode: LoopNode,
  ): boolean {
    if (loopNode.start.type !== "number") return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currentStart = (loopNode.start as any).value;
    const prevIndexVal = currentStart - 1;

    // Body might have been normalized, so we should check its original length
    // But for extension, we check against the current result items
    const K = loopNode.body.length;
    if (result.length < K) return false;

    const candidate = result.slice(result.length - K).map((r) => r.node);

    if (this.matchLoopBody(candidate, loopNode, prevIndexVal)) {
      for (let k = 0; k < K; k++) result.pop();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (loopNode.start as any).value = prevIndexVal;
      return true;
    }
    return false;
  }

  private matchLoopBody(
    nodes: ASTNode[],
    loopNode: LoopNode,
    indexVal: number,
  ): boolean {
    if (nodes.length !== loopNode.body.length) return false;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      const template = loopNode.body[i];
      if (template.type === "item") {
        if (
          !this.matchesTemplate(
            node,
            template as ItemNode,
            loopNode.variable,
            indexVal,
          )
        )
          return false;
      } else {
        // For non-items, they must match exactly for now
        if (!this.areNodesEqual(node, template)) return false;
      }
    }
    return true;
  }

  private matchesTemplate(
    node: ASTNode,
    template: ItemNode,
    loopVar: string,
    indexVal: number,
  ): boolean {
    if (node.type !== "item") return false;
    const itemNode = node as ItemNode;
    if (itemNode.name !== template.name) return false;
    if (itemNode.indices.length !== template.indices.length) return false;

    for (let j = 0; j < itemNode.indices.length; j++) {
      const nodeIdx = itemNode.indices[j];
      const templIdx = template.indices[j];

      // Check if templIdx is the loop variable
      if (
        templIdx.type === "item" &&
        (templIdx as ItemNode).name === loopVar &&
        (templIdx as ItemNode).indices.length === 0
      ) {
        // Should match indexVal
        if (nodeIdx.type !== "number" || (nodeIdx as any).value !== indexVal)
          return false;
      } else {
        // Should be identical
        if (!this.areNodesEqual(nodeIdx, templIdx)) return false;
      }
    }
    return true;
  }

  private detectLoop(
    nodes: ASTNode[],
    dotsIndex: number,
    result: { node: ASTNode; count: number }[],
  ): { K_nodes: number; K_result: number; loopNode: LoopNode } | null {
    for (let K_nodes = 1; K_nodes <= dotsIndex; K_nodes++) {
      if (dotsIndex + K_nodes >= nodes.length) break;

      // Check how many result items correspond to K_nodes
      let sum = 0;
      let K_result = 0;
      for (let j = result.length - 1; j >= 0; j--) {
        sum += result[j].count;
        K_result++;
        if (sum === K_nodes) break;
        if (sum > K_nodes) {
          K_result = -1;
          break;
        }
      }

      if (K_result === -1) continue;

      const left = nodes.slice(dotsIndex - K_nodes, dotsIndex);
      const right = nodes.slice(dotsIndex + 1, dotsIndex + 1 + K_nodes);

      if (this.match(left, right)) {
        const loopNode = this.createLoop(left, right);
        if (loopNode) return { K_nodes, K_result, loopNode };
      }
    }
    return null;
  }

  private match(left: ASTNode[], right: ASTNode[]): boolean {
    if (left.length !== right.length) return false;
    for (let i = 0; i < left.length; i++) {
      const l = left[i];
      const r = right[i];
      if (l.type !== r.type) return false;
      if (l.type === "item") {
        if ((l as ItemNode).name !== (r as ItemNode).name) return false;
      } else if (l.type === "loop") {
        const ll = l as LoopNode;
        const rr = r as LoopNode;
        if (ll.variable !== rr.variable) return false;
        if (!this.areNodesEqual(ll.start, rr.start)) return false;
        if (!this.areNodesEqual(ll.end, rr.end)) return false;
        if (!this.match(ll.body, rr.body)) return false;
      } else if (l.type === "dots") {
        continue; // Match dots
      } else {
        // For other types, they should be identical
        if (JSON.stringify(l) !== JSON.stringify(r)) return false;
      }
    }
    return true;
  }

  private createLoop(left: ASTNode[], right: ASTNode[]): LoopNode | null {
    // We assume match(left, right) is true, so they have same types
    const firstL = left[0];
    const firstR = right[0];

    let diffIndex = -1;
    let diffNodeL: ASTNode | null = null;
    let diffNodeR: ASTNode | null = null;

    if (firstL.type === "item") {
      const l = firstL as ItemNode;
      const r = firstR as ItemNode;
      if (l.indices.length !== r.indices.length) return null;
      for (let j = 0; j < l.indices.length; j++) {
        if (!this.areNodesEqual(l.indices[j], r.indices[j])) {
          if (diffIndex !== -1) return null; // More than one diff
          diffIndex = j;
          diffNodeL = l.indices[j];
          diffNodeR = r.indices[j];
        }
      }
    }

    if (diffIndex === -1) return null;

    const start = diffNodeL!;
    const end = diffNodeR!;

    const loopVar = this.generateLoopVar(start, end, left as any, right as any);

    // Check consistency for other items
    for (let k = 0; k < left.length; k++) {
      const l = left[k];
      const r = right[k];

      if (l.type === "item") {
        const li = l as ItemNode;
        const ri = r as ItemNode;
        for (let j = 0; j < li.indices.length; j++) {
          if (k === 0 && j === diffIndex) continue;
          if (j === diffIndex) {
            // Must have the same difference
            if (
              !this.areNodesEqual(li.indices[j], diffNodeL!) ||
              !this.areNodesEqual(ri.indices[j], diffNodeR!)
            )
              return null;
          } else {
            if (!this.areNodesEqual(li.indices[j], ri.indices[j])) return null;
          }
        }
      }
      // For dots or other nodes, they were already checked by match()
    }

    const body = left.map((node) => {
      if (node.type === "item") {
        const item = node as ItemNode;
        const newIndices = [...item.indices];
        newIndices[diffIndex] = {
          type: "item",
          name: loopVar,
          indices: [],
        } as ItemNode;
        return { ...item, indices: newIndices };
      }
      return node;
    });

    return {
      type: "loop",
      variable: loopVar,
      start,
      end,
      body: this.normalize(body),
    };
  }

  private generateLoopVar(
    start: ASTNode,
    end: ASTNode,
    left: ItemNode[],
    right: ItemNode[],
  ): string {
    const used = new Set<string>();
    const extract = (node: ASTNode) => {
      if (node.type === "item") {
        used.add((node as ItemNode).name);
        (node as ItemNode).indices.forEach(extract);
      }
      if (node.type === "binop") {
        extract((node as BinOpNode).left);
        extract((node as BinOpNode).right);
      }
      if (node.type === "loop") {
        // Shouldn't happen in raw AST unless recursive?
      }
    };

    extract(start);
    extract(end);
    left.forEach(extract); // Extract from indices of left items
    right.forEach(extract); // Extract from indices of right items

    const candidates = ["i", "j", "k", "l", "m"];
    for (const c of candidates) {
      if (!used.has(c)) return c;
    }
    return "i";
  }

  private areNodesEqual(a: ASTNode, b: ASTNode): boolean {
    if (a.type !== b.type) return false;
    if (a.type === "item") {
      const ia = a as ItemNode;
      const ib = b as ItemNode;
      if (ia.name !== ib.name) return false;
      if (ia.indices.length !== ib.indices.length) return false;
      for (let i = 0; i < ia.indices.length; i++) {
        if (!this.areNodesEqual(ia.indices[i], ib.indices[i])) return false;
      }
      return true;
    }
    if (a.type === "number") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (a as any).value === (b as any).value;
    }
    if (a.type === "binop") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ba = a as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const bb = b as any;
      return (
        ba.op === bb.op &&
        this.areNodesEqual(ba.left, bb.left) &&
        this.areNodesEqual(ba.right, bb.right)
      );
    }
    return JSON.stringify(a) === JSON.stringify(b);
  }
}
