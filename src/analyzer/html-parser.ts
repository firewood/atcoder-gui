import * as cheerio from 'cheerio';

export interface Sample {
  input: string;
  output: string;
}

export interface ParseResult {
  inputFormat: string;
  samples: Sample[];
}

export function parseHtml(html: string): ParseResult {
  const $ = cheerio.load(html);
  let inputFormat = '';
  const samples: Sample[] = [];
  const tempSamples: Record<string, { input?: string; output?: string }> = {};

  $('h3').each((_, element) => {
    const text = $(element).text().trim();
    const section = $(element).closest('section');

    // Find content in the same section
    let content = '';
    // Usually the pre is inside the section
    const pre = section.find('pre');
    if (pre.length > 0) {
        content = pre.text();
    } else {
        // Fallback: look for next sibling pre if section structure is different
        // But in AtCoder, it is usually inside section.
        // If multiple pres? usually only one relevant one.
        // The Input Format section might have multiple pres? Unlikely.
    }

    if (text.match(/^Input(\s*Format)?$/i)) {
      inputFormat = content;
    } else {
      const inputMatch = text.match(/^Sample Input\s*(\d+)?$/i);
      if (inputMatch) {
        const id = inputMatch[1] || '1';
        if (!tempSamples[id]) tempSamples[id] = {};
        tempSamples[id].input = content;
      }

      const outputMatch = text.match(/^Sample Output\s*(\d+)?$/i);
      if (outputMatch) {
        const id = outputMatch[1] || '1';
        if (!tempSamples[id]) tempSamples[id] = {};
        tempSamples[id].output = content;
      }
    }
  });

  // Convert tempSamples to array
  // Sort by ID
  const ids = Object.keys(tempSamples).sort((a, b) => Number(a) - Number(b));
  for (const id of ids) {
    const s = tempSamples[id];
    if (s.input !== undefined && s.output !== undefined) {
      samples.push({
        input: s.input,
        output: s.output,
      });
    }
  }

  return {
    inputFormat: inputFormat.trim(),
    samples,
  };
}
