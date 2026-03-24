import { FormatNode, ItemNode, ASTNode, LoopNode, BinOpNode } from "./types";

export class Analyzer {
  public analyze(root: FormatNode): FormatNode {
    const childrenWithoutBreaks = root.children.filter(
      (n) => n.type !== "break",
    );
    let current = childrenWithoutBreaks;
    while (true) {
      const next = this.normalize(current);
      if (JSON.stringify(next) === JSON.stringify(current)) break;
      current = next;
    }
    return { ...root, children: current };
  }

  private normalize(nodes: ASTNode[]): ASTNode[] {
    // Recursively normalize all children first
    const normalizedNodes = nodes.map((node) => {
      if (node.type === "loop") {
        const loop = node as LoopNode;
        return { ...loop, body: this.normalize(loop.body) };
      }
      return node;
    });

    const result: { node: ASTNode; count: number }[] = [];
    let i = 0;
    while (i < normalizedNodes.length) {
      const node = normalizedNodes[i];
      if (node.type === "dots") {
        const loop = this.detectLoop(normalizedNodes, i, result);
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

    // Instantiate template by replacing loop variable with indexVal
    const instantiatedBody = loopNode.body.map((template) =>
      this.instantiate(template, loopNode.variable, indexVal),
    );

    for (let i = 0; i < nodes.length; i++) {
      if (!this.areNodesEqual(nodes[i], instantiatedBody[i])) return false;
    }
    return true;
  }

  private instantiate(node: ASTNode, loopVar: string, indexVal: number): ASTNode {
    if (node.type === "item") {
      const item = node as ItemNode;
      if (item.name === loopVar && item.indices.length === 0) {
        return { type: "number", value: indexVal } as NumberNode;
      }
      return {
        ...item,
        indices: item.indices.map((idx) => this.instantiate(idx, loopVar, indexVal)),
      };
    }
    if (node.type === "binop") {
      const bin = node as BinOpNode;
      return {
        ...bin,
        left: this.instantiate(bin.left, loopVar, indexVal),
        right: this.instantiate(bin.right, loopVar, indexVal),
      };
    }
    if (node.type === "loop") {
      const loop = node as LoopNode;
      // Note: If nested loop uses the same variable name, it shadows.
      // But usually they have different names.
      if (loop.variable === loopVar) return loop;
      return {
        ...loop,
        start: this.instantiate(loop.start, loopVar, indexVal),
        end: this.instantiate(loop.end, loopVar, indexVal),
        body: loop.body.map((child) => this.instantiate(child, loopVar, indexVal)),
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
        if ((l as ItemNode).indices.length !== (r as ItemNode).indices.length)
          return false;
      } else if (l.type === "loop") {
        const ll = l as LoopNode;
        const rr = r as LoopNode;
        // Body should match structurally regardless of loop variable name (alpha equivalence)
        // For matching, we check if they have the same structure.
        if (!this.match(ll.body, rr.body)) return false;
      } else if (l.type === "dots") {
        continue; // Match dots
      } else if (l.type === "number") {
        continue; // Allow different numbers for createLoop to pick up
      } else if (l.type === "binop") {
        const bl = l as BinOpNode;
        const br = r as BinOpNode;
        if (bl.op !== br.op) return false;
        if (!this.match([bl.left], [br.left])) return false;
        if (!this.match([bl.right], [br.right])) return false;
      } else {
        // For other types, they should be identical
        if (JSON.stringify(l) !== JSON.stringify(r)) return false;
      }
    }
    return true;
  }

  private createLoop(left: ASTNode[], right: ASTNode[]): LoopNode | null {
    // Collect all differences between left and right
    const allDiffs: { path: (string | number)[]; left: ASTNode; right: ASTNode }[][] = [];
    for (let i = 0; i < left.length; i++) {
      allDiffs.push(this.findDiffs(left[i], right[i], []));
    }

    // Heuristic: Identify the primary loop variable by looking for consistent differences.
    // If multiple nodes differ, they should all differ by the same (start, end) pair.
    if (allDiffs.every((d) => d.length === 0)) return null;

    let start: ASTNode | null = null;
    let end: ASTNode | null = null;

    for (const diffs of allDiffs) {
      for (const diff of diffs) {
        if (!start) {
          start = diff.left;
          end = diff.right;
        } else {
          if (
            !this.areNodesEqual(start, diff.left) ||
            !this.areNodesEqual(end, diff.right)
          ) {
            // Inconsistent difference. For now, we only support one type of difference per loop.
            return null;
          }
        }
      }
    }

    if (!start || !end) return null;

    const loopVar = this.generateLoopVar(start, end, left, right);

    const body = left.map((node, i) => {
      const diffs = allDiffs[i];
      const paths = diffs.map((d) => d.path);
      return this.replacePaths(node, paths, {
        type: "item",
        name: loopVar,
        indices: [],
      } as ItemNode);
    });

    return {
      type: "loop",
      variable: loopVar,
      start,
      end,
      body: this.normalize(body),
    };
  }

  private findDiffs(
    l: ASTNode,
    r: ASTNode,
    path: (string | number)[],
  ): { path: (string | number)[]; left: ASTNode; right: ASTNode }[] {
    if (l.type !== r.type) return [{ path, left: l, right: r }];

    if (l.type === "dots") return [];

    if (l.type === "number") {
      if ((l as any).value !== (r as any).value) {
        return [{ path, left: l, right: r }];
      }
      return [];
    }

    if (l.type === "item") {
      const li = l as ItemNode;
      const ri = r as ItemNode;
      if (li.name !== ri.name) return [{ path, left: l, right: r }];
      if (li.indices.length !== ri.indices.length) return [{ path, left: l, right: r }];
      const diffs: any[] = [];
      for (let i = 0; i < li.indices.length; i++) {
        diffs.push(...this.findDiffs(li.indices[i], ri.indices[i], [...path, "indices", i]));
      }
      return diffs;
    }

    if (l.type === "binop") {
      const bl = l as BinOpNode;
      const br = r as BinOpNode;
      if (bl.op !== br.op) return [{ path, left: l, right: r }];
      return [
        ...this.findDiffs(bl.left, br.left, [...path, "left"]),
        ...this.findDiffs(bl.right, br.right, [...path, "right"]),
      ];
    }

    if (l.type === "loop") {
      const ll = l as LoopNode;
      const rr = r as LoopNode;
      // For loops, we assume match already checked structural equality.
      // Differences can be in start, end, or body.
      const diffs: any[] = [];
      diffs.push(...this.findDiffs(ll.start, rr.start, [...path, "start"]));
      diffs.push(...this.findDiffs(ll.end, rr.end, [...path, "end"]));
      for (let i = 0; i < ll.body.length; i++) {
        diffs.push(...this.findDiffs(ll.body[i], rr.body[i], [...path, "body", i]));
      }
      return diffs;
    }

    return [];
  }

  private replacePaths(node: ASTNode, paths: (string | number)[][], replacement: ASTNode): ASTNode {
    // If any path is empty, replace the whole node
    if (paths.some((p) => p.length === 0)) return replacement;

    const newNode = { ...node } as any;

    // Group paths by their first element
    const groups: Record<string, (string | number)[][]> = {};
    for (const path of paths) {
      const head = String(path[0]);
      if (!groups[head]) groups[head] = [];
      groups[head].push(path.slice(1));
    }

    for (const key of Object.keys(groups)) {
      const val = newNode[key];
      if (Array.isArray(val)) {
        const nextPathsByIdx: Record<number, (string | number)[][]> = {};
        for (const p of groups[key]) {
          const idx = Number(p[0]);
          if (!nextPathsByIdx[idx]) nextPathsByIdx[idx] = [];
          nextPathsByIdx[idx].push(p.slice(1));
        }
        for (const idx of Object.keys(nextPathsByIdx)) {
          val[Number(idx)] = this.replacePaths(val[Number(idx)], nextPathsByIdx[Number(idx)], replacement);
        }
      } else {
        newNode[key] = this.replacePaths(val, groups[key], replacement);
      }
    }

    return newNode;
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
      } else if (node.type === "binop") {
        extract((node as BinOpNode).left);
        extract((node as BinOpNode).right);
      } else if (node.type === "loop") {
        const l = node as LoopNode;
        used.add(l.variable);
        extract(l.start);
        extract(l.end);
        l.body.forEach(extract);
      } else if (node.type === "format") {
        (node as FormatNode).children.forEach(extract);
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
