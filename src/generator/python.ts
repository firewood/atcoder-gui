import nunjucks from "nunjucks";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import JSON5 from "json5";
import { UniversalGenerator } from "./universal.js";
import { CodeGeneratorConfig } from "./types.js";
import { FormatNode, VarType, ASTNode } from "../analyzer/types.js";
import { ConfigManager } from "../config.js";

// Resolve paths relative to this file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_CONFIG_PATH = path.join(__dirname, "config", "python.json5");
const DEFAULT_TEMPLATE_PATH = path.join(__dirname, "templates", "python.njk");

export class PythonGenerator {
  private generator: UniversalGenerator;
  private template: string;

  constructor(configManager?: ConfigManager) {
    let configPath = DEFAULT_CONFIG_PATH;
    let templatePath = DEFAULT_TEMPLATE_PATH;

    if (configManager) {
      const configDir = configManager.getConfigDirPath();
      const localPythonJson5Path = path.join(configDir, "python.json5");
      const localPythonNjkPath = path.join(configDir, "python.njk");

      if (fs.existsSync(localPythonJson5Path)) {
        configPath = localPythonJson5Path;
      }
      if (fs.existsSync(localPythonNjkPath)) {
        templatePath = localPythonNjkPath;
      }
    }

    const configContent = fs.readFileSync(configPath, "utf-8");
    const config = JSON5.parse(configContent) as CodeGeneratorConfig;
    this.generator = new UniversalGenerator(config);
    this.template = fs
      .readFileSync(templatePath, "utf-8")
      .replaceAll("%}\r\n", "%}")
      .replaceAll("%}\n", "%}");

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
    const context = this.generator.generate(format, variables, multipleCases, queryCases);
    return nunjucks.renderString(this.template, context);
  }
}
