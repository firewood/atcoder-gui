import { describe, it, expect } from 'vitest';
import { inferTypesFromInstances } from './typing';
import { FormatNode, ItemNode, LoopNode, NumberNode, BinOpNode, VarType } from './types';

describe('inferTypesFromInstances', () => {
  it('should infer scalar types', () => {
    // Format: N M S
    // Input: 10 3.14 hello
    const format: FormatNode = {
      type: 'format',
      children: [
        { type: 'item', name: 'N', indices: [] } as ItemNode,
        { type: 'item', name: 'M', indices: [] } as ItemNode,
        { type: 'item', name: 'S', indices: [] } as ItemNode,
      ],
    };
    const instances = ['10 3.14 hello'];
    const types = inferTypesFromInstances(format, instances);

    expect(types['N']).toBe(VarType.ValueInt);
    expect(types['M']).toBe(VarType.Float);
    expect(types['S']).toBe(VarType.String);
  });

  it('should infer char type', () => {
      const format: FormatNode = {
          type: 'format',
          children: [{ type: 'item', name: 'C', indices: [] } as ItemNode]
      };
      const instances = ['X'];
      const types = inferTypesFromInstances(format, instances);
      expect(types['C']).toBe(VarType.Char);
  });

  it('should unify types correctly', () => {
      const format: FormatNode = {
          type: 'format',
          children: [{ type: 'item', name: 'A', indices: [] } as ItemNode]
      };

      // int + float -> float
      expect(inferTypesFromInstances(format, ['10', '3.14'])['A']).toBe(VarType.Float);

      // int + string -> string
      expect(inferTypesFromInstances(format, ['10', 'hello'])['A']).toBe(VarType.String);

      // char + string -> string
      expect(inferTypesFromInstances(format, ['a', 'abc'])['A']).toBe(VarType.String);
  });

  it('should handle array types', () => {
      // Format: N, Loop(i, 0, N-1, [A_i])
      const itemN: ItemNode = { type: 'item', name: 'N', indices: [] };
      const itemA: ItemNode = {
          type: 'item',
          name: 'A',
          indices: [{ type: 'item', name: 'i', indices: [] } as ItemNode]
      };
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

      const input = '3 1 2 3.5'; // Mixed int and float in array
      const types = inferTypesFromInstances(format, [input]);

      expect(types['N']).toBe(VarType.ValueInt);
      expect(types['A']).toBe(VarType.Float); // 1, 2, 3.5 -> Float
  });
});
