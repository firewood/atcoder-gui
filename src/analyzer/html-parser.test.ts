import { describe, it, expect } from 'vitest';
import { parseHtml } from './html-parser';
import { Lexer } from './lexer';
import { Parser } from './parser';
import { VariableNode, NumberNode, LoopNode } from './types';
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
    expect(ast.children).toHaveLength(4);

    // First element: N
    const nNode = ast.children[0] as VariableNode;
    expect(nNode.type).toBe('variable');
    expect(nNode.name).toBe('N');

    // Second element: a_1
    const a1Node = ast.children[1] as VariableNode;
    expect(a1Node.type).toBe('variable');
    expect(a1Node.name).toBe('a');
    expect(a1Node.indices).toHaveLength(1);
    expect((a1Node.indices[0] as NumberNode).value).toBe(1);

    // Third element: a_2
    const a2Node = ast.children[2] as VariableNode;
    expect(a2Node.type).toBe('variable');
    expect(a2Node.name).toBe('a');
    expect(a2Node.indices).toHaveLength(1);
    expect((a2Node.indices[0] as NumberNode).value).toBe(2);

    // Fourth element: Loop a_3 ... a_N
    const loopNode = ast.children[3] as LoopNode;
    expect(loopNode.type).toBe('loop');
    expect(loopNode.variable).toBe('i');

    // Loop start: 3
    expect(loopNode.start.type).toBe('number');
    expect((loopNode.start as NumberNode).value).toBe(3);

    // Loop end: N
    expect(loopNode.end.type).toBe('variable');
    expect((loopNode.end as VariableNode).name).toBe('N');

    // Loop body: a[i]
    expect(loopNode.body).toHaveLength(1);
    const bodyVar = loopNode.body[0] as VariableNode;
    expect(bodyVar.name).toBe('a');
    expect(bodyVar.indices).toHaveLength(1);
    expect((bodyVar.indices[0] as VariableNode).name).toBe('i');
  });
});
