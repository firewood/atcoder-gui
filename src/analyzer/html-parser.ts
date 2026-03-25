import * as cheerio from "cheerio";

export interface Sample {
  input: string;
  output: string;
}

type OutputType = {
  returnType: string;
  yesStr?: string;
  noStr?: string;
  multipleColumns?: boolean;
  multipleRows?: boolean;
  variableArray?: boolean;
};

type ParseResult = OutputType & {
  inputFormat: string;
  samples: Sample[];
  multipleCases: boolean;
  queryType: boolean;
  judgeType: string;
  errorTolerance?: number;
  mod?: number;
};

export function parseHtml(html: string): ParseResult {
  const $ = cheerio.load(html);
  let inputFormat = "";
  const samples: Sample[] = [];
  const tempSamples: Record<string, { input?: string; output?: string }> = {};
  let multipleCases = false;
  let queryType = false;
  let judgeType = "normal";
  let errorTolerance: number | undefined = undefined;
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
    multipleCases,
    queryType,
    judgeType,
    errorTolerance,
    mod,
    ...inferReturnType(allOutputs, judgeType, mod, multipleCases),
  };
}

function inferReturnType(
  outputs: string[],
  judgeType: string,
  mod: number | undefined,
  multipleCases: boolean,
): OutputType {
  if (outputs.length === 0) return { returnType: "void" };

  let returnType = "string";
  let yesStr: string | undefined = undefined;
  let noStr: string | undefined = undefined;
  let variableArray = false;

  const parsedOutputs = outputs.map((out) =>
    out
      .trim()
      .split(/\s+/)
      .filter((s) => s.length > 0),
  );

  // Check for variableArray pattern (K elements preceded by K)
  // Atcoder ABC 233 F style:
  // K
  // c1 c2 ... cK
  // OR -1
  const isVariableArrayMatch = parsedOutputs.every((tokens) => {
    if (tokens.length === 0) return false;
    if (tokens.length === 1 && tokens[0] === "-1") return true;
    const K = parseInt(tokens[0]);
    if (isNaN(K) || K < 0) return false;
    return tokens.length === K + 1;
  });

  const hasMultiLineOrZero = outputs.some((out) => {
    const trimmed = out.trim();
    return trimmed.includes("\n") || trimmed === "0";
  });

  if (isVariableArrayMatch && hasMultiLineOrZero) {
    variableArray = true;
  }

  const isSingleLine = outputs.every((out) => out.trim().split("\n").length === 1);
  const isSingleValue = outputs.every((out) =>
    out
      .trim()
      .split("\n")
      .every((line) => line.split(/\s+/).length == 1),
  );

  const isNumeric = (t: string): boolean => /^-?(?:\d+\.\d+|\d+)$/.test(t);

  const tokensToConsider = variableArray
    ? parsedOutputs.map((tokens) => (tokens.length === 1 && tokens[0] === "-1" ? [] : tokens.slice(1))).flat()
    : parsedOutputs.flat();

  const isNumericAll = tokensToConsider.every(isNumeric);
  const hasVeryLargeNumber = tokensToConsider.some((t) => {
    const digitsOnly = t.replace(/^-/, "").split(".")[0];
    return digitsOnly.length >= 20;
  });

  if (isNumericAll && !hasVeryLargeNumber && tokensToConsider.length > 0) {
    if (judgeType === "decimal") {
      returnType = "float";
    } else if (mod !== undefined) {
      returnType = "modint";
    } else {
      returnType = "int";
    }
  } else if (tokensToConsider.length > 0) {
    const yesNoPairs = [
      ["Yes", "No"],
      ["YES", "NO"],
      ["Possible", "Impossible"],
      ["POSSIBLE", "IMPOSSIBLE"],
      ["Takahashi", "Aoki"],
    ];
    for (const [y, n] of yesNoPairs) {
      const isBoolean = (t: string): boolean => t == y || t == n;
      const isBooleanAll = tokensToConsider.every(isBoolean);
      if (isBooleanAll) {
        returnType = "bool";
        yesStr = y;
        noStr = n;
      }
    }
  }

  return {
    returnType,
    multipleColumns: !isSingleValue && !variableArray,
    multipleRows: !isSingleLine && !multipleCases && !variableArray,
    variableArray,
    yesStr,
    noStr,
  };
}
