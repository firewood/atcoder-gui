# Specification: Home Directory (~) Support for `gen2` Command

## Goal
AtCoder GUI の `gen2` コマンドにおいて、設定ファイル (`config.json5`) の `workspaceDir` に `~` (チルダ) が含まれている場合に、ユーザーのホームディレクトリとして正しく展開し、期待されるディレクトリにファイルを生成できるようにします。

## Scope
- `Gen2Manager` 内での `workspaceDir` 取得ロジックの更新: `workspaceDir` を取得した直後に `expandHomeDir` を適用。
- ユニットテストの追加: `Gen2Manager` が `workspaceDir` の `~` を正しく展開して使用することを検証。

## Functional Requirements
1. `config.json5` の `workspaceDir` が `~` で始まる場合 (例: `~/atcoder`)、`gen2` コマンド実行時にユーザーのホームディレクトリに展開された絶対パスとして扱われる。
2. 既に `src/utils.ts` に実装されている `expandHomeDir` ユーティリティ関数を使用する。
3. `workspaceDir` が設定されていない、または相対パス/絶対パスの場合は、従来通りの動作を維持する。

## Acceptance Criteria
- `workspaceDir: "~/atcoder"` の設定がある状態で `gen2` を実行すると、ホームディレクトリ以下の `atcoder` フォルダにコンテストフォルダが生成される。
- `workspaceDir: "/abs/path"` の場合は、その絶対パスがそのまま使用される。
- `workspaceDir: "relative/path"` の場合は、カレントディレクトリからの相対パスとして扱われる。

## Implementation Details
- `src/gen2.ts` の `Gen2Manager.run` メソッド内で `this.configManager.getConfig().workspaceDir` を取得している箇所で、`expandHomeDir` を呼び出す。
- `src/tests/gen2.test.ts` または適切な場所で、`workspaceDir` に `~` を含むモック設定を使用したテストを追加。
