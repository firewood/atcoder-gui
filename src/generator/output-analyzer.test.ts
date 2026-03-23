import { describe, it, expect } from 'vitest';
import { OutputAnalyzer } from './output-analyzer';

describe('OutputAnalyzer', () => {
  const analyzer = new OutputAnalyzer();

  it('detects Modulo 998244353', () => {
    const html = '<div>The answer should be modulo 998244353.</div>';
    expect(analyzer.analyze(html, ['123'])).toBe('atcoder::modint998244353');
  });

  it('detects Modulo 1000000007', () => {
    const html = '<div>The answer should be modulo 1000000007.</div>';
    expect(analyzer.analyze(html, ['123'])).toBe('atcoder::modint1000000007');
  });

  it('detects Dynamic Modulo', () => {
    const html = '<div>The answer should be modulo.</div>';
    expect(analyzer.analyze(html, ['123'])).toBe('atcoder::modint');
  });

  it('detects Yes/No string', () => {
    const html = '<div>Yes/No problem.</div>';
    expect(analyzer.analyze(html, ['Yes'], 'Yes')).toBe('string');
  });

  it('detects Vector output', () => {
    const html = '<div>Sequence output.</div>';
    expect(analyzer.analyze(html, ['1 2 3'])).toBe('std::vector<long long>');
  });

  it('defaults to long long', () => {
    const html = '<div>Simple integer.</div>';
    expect(analyzer.analyze(html, ['123'])).toBe('long long');
  });
});
