import { describe, it, expect } from "vitest";
import { parseHtml } from "./html-parser";

describe("return type inference", () => {
  const wrapHtml = (inputFormat: string, sampleOutputs: string[], bodyText: string = "") => `
    <html>
      <body>
        <section>
          <h3>Input Format</h3>
          <pre>${inputFormat}</pre>
        </section>
        <section>
          <h3>Problem Statement</h3>
          <p>${bodyText}</p>
        </section>
        ${sampleOutputs
          .map(
            (out, i) => `
          <section>
            <h3>Sample Output ${i + 1}</h3>
            <pre>${out}</pre>
          </section>
        `,
          )
          .join("")}
      </body>
    </html>
  `;

  it("should detect int return type", () => {
    const html = wrapHtml("N", ["42", "7"]);
    const result = parseHtml(html);
    expect(result.returnType).toBe("int");
    expect(result.mod).toBeUndefined();
  });

  it("should detect modint return type for 998244353", () => {
    const html = wrapHtml("N", ["42"], "Find the answer modulo 998244353.");
    const result = parseHtml(html);
    expect(result.returnType).toBe("modint");
    expect(result.mod).toBe(998244353);
  });

  it("should detect modint return type for 1000000007", () => {
    const html = wrapHtml("N", ["1000000006"], "1000000007");
    const result = parseHtml(html);
    expect(result.returnType).toBe("modint");
    expect(result.mod).toBe(1000000007);
  });

  it("should detect string return type", () => {
    const html = wrapHtml("N", ["Yes", "No"]);
    const result = parseHtml(html);
    expect(result.returnType).toBe("string");
  });

  it("should detect double return type", () => {
    // We need to trigger judgeType = 'decimal'
    const html = wrapHtml("N", ["3.14159"], "absolute error 10^-6");
    const result = parseHtml(html);
    expect(result.returnType).toBe("double");
    expect(result.judgeType).toBe("decimal");
  });

  it("should detect int_array return type", () => {
    const html = wrapHtml("N", ["1 2 3", "4 5"]);
    const result = parseHtml(html);
    expect(result.returnType).toBe("int_array");
  });

  it("should detect multiple_lines return type", () => {
    const html = wrapHtml("N", ["1\n2\n3", "4\n5"]);
    const result = parseHtml(html);
    expect(result.returnType).toBe("multiple_lines");
  });

  it("should detect void return type when outputs are mixed or empty", () => {
    const html = wrapHtml("N", []);
    const result = parseHtml(html);
    expect(result.returnType).toBe("void");
  });

  it("should detect void if mixed types", () => {
      const html = wrapHtml("N", ["1 2", "string"]);
      const result = parseHtml(html);
      expect(result.returnType).toBe("void");
  });
});
