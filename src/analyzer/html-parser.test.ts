import { describe, it, expect } from 'vitest';
import { parseHtml } from './html-parser';
import { Lexer } from './lexer';
import { Parser } from './parser';
import { Analyzer } from './analyzer';
import { ItemNode, LoopNode } from './types';
import fs from 'fs';
import path from 'path';

describe('htmlParser', () => {
  it('should parse problem-example.html', () => {
    const htmlPath = path.resolve(__dirname, '../../test-resources/single-case-example.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');
    const result = parseHtml(html);

    expect(result.inputFormats[0]).toContain('N');
    expect(result.inputFormats[0]).toContain('a_1');
    // Check if newlines are preserved
    expect(result.inputFormats[0]).toMatch(/N\s+a_1/);

    expect(result.samples).toHaveLength(2);
    expect(result.samples[0].input.trim()).toBe('3\n3 1 4');
    expect(result.samples[0].output.trim()).toBe('8');
    expect(result.samples[1].input.trim()).toBe('4\n1 2 3 4');
    expect(result.samples[1].output.trim()).toBe('10');
  });

  it('should parse input format into FormatNode using Analyzer', () => {
    const htmlPath = path.resolve(__dirname, '../../test-resources/single-case-example.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');
    const result = parseHtml(html);

    const lexer = new Lexer(result.inputFormats[0]);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    const rawAst = parser.parse();

    // Apply Analyzer to get the Format Tree
    const analyzer = new Analyzer();
    const ast = analyzer.analyze(rawAst);

    expect(ast.type).toBe('format');

    const children = ast.children;
    expect(children.length).toBeGreaterThanOrEqual(2);

    const nNode = children.find(c => c.type === 'item' && (c as ItemNode).name === 'N');
    expect(nNode).toBeDefined();

    const loopNode = children.find(c => c.type === 'loop') as LoopNode;
    expect(loopNode).toBeDefined();
    expect(loopNode.type).toBe('loop');
    expect(loopNode.end.type).toBe('item');
    expect((loopNode.end as ItemNode).name).toBe('N');

    // Check loop body
    expect(loopNode.body).toHaveLength(1);
    expect((loopNode.body[0] as ItemNode).name).toBe('a');
  });
});
