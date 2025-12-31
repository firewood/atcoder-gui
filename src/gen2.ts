import fs from 'fs';
import { BrowserManager } from './browser';
import { CPlusPlusGenerator } from './generator/cplusplus.js';
import { generateParseResult } from './generator/pipeline.js';
import { ConfigManager } from './config.js';

export class Gen2Manager {
  private browserManager: BrowserManager;
  private configManager: ConfigManager;

  constructor(browserManager: BrowserManager, configManager: ConfigManager) {
    this.browserManager = browserManager;
    this.configManager = configManager;
  }

  async run(): Promise<void> {
    const url = this.browserManager.getCurrentUrl();
    if (!url || !url.includes('atcoder.jp/contests/')) {
      console.error(
        'Error: Not on an AtCoder contest page. Please navigate to a problem page.',
      );
      return;
    }

    const match = url.match(/tasks\/([^\/?#]+)/);
    const taskId = match ? match[1] : undefined;

    if (!taskId) {
      console.error('Error: Could not extract task ID from the URL.');
      return;
    }

    console.log(`Generating main.cpp for task: ${taskId}`);

    try {
      const html = await this.browserManager.getCurrentPageContent();
      if (!html) {
        console.error('Error: Could not get page content.');
        return;
      }

      // Pipeline
      const { multipleCases, queryType, variables, formatTree } =
        generateParseResult(html, taskId, url);

      console.log('Generating C++ Code...');
      if (!formatTree) throw new Error('Format tree is undefined');

      const generator = new CPlusPlusGenerator(this.configManager);
      const code = generator.generate(
        formatTree,
        variables,
        multipleCases,
        queryType,
      );

      fs.writeFileSync('main.cpp', code);
      console.log('Saved C++ code to main.cpp');
    } catch (e) {
      console.error('Error during generation:', e);
    }
  }
}
