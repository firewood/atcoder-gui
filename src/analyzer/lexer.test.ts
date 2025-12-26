import { describe, it, expect } from 'vitest';
import { Lexer } from './lexer.js';

describe('Lexer', () => {
  it('should tokenize simple variables', () => {
    const lexer = new Lexer('n m');
    const tokens = lexer.tokenize();
    expect(tokens.map(t => t.type)).toEqual(['ident', 'ident', 'eof']);
    expect(tokens[0].value).toBe('n');
    expect(tokens[1].value).toBe('m');
  });

  it('should tokenize unicode subscripts', () => {
    // a₀ -> a _ 0
    const lexer = new Lexer('a₀');
    const tokens = lexer.tokenize();
    // Expected: ident(a), subscript, number(0), eof
    expect(tokens.map(t => t.type)).toEqual(['ident', 'subscript', 'number', 'eof']);
    expect(tokens[0].value).toBe('a');
    expect(tokens[1].value).toBe('_');
    expect(tokens[2].value).toBe(0);
  });

  it('should tokenize complex expression with unicode subscripts', () => {
    // aₙ₋₁ -> a _ n - 1
    const lexer = new Lexer('aₙ₋₁');
    const tokens = lexer.tokenize();
    // Normalized to: a_n-1
    // Expected: ident(a), subscript, ident(n), binop(-), number(1), eof
    expect(tokens.map(t => t.type)).toEqual(['ident', 'subscript', 'ident', 'binop', 'number', 'eof']);
    expect(tokens[0].value).toBe('a');
    expect(tokens[2].value).toBe('n');
    expect(tokens[3].value).toBe('-');
    expect(tokens[4].value).toBe(1);
  });

  it('should tokenize the example from documentation', () => {
    // n m
    // a₀ a₁ … aₙ₋₁
    const input = `n m
a₀ a₁ … aₙ₋₁`;
    const lexer = new Lexer(input);
    const tokens = lexer.tokenize();

    // n m \n
    // a _ 0   a _ 1   ...   a _ n - 1

    // Line 1: n m
    expect(tokens[0].type).toBe('ident');
    expect(tokens[0].value).toBe('n');
    expect(tokens[1].type).toBe('ident');
    expect(tokens[1].value).toBe('m');
    expect(tokens[2].type).toBe('newline');

    // Line 2: a₀ a₁ … aₙ₋₁
    let i = 3;
    // a₀
    expect(tokens[i].type).toBe('ident'); expect(tokens[i].value).toBe('a'); i++;
    expect(tokens[i].type).toBe('subscript'); i++;
    expect(tokens[i].type).toBe('number'); expect(tokens[i].value).toBe(0); i++;

    // a₁
    expect(tokens[i].type).toBe('ident'); expect(tokens[i].value).toBe('a'); i++;
    expect(tokens[i].type).toBe('subscript'); i++;
    expect(tokens[i].type).toBe('number'); expect(tokens[i].value).toBe(1); i++;

    // …
    expect(tokens[i].type).toBe('dots'); i++;

    // aₙ₋₁
    expect(tokens[i].type).toBe('ident'); expect(tokens[i].value).toBe('a'); i++;
    expect(tokens[i].type).toBe('subscript'); i++;
    expect(tokens[i].type).toBe('ident'); expect(tokens[i].value).toBe('n'); i++;
    expect(tokens[i].type).toBe('binop'); expect(tokens[i].value).toBe('-'); i++;
    expect(tokens[i].type).toBe('number'); expect(tokens[i].value).toBe(1); i++;

    expect(tokens[i].type).toBe('eof');
  });
});
