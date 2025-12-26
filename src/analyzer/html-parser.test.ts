import { describe, it, expect } from 'vitest';
import { parseHtml } from './html-parser';
import { Lexer } from './lexer';
import { Parser } from './parser';
import { VariableNode } from './types';
import fs from 'fs';
import path from 'path';

describe('htmlParser', () => {
  it('should parse problem-example.html', () => {
    const htmlPath = path.resolve(__dirname, '../../resources/problem-example.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');
    const result = parseHtml(html);

    expect(result.inputFormat).toContain('N');
    expect(result.inputFormat).toContain('a_1');
    // Check if newlines are preserved
    expect(result.inputFormat).toMatch(/N\s+a_1/);

    expect(result.samples).toHaveLength(2);
    expect(result.samples[0].input.trim()).toBe('3\n3 1 4');
    expect(result.samples[0].output.trim()).toBe('8');
    expect(result.samples[1].input.trim()).toBe('4\n1 2 3 4');
    expect(result.samples[1].output.trim()).toBe('10');
  });

  it('should parse input format into FormatNode', () => {
    const htmlPath = path.resolve(__dirname, '../../resources/problem-example.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');
    const result = parseHtml(html);

    const lexer = new Lexer(result.inputFormat);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const ast = parser.parse();

    expect(ast.type).toBe('format');
    expect(ast.children.length).toBeGreaterThan(0);

    // First element should be N
    const nNode = ast.children[0] as VariableNode;
    expect(nNode.type).toBe('variable');
    expect(nNode.name).toBe('N');
  });
});
