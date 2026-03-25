import { describe, it, expect } from "vitest";
import { CPlusPlusGenerator } from "./cplusplus";
import { FormatNode, VarType } from "../analyzer/types";

describe("CPlusPlusGenerator Grouping", () => {
  it("should group scalar declarations of the same type", () => {
    // Input: N M K
    const format: FormatNode = {
      type: "format",
      children: [
        { type: "item", name: "N", indices: [] } as any,
        { type: "item", name: "M", indices: [] } as any,
        { type: "item", name: "K", indices: [] } as any,
      ],
    };

    const variables = [
      { name: "N", type: VarType.ValueInt, dims: 0, indices: [] },
      { name: "M", type: VarType.ValueInt, dims: 0, indices: [] },
      { name: "K", type: VarType.ValueInt, dims: 0, indices: [] },
    ];

    const generator = new CPlusPlusGenerator();
    const code = generator.generate(format, variables);

    expect(code).toContain("int64_t N, M, K;");
    expect(code).not.toContain("int64_t N;");
    expect(code).not.toContain("int64_t M;");
    expect(code).not.toContain("int64_t K;");
    expect(code).toContain("std::cin >> N;");
    expect(code).toContain("std::cin >> M;");
    expect(code).toContain("std::cin >> K;");
  });

  it("should group declarations within loops", () => {
    // N
    // Loop i < N:
    //   A_i B_i
    const i_Node: any = { type: "ident", value: "i" };
    const N_Ref: any = { type: "ident", value: "N" };

    const format: FormatNode = {
      type: "format",
      children: [
        { type: "item", name: "N", indices: [] } as any,
        {
          type: "loop",
          variable: "i",
          start: { type: "number", value: 0 },
          end: { type: "ident", value: "N" },
          body: [
            { type: "item", name: "A", indices: [i_Node] } as any,
            { type: "item", name: "B", indices: [i_Node] } as any,
          ],
        } as any,
      ],
    };

    const variables = [
      { name: "N", type: VarType.ValueInt, dims: 0, indices: [] },
      { name: "A", type: VarType.ValueInt, dims: 0, indices: [] }, // Scalar A_i
      { name: "B", type: VarType.ValueInt, dims: 0, indices: [] }, // Scalar B_i
    ];

    const generator = new CPlusPlusGenerator();
    const code = generator.generate(format, variables);

    expect(code).toContain("int64_t N, A, B;");
    expect(code).toContain("std::cin >> A;");
    expect(code).toContain("std::cin >> B;");
  });

  it("should not group different types", () => {
    // N (int) X (float) S (string)
    const format: FormatNode = {
      type: "format",
      children: [
        { type: "item", name: "N", indices: [] } as any,
        { type: "item", name: "X", indices: [] } as any,
        { type: "item", name: "S", indices: [] } as any,
      ],
    };

    const variables = [
      { name: "N", type: VarType.ValueInt, dims: 0, indices: [] },
      { name: "X", type: VarType.Float, dims: 0, indices: [] },
      { name: "S", type: VarType.String, dims: 0, indices: [] },
    ];

    const generator = new CPlusPlusGenerator();
    const code = generator.generate(format, variables);

    expect(code).toContain("int64_t N;");
    expect(code).toContain("long double X;");
    expect(code).toContain("std::string S;");
  });

  it("should group vector declarations of the same type and size", () => {
    // N
    // A_1 ... A_N
    // B_1 ... B_N
    const N_Ref: any = { type: "ident", value: "N" };
    const format: FormatNode = {
      type: "format",
      children: [
        { type: "item", name: "N", indices: [] } as any,
        {
          type: "loop",
          variable: "i",
          start: { type: "number", value: 0 },
          end: { type: "ident", value: "N" },
          body: [{ type: "item", name: "A", indices: [{ type: "ident", value: "i" }] } as any],
        } as any,
        {
          type: "loop",
          variable: "j",
          start: { type: "number", value: 0 },
          end: { type: "ident", value: "N" },
          body: [{ type: "item", name: "B", indices: [{ type: "ident", value: "j" }] } as any],
        } as any,
      ],
    };

    const variables = [
      { name: "N", type: VarType.ValueInt, dims: 0, indices: [] },
      { name: "A", type: VarType.ValueInt, dims: 1, indices: [N_Ref] },
      { name: "B", type: VarType.ValueInt, dims: 1, indices: [N_Ref] },
    ];

    const generator = new CPlusPlusGenerator();
    const code = generator.generate(format, variables);

    expect(code).toContain("std::vector<int64_t> A(N), B(N);");
    expect(code).not.toContain("std::vector<int64_t> A(N);");
    expect(code).not.toContain("std::vector<int64_t> B(N);");
  });

  it("should not group vectors with different sizes", () => {
    // N M
    // A_1 ... A_N
    // B_1 ... B_M
    const N_Ref: any = { type: "ident", value: "N" };
    const M_Ref: any = { type: "ident", value: "M" };
    const format: FormatNode = {
      type: "format",
      children: [
        { type: "item", name: "N", indices: [] } as any,
        { type: "item", name: "M", indices: [] } as any,
        {
          type: "loop",
          variable: "i",
          start: { type: "number", value: 0 },
          end: { type: "ident", value: "N" },
          body: [{ type: "item", name: "A", indices: [{ type: "ident", value: "i" }] } as any],
        } as any,
        {
          type: "loop",
          variable: "j",
          start: { type: "number", value: 0 },
          end: { type: "ident", value: "M" },
          body: [{ type: "item", name: "B", indices: [{ type: "ident", value: "j" }] } as any],
        } as any,
      ],
    };

    const variables = [
      { name: "N", type: VarType.ValueInt, dims: 0, indices: [] },
      { name: "M", type: VarType.ValueInt, dims: 0, indices: [] },
      { name: "A", type: VarType.ValueInt, dims: 1, indices: [N_Ref] },
      { name: "B", type: VarType.ValueInt, dims: 1, indices: [M_Ref] },
    ];

    const generator = new CPlusPlusGenerator();
    const code = generator.generate(format, variables);

    expect(code).toContain("std::vector<int64_t> A(N);");
    expect(code).toContain("std::vector<int64_t> B(M);");
    expect(code).not.toContain("A(N), B(M)");
  });

  it("should not produce duplicate names in a grouped declaration", () => {
    // N N
    const format: FormatNode = {
      type: "format",
      children: [
        { type: "item", name: "N", indices: [] } as any,
        { type: "item", name: "N", indices: [] } as any,
      ],
    };

    const variables = [{ name: "N", type: VarType.ValueInt, dims: 0, indices: [] }];

    const generator = new CPlusPlusGenerator();
    const code = generator.generate(format, variables);

    expect(code).toContain("int64_t N;");
    expect(code).not.toContain("int64_t N, N;");
  });
});
