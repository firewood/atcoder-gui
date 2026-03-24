import { parseHtml } from "../analyzer/html-parser.js";
import { describe, it, expect } from "vitest";

describe("html-parser multipleCases input preservation", () => {
  it("should preserve the first line (T) in sample inputs when multipleCases is true", () => {
    const html = `
      <section>
        <h3>Input Format</h3>
        <pre>T</pre>
        <pre>N
A_1 A_2 ... A_N</pre>
      </section>
      <section>
        <h3>Sample Input 1</h3>
        <pre>2
3
1 2 3
2
10 20</pre>
      </section>
      <section>
        <h3>Sample Output 1</h3>
        <pre>1 2 3
10 20</pre>
      </section>
    `;

    const result = parseHtml(html);
    expect(result.multipleCases).toBe(true);
    // Current behavior (buggy): it strips "2\n"
    // Desired behavior: it should be "2\n3\n1 2 3\n2\n10 20"
    expect(result.samples[0].input.trim()).toBe("2\n3\n1 2 3\n2\n10 20".trim());
  });
});
