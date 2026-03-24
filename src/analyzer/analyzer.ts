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
          let currentCount = K_nodes * 2 + 1;
          for (let k = 0; k < K_result; k++) result.pop();

          while (true) {
            const consumed = this.tryExtendLoop(result, loopNode);
            if (consumed === 0) break;
            currentCount += consumed;
          }

          result.push({ node: loopNode, count: currentCount });
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
  ): number {
    if (loopNode.start.type !== "number") return 0;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currentStart = (loopNode.start as any).value;
    const prevIndexVal = currentStart - 1;

    // Body might have been normalized, so we should check its original length
    // But for extension, we check against the current result items
    const K = loopNode.body.length;
    if (result.length < K) return 0;

    const candidate = result.slice(result.length - K).map((r) => r.node);

    if (this.matchLoopBody(candidate, loopNode, prevIndexVal)) {
      let consumed = 0;
      for (let k = 0; k < K; k++) {
        const p = result.pop();
        if (p) consumed += p.count;
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (loopNode.start as any).value = prevIndexVal;
      return consumed;
    }
    return 0;
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
      const substituted = this.substitute(template, loopNode.variable, indexVal);
      if (!this.areNodesEqual(node, substituted)) return false;
    }
    return true;
  }

  private substitute(node: ASTNode, varName: string, value: number): ASTNode {
    if (node.type === "item") {
      const item = node as ItemNode;
      if (item.name === varName && item.indices.length === 0) {
        return { type: "number", value };
      }
      return {
        ...item,
        indices: item.indices.map((idx) =>
          this.substitute(idx, varName, value),
        ),
      };
    }
    if (node.type === "loop") {
      const loop = node as LoopNode;
      if (loop.variable === varName) return node; // Shadowing
      return {
        ...loop,
        start: this.substitute(loop.start, varName, value),
        end: this.substitute(loop.end, varName, value),
        body: loop.body.map((b) => this.substitute(b, varName, value)),
      };
    }
    if (node.type === "binop") {
      const bin = node as BinOpNode;
      return {
        ...bin,
        left: this.substitute(bin.left, varName, value),
        right: this.substitute(bin.right, varName, value),
      };
    }
    return node;
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
        // Check structural equality of loop bounds/body roughly?
        // match() is for detecting "similar structure".
        // The detailed check is done in createLoop via findDifferences.
        // So here we recurse loosely.
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
    const diffs = this.findDifferences(left, right);
    if (diffs.length === 0) return null;

    // Check consistency: all diffs must be between the same start/end values
    const firstDiff = diffs[0];
    const startNode = JSON.parse(JSON.stringify(firstDiff.left));
    const endNode = JSON.parse(JSON.stringify(firstDiff.right));

    for (let i = 1; i < diffs.length; i++) {
      if (
        !this.areNodesEqual(diffs[i].left, startNode) ||
        !this.areNodesEqual(diffs[i].right, endNode)
      ) {
        return null;
      }
    }

    // Use original nodes for generateLoopVar to ensure we check all used vars in original tree
    // But startNode/endNode are clones, so pass firstDiff.left/right?
    // Actually generateLoopVar uses them to extract used vars.
    // Clones have same names, so it's fine.
    const loopVar = this.generateLoopVar(startNode, endNode, left, right);
    const newBody = this.replaceDiffsWithLoopVar(left, diffs, loopVar);

    return {
      type: "loop",
      variable: loopVar,
      start: startNode,
      end: endNode,
      body: this.normalize(newBody),
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private replaceDiffsWithLoopVar(
    nodes: ASTNode[],
    diffs: Diff[],
    loopVar: string,
  ): ASTNode[] {
    const clone = JSON.parse(JSON.stringify(nodes));

    for (const diff of diffs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      let curr: any = clone;
      const p = diff.path;
      const lastKey = p[p.length - 1];

      for (let i = 0; i < p.length - 1; i++) {
        curr = curr[p[i]];
      }

      curr[lastKey] = {
        type: "item",
        name: loopVar,
        indices: [],
      };
    }
    return clone;
  }

  private generateLoopVar(
    start: ASTNode,
    end: ASTNode,
    left: ASTNode[],
    right: ASTNode[],
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
        const loop = node as LoopNode;
        used.add(loop.variable);
        extract(loop.start);
        extract(loop.end);
        loop.body.forEach(extract);
      }
    };

    extract(start);
    extract(end);
    left.forEach(extract);
    right.forEach(extract);

    const candidates = ["i", "j", "k", "l", "m"];
    for (const c of candidates) {
      if (!used.has(c)) return c;
    }
    return "i";
  }

  private findDifferences(
    listA: ASTNode[],
    listB: ASTNode[],
    path: (string | number)[] = [],
  ): Diff[] {
    if (listA.length !== listB.length) return [];
    const diffs: Diff[] = [];
    for (let i = 0; i < listA.length; i++) {
      diffs.push(...this.findNodeDiff(listA[i], listB[i], [...path, i]));
    }
    return diffs;
  }

  private findNodeDiff(
    a: ASTNode,
    b: ASTNode,
    path: (string | number)[],
  ): Diff[] {
    if (this.areNodesEqual(a, b)) return [];

    const diffs: Diff[] = [];

    // Structural recursion for Items
    if (a.type === "item" && b.type === "item") {
      const ia = a as ItemNode;
      const ib = b as ItemNode;
      // If both have indices, treat as structure
      if (ia.indices.length > 0 && ib.indices.length > 0) {
        if (ia.name !== ib.name) return []; // Different arrays
        if (ia.indices.length !== ib.indices.length) return [];
        for (let i = 0; i < ia.indices.length; i++) {
          diffs.push(
            ...this.findNodeDiff(ia.indices[i], ib.indices[i], [
              ...path,
              "indices",
              i,
            ]),
          );
        }
        return diffs;
      }
    }

    if (a.type === "loop" && b.type === "loop") {
      const la = a as LoopNode;
      const lb = b as LoopNode;
      diffs.push(...this.findNodeDiff(la.start, lb.start, [...path, "start"]));
      diffs.push(...this.findNodeDiff(la.end, lb.end, [...path, "end"]));
      diffs.push(...this.findDifferences(la.body, lb.body, [...path, "body"]));
      return diffs;
    }

    if (a.type === "binop" && b.type === "binop") {
      const ba = a as BinOpNode;
      const bb = b as BinOpNode;
      diffs.push(...this.findNodeDiff(ba.left, bb.left, [...path, "left"]));
      diffs.push(...this.findNodeDiff(ba.right, bb.right, [...path, "right"]));
      return diffs;
    }

    // Check if both are scalars (number or item without indices)
    const isScalar = (n: ASTNode) =>
      n.type === "number" ||
      (n.type === "item" && (n as ItemNode).indices.length === 0);

    if (isScalar(a) && isScalar(b)) {
      return [{ path, left: a, right: b }];
    }

    // Structural mismatch
    return [];
  }

  private areNodesEqual(
    a: ASTNode,
    b: ASTNode,
    varMap: Map<string, string> = new Map(),
  ): boolean {
    if (a.type !== b.type) return false;
    if (a.type === "item") {
      const ia = a as ItemNode;
      const ib = b as ItemNode;
      const mappedName = varMap.get(ia.name) || ia.name;
      if (mappedName !== ib.name) return false;
      if (ia.indices.length !== ib.indices.length) return false;
      for (let i = 0; i < ia.indices.length; i++) {
        if (!this.areNodesEqual(ia.indices[i], ib.indices[i], varMap))
          return false;
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
        this.areNodesEqual(ba.left, bb.left, varMap) &&
        this.areNodesEqual(ba.right, bb.right, varMap)
      );
    }
    if (a.type === "loop") {
      const la = a as LoopNode;
      const lb = b as LoopNode;
      if (!this.areNodesEqual(la.start, lb.start, varMap)) return false;
      if (!this.areNodesEqual(la.end, lb.end, varMap)) return false;

      const newMap = new Map(varMap);
      newMap.set(la.variable, lb.variable);

      if (la.body.length !== lb.body.length) return false;
      for (let i = 0; i < la.body.length; i++) {
        if (!this.areNodesEqual(la.body[i], lb.body[i], newMap)) return false;
      }
      return true;
    }
    return JSON.stringify(a) === JSON.stringify(b);
  }
}
