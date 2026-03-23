import { parseHtml } from '../analyzer/html-parser.js';
import { describe, it, expect } from 'vitest';

describe('html-parser multipleCases and multipleLines', () => {
  it('should set multipleLines to false when multipleCases is true, even if output has multiple lines', () => {
    const html = `
      <section>
        <h3>Input Format</h3>
        <pre>T</pre>
        <pre>N
A_1 A_2 ... A_N</pre>
      </section>
      <section>
        <h3>Sample Input 1</h3>
        <pre>2
3
1 2 3
2
10 20</pre>
      </section>
      <section>
        <h3>Sample Output 1</h3>
        <pre>1 2 3
10 20</pre>
      </section>
    `;

    const result = parseHtml(html);
    expect(result.multipleCases).toBe(true);
    // Currently this is likely true because Sample Output 1 has 2 lines.
    // The user wants it to be false.
    expect(result.multipleLines).toBe(false);
  });
});
