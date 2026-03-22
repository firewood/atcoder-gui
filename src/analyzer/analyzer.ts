import { FormatNode, ItemNode, ASTNode, LoopNode, BinOpNode, NumberNode } from "./types.js";

export class Analyzer {
  public analyze(root: FormatNode): FormatNode {
    const childrenWithoutBreaks = root.children.filter(
      (n) => n.type !== "break",
    );
    const newChildren = this.normalize(childrenWithoutBreaks);
    return { ...root, children: newChildren };
  }

  private normalize(nodes: ASTNode[]): ASTNode[] {
    const result: ASTNode[] = [];
    let i = 0;
    while (i < nodes.length) {
      const node = nodes[i];
      if (node.type === "dots") {
        const loop = this.detectLoop(result, nodes, i);
        if (loop) {
          const { K_left, K_right, loopNode } = loop;
          for (let k = 0; k < K_left; k++) result.pop();

          // Try to extend loop backwards if possible (e.g. A_1 A_2 ... A_N)
          while (this.tryExtendLoop(result, loopNode)) {
            // extended
          }

          result.push(loopNode);
          i += K_right + 1; // Skip dots and right side
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

    if (this.matchLoopBody(candidate, loopNode.body, loopNode.variable, prevIndexVal)) {
      for (let k = 0; k < K; k++) result.pop();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (loopNode.start as any).value = prevIndexVal;
      return true;
    }
    return false;
  }

  private matchLoopBody(
    nodes: ASTNode[],
    template: ASTNode[],
    loopVar: string,
    indexVal: number,
  ): boolean {
    if (nodes.length !== template.length) return false;

    for (let i = 0; i < nodes.length; i++) {
      if (!this.matchesTemplate(nodes[i], template[i], loopVar, indexVal))
        return false;
    }
    return true;
  }

  private matchesTemplate(
    node: ASTNode,
    template: ASTNode,
    loopVar: string,
    indexVal: number,
  ): boolean {
    // If template is the loop variable itself (as a scalar), it matches the index value
    if (node.type === "number" && template.type === "item" && (template as ItemNode).name === loopVar && (template as ItemNode).indices.length === 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (node as any).value === indexVal;
    }

    if (node.type !== template.type) return false;

    if (node.type === "item") {
      const n = node as ItemNode;
      const t = template as ItemNode;
      if (n.name !== t.name) return false;
      if (n.indices.length !== t.indices.length) return false;
      for (let i = 0; i < n.indices.length; i++) {
        if (!this.matchesTemplate(n.indices[i], t.indices[i], loopVar, indexVal))
          return false;
      }
      return true;
    }

    if (node.type === "loop") {
      const n = node as LoopNode;
      const t = template as LoopNode;
      // Body might use a different loop variable name, but structure should match.
      // We normalize the body to use the template's variable name for comparison.
      const tReplacedBody = t.body.map(child => this.replaceVar(child, t.variable, n.variable));

      if (!this.matchesTemplate(n.start, t.start, loopVar, indexVal)) return false;
      if (!this.matchesTemplate(n.end, t.end, loopVar, indexVal)) return false;
      return this.matchLoopBody(n.body, tReplacedBody, loopVar, indexVal);
    }

    if (node.type === "number") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return (node as any).value === (template as any).value;
    }

    if (node.type === "binop") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const n = node as any;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const t = template as any;
      return (
        n.op === t.op &&
        this.matchesTemplate(n.left, t.left, loopVar, indexVal) &&
        this.matchesTemplate(n.right, t.right, loopVar, indexVal)
      );
    }

    return this.areNodesEqual(node, template);
  }

  private detectLoop(
    result: ASTNode[],
    nodes: ASTNode[],
    dotsIndex: number,
  ): { K_left: number; K_right: number; loopNode: LoopNode } | null {
    // Priority is given to linear matches to correctly handle multi-variable sequences (e.g. A_1 B_1 ... A_N B_N).
    for (let K = 1; K <= Math.min(result.length, nodes.length - dotsIndex - 1); K++) {
      const left = result.slice(result.length - K);
      const right = nodes.slice(dotsIndex + 1, dotsIndex + 1 + K);
      if (this.match(left, right)) {
        const loopNode = this.createLoop(left, right);
        if (loopNode) return { K_left: K, K_right: K, loopNode };
      }
    }

    // Structural match (Grid pattern detection)
    // Check if the node immediately before 'dots' matches the node immediately after,
    // potentially after some inner normalization. This is used for LaTeX-style grid descriptions.
    if (result.length > 0) {
        const left = [result[result.length - 1]];
        for (let j = dotsIndex + 1; j < nodes.length; j++) {
            const rightRaw = nodes.slice(j);
            const normalizedRight = this.normalize(rightRaw);
            if (normalizedRight.length > 0) {
                const firstRight = [normalizedRight[0]];
                if (this.match(left, firstRight)) {
                    const loopNode = this.createLoop(left, firstRight);
                    if (loopNode) {
                        let k_right = 0;
                        let tempI = j;
                        const subNodes = [];
                        while(tempI < nodes.length && nodes[tempI].type !== 'dots') {
                            subNodes.push(nodes[tempI]);
                            const norm = this.normalize(subNodes);
                            if (norm.length === 1 && this.match(left, norm)) {
                                k_right = (tempI + 1) - (dotsIndex + 1);
                                break;
                            }
                            tempI++;
                        }

                        if (k_right > 0) {
                           return { K_left: 1, K_right: k_right, loopNode };
                        }
                    }
                }
            }
            if (nodes[j].type === 'dots') break;
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
        if ((l as ItemNode).indices.length !== (r as ItemNode).indices.length) return false;
      } else if (l.type === "loop") {
        const ll = l as LoopNode;
        const rr = r as LoopNode;
        if (ll.body.length !== rr.body.length) return false;
        // Deep compare loop bodies
        if (!this.match(ll.body, rr.body)) return false;
      }
    }
    return true;
  }

  private createLoop(left: ASTNode[], right: ASTNode[]): LoopNode | null {
    const differences: { a: ASTNode; b: ASTNode; path: (string | number)[] }[] = [];

    const findDiffs = (l: ASTNode, r: ASTNode, path: (string | number)[] = []) => {
      if (this.areNodesEqual(l, r)) return;

      if (l.type === "number" && r.type === "number") {
        differences.push({ a: l, b: r, path });
      } else if (l.type === "item" && r.type === "item") {
        const il = l as ItemNode;
        const ir = r as ItemNode;
        if (il.name === ir.name && il.indices.length === ir.indices.length) {
          for (let i = 0; i < il.indices.length; i++) {
            findDiffs(il.indices[i], ir.indices[i], [...path, 'indices', i]);
          }
        } else {
           differences.push({a: l, b: r, path});
        }
      } else if (l.type === "loop" && r.type === "loop") {
        const ll = l as LoopNode;
        const rr = r as LoopNode;
        findDiffs(ll.start, rr.start, [...path, 'start']);
        findDiffs(ll.end, rr.end, [...path, 'end']);

        if (ll.body.length === rr.body.length) {
          const llBodyReplaced = ll.body.map(child => this.replaceVar(child, ll.variable, rr.variable));
          for (let i = 0; i < llBodyReplaced.length; i++) {
            findDiffs(llBodyReplaced[i], rr.body[i], [...path, 'body', i]);
          }
        } else {
            differences.push({a: l, b: r, path});
        }
      } else if (l.type === "binop" && r.type === "binop") {
         const bl = l as BinOpNode;
         const br = r as BinOpNode;
         if (bl.op === br.op) {
            findDiffs(bl.left, br.left, [...path, 'left']);
            findDiffs(bl.right, br.right, [...path, 'right']);
         } else {
             differences.push({a: l, b: r, path});
         }
      } else {
        differences.push({ a: l, b: r, path });
      }
    };

    for (let i = 0; i < left.length; i++) {
      findDiffs(left[i], right[i], [i]);
    }

    if (differences.length === 0) return null;

    // Ensure all differences are consistent (all are start -> end)
    const firstDiff = differences[0];
    for (const diff of differences) {
      if (!this.areNodesEqual(diff.a, firstDiff.a) || !this.areNodesEqual(diff.b, firstDiff.b)) {
        return null;
      }
    }

    const start = firstDiff.a;
    const end = firstDiff.b;
    const loopVar = this.generateLoopVar(start, end, left, right);

    const replaceAtPath = (nodes: any[], targetPath: (string | number)[], newValue: ASTNode): any[] => {
        const result = [...nodes];
        let current: any = result;
        for (let i = 0; i < targetPath.length - 1; i++) {
            const key = targetPath[i];
            current[key] = Array.isArray(current[key]) ? [...current[key]] : { ...current[key] };
            current = current[key];
        }
        current[targetPath[targetPath.length - 1]] = newValue;
        return result;
    };

    let body = JSON.parse(JSON.stringify(left));
    for (const diff of differences) {
        body = replaceAtPath(body, diff.path, { type: "item", name: loopVar, indices: [] } as ItemNode);
    }

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
    left: ASTNode[],
    right: ASTNode[],
  ): string {
    const used = new Set<string>();
    const extract = (node: ASTNode) => {
      if (!node) return;
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
    for (let i = 1; ; i++) {
      if (!used.has(`i${i}`)) return `i${i}`;
    }
  }

  private replaceVar(node: ASTNode, oldVar: string, newVar: string): ASTNode {
    if (node.type === 'item') {
      const item = node as ItemNode;
      if (item.name === oldVar && item.indices.length === 0) {
        return { ...item, name: newVar };
      }
      return { ...item, indices: item.indices.map(idx => this.replaceVar(idx, oldVar, newVar)) };
    }
    if (node.type === 'loop') {
      const loop = node as LoopNode;
      if (loop.variable === oldVar) return loop;
      return {
        ...loop,
        start: this.replaceVar(loop.start, oldVar, newVar),
        end: this.replaceVar(loop.end, oldVar, newVar),
        body: loop.body.map(child => this.replaceVar(child, oldVar, newVar))
      };
    }
    if (node.type === 'binop') {
      const bin = node as BinOpNode;
      return {
        ...bin,
        left: this.replaceVar(bin.left, oldVar, newVar),
        right: this.replaceVar(bin.right, oldVar, newVar)
      };
    }
    return node;
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
      const ba = a as BinOpNode;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

      const laBodyReplaced = la.body.map(n => this.replaceVar(n, la.variable, lb.variable));
      return laBodyReplaced.every((n, i) => this.areNodesEqual(n, lb.body[i]));
    }
    return JSON.stringify(a) === JSON.stringify(b);
  }
}
