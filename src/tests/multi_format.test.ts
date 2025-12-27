import { describe, it, expect } from 'vitest';
import { parseHtml } from '../analyzer/html-parser.js';

describe('HTML Parser Multi-Format Support', () => {
  it('should detect multiple input formats when >= 3 pre tags exist', () => {
    const html = `
      <section>
        <h3>Input</h3>
        <p>Input is given from Standard Input in the following format:</p>
        <pre>N Q</pre>
        <p>First query format:</p>
        <pre>1 x y</pre>
        <p>Second query format:</p>
        <pre>2 z</pre>
      </section>
    `;

    const result = parseHtml(html);

    expect(result.inputFormats).toBeDefined();
    expect(result.inputFormats).toHaveLength(3);
    // @ts-expect-error result.inputFormats is possibly undefined (checked above)
    expect(result.inputFormats[0]).toBe('N Q');
    // @ts-expect-error result.inputFormats is possibly undefined
    expect(result.inputFormats[1]).toBe('1 x y');
    // @ts-expect-error result.inputFormats is possibly undefined
    expect(result.inputFormats[2]).toBe('2 z');
  });

  it('should fallback to standard behavior for 1 pre tag', () => {
     const html = `
      <section>
        <h3>Input</h3>
        <pre>N Q
A_1 ... A_N</pre>
      </section>
    `;
    const result = parseHtml(html);
    expect(result.inputFormat).toContain('N Q');
    expect(result.inputFormats).toBeUndefined();
  });
});
