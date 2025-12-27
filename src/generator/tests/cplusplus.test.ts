import { describe, it, expect } from 'vitest';
import { CPlusPlusGenerator } from '../cplusplus';
import { FormatNode, VarType, ASTNode } from '../../analyzer/types';

describe('CPlusPlusGenerator', () => {
  it('should generate C++ code for simple input', () => {
    // Mock Data
    // Input: N (int)
    const format: FormatNode = {
      type: 'format',
      children: [
        {
          type: 'item',
          name: 'N',
          indices: [],
        } as any,
      ],
    };

    const variables = [
      {
        name: 'N',
        type: VarType.ValueInt,
        dims: 0,
        indices: [],
      },
    ];

    const generator = new CPlusPlusGenerator();
    // Updated call signature
    const code = generator.generate([{ variables, formatTree: format }]);

    expect(code).toContain('long long N;');
    expect(code).toContain('std::cin >> N;');
    expect(code).toContain('void solve(long long N)');
  });

  it('should generate C++ code for array input', () => {
      // Input:
      // N
      // A_1 ... A_N

      // Representation:
      // Item(N)
      // Loop(i, 0, N, Item(A, [i]))

      const N_Node: any = { type: 'item', name: 'N', indices: [] };
      const i_Node: any = { type: 'ident', value: 'i' }; // or whatever variable representation
      const N_Ref: any = { type: 'ident', value: 'N' };

      const format: FormatNode = {
          type: 'format',
          children: [
              N_Node,
              {
                  type: 'loop',
                  variable: 'i',
                  start: { type: 'number', value: 0 },
                  end: { type: 'ident', value: 'N' }, // length N
                  body: [
                      {
                          type: 'item',
                          name: 'A',
                          indices: [i_Node]
                      }
                  ]
              } as any
          ]
      };

      const variables = [
          { name: 'N', type: VarType.ValueInt, dims: 0, indices: [] },
          { name: 'A', type: VarType.ValueInt, dims: 1, indices: [N_Ref] }
      ];

      const generator = new CPlusPlusGenerator();
      // Updated call signature
      const code = generator.generate([{ variables, formatTree: format }]);

      // Check declarations
      expect(code).toContain('long long N;');
      expect(code).toContain('std::vector<long long> A(N);');

      // Check input loop
      expect(code).toContain('std::cin >> N;');
      expect(code).toContain('for(int i = 0 ; i < N ; i++){');
      expect(code).toContain('std::cin >> A[i];');

      // Check arguments
      expect(code).toContain('void solve(long long N, std::vector<long long> A)');
      expect(code).toContain('solve(N, std::move(A));');
  });
});
