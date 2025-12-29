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
    const code = generator.generate(format, variables);

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
      const code = generator.generate(format, variables);

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

  it('should generate interleaved declarations for multiple arrays', () => {
    // Input:
    // N
    // A_1 ... A_N
    // M
    // B_1 ... B_M

    const N_Node: any = { type: 'item', name: 'N', indices: [] };
    const M_Node: any = { type: 'item', name: 'M', indices: [] };
    const i_Node: any = { type: 'ident', value: 'i' };
    const j_Node: any = { type: 'ident', value: 'j' };
    const N_Ref: any = { type: 'ident', value: 'N' };
    const M_Ref: any = { type: 'ident', value: 'M' };

    const format: FormatNode = {
        type: 'format',
        children: [
            N_Node,
            {
                type: 'loop',
                variable: 'i',
                start: { type: 'number', value: 0 },
                end: { type: 'ident', value: 'N' },
                body: [
                    {
                        type: 'item',
                        name: 'A',
                        indices: [i_Node]
                    }
                ]
            } as any,
            M_Node,
            {
                type: 'loop',
                variable: 'j',
                start: { type: 'number', value: 0 },
                end: { type: 'ident', value: 'M' },
                body: [
                    {
                        type: 'item',
                        name: 'B',
                        indices: [j_Node]
                    }
                ]
            } as any
        ]
    };

    const variables = [
        { name: 'N', type: VarType.ValueInt, dims: 0, indices: [] },
        { name: 'A', type: VarType.ValueInt, dims: 1, indices: [N_Ref] },
        { name: 'M', type: VarType.ValueInt, dims: 0, indices: [] },
        { name: 'B', type: VarType.ValueInt, dims: 1, indices: [M_Ref] }
    ];

    const generator = new CPlusPlusGenerator();
    const code = generator.generate(format, variables);

    // Verify order:
    // N declared
    // input N
    // A declared (using N)
    // loop A
    // M declared
    // input M
    // B declared (using M)
    // loop B

    const lines = code.split('\n');
    const nDeclIndex = lines.findIndex(l => l.includes('long long N;'));
    const nInputIndex = lines.findIndex(l => l.includes('std::cin >> N;'));
    const aDeclIndex = lines.findIndex(l => l.includes('std::vector<long long> A(N);'));
    const aLoopIndex = lines.findIndex(l => l.includes('for(int i = 0 ; i < N ; i++){'));
    const mDeclIndex = lines.findIndex(l => l.includes('long long M;'));
    const mInputIndex = lines.findIndex(l => l.includes('std::cin >> M;'));
    const bDeclIndex = lines.findIndex(l => l.includes('std::vector<long long> B(M);'));
    const bLoopIndex = lines.findIndex(l => l.includes('for(int j = 0 ; j < M ; j++){'));

    expect(nDeclIndex).toBeLessThan(nInputIndex);
    expect(nInputIndex).toBeLessThan(aDeclIndex); // N input before A declared (since A uses N)
    expect(aDeclIndex).toBeLessThan(aLoopIndex);

    // Check that M and B appear after A's loop (rough check of interleaving, though strict order between A loop and M depends on generator)
    // Actually, format is N, Loop A, M, Loop B.
    // So M decl should be after Loop A? Or at least after N decl.
    // With new logic, M is declared when M_Node is processed.
    // M_Node is after Loop A in format.
    // So M decl should be after Loop A.

    expect(aLoopIndex).toBeLessThan(mDeclIndex);
    expect(mDeclIndex).toBeLessThan(mInputIndex);
    expect(mInputIndex).toBeLessThan(bDeclIndex);
    expect(bDeclIndex).toBeLessThan(bLoopIndex);
  });
});
