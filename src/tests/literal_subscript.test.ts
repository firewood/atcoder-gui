import { describe, it, expect } from "vitest";
import { generateParseResult } from "../generator/pipeline.js";
import { CPlusPlusGenerator } from "../generator/cplusplus.js";

// Reproduces the abc467_d failure: coordinates written as `P_x P_y Q_x Q_y ...`
// were parsed as `P` indexed by the (undefined) variable `x`, which crashed
// type inference with "Variable x not found in environment".
const abc467dHtml = `
  <span class="lang-en">
    <section>
      <h3>Input</h3>
      <p>The input is given from Standard Input in the following format:</p>
      <pre><var>T</var>
<var>\\mathrm{case}_1</var>
<var>\\mathrm{case}_2</var>
</pre>
      <p>Each case is given in the following format:</p>
      <pre><var>P_x</var> <var>P_y</var> <var>Q_x</var> <var>Q_y</var> <var>R_x</var> <var>R_y</var> <var>S_x</var> <var>S_y</var></pre>
    </section>
    <section>
      <h3>Sample Input 1</h3>
      <pre>3
2 0 1 1 -1 0 1 2
1 0 -1 0 0 1 0 -1
4 0 3 1 2 0 1 1
</pre>
    </section>
    <section>
      <h3>Sample Output 1</h3>
      <pre>Yes
Yes
No
</pre>
    </section>
  </span>
`;

describe("literal alphabetic subscripts (abc467_d style)", () => {
  it("folds `P_x` into a single scalar variable instead of indexing", () => {
    const result = generateParseResult(abc467dHtml, "abc467_d", "url");

    expect(result.formatTree).toBeDefined();
    const names = result.variables.map((v) => v.name);
    expect(names).toEqual(["P_x", "P_y", "Q_x", "Q_y", "R_x", "R_y", "S_x", "S_y"]);
    // All are scalars (dims === 0), not arrays.
    expect(result.variables.every((v) => v.dims === 0)).toBe(true);
  });

  it("generates compilable C++ that reads all eight coordinates", () => {
    const result = generateParseResult(abc467dHtml, "abc467_d", "url");
    const code = new CPlusPlusGenerator().generate(
      result.formatTree!,
      result.variables,
      result.multipleCases,
      result.queryType,
      result.yesStr,
      result.noStr,
      result.mod,
      result.returnType,
      result.multipleColumns,
      result.multipleRows,
      result.variableArray,
    );

    expect(code).toContain("cin >> P_x >> P_y >> Q_x >> Q_y >> R_x >> R_y >> S_x >> S_y");
    expect(code).toContain("bool solve(");
    // Multiple cases (T) detected -> case loop in main.
    expect(code).toContain("while (t--)");
  });
});
