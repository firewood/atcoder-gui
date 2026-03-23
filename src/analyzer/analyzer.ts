import { FormatNode, ItemNode, ASTNode, LoopNode, BinOpNode } from "./types";

export class Analyzer {
  public analyze(root: FormatNode): FormatNode {
    const childrenWithoutBreaks = root.children.filter(
      (n) => n.type !== "break",
    );
    let currentChildren = childrenWithoutBreaks;
    // eslint-disable-next-line no-constant-condition
    while (true) {
        const newChildren = this.normalize(currentChildren);
        if (this.areChildrenEqual(newChildren, currentChildren)) break;
        currentChildren = newChildren;
    }
    return { ...root, children: currentChildren };
  }

  private areChildrenEqual(a: ASTNode[], b: ASTNode[]): boolean {
      if (a.length !== b.length) return false;
      for (let i = 0; i < a.length; i++) {
          if (!this.areNodesEqual(a[i], b[i])) return false;
      }
      return true;
  }

  private normalize(nodes: ASTNode[]): ASTNode[] {
    const result: ASTNode[] = [];
    let i = 0;
    while (i < nodes.length) {
      const node = nodes[i];
      if (node.type === "dots" || node.type === "vdots") {
        const loop = this.detectLoop(nodes, i, node.type);
        if (loop) {
          const { K, loopNode } = loop;
          for (let k = 0; k < K; k++) result.pop();

          while (this.tryExtendLoop(result, loopNode)) {
            // extended
          }
          loopNode.body = this.normalize(loopNode.body);
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
    if (loopNode.start.type !== "number") return false;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const currentStart = (loopNode.start as any).value;
    const prevIndexVal = currentStart - 1;

    const K = loopNode.body.length;
    if (result.length < K) return false;

    const candidate = result.slice(result.length - K);

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
      if (template.type !== "item") return false; // Loop body elements are items in our current logic
      if (!this.matchesTemplate(node, template as ItemNode, loopNode.variable, indexVal))
        return false;
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
    dotsType: string,
  ): { K: number; loopNode: LoopNode } | null {
    for (let K = 1; K <= dotsIndex; K++) {
      if (dotsIndex + K >= nodes.length) break;

      const left = nodes.slice(dotsIndex - K, dotsIndex);
      const right = nodes.slice(dotsIndex + 1, dotsIndex + 1 + K);

      if (this.match(left, right)) {
        const loopNode = this.createLoop(
          left,
          right,
          dotsType,
        );
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
      if (l.type !== "item" || r.type !== "item") return false;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((l as any).name !== (r as any).name) return false;
    }
    return true;
  }

  private createLoop(left: ASTNode[], right: ASTNode[], dotsType: string): LoopNode | null {
    const diffs: { path: string[]; start: ASTNode; end: ASTNode }[] = [];

    const findDiffs = (a: ASTNode, b: ASTNode, path: string[]) => {
      if (this.areNodesEqual(a, b)) return;

      if (a.type === "item" && b.type === "item") {
        const ia = a as ItemNode;
        const ib = b as ItemNode;
        if (ia.name === ib.name && ia.indices.length === ib.indices.length) {
          ia.indices.forEach((idx, i) => findDiffs(idx, ib.indices[i], [...path, `indices[${i}]`]));
          return;
        }
      }

      if (a.type === "binop" && b.type === "binop") {
         const ba = a as BinOpNode;
         const bb = b as BinOpNode;
         if (ba.op === bb.op) {
             findDiffs(ba.left, bb.left, [...path, "left"]);
             findDiffs(ba.right, bb.right, [...path, "right"]);
             return;
         }
      }

      diffs.push({ path, start: a, end: b });
    };

    for (let i = 0; i < left.length; i++) {
       findDiffs(left[i], right[i], [`[${i}]`]);
    }

    if (diffs.length === 0) return null;

    // Pick a representative difference to define the loop range
    const dIdx = (dotsType === "dots") ? diffs.length - 1 : 0;
    const representative = diffs[dIdx];
    const { start, end } = representative;

    // All diffs that share the same start and end should be replaced by the loop variable
    const pathsToReplace = diffs
      .filter(d => this.areNodesEqual(d.start, start) && this.areNodesEqual(d.end, end))
      .map(d => d.path.join("."));

    const loopVar = this.generateLoopVar(start, end, left);

    const replaceAt = (n: ASTNode, currentPath: string[]): ASTNode => {
      if (pathsToReplace.includes(currentPath.join("."))) {
          return { type: "item", name: loopVar, indices: [] } as ItemNode;
      }
      if (n.type === "item") {
          const item = n as ItemNode;
          const newIndices = item.indices.map((idx, i) => replaceAt(idx, [...currentPath, `indices[${i}]`]));
          return { ...item, indices: newIndices };
      }
      if (n.type === "loop") {
          const loop = n as LoopNode;
          return {
              ...loop,
              start: replaceAt(loop.start, [...currentPath, "start"]),
              end: replaceAt(loop.end, [...currentPath, "end"]),
              body: loop.body.map((child, i) => replaceAt(child, [...currentPath, `body[${i}]`]))
          };
      }
      if (n.type === "binop") {
          const bin = n as BinOpNode;
          return {
              ...bin,
              left: replaceAt(bin.left, [...currentPath, "left"]),
              right: replaceAt(bin.right, [...currentPath, "right"])
          };
      }
      return JSON.parse(JSON.stringify(n));
    };

    const body = left.map((node, i) => replaceAt(node, [`[${i}]`]));

    return {
      type: "loop",
      variable: loopVar,
      start,
      end,
      body,
    };
  }

  private generateLoopVar(
    start: ASTNode,
    end: ASTNode,
    body: ASTNode[],
  ): string {
    const used = new Set<string>();
    const extract = (node: ASTNode) => {
      if (!node) return;
      if (node.type === "item") {
        const item = node as ItemNode;
        used.add(item.name);
        item.indices.forEach(extract);
      } else if (node.type === "binop") {
        extract((node as BinOpNode).left);
        extract((node as BinOpNode).right);
      } else if (node.type === "loop") {
        const loop = node as LoopNode;
        used.add(loop.variable);
        extract(loop.start);
        extract(loop.end);
        loop.body.forEach(extract);
      }
    };

    extract(start);
    extract(end);
    body.forEach(extract);

    const candidates = ["i", "j", "k", "l", "m"];
    for (const c of candidates) {
      if (!used.has(c)) return c;
    }
    for (let i = 0; i < 26; i++) {
        const c = String.fromCharCode(97 + i);
        if (!used.has(c)) return c;
    }
    return "idx";
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
      const ba = a as BinOpNode;
      const bb = b as BinOpNode;
      return (
        ba.op === bb.op &&
        this.areNodesEqual(ba.left, bb.left) &&
        this.areNodesEqual(ba.right, bb.right)
      );
    }
    if (a.type === "loop") {
        const la = a as LoopNode;
        const lb = b as LoopNode;
        if (!this.areNodesEqual(la.start, lb.start)) return false;
        if (!this.areNodesEqual(la.end, lb.end)) return false;
        if (la.body.length !== lb.body.length) return false;
        for (let i = 0; i < la.body.length; i++) {
            if (!this.areNodesAlphaEqual(la.body[i], lb.body[i], la.variable, lb.variable)) return false;
        }
        return true;
    }
    return JSON.stringify(a) === JSON.stringify(b);
  }

  private areNodesAlphaEqual(a: ASTNode, b: ASTNode, varA: string, varB: string): boolean {
    if (a.type === "item" && b.type === "item") {
        const ia = a as ItemNode;
        const ib = b as ItemNode;
        if (ia.name === varA && ia.indices.length === 0) {
            return ib.name === varB && ib.indices.length === 0;
        }
        if (ib.name === varB && ib.indices.length === 0) return false;

        if (ia.name !== ib.name) return false;
        if (ia.indices.length !== ib.indices.length) return false;
        for (let i = 0; i < ia.indices.length; i++) {
            if (!this.areNodesAlphaEqual(ia.indices[i], ib.indices[i], varA, varB)) return false;
        }
        return true;
    }
    if (a.type !== b.type) return false;
    if (a.type === "number") return (a as any).value === (b as any).value;
    if (a.type === "binop") {
        const ba = a as BinOpNode;
        const bb = b as BinOpNode;
        return ba.op === bb.op && this.areNodesAlphaEqual(ba.left, bb.left, varA, varB) && this.areNodesAlphaEqual(ba.right, bb.right, varA, varB);
    }
    if (a.type === "loop") {
        const la = a as LoopNode;
        const lb = b as LoopNode;
        return this.areNodesAlphaEqual(la.start, lb.start, varA, varB) &&
               this.areNodesAlphaEqual(la.end, lb.end, varA, varB) &&
               la.body.length === lb.body.length &&
               la.body.every((n, i) => this.areNodesAlphaEqual(n, lb.body[i], varA, varB));
    }
    return JSON.stringify(a) === JSON.stringify(b);
  }
}
