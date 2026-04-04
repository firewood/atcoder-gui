import { describe, it, expect } from "vitest";
import { PythonGenerator } from "./python";
import { FormatNode, VarType } from "../analyzer/types";

describe("PythonGenerator", () => {
  it("should generate Python code for simple input", () => {
    // Input: N (int)
    const format: FormatNode = {
      type: "format",
      children: [
        {
          type: "item",
          name: "N",
          indices: [],
        } as any,
      ],
    };

    const variables = [
      {
        name: "N",
        type: VarType.ValueInt,
        dims: 0,
        indices: [],
      },
    ];

    const generator = new PythonGenerator();
    const code = generator.generate(format, variables);

    expect(code).toContain("N: int");
    expect(code).not.toContain("N: int;");
    expect(code).toContain("N = int(next(tokens))");
    expect(code).toContain("def solve(N: int):");
  });

  it("should generate Python code for array input", () => {
    // Input:
    // N
    // A_1 ... A_N

    const N_Node: any = { type: "item", name: "N", indices: [] };
    const i_Node: any = { type: "ident", value: "i" };
    const N_Ref: any = { type: "ident", value: "N" };

    const format: FormatNode = {
      type: "format",
      children: [
        N_Node,
        {
          type: "loop",
          variable: "i",
          start: { type: "number", value: 0 },
          end: { type: "ident", value: "N" },
          body: [
            {
              type: "item",
              name: "A",
              indices: [i_Node],
            },
          ],
        } as any,
      ],
    };

    const variables = [
      { name: "N", type: VarType.ValueInt, dims: 0, indices: [] },
      { name: "A", type: VarType.ValueInt, dims: 1, indices: [N_Ref] },
    ];

    const generator = new PythonGenerator();
    const code = generator.generate(format, variables);

    // Check declarations/allocations
    expect(code).toContain("N: int");
    expect(code).toContain("A: List[int]");
    expect(code).toContain("A = [0] * N");

    // Check input loop
    expect(code).toContain("N = int(next(tokens))");
    expect(code).toContain("for i in range(N):");
    expect(code).toContain("A[i] = int(next(tokens))");

    // Check arguments
    expect(code).toContain("def solve(N: int, A: List[int]):");
    expect(code).toContain("solve(N, A)");
  });

  it("should generate Python code with recursion limit and MOD/YES/NO", () => {
    const format: FormatNode = { type: "format", children: [] };
    const variables: any[] = [];
    
    const generator = new PythonGenerator();
    const code = generator.generate(format, variables);
    
    expect(code).toContain("import sys");
    expect(code).toContain("sys.setrecursionlimit(2000000)");
    expect(code).toContain("def input_tokens():");
    expect(code).toContain("tokens = input_tokens()");
    expect(code).toContain("if __name__ == '__main__':");
  });
});
