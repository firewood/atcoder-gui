import nunjucks from "nunjucks";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import JSON5 from "json5";
import { UniversalGenerator } from "./universal.js";
import { CodeGeneratorConfig } from "./types.js";
import { FormatNode, VarType, ASTNode } from "../analyzer/types.js";
import process from "process";

// Resolve paths relative to this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_CONFIG_PATH = path.join(__dirname, "config", "cpp.json5");
const DEFAULT_TEMPLATE_PATH = path.join(__dirname, "templates", "cpp.njk");

export class CPlusPlusGenerator {
  private generator: UniversalGenerator;
  private template: string;

  constructor() {
    let configPath = DEFAULT_CONFIG_PATH;
    let templatePath = DEFAULT_TEMPLATE_PATH;

    const cwd = process.cwd();
    const localConfigJsonPath = path.join(cwd, "config.json");

    if (fs.existsSync(localConfigJsonPath)) {
      const localCppJson5Path = path.join(cwd, "cpp.json5");
      const localCppNjkPath = path.join(cwd, "cpp.njk");

      if (fs.existsSync(localCppJson5Path)) {
        configPath = localCppJson5Path;
        console.log(`Using local config: ${configPath}`);
      }
      if (fs.existsSync(localCppNjkPath)) {
        templatePath = localCppNjkPath;
        console.log(`Using local template: ${templatePath}`);
      }
    }

    const configContent = fs.readFileSync(configPath, "utf-8");
    const config = JSON5.parse(configContent) as CodeGeneratorConfig;
    this.generator = new UniversalGenerator(config);
    this.template = fs.readFileSync(templatePath, "utf-8");

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
