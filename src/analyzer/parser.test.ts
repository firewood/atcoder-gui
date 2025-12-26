import { describe, it, expect } from 'vitest';
import { Lexer } from './lexer.js';
import { Parser } from './parser.js';
import { VariableNode, NumberNode, LoopNode } from './types.js';

describe('Parser', () => {
  it('should parse simple variables', () => {
    const lexer = new Lexer('n m');
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    expect(ast.type).toBe('format');
    expect(ast.children).toHaveLength(2);

    const var1 = ast.children[0] as VariableNode;
    expect(var1.type).toBe('variable');
    expect(var1.name).toBe('n');

    const var2 = ast.children[1] as VariableNode;
    expect(var2.type).toBe('variable');
    expect(var2.name).toBe('m');
  });

  it('should parse variable with numeric subscript', () => {
    const lexer = new Lexer('a₀'); // a_0
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    expect(ast.children).toHaveLength(1);
    const v = ast.children[0] as VariableNode;
    expect(v.name).toBe('a');
    expect(v.indices).toHaveLength(1);
    expect((v.indices[0] as NumberNode).value).toBe(0);
  });

  it('should parse variable with variable subscript', () => {
    const lexer = new Lexer('aₙ'); // a_n
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    expect(ast.children).toHaveLength(1);
    const v = ast.children[0] as VariableNode;
    expect(v.name).toBe('a');
    expect(v.indices).toHaveLength(1);
    const idx = v.indices[0] as VariableNode;
    expect(idx.type).toBe('variable');
    expect(idx.name).toBe('n');
  });

  it('should parse loop structure a_0 ... a_{n-1}', () => {
    // a₀ … aₙ₋₁
    const input = 'a₀ … aₙ₋₁';
    const lexer = new Lexer(input);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    expect(ast.children).toHaveLength(1);

    const loop = ast.children[0] as LoopNode;
    expect(loop.type).toBe('loop');
    expect(loop.variable).toBe('i');

    // Start should be 0
    expect(loop.start.type).toBe('number');
    expect((loop.start as NumberNode).value).toBe(0);

    // End should be n (derived from n-1)
    expect(loop.end.type).toBe('variable');
    expect((loop.end as VariableNode).name).toBe('n');

    // Body should be a[i]
    expect(loop.body).toHaveLength(1);
    const bodyVar = loop.body[0] as VariableNode;
    expect(bodyVar.name).toBe('a');
    expect(bodyVar.indices).toHaveLength(1);
    expect((bodyVar.indices[0] as VariableNode).name).toBe('i');
  });
});
