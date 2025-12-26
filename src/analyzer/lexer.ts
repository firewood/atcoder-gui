import { Token, TokenType } from './types.js';

interface Rule {
  type: TokenType;
  regex: RegExp;
  skippable?: boolean;
}

export class Lexer {
  private input: string;
  private pos: number;
  private line: number;
  private column: number;

  private rules: Rule[] = [
    { type: 'newline', regex: /^(\r\n|\r|\n)/ },
    { type: 'space', regex: /^[ \t\u00a0]+/, skippable: true },
    { type: 'dots', regex: /^(\.\.\.|…)/ },
    { type: 'vdots', regex: /^(⋮)/ },
    { type: 'subscript', regex: /^(_)/ }, // Unicode subscripts are handled separately before matching
    { type: 'number', regex: /^[0-9]+/ },
    { type: 'ident', regex: /^[a-zA-Z][a-zA-Z0-9]*/ },
    { type: 'binop', regex: /^[-+*/]/ },
    { type: 'lparen', regex: /^\(/ },
    { type: 'rparen', regex: /^\)/ },
    { type: 'comma', regex: /^,/ },
  ];

  // Unicode subscript mapping
  private subscriptMap: Record<string, string> = {
    '₀': '0', '₁': '1', '₂': '2', '₃': '3', '₄': '4',
    '₅': '5', '₆': '6', '₇': '7', '₈': '8', '₉': '9',
    'ₐ': 'a', 'ₑ': 'e', 'ₕ': 'h', 'ᵢ': 'i', 'ⱼ': 'j', 'ₖ': 'k',
    'ₗ': 'l', 'ₘ': 'm', 'ₙ': 'n', 'ₒ': 'o', 'ₚ': 'p', 'ᵣ': 'r',
    'ₛ': 's', 'ₜ': 't', 'ᵤ': 'u', 'ᵥ': 'v', 'ₓ': 'x'
    // Add more if needed
  };

  // Unicode subscript minus
  private subscriptMinusMap: Record<string, string> = {
    '₋': '-'
  }

  constructor(input: string) {
    this.input = this.normalizeInput(input);
    this.pos = 0;
    this.line = 1;
    this.column = 1;
  }

  private normalizeInput(input: string): string {
    // Replace unicode subscripts with _{char} or similar
    // However, the tokens in the example are: "ident(a)", "subscript()", "number(0)"
    // So 'a₀' should become "a", "_", "0"
    // We can just replace subscript chars with '_'+char, but we need to handle multi-char subscripts carefully?
    // Actually, simple replacement is enough because the lexer will see '_' then '0'.

    // First, handle subscript minus '₋' -> '_-' ? No, usually it's inside subscript like n-1
    // If input is 'aₙ₋₁', we want tokens: ident(a), sub, ident(n), binop(-), number(1)
    // If we replace 'ₙ' with '_n', '₋' with '_-', '₁' with '_1', we get:
    // a _n _- _1 -> a, sub, n, sub, -, sub, 1. This is wrong. Too many subscripts.

    // We need to insert a subscript token only at the start of a subscript sequence.
    // But how to detect the start?
    // Maybe we shouldn't replace with '_' but just handle them as special characters that imply a subscript state?
    // But the lexer is stateless in the simple regex approach.

    // Let's look at the example: aₙ₋₁
    // We want: a, subscript, n, -, 1
    // If we replace unicode subscripts with their normal equivalents, we lose the information that they are subscripts.
    // Unless we assume that subscripts are always attached to the previous identifier?
    // But 'n-1' in subscript is 'ₙ₋₁'.

    // Alternative strategy: Pre-process to insert '_' before the first unicode subscript in a sequence,
    // and convert all unicode subscripts to normal chars.

    let result = '';
    let inSubscript = false;

    for (const char of input) {
      if (this.subscriptMap[char] || this.subscriptMinusMap[char]) {
        if (!inSubscript) {
          result += '_';
          inSubscript = true;
        }
        result += this.subscriptMap[char] || this.subscriptMinusMap[char];
      } else {
        inSubscript = false;
        result += char;
      }
    }

    return result;
  }

  public tokenize(): Token[] {
    const tokens: Token[] = [];
    while (this.pos < this.input.length) {
      const rest = this.input.slice(this.pos);
      let matched = false;

      for (const rule of this.rules) {
        const match = rule.regex.exec(rest);
        if (match) {
          const value = match[0];

          if (!rule.skippable) {
            tokens.push({
              type: rule.type,
              value: rule.type === 'number' ? parseInt(value, 10) : value,
              line: this.line,
              column: this.column,
            });
          }

          // Update position
          this.pos += value.length;

          // Update line/column
          const newlines = value.split('\n').length - 1;
          if (newlines > 0) {
            this.line += newlines;
            const lastLineLen = value.split('\n').pop()!.length;
            this.column = 1 + lastLineLen;
          } else {
            this.column += value.length;
          }

          matched = true;
          break;
        }
      }

      if (!matched) {
        throw new Error(`Unexpected character at line ${this.line}, column ${this.column}: ${rest[0]}`);
      }
    }

    tokens.push({ type: 'eof', line: this.line, column: this.column });
    return tokens;
  }
}
