import { describe, it, expect } from "vitest";
import { generateParseResult } from "../generator/pipeline.js";

// Hermetic unit tests for scope-aware folding of literal alphabetic subscripts.
// The abc467_d real-task regression lives in test-resources/expected-results;
// these cover synthetic edge cases that no real task conveniently exercises.
// Each case reproduces a distinct bug that occurred before the fix.
function problemHtml(inputFormat: string, sampleIn: string, sampleOut: string): string {
  return `<span class="lang-en">
    <section><h3>Input</h3><pre>${inputFormat}</pre></section>
    <section><h3>Sample Input 1</h3><pre>${sampleIn}</pre></section>
    <section><h3>Sample Output 1</h3><pre>${sampleOut}</pre></section>
  </span>`;
}

describe("scope-aware literal subscript folding", () => {
  it("folds a literal subscript used as a loop bound (A_1 ... A_{N_x})", () => {
    // `N_x` is a scalar; the array length references that same scalar. Both the
    // declaration and the loop bound must fold to `N_x` consistently.
    const html = problemHtml(
      `N_x
A_1 A_2 \\ldots A_{N_x}`,
      `3
5 2 8`,
      `1`,
    );

    const result = generateParseResult(html, "abc999_a", "url");
    const byName = Object.fromEntries(result.variables.map((v) => [v.name, v]));

    // No spurious `N` variable is extracted.
    expect(Object.keys(byName).sort()).toEqual(["A", "N_x"]);
    expect(byName["N_x"].dims).toBe(0);
    // A is an array, sized by the folded scalar N_x (not collapsed to a scalar).
    expect(byName["A"].dims).toBe(1);
    expect(byName["A"].indices).toHaveLength(1);
    expect((byName["A"].indices[0] as { name: string }).name).toBe("N_x");
  });

  it("folds a literal subscript inside an arithmetic loop bound (A_1 ... A_{N_x-1})", () => {
    // The bound is an expression `N_x - 1`. The `-1` must stay outside the
    // subscript so the literal `x` folds into `N_x` and the array is sized
    // `N_x - 1`, rather than parsing as `N[x-1]`.
    const html = problemHtml(
      `N_x
A_1 A_2 \\ldots A_{N_x-1}`,
      `4
5 2 8`,
      `1`,
    );

    const result = generateParseResult(html, "abc999_c", "url");
    const byName = Object.fromEntries(result.variables.map((v) => [v.name, v]));

    expect(Object.keys(byName).sort()).toEqual(["A", "N_x"]);
    expect(byName["N_x"].dims).toBe(0);
    expect(byName["A"].dims).toBe(1);
    // The index is the binop `N_x - 1`.
    const index = byName["A"].indices[0] as {
      type: string;
      op: string;
      left: { name: string };
      right: { value: number };
    };
    expect(index.type).toBe("binop");
    expect(index.op).toBe("-");
    expect(index.left.name).toBe("N_x");
    expect(index.right.value).toBe(1);
  });

  it("does not treat an out-of-scope loop variable as an index (P_i vs A_1 ... A_N)", () => {
    // The A-loop generates loop variable `i`, but `P_i` lives in an unrelated
    // scope and must still fold to a scalar rather than crash with
    // "Variable i not found".
    const html = problemHtml(
      `P_i
N
A_1 A_2 \\ldots A_N`,
      `7
3
5 2 8`,
      `1`,
    );

    const result = generateParseResult(html, "abc999_b", "url");
    const byName = Object.fromEntries(result.variables.map((v) => [v.name, v]));

    expect(Object.keys(byName).sort()).toEqual(["A", "N", "P_i"]);
    expect(byName["P_i"].dims).toBe(0);
    expect(byName["N"].dims).toBe(0);
    expect(byName["A"].dims).toBe(1);
    expect((byName["A"].indices[0] as { name: string }).name).toBe("N");
  });
});
