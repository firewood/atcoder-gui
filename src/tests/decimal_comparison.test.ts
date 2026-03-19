import { describe, it, expect } from 'vitest';
import { TestManager } from '../test.js';

describe('TestManager.compareOutputs', () => {
  const testManager = new TestManager(null as any, null as any);

  it('should pass exact matches', () => {
    const metadata = { judge: { judge_type: 'normal' } };
    expect((testManager as any).compareOutputs('1 2 3\n', '1 2 3\n', metadata)).toBe(true);
    expect((testManager as any).compareOutputs('  1  2  3  ', '1 2 3', metadata)).toBe(true);
  });

  it('should fail on mismatch for normal judge', () => {
    const metadata = { judge: { judge_type: 'normal' } };
    expect((testManager as any).compareOutputs('1.0', '1', metadata)).toBe(false);
  });

  it('should handle decimal judge within absolute tolerance', () => {
    const metadata = { judge: { judge_type: 'decimal', error: 1e-6 } };
    expect((testManager as any).compareOutputs('3.141592', '3.1415925', metadata)).toBe(true);
    expect((testManager as any).compareOutputs('3.141592', '3.141594', metadata)).toBe(true); // Passes relative tolerance
    expect((testManager as any).compareOutputs('3.14', '3.15', metadata)).toBe(false);
  });

  it('should handle decimal judge within relative tolerance', () => {
    const metadata = { judge: { judge_type: 'decimal', error: 1e-6 } };
    expect((testManager as any).compareOutputs('1000000', '1000000.5', metadata)).toBe(true);
    expect((testManager as any).compareOutputs('1000000', '1000001.5', metadata)).toBe(false);
  });

  it('should fail on token count mismatch', () => {
    const metadata = { judge: { judge_type: 'decimal' } };
    expect((testManager as any).compareOutputs('1 2', '1 2 3', metadata)).toBe(false);
  });

  it('should handle non-numeric tokens even in decimal mode', () => {
    const metadata = { judge: { judge_type: 'decimal' } };
    expect((testManager as any).compareOutputs('Yes 3.141592', 'Yes 3.1415921', metadata)).toBe(true);
    expect((testManager as any).compareOutputs('Yes', 'No', metadata)).toBe(false);
  });
});
