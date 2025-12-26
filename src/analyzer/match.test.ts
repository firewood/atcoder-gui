import { describe, it, expect } from 'vitest';
import { matchFormat } from './match';
import { FormatNode, ItemNode, LoopNode, NumberNode, BinOpNode } from './types';

describe('matchFormat', () => {
  it('should match simple scalar variables', () => {
    // Format: N M
    // Input: 3 4
    const format: FormatNode = {
      type: 'format',
      children: [
        { type: 'item', name: 'N', indices: [] } as ItemNode,
        { type: 'item', name: 'M', indices: [] } as ItemNode,
      ],
    };
    const input = '3 4';
    const result = matchFormat(format, input);
    expect(result).toEqual({ N: '3', M: '4' });
  });

  it('should match array in loop', () => {
    // Format: N, Loop(i, 0, N-1, [A_i])
    // Input: 3 10 20 30

    // N
    const itemN: ItemNode = { type: 'item', name: 'N', indices: [] };

    // A_i
    const itemA: ItemNode = {
        type: 'item',
        name: 'A',
        indices: [{ type: 'item', name: 'i', indices: [] } as ItemNode]
    };

    // Loop i from 0 to N-1
    // start: 0
    // end: N - 1
    const loop: LoopNode = {
        type: 'loop',
        variable: 'i',
        start: { type: 'number', value: 0 } as NumberNode,
        end: {
            type: 'binop',
            op: '-',
            left: { type: 'item', name: 'N', indices: [] } as ItemNode,
            right: { type: 'number', value: 1 } as NumberNode
        } as BinOpNode,
        body: [itemA]
    };

    const format: FormatNode = {
      type: 'format',
      children: [itemN, loop]
    };

    const input = '3 10 20 30';
    const result = matchFormat(format, input);

    expect(result['N']).toBe('3');
    // A should be map-like: { "0": "10", "1": "20", "2": "30" }
    expect(result['A']).toEqual({ "0": "10", "1": "20", "2": "30" });
  });

  it('should handle newline and extra spaces', () => {
      const format: FormatNode = {
          type: 'format',
          children: [
              { type: 'item', name: 'A', indices: [] } as ItemNode,
              { type: 'item', name: 'B', indices: [] } as ItemNode,
          ]
      };
      const input = `
        10
          20
      `;
      const result = matchFormat(format, input);
      expect(result).toEqual({ A: '10', B: '20' });
  });

  it('should handle 2D array', () => {
      // H W, Loop(i, 0, H-1, Loop(j, 0, W-1, C_ij))
      // Input: 2 3 1 2 3 4 5 6

      const itemH: ItemNode = { type: 'item', name: 'H', indices: [] };
      const itemW: ItemNode = { type: 'item', name: 'W', indices: [] };

      const itemC: ItemNode = {
          type: 'item',
          name: 'C',
          indices: [
              { type: 'item', name: 'i', indices: [] } as ItemNode,
              { type: 'item', name: 'j', indices: [] } as ItemNode
          ]
      };

      const innerLoop: LoopNode = {
          type: 'loop',
          variable: 'j',
          start: { type: 'number', value: 0 } as NumberNode,
          end: {
              type: 'binop',
              op: '-',
              left: { type: 'item', name: 'W', indices: [] } as ItemNode,
              right: { type: 'number', value: 1 } as NumberNode
          } as BinOpNode,
          body: [itemC]
      };

      const outerLoop: LoopNode = {
          type: 'loop',
          variable: 'i',
          start: { type: 'number', value: 0 } as NumberNode,
          end: {
              type: 'binop',
              op: '-',
              left: { type: 'item', name: 'H', indices: [] } as ItemNode,
              right: { type: 'number', value: 1 } as NumberNode
          } as BinOpNode,
          body: [innerLoop]
      };

      const format: FormatNode = {
          type: 'format',
          children: [itemH, itemW, outerLoop]
      };

      const input = '2 3 1 2 3 4 5 6';
      const result = matchFormat(format, input);

      expect(result['H']).toBe('2');
      expect(result['W']).toBe('3');
      expect(result['C']).toEqual({
          "0,0": "1", "0,1": "2", "0,2": "3",
          "1,0": "4", "1,1": "5", "1,2": "6"
      });
  });
});
