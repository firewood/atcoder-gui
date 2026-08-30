import { describe, it, expect } from "vitest";
import { generateParseResult } from "../generator/pipeline.js";
import { PythonGenerator } from "../generator/python.js";
import { CPlusPlusGenerator } from "../generator/cplusplus.js";
import { VariableInfo } from "../generator/variable-extractor.js";

// AtCoder writes fixed-width rows with 1-based literal subscripts
// (`P_{i,1} P_{i,2} P_{i,3}`), but the generated code allocates and loops
// 0-based. Emitting those literals verbatim indexed past the end of the row.
// The real-task regression is abc228_c (test-resources/expected-results).
function problemHtml(inputFormat: string, sampleIn: string, sampleOut: string): string {
  return `<span class="lang-en">
    <section><h3>Input</h3><pre>${inputFormat}</pre></section>
    <section><h3>Sample Input 1</h3><pre>${sampleIn}</pre></section>
    <section><h3>Sample Output 1</h3><pre>${sampleOut}</pre></section>
  </span>`;
}

function generate(taskId: string, inputFormat: string, sampleIn: string, sampleOut: string) {
  const result = generateParseResult(problemHtml(inputFormat, sampleIn, sampleOut), taskId, "url");
  const args = [
    result.formatTree!,
    result.variables as VariableInfo[],
    result.multipleCases,
    result.queryType,
    result.yesStr,
    result.noStr,
    result.mod,
    result.returnType,
    result.multipleColumns,
    result.multipleRows,
    result.variableArray,
  ] as const;

  return {
    python: new PythonGenerator().generate(...args),
    cpp: new CPlusPlusGenerator().generate(...args),
  };
}

describe("0-based literal subscripts", () => {
  it("shifts 1-based literal columns of a 2D array (abc228_c style)", () => {
    const { python, cpp } = generate(
      "abc999_a",
      `N K
P_{1,1} P_{1,2} P_{1,3}
\\vdots
P_{N,1} P_{N,2} P_{N,3}`,
      `2 1
178 205 132
112 220 96`,
      `Yes
No`,
    );

    // 3 columns allocated, so the reads must be P[i][0..2], not P[i][1..3].
    expect(python).toContain("P = [[0] * 3 for _ in range(N)]");
    expect(python).toContain("P[i][0] = int(next(tokens))");
    expect(python).toContain("P[i][2] = int(next(tokens))");
    expect(python).not.toContain("P[i][3]");

    expect(cpp).toContain("std::vector<std::vector<int64_t>> P(N, std::vector<int64_t>(3));");
    expect(cpp).toContain("std::cin >> P[i][0] >> P[i][1] >> P[i][2];");
    expect(cpp).not.toContain("P[i][3]");
  });

  it("shifts 1-based literal subscripts of a 1D array (A_1 A_2 A_3)", () => {
    const { python, cpp } = generate("abc999_b", `A_1 A_2 A_3`, `5 2 8`, `1`);

    expect(python).toContain("A = [0] * 3");
    expect(python).toContain("A[0] = int(next(tokens))");
    expect(python).toContain("A[2] = int(next(tokens))");
    expect(python).not.toContain("A[3]");

    expect(cpp).toContain("std::vector<int64_t> A(3);");
    expect(cpp).not.toContain("A[3]");
  });

  it("leaves an already 0-based statement alone but sizes it for the whole range", () => {
    // The base is the smallest subscript seen, not a hard-coded 1, so `A_0`
    // stays `A[0]`; the length spans max - min + 1 = 3 rather than the last
    // subscript (2), which would have left `A[2]` out of bounds.
    const { python, cpp } = generate("abc999_c", `A_0 A_1 A_2`, `5 2 8`, `1`);

    expect(python).toContain("A = [0] * 3");
    expect(python).toContain("A[0] = int(next(tokens))");
    expect(python).toContain("A[2] = int(next(tokens))");

    expect(cpp).toContain("std::vector<int64_t> A(3);");
  });

  it("does not shift a dimension driven by a loop variable", () => {
    // `for i in range(N)` is already 0-based; only literal subscripts move.
    const { python, cpp } = generate("abc999_d", `N\nA_1 A_2 \\ldots A_N`, `3\n5 2 8`, `1`);

    expect(python).toContain("for i in range(N):");
    expect(python).toContain("A[i] = int(next(tokens))");
    expect(cpp).toContain("std::cin >> A[i];");
  });
});
