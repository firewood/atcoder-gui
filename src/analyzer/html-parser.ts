import * as cheerio from "cheerio";

export interface Sample {
  input: string;
  output: string;
}

export interface ParseResult {
  inputFormat: string;
  samples: Sample[];
  multipleCases: boolean;
  queryType: boolean;
  judgeType: string;
  errorTolerance?: number;
  yesStr?: string;
  noStr?: string;
  mod?: number;
  returnType: string;
  multipleLines: boolean;
}

export function parseHtml(html: string): ParseResult {
  const $ = cheerio.load(html);
  let inputFormat = "";
  const samples: Sample[] = [];
  const tempSamples: Record<string, { input?: string; output?: string }> = {};
  let multipleCases = false;
  let queryType = false;
  let judgeType = "normal";
  let errorTolerance: number | undefined = undefined;
  let yesStr: string | undefined = undefined;
  let noStr: string | undefined = undefined;
  let mod: number | undefined = undefined;

  const checkFloatingPoint = (text: string) => {
    const sectionText = text.toLowerCase();
    if (
      sectionText.includes("絶対誤差") ||
      sectionText.includes("相対誤差") ||
      sectionText.includes("absolute error") ||
      sectionText.includes("relative error")
    ) {
      judgeType = "decimal";
      if (errorTolerance === undefined) {
        // Try to extract error tolerance like 10^{-6}
        const match = text.match(/10\^{?(-?\d+)}?/);
        if (match) {
          errorTolerance = Math.pow(10, parseInt(match[1]));
        } else {
          errorTolerance = 1e-6;
        }
      }
    }
  };

  const checkMod = (text: string) => {
    if (text.includes("998244353")) {
      mod = 998244353;
    } else if (text.includes("1000000007") || text.includes("10^9+7") || text.includes("10^{9}+7")) {
      mod = 1000000007;
    }
  };

  $("h3").each((_, element) => {
    const text = $(element).text().trim();
    const section = $(element).closest("section");

    if (text.match(/^Input(\s*Format)?$/i)) {
      const pres = section.find("pre");
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
        if (firstPreText.startsWith("T") || firstPreText.startsWith("Q")) {
          multipleCases = true;
          inputFormat = pres.eq(1).text();
        } else {
          inputFormat = pres.eq(0).text();
        }
      } else if (pres.length > 0) {
        inputFormat = pres.eq(0).text();
      }
    } else if (text.match(/^(Problem Statement|問題文|Output|出力)$/i)) {
      const sectionText = section.text();
      checkFloatingPoint(sectionText);
      checkMod(sectionText);
    } else if (text.match(/^Constraints|制約$/i)) {
      checkMod(section.text());
    } else {
      const inputMatch = text.match(/^Sample Input\s*(\d+)?$/i);
      if (inputMatch) {
        const id = inputMatch[1] || "1";
        if (!tempSamples[id]) tempSamples[id] = {};

        let content = "";
        const pre = section.find("pre");
        if (pre.length > 0) {
          content = pre.text();
        }
        tempSamples[id].input = content;
      }

      const outputMatch = text.match(/^Sample Output\s*(\d+)?$/i);
      if (outputMatch) {
        const id = outputMatch[1] || "1";
        if (!tempSamples[id]) tempSamples[id] = {};

        let content = "";
        const pre = section.find("pre");
        if (pre.length > 0) {
          content = pre.text();
        }
        tempSamples[id].output = content;

        if (content.match(/\d+\.\d+/) || content.match(/\d+[eE][+-]?\d+/)) {
          if (judgeType === "normal") {
            judgeType = "decimal";
            if (errorTolerance === undefined) errorTolerance = 1e-6;
          }
        }
      }
    }
  });

  // Convert tempSamples to array
  const ids = Object.keys(tempSamples).sort((a, b) => Number(a) - Number(b));

  const allOutputs = ids.map((id) => tempSamples[id].output?.trim()).filter(Boolean) as string[];
  const yesNoPairs = [
    ["Yes", "No"],
    ["YES", "NO"],
    ["Possible", "Impossible"],
    ["POSSIBLE", "IMPOSSIBLE"],
    ["Takahashi", "Aoki"],
  ];

  for (const [y, n] of yesNoPairs) {
    if (allOutputs.includes(y) && allOutputs.includes(n)) {
      yesStr = y;
      noStr = n;
      break;
    }
  }

  for (const id of ids) {
    const s = tempSamples[id];
    if (s.input !== undefined && s.output !== undefined) {
      let finalInput = s.input;
      if (multipleCases) {
        // Strip the first line
        const lines = finalInput.split("\n");
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
          finalInput = lines.join("\n");
        }
      }

      samples.push({
        input: finalInput,
        output: s.output,
      });
    }
  }

  const { returnType, multipleLines } = inferReturnType(allOutputs, mod, judgeType);

  return {
    inputFormat: inputFormat.trim(),
    samples,
    multipleCases,
    queryType,
    judgeType,
    errorTolerance,
    yesStr,
    noStr,
    mod,
    returnType,
    multipleLines,
  };
}

function inferReturnType(
  outputs: string[],
  mod: number | undefined,
  judgeType: string,
): { returnType: string; multipleLines: boolean } {
  if (outputs.length === 0) return { returnType: "void", multipleLines: false };

  const parsedOutputs = outputs.map((out) =>
    out
      .trim()
      .split(/\s+/)
      .filter((s) => s.length > 0),
  );

  const isSingleValue = parsedOutputs.every((tokens) => tokens.length === 1);
  const isNumeric = (t: string): boolean => /^-?(?:\d+\.\d+|\d+)$/.test(t);
  if (isSingleValue) {
    const allTokens = parsedOutputs.map((t) => t[0]);
    if (allTokens.every(isNumeric)) {
      if (mod !== undefined) return { returnType: "modint", multipleLines: false };
      if (judgeType === "decimal") return { returnType: "float", multipleLines: false };
      return { returnType: "int", multipleLines: false };
    }
    return { returnType: "string", multipleLines: false };
  }

  const isNumericAll = parsedOutputs.every((tokens) => tokens.every(isNumeric));
  if (isNumericAll) {
    const isSingleLine = outputs.every((out) => out.trim().split("\n").length === 1);
    if (isSingleLine) {
      return { returnType: "int_array", multipleLines: false };
    }
    return { returnType: "int_array", multipleLines: true };
  }

  return { returnType: "void", multipleLines: false };
}
