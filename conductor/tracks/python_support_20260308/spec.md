# Specification: Python Support for Code Generator

## Goal
AtCoder GUI ツールに Python コード生成サポートを追加し、ユーザーが問題に対して `main.py` ファイルを生成できるようにします。

## Scope
- `src/generator/python.ts` の作成: Python コード生成ロジックの構築。
- `src/generator/config/python.json5` の作成: Python 固有の設定（型、入力読み込みなど）。
- `src/generator/templates/python.njk` の作成: Python 用の Nunjucks テンプレート。
- `src/gen2.ts` の更新: C++ と Python のジェネレーターを選択できるロジックの追加。
- `src/generator/python.test.ts` の作成: Python 生成のユニットテスト。

## Implementation Details
- `PythonGenerator` は `CPlusPlusGenerator` と同じパターンに従います。
- `UniversalGenerator` を使用して、Nunjucks 用のコンテキストを生成します。
- Python での入力読み込みは、速度のために `sys.stdin.readline` を使用するなど最適化を考慮します。
