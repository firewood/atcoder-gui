import { describe, it, expect } from "vitest";
import { Lexer } from "./lexer";

describe("Lexer", () => {
  it("should tokenize simple variables", () => {
    const lexer = new Lexer("N M");
    const tokens = lexer.tokenize();
    // Expect NO spaces because they are skippable
    expect(tokens.map((t) => t.type)).toEqual(["ident", "ident", "eof"]);
    expect(tokens[0].value).toBe("N");
    expect(tokens[1].value).toBe("M");
  });

  it("should tokenize subscripts", () => {
    const lexer = new Lexer("A_1");
    const tokens = lexer.tokenize();
    // A, _, 1
    expect(tokens.map((t) => t.type)).toEqual([
      "ident",
      "subscript",
      "number",
      "eof",
    ]);
  });

  it("should tokenize unicode subscripts", () => {
    const lexer = new Lexer("A₁");
    const tokens = lexer.tokenize();
    // A, _, 1 (normalized)
    expect(tokens.map((t) => t.type)).toEqual([
      "ident",
      "subscript",
      "number",
      "eof",
    ]);
  });

  it("should tokenize dots", () => {
    const lexer = new Lexer("...");
    const tokens = lexer.tokenize();
    expect(tokens[0].type).toBe("dots");
  });

  it("should tokenize parens/braces", () => {
    const lexer = new Lexer("{ ( ) }");
    const tokens = lexer.tokenize().filter((t) => t.type !== "space");
    expect(tokens.map((t) => t.type)).toEqual([
      "lparen",
      "lparen",
      "rparen",
      "rparen",
      "eof",
    ]);
  });

  it("should handle hspace during normalization", () => {
    const lexer = new Lexer("N\\hspace{0.4cm} M");
    const tokens = lexer.tokenize();
    expect(tokens.map((t) => t.type)).toEqual(["ident", "ident", "eof"]);
    expect(tokens[0].value).toBe("N");
    expect(tokens[1].value).toBe("M");
  });
});
