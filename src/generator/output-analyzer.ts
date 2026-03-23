export class OutputAnalyzer {
  analyze(html: string, samples: string[], yesStr?: string): string {
    if (yesStr && samples.some(s => s.toLowerCase() === yesStr.toLowerCase())) {
      return 'string';
    }

    if (html.includes('998244353')) {
      return 'atcoder::modint998244353';
    }
    if (html.includes('1000000007')) {
      return 'atcoder::modint1000000007';
    }
    if (html.toLowerCase().includes('modulo')) {
      return 'atcoder::modint';
    }

    for (const sample of samples) {
      if (sample.includes(' ') || sample.includes('\n')) {
        return 'std::vector<long long>';
      }
    }

    return 'long long';
  }
}
