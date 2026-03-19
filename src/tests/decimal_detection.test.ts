import { describe, it, expect } from 'vitest';
import { GenManager } from '../gen.js';

describe('GenManager.isDecimalProblem', () => {
  const genManager = new GenManager(null as any, null as any);

  it('should detect decimal points', () => {
    expect((genManager as any).isDecimalProblem([{ output: '1.0\n' }])).toBe(true);
    expect((genManager as any).isDecimalProblem([{ output: '3.14159' }])).toBe(true);
  });

  it('should detect scientific notation', () => {
    expect((genManager as any).isDecimalProblem([{ output: '1e-9\n' }])).toBe(true);
    expect((genManager as any).isDecimalProblem([{ output: '1.2E10' }])).toBe(true);
  });

  it('should not detect integers', () => {
    expect((genManager as any).isDecimalProblem([{ output: '123\n' }])).toBe(false);
    expect((genManager as any).isDecimalProblem([{ output: '0\n' }])).toBe(false);
  });

  it('should handle multiple tokens', () => {
    expect((genManager as any).isDecimalProblem([{ output: '1 2 3.0 4' }])).toBe(true);
    expect((genManager as any).isDecimalProblem([{ output: '1\n2\n3' }])).toBe(false);
  });
});
