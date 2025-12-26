import { describe, it, expect } from 'vitest';
import { Lexer } from './lexer';
import { Parser } from './parser';
import { Analyzer } from './analyzer';
import { FormatNode } from './types';

function parse(input: string): FormatNode {
    const lexer = new Lexer(input);
    const tokens = lexer.tokenize();
    const parser = new Parser(tokens);
    return parser.parse();
}

describe('Analyzer', () => {
    it('should normalize simple loop A_1 ... A_N', () => {
        const input = 'A_1 ... A_N';
        const rawAST = parse(input);

        const analyzer = new Analyzer();
        const result = analyzer.analyze(rawAST);

        expect(result.children.length).toBe(1);
        const loop = result.children[0];
        expect(loop.type).toBe('loop');
        if (loop.type === 'loop') {
            expect(loop.variable).toBe('i');
            expect(loop.start.type).toBe('number');
            expect((loop.start as any).value).toBe(1);
            expect(loop.end.type).toBe('item');
            expect((loop.end as any).name).toBe('N');
            expect(loop.body.length).toBe(1);
            expect((loop.body[0] as any).name).toBe('A');
        }
    });

    it('should normalize multi-variable loop A_1 B_1 ... A_N B_N', () => {
        const input = 'A_1 B_1 ... A_N B_N';
        const rawAST = parse(input);

        const analyzer = new Analyzer();
        const result = analyzer.analyze(rawAST);

        expect(result.children.length).toBe(1);
        const loop = result.children[0];
        expect(loop.type).toBe('loop');
        if (loop.type === 'loop') {
            expect(loop.body.length).toBe(2);
            expect((loop.body[0] as any).name).toBe('A');
            expect((loop.body[1] as any).name).toBe('B');
        }
    });

    it('should use distinct loop variable if i is used', () => {
        // Input: A_i ... A_N (where i is a variable)
        // If i is used in bounds or indices, loop var should be j.
        // But A_i implies start index is 'i'.
        const input = 'A_i ... A_N';
        const rawAST = parse(input);
        const analyzer = new Analyzer();
        const result = analyzer.analyze(rawAST);

        const loop = result.children[0];
        if (loop.type === 'loop') {
            expect(loop.variable).toBe('j');
            expect((loop.start as any).name).toBe('i');
            expect((loop.end as any).name).toBe('N');
        }
    });

    it('should handle loops with comma separators if parser skips them', () => {
        const input = 'a_1, a_2, ..., a_n';
        // Expected: a_1, Loop(2..n) or merged.
        // My implementation collapses around dots.
        // a_1, a_2, ..., a_n -> a_1, Loop(2..n).
        // With loop extension, this might become Loop(1..n) if logic allows.
        // a_1, a_2 ... a_n -> Detected Loop(2..n).
        // Then we check a_1 against a_i (i=1). It matches.
        // So Loop(1..n).

        const rawAST = parse(input);
        const analyzer = new Analyzer();
        const result = analyzer.analyze(rawAST);

        const loop = result.children.find(c => c.type === 'loop');
        expect(loop).toBeDefined();
        if (loop && loop.type === 'loop') {
            // Due to loop extension, start should now be 1
            expect((loop.start as any).value).toBe(1);
            expect((loop.end as any).name).toBe('n');
        }
    });
});
