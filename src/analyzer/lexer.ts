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
    // LaTeX style dots \ldots, \cdots, \dots. Also plain ... and …
    { type: 'dots', regex: /^(\\ldots|\\cdots|\\dots|\.\.\.|…)/ },
    { type: 'vdots', regex: /^(\\vdots|⋮)/ },
    { type: 'subscript', regex: /^(_)/ }, // Unicode subscripts are handled separately before matching
    { type: 'number', regex: /^[0-9]+/ },
    { type: 'ident', regex: /^[a-zA-Z][a-zA-Z0-9]*/ },
    { type: 'binop', regex: /^[-+*/]/ },
    { type: 'lparen', regex: /^[{([[]/ }, // Match (, {, or [  (fixed regex)
    { type: 'rparen', regex: /^[})\]]/ }, // Match ), }, or ]
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
    // Replace \mathrm{...} and \operatorname{...} with ...
    // Repeatedly replace to handle nested or multiple occurrences
    let currentInput = input;
    const mathRmRegex = /\\(?:mathrm|operatorname|text)\{([^{}]+)\}/g;
    while (mathRmRegex.test(currentInput)) {
      currentInput = currentInput.replace(mathRmRegex, '$1');
    }

    let result = '';
    let inSubscript = false;

    for (const char of currentInput) {
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
        // Instead of throwing, skip the character?
        // Or throw. The prompt implies normal inputs.
        throw new Error(`Unexpected character at line ${this.line}, column ${this.column}: ${rest[0]}`);
      }
    }

    tokens.push({ type: 'eof', line: this.line, column: this.column });
    return tokens;
  }
}
