# OpenSpec: アーキテクチャ設計書 (atcoder-gui)

## 世界観 (Worldview)
`atcoder-gui` は、競技プログラミングプラットフォーム「AtCoder」とのやり取りを自動化するために設計された、TypeScriptベースのCLIツールです。Playwrightによるブラウザ管理を通じてログインセッションを維持しつつ、問題文の解析やコード生成をコマンドラインから実行可能にすることで、手動操作と自動化ツールのギャップを埋めることを目的としています。

### コアな目的
- **セッションの継続性**: 実ブラウザのコンテキストを使用し、AtCoderのログイン状態をセッション間で維持する。
- **スマートな解析**: 半構造化されたHTML形式の入力形式を、型定義されたAST (抽象構文木) に解析する。
- **自動コード生成**: 解析された問題データに基づき、慣習に沿ったスターターコード（初期対応はC++）を生成する。
- **外部ツール連携**: セッションデータを `atcoder-cli`, `atcoder-tools`, `online-judge-tools` などの外部ツールが利用可能な形式でエクスポートする。

## 技術スタック
- **言語**: TypeScript (Node.js ESM)
- **ブラウザ自動化**: Playwright (Chromium)
- **HTML解析**: Cheerio
- **構文解析/AST**: 独自のLexer, Parser, Analyzer
- **テンプレートエンジン**: Nunjucks (コード生成用)
- **設定管理**: `conf` (永続的な設定用)
- **テスト**: Vitest

## アーキテクチャ・レイヤー

### 1. CLI / オーケストレーション層 (`src/main.ts`)
アプリケーションのエントリーポイント。Node.jsの `readline` を使用して対話型REPLを管理します。
- **AtCoderGUI**: 各種マネージャーを統合・制御するメインクラス。
- **コマンド・ディスパッチャー**: ユーザー入力を各マネージャー (`Gen2Manager`, `SubmitManager`, `CookieExporter` 等) に振り分ける。

### 2. ブラウザ & セッション層 (`src/browser.ts`, `src/session.ts`)
Playwrightブラウザのライフサイクルを管理します。
- **BrowserManager**: Chromiumの起動、保存された状態（Storage State）によるコンテキスト作成、ページ遷移を担当。
- **SessionManager**: `conf` を使用して、CookieやlocalStorageなどのブラウザ状態をディスクに保存する。
- **CookieExporter**: 外部ツール向けにセッションデータを整形・保存するロジック。

### 3. 解析層 (`src/analyzer/`)
HTMLの問題説明を構造化データに変換する、ツールの核となる部分です。
- **HTML Parser**: Cheerioを使用して「入力形式」と「入力例」のセクションを抽出。
- **Lexer/Parser**: 入力形式の文字列をトークン化し、生のASTを構築。
- **Analyzer**: ASTを正規化し、**ループ検出** (例: $A_1, A_2, \dots, A_N$ がループであることを特定) などの高度な操作を実行。
- **Typing Engine**: 実際の入力例とASTを照らし合わせ、変数の型 (int, string, float等) を推論。

### 4. 生成層 (`src/generator/`)
解析されたデータをソースコードに変換します。
- **Pipeline**: HTML -> AST -> 型推論 -> 変数メタデータの流れを制御。
- **Variable Extractor**: 複雑なAST構造を、メタデータ（次元、型）を持つ変数のリストに平坦化。
- **CPlusPlusGenerator**: Nunjucksテンプレート (`src/generator/templates/cpp.njk`) と設定 (`src/generator/config/cpp.json5`) を使用して `main.cpp` を出力。

## データフロー

1. **入力**: ユーザーがコマンド (例: `gen2`) を入力、またはブラウザで問題ページに移動。
2. **取得**: `BrowserManager` が問題ページの生HTMLを取得。
3. **解析**: `generateParseResult` (Pipeline) が実行される：
   - `parseHtml` でフォーマットブロックとサンプルを抽出。
   - `Lexer` & `Parser` が生の `FormatNode` ツリーを作成。
   - `Analyzer` がループを検出し、ツリーを簡略化。
   - `inferTypesFromInstances` が入力例を確認し、各変数の型を決定。
   - `VariableExtractor` が最終的なメタデータリストを準備。
4. **生成**: `CPlusPlusGenerator` がメタデータを受け取り、C++テンプレートをレンダリング。
5. **出力**: 生成されたコードがローカルディレクトリの `main.cpp` に書き込まれる。

## 主要な設計方針

- **UI優先のブラウザ**: 多くのCLIツールがヘッドレスリクエストを使用するのに対し、本ツールはデフォルトで可視化されたブラウザを使用します。これにより、CAPTCHA対応や手動ログインを容易にしつつ、技術的な自動化をツールに任せることができます。
- **ASTベースの解析**: 壊れやすい正規表現ベースの解析ではなく、正式なLexer/Parserアプローチを採用。これにより、AtCoderの問題フォーマットの微妙な変化に対しても堅牢です。
- **ヒューリスティックなループ検出**: `Analyzer` は「...」(dots) やインデックスのパターンを探索し、テキスト上では暗示的にしか示されないループ構造を再構築します。
- **ハードコードを避けた設定管理**: 生成ロジック（インクルード、マクロ等）は `.json5` 設定ファイルや `.njk` テンプレートに切り出されており、将来的な多言語対応を容易にしています。

## テスト戦略
- **ユニットテスト**: ソースファイルと同じディレクトリに配置 (例: `analyzer.test.ts`)。Lexer/Parserの正当性やループ検出に重点を置く。
- **シナリオテスト**: `src/tests/scenario.test.ts` および `gen2.test.ts` で、`test-resources/` に保存されたHTMLリソースを使用したエンドツーエンドの検証を行う。
- **手動検証**: `checker.ts` ユーティリティを使用して、過去の膨大なAtCoderの問題に対して一括で解析テストを実行可能。
