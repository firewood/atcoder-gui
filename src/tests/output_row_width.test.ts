import { describe, it, expect } from "vitest";
import { generateParseResult } from "../generator/pipeline.js";
import { CPlusPlusGenerator } from "../generator/cplusplus.js";
import { PythonGenerator } from "../generator/python.js";
import { VariableInfo } from "../generator/variable-extractor.js";

// A multi-row, multi-column answer used to be typed `vector<pair<int64_t, int64_t>>`,
// which only fits output that is exactly two values wide. abc473_d prints N values
// per line (N is an input, up to 10), so the rows are now `vector<int64_t>` — the
// same type serves both widths, and Python already did exactly this.
function problemHtml(inputFormat: string, samples: [string, string][]): string {
  const sections = samples
    .map(
      ([input, output], i) =>
        `<section><h3>Sample Input ${i + 1}</h3><pre>${input}</pre></section>` +
        `<section><h3>Sample Output ${i + 1}</h3><pre>${output}</pre></section>`,
    )
    .join("");
  return `<span class="lang-en"><section><h3>Input</h3><pre>${inputFormat}</pre></section>${sections}</span>`;
}

function generate(taskId: string, inputFormat: string, samples: [string, string][]) {
  const result = generateParseResult(problemHtml(inputFormat, samples), taskId, "url");
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
    cpp: new CPlusPlusGenerator().generate(...args),
    python: new PythonGenerator().generate(...args),
  };
}

describe("output row width", () => {
  it("types rows of a grid answer as a vector (abc473_d style)", () => {
    // The row width follows N, so no fixed-size type could hold it.
    const { cpp } = generate("abc999_a", `N K`, [
      ["3 8", "0 1 2\n0 4 0\n1 2 1"],
      ["4 2", "0 1 0 0\n2 0 0 0"],
    ]);

    expect(cpp).toContain("std::vector<std::vector<int64_t>> solve(int64_t N, int64_t K) {");
    expect(cpp).not.toContain("pair<int64_t, int64_t>");
    // Each row is printed element by element, space separated.
    expect(cpp).toContain("for (size_t i = 0; i < ans.size(); i++) {");
    expect(cpp).toContain('cout << (i > 0 ? " " : "") << ans[i];');
    expect(cpp).not.toContain("ans.first");
  });

  it("uses the same vector rows for two-value output (abc430_g style)", () => {
    // Two values per line used to produce `vector<pair<int64_t, int64_t>>`.
    const { cpp } = generate("abc999_b", `N K`, [["3 8", "2 1\n1 2\n2 1"]]);

    expect(cpp).toContain("std::vector<std::vector<int64_t>> solve(int64_t N, int64_t K) {");
    expect(cpp).not.toContain("pair<int64_t, int64_t>");
    expect(cpp).not.toContain("ans.first");
  });

  it("leaves single-column and single-row output alone", () => {
    // One value per line stays a flat vector printed one per line...
    const rows = generate("abc999_c", `N K`, [["3 8", "1\n2\n3"]]);
    expect(rows.cpp).toContain("std::vector<int64_t> solve(int64_t N, int64_t K) {");
    expect(rows.cpp).toContain("cout << ans << endl;");

    // ...and several values on one line stay a flat vector printed space separated.
    const columns = generate("abc999_d", `N K`, [["3 8", "1 2 3"]]);
    expect(columns.cpp).toContain("std::vector<int64_t> solve(int64_t N, int64_t K) {");
    expect(columns.cpp).toContain('cout << (i > 0 ? " " : "") << ans;');
  });

  it("leaves the Python output unchanged", () => {
    const wide = generate("abc999_e", `N K`, [["3 8", "0 1 2\n0 4 0"]]);
    const twoWide = generate("abc999_f", `N K`, [["3 8", "2 1\n1 2"]]);

    for (const { python } of [wide, twoWide]) {
      expect(python).toContain("def solve(N: int, K: int):");
      expect(python).toContain("ans: List[List[int]]");
      expect(python).toContain("print(*ans)");
    }
  });
});
