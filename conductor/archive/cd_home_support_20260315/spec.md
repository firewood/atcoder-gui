# Specification: Home Directory (~) Support for `cd` Command

## Goal
AtCoder GUI の内部 CLI において、`cd` コマンドがホームディレクトリを示す `~` (チルダ) を正しく解釈し、ユーザーのホームディレクトリへの移動をサポートします。

## Scope
- `cd` コマンドのパス解析ロジックの更新: `~` で始まるパスをホームディレクトリとして展開。
- クロスプラットフォーム対応: `os.homedir()` を使用して、Windows, macOS, Linux すべてで動作することを保証。
- ユニットテストの追加: `~` および `~/subdir` が正しく展開されること、および既存の相対パス/絶対パスが壊れないことを検証。

## Functional Requirements
1. `cd ~` を実行すると、ユーザーのホームディレクトリに移動する。
2. `cd ~/some/path` を実行すると、ユーザーのホームディレクトリ内の `some/path` に移動する。
3. パスの途中の `~` (例: `cd /path/to/~`) は展開しない。

## Implementation Details
- `os.homedir()` を使用してホームディレクトリのパスを取得。
- `path` モジュールの `resolve` や `join` と組み合わせて、展開後の絶対パスを生成。
- `src/main.ts` 内の `cd` コマンド実装箇所 (`process.chdir(dir)`) を、展開後のパスを使用するように修正。
- ユーティリティ関数として `expandHomeDir(path: string): string` を `src/utils.ts` 等に追加することを検討。
