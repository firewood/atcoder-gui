import { describe, it, expect } from "vitest";
import { parseHtml } from "../analyzer/html-parser.js";
import { CPlusPlusGenerator } from "../generator/cplusplus.js";
import { PythonGenerator } from "../generator/python.js";
import { FormatNode } from "../analyzer/types.js";

describe("boolean detection in htmlParser", () => {
  it("should detect Yes/No from sample outputs", () => {
    const html = `
      <section>
        <h3>Input Format</h3>
        <pre>N</pre>
      </section>
      <section>
        <h3>Sample Input 1</h3>
        <pre>1</pre>
      </section>
      <section>
        <h3>Sample Output 1</h3>
        <pre>Yes</pre>
      </section>
      <section>
        <h3>Sample Input 2</h3>
        <pre>2</pre>
      </section>
      <section>
        <h3>Sample Output 2</h3>
        <pre>No</pre>
      </section>
    `;
    const result = parseHtml(html) as any;
    expect(result.yesStr).toBe("Yes");
    expect(result.noStr).toBe("No");
  });

  it("should detect YES/NO from sample outputs", () => {
    const html = `
      <section>
        <h3>Input Format</h3>
        <pre>N</pre>
      </section>
      <section>
        <h3>Sample Input 1</h3>
        <pre>1</pre>
      </section>
      <section>
        <h3>Sample Output 1</h3>
        <pre>YES</pre>
      </section>
      <section>
        <h3>Sample Input 2</h3>
        <pre>2</pre>
      </section>
      <section>
        <h3>Sample Output 2</h3>
        <pre>NO</pre>
      </section>
    `;
    const result = parseHtml(html) as any;
    expect(result.yesStr).toBe("YES");
    expect(result.noStr).toBe("NO");
  });

  it("should detect Possible/Impossible from sample outputs", () => {
    const html = `
      <section>
        <h3>Input Format</h3>
        <pre>N</pre>
      </section>
      <section>
        <h3>Sample Input 1</h3>
        <pre>1</pre>
      </section>
      <section>
        <h3>Sample Output 1</h3>
        <pre>Possible</pre>
      </section>
      <section>
        <h3>Sample Input 2</h3>
        <pre>2</pre>
      </section>
      <section>
        <h3>Sample Output 2</h3>
        <pre>Impossible</pre>
      </section>
    `;
    const result = parseHtml(html) as any;
    expect(result.yesStr).toBe("Possible");
    expect(result.noStr).toBe("Impossible");
  });

  it("should include YES/NO in generated C++ code", () => {
    const html = `
      <section>
        <h3>Input Format</h3>
        <pre>N</pre>
      </section>
      <section>
        <h3>Sample Output 1</h3>
        <pre>Yes</pre>
      </section>
      <section>
        <h3>Sample Output 2</h3>
        <pre>No</pre>
      </section>
    `;
    const result = parseHtml(html);
    const generator = new CPlusPlusGenerator();
    const format: FormatNode = { type: "format", children: [] };
    const code = generator.generate(
      format,
      [{ name: "N", type: "int", dims: 0, indices: [] }],
      false,
      false,
      result.yesStr,
      result.noStr,
    );

    expect(code).toContain('const string YES = "Yes";');
    expect(code).toContain('const string NO = "No";');
  });

  it("should include YES/NO in generated Python code", () => {
    const html = `
      <section>
        <h3>Input Format</h3>
        <pre>N</pre>
      </section>
      <section>
        <h3>Sample Output 1</h3>
        <pre>Yes</pre>
      </section>
      <section>
        <h3>Sample Output 2</h3>
        <pre>No</pre>
      </section>
    `;
    const result = parseHtml(html);
    const generator = new PythonGenerator();
    const format: FormatNode = { type: "format", children: [] };
    const code = generator.generate(
      format,
      [{ name: "N", type: "int", dims: 0, indices: [] }],
      false,
      false,
      result.yesStr,
      result.noStr,
    );

    expect(code).toContain('YES = "Yes"');
    expect(code).toContain('NO = "No"');
  });
});
