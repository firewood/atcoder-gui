import * as cheerio from 'cheerio';

export interface Sample {
  input: string;
  output: string;
}

export interface ParseResult {
  inputFormat: string;
  samples: Sample[];
  multipleCases: boolean;
  queryType: boolean;
}

export function parseHtml(html: string): ParseResult {
  const $ = cheerio.load(html);
  let inputFormat = '';
  const samples: Sample[] = [];
  const tempSamples: Record<string, { input?: string; output?: string }> = {};
  let multipleCases = false;
  let queryType = false;

  $('h3').each((_, element) => {
    const text = $(element).text().trim();
    const section = $(element).closest('section');

    if (text.match(/^Input(\s*Format)?$/i)) {
      const pres = section.find('pre');
      if (pres.length >= 3) {
        // Query type problem
        // Use only the first block for format
        inputFormat = pres.eq(0).text();
        queryType = true;
        multipleCases = false;
      } else if (pres.length >= 2) {
        const firstPreText = pres.eq(0).text().trim();
        // Check if starts with T or Q.
        // The content might be <var>T</var>... so text is T...
        if (firstPreText.startsWith('T') || firstPreText.startsWith('Q')) {
          multipleCases = true;
          inputFormat = pres.eq(1).text();
        } else {
          inputFormat = pres.eq(0).text();
        }
      } else if (pres.length > 0) {
        inputFormat = pres.eq(0).text();
      }
    } else {
      const inputMatch = text.match(/^Sample Input\s*(\d+)?$/i);
      if (inputMatch) {
        const id = inputMatch[1] || '1';
        if (!tempSamples[id]) tempSamples[id] = {};

        let content = '';
        const pre = section.find('pre');
        if (pre.length > 0) {
          content = pre.text();
        }
        tempSamples[id].input = content;
      }

      const outputMatch = text.match(/^Sample Output\s*(\d+)?$/i);
      if (outputMatch) {
        const id = outputMatch[1] || '1';
        if (!tempSamples[id]) tempSamples[id] = {};

        let content = '';
        const pre = section.find('pre');
        if (pre.length > 0) {
          content = pre.text();
        }
        tempSamples[id].output = content;
      }
    }
  });

  // Convert tempSamples to array
  const ids = Object.keys(tempSamples).sort((a, b) => Number(a) - Number(b));
  for (const id of ids) {
    const s = tempSamples[id];
    if (s.input !== undefined && s.output !== undefined) {
      let finalInput = s.input;
      if (multipleCases) {
        // Strip the first line
        const lines = finalInput.split('\n');
        // If the first line is empty (e.g. leading newline), keep stripping?
        // Usually pre content starts immediately.
        // The example shows:
        // <pre>1
        // 3...
        // </pre>
        // So text is "1\n3...".
        // remove first line.
        if (lines.length > 0) {
          lines.shift();
          finalInput = lines.join('\n');
        }
      }

      samples.push({
        input: finalInput,
        output: s.output
      });
    }
  }

  return {
    inputFormat: inputFormat.trim(),
    samples,
    multipleCases,
    queryType
  };
}
