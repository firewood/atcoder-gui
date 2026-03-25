import { describe, it, expect } from "vitest";
import { parseHtml } from "../analyzer/html-parser.js";

describe("return type inference in htmlParser", () => {
  it("should infer int for small numbers", () => {
    const html = `
      <section><h3>Sample Output 1</h3><pre>123456789</pre></section>
    `;
    const result = parseHtml(html);
    expect(result.returnType).toBe("int");
  });

  it("should infer string for very large numbers (>= 20 digits)", () => {
    const html = `
      <section><h3>Sample Output 1</h3><pre>20220200022022002222200220022222222022022202022022</pre></section>
    `;
    const result = parseHtml(html);
    expect(result.returnType).toBe("string");
  });

  it("should infer string if any token is a very large number", () => {
    const html = `
      <section><h3>Sample Output 1</h3><pre>123 20220200022022002222200220022222222022022202022022</pre></section>
    `;
    const result = parseHtml(html);
    expect(result.returnType).toBe("string");
  });
});
