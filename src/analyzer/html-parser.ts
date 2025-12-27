import * as cheerio from 'cheerio';

export interface Sample {
  input: string;
  output: string;
}

export interface ParseResult {
  inputFormat: string;
  inputFormats?: string[];
  samples: Sample[];
  multipleCases: boolean;
}

export function parseHtml(html: string): ParseResult {
  const $ = cheerio.load(html);
  let inputFormat = '';
  let inputFormats: string[] | undefined;
  const samples: Sample[] = [];
  const tempSamples: Record<string, { input?: string; output?: string }> = {};
  let multipleCases = false;

  $('h3').each((_, element) => {
    const text = $(element).text().trim();
    const section = $(element).closest('section');

    if (text.match(/^Input(\s*Format)?$/i)) {
      const pres = section.find('pre');
      const count = pres.length;

      // Check for T or Q in the first pre tag regardless of count,
      // but only trigger multipleCases if we have at least 2 blocks
      // (Block 1: T, Block 2: Format) OR if it's explicitly T.
      // NOTE: For abc400_b (N Q ...), pres[0] is "N Q". It doesn't start with T.
      // So multipleCases remains false.
      if (count > 0) {
          const firstPreText = pres.eq(0).text().trim();
          // Heuristic: T or Q alone, or T followed by newline/space
          // If it is just "N Q", it is NOT multipleCases (template shouldn't loop).
          if (firstPreText === 'T' || firstPreText.match(/^T\s/) || firstPreText === 'Q' || firstPreText.match(/^Q\s/)) {
               // Only valid if we have >1 blocks (T + Body)
               // OR if T is the only block (rare for format section, usually T is separated).
               if (count >= 2) {
                   multipleCases = true;
               }
          }
      }

      if (count >= 3) {
        // If multipleCases is detected (Block 0 is T), we skip it for inputFormats
        // so pipeline processes Body + Query1 + Query2...
        if (multipleCases) {
             inputFormats = pres.slice(1).map((_, el) => $(el).text()).get();
        } else {
             inputFormats = pres.map((_, el) => $(el).text()).get();
        }

        // Fallback inputFormat
        inputFormat = inputFormats[0];

      } else if (count >= 2) {
        if (multipleCases) {
            // Logic for standard T cases: Format is in second block
            inputFormat = pres.eq(1).text();
        } else {
            inputFormat = pres.eq(0).text();
        }
      } else if (count > 0) {
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
        if (lines.length > 0) {
            lines.shift();
            finalInput = lines.join('\n');
        }
      }

      samples.push({
        input: finalInput,
        output: s.output,
      });
    }
  }

  return {
    inputFormat: inputFormat.trim(),
    inputFormats,
    samples,
    multipleCases,
  };
}
