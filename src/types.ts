/**
 * Type definitions for atcoder-cli and atcoder-tools configuration files
 */

// atcoder-cli contest.acc.json format
export interface AtCoderCliContestConfig {
  contest: {
    id: string;
    title: string;
    url: string;
  };
  tasks: AtCoderCliTask[];
}

export interface AtCoderCliTask {
  id: string;
  label: string;
  title: string;
  url: string;
  directory?: {
    path: string;
    testdir: string;
    submit: string;
  };
}

// atcoder-tools metadata.json format
export interface AtCoderToolsMetadata {
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
    url?: string; // Optional field that may be present in some versions
  };
  sample_in_pattern: string;
  sample_out_pattern: string;
  timeout_ms: number;
}
