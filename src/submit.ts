import { readFileSync, existsSync } from 'fs';
import * as path from 'path';
import { BrowserManager } from './browser.js';
import { AtCoderCliContestConfig, AtCoderToolsMetadata } from './types.js';

interface MetadataJson {
  code_filename: string;
  judge: {
    judge_type: string;
  };
  lang: string;
  problem: {
    alphabet: string;
    contest: {
      contest_id: string;
    };
    problem_id: string;
  };
  sample_in_pattern: string;
  sample_out_pattern: string;
  timeout_ms: number;
}

export class SubmitManager {
  private browserManager: BrowserManager;

  constructor(browserManager: BrowserManager) {
    this.browserManager = browserManager;
  }

  /**
   * Submit solution to AtCoder
   */
  async submitSolution(filename: string | undefined): Promise<boolean> {
    try {
      const atcoderToolsMetadataPath = './metadata.json';
      const atcoderCliMetadataPath = '../contest.acc.json';
      if (existsSync(atcoderToolsMetadataPath)) {
        const metadata: AtCoderToolsMetadata = JSON.parse(readFileSync(atcoderToolsMetadataPath, 'utf-8'));
        this.pasteToBrowser(metadata.problem.contest.contest_id, metadata.problem.problem_id, filename || metadata.code_filename);
        return true;
      } else if (existsSync(atcoderCliMetadataPath)) {
        if (!filename) {
          console.error('Error: filename is required');
          return false;
        }
        const metadata: AtCoderCliContestConfig = JSON.parse(readFileSync(atcoderCliMetadataPath, 'utf-8'));
        const problem_id = path.basename(process.cwd());
        for (const task of metadata.tasks) {
          if (task.directory?.path == problem_id) {
            this.pasteToBrowser(metadata.contest.id, task.id, filename);
            return true;
          }
        }
      } else {
        console.error('Error: metadata not found in current directory');
      }
    } catch (error) {
      console.error('Error during submission:', error);
    }
    return false;
  }

  private async pasteToBrowser(contestId: string, problemId: string, sourceCodePath: string): Promise<void> {
    if (!existsSync(sourceCodePath)) {
      console.error(`Error: ${sourceCodePath} not found in current directory`);
      return;
    }
    const sourceCode = this.readSourceCode(sourceCodePath);

    console.log(`Contest ID: ${contestId}, Problem ID: ${problemId}`);

    // Open AtCoder submit URL
    const submitUrl = `https://atcoder.jp/contests/${contestId}/submit?taskScreenName=${problemId}`;
    await this.browserManager.openUrl(submitUrl);

    // Copy source code to clipboard and fill the textarea
    await this.fillSourceCodeArea(sourceCode);
  }

  /**
   * Parse metadata.json to extract contest_id and problem_id
   */
  private parseMetadata(metadataPath: string): { contestId: string; problemId: string } {
    try {
      const metadataContent = readFileSync(metadataPath, 'utf-8');
      const metadata: MetadataJson = JSON.parse(metadataContent);

      const contestId = metadata.problem.contest.contest_id;
      const problemId = metadata.problem.problem_id;

      if (!contestId || !problemId) {
        throw new Error('contest_id or problem_id not found in metadata.json');
      }

      return { contestId, problemId };
    } catch (error) {
      throw new Error(`Failed to parse metadata.json: ${error}`);
    }
  }

  /**
   * Read source code from main.cpp
   */
  private readSourceCode(mainCppPath: string): string {
    try {
      return readFileSync(mainCppPath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read main.cpp: ${error}`);
    }
  }

  /**
   * Fill the source code area on AtCoder submit page
   */
  private async fillSourceCodeArea(sourceCode: string): Promise<void> {
    try {
      const page = this.browserManager.getCurrentPage();
      if (!page) {
        throw new Error('No active page found');
      }

      // Wait for the page to load
      await page.waitForLoadState('domcontentloaded');

      // Find the source code textarea (common selectors for AtCoder)
      const textareaSelector = '#editor .ace_text-input';
      await page.waitForSelector(textareaSelector, { timeout: 10000 });

      // Set min-height for the editor textarea
      await page.addStyleTag({ content: `div#editor { min-height: 200px !important; }` });

      // Clear existing content and paste source code
      await page.fill(textareaSelector, sourceCode);

      console.log('✓ Copied!');
    } catch (error) {
      console.error('Failed to fill source code area:', error);
    }
  }
}
