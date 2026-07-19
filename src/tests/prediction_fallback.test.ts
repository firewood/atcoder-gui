import { describe, it, expect } from "vitest";
import { CPlusPlusGenerator } from "../generator/cplusplus.js";
import { PythonGenerator } from "../generator/python.js";

// When input-format prediction fails, the generators should still emit a
// compilable skeleton (prediction disabled) rather than nothing at all.
describe("prediction failure fallback", () => {
  it("C++ fallback renders a skeleton with prediction disabled", () => {
    const code = new CPlusPlusGenerator().generateFallback({
      multipleCases: true,
      yesStr: "Yes",
      noStr: "No",
      returnType: "bool",
    });

    expect(code).toContain("// Failed to predict input format");
    expect(code).toContain("while (t--)");
    // No solve() body is emitted when prediction failed.
    expect(code).not.toContain("bool solve(");
    expect(code).toContain("int main()");
  });

  it("Python fallback renders a skeleton with prediction disabled", () => {
    const code = new PythonGenerator().generateFallback({ returnType: "int" });

    expect(code).toContain("# Failed to predict input format");
    expect(code).not.toContain("def solve(");
    expect(code).toContain("def main():");
  });
});
