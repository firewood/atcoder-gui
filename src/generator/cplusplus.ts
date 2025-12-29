import nunjucks from "nunjucks";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import JSON5 from "json5";
import { UniversalGenerator } from "./universal.js";
import { CodeGeneratorConfig } from "./types.js";
import { FormatNode, VarType, ASTNode } from "../analyzer/types.js";

// Resolve paths relative to this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_PATH = path.join(__dirname, "config", "cpp.json5");
const TEMPLATE_PATH = path.join(__dirname, "templates", "cpp.njk");

export class CPlusPlusGenerator {
  private generator: UniversalGenerator;
  private template: string;

  constructor() {
    const configContent = fs.readFileSync(CONFIG_PATH, "utf-8");
    const config = JSON5.parse(configContent) as CodeGeneratorConfig;
    this.generator = new UniversalGenerator(config);
    this.template = fs.readFileSync(TEMPLATE_PATH, "utf-8");

    // Configure nunjucks
    nunjucks.configure({ autoescape: false });
  }

  generate(
    format: FormatNode,
    variables: {
      name: string;
      type: VarType;
      dims: number;
      indices: ASTNode[];
    }[],
    multipleCases?: boolean,
    queryCases?: boolean,
  ): string {
    const context = this.generator.generate(
      format,
      variables,
      multipleCases,
      queryCases,
    );
    return nunjucks.renderString(this.template, context);
  }
}
