# OpenSpec: Generator 詳細設計 (atcoder-gui)

## 役割 (Role)
`generator` コンポーネントは、`analyzer` によって構造化された問題データ（ASTおよび変数メタデータ）を受け取り、特定のプログラミング言語のソースコードへと変換する役割を担います。テンプレートエンジンと設定ファイルを活用することで、言語ごとの慣習に沿った、再利用性の高いコードを生成します。

## 主要コンポーネント

### 1. Variable Extractor (`src/generator/variable-extractor.ts`)
`analyzer` が出力した AST を走査し、コード生成に必要な変数の情報を抽出・整理します。
- **次元の特定**: ループ内での使用状況から、変数がスカラー、1次元配列（vector）、または2次元配列（matrix）のいずれであるかを判定。
- **インデックスの解決**: ループ変数（$i, j$ など）をループの終了条件（$N, M$ など）に紐付け、配列のサイズを特定。
- **例外処理 (Heuristics)**: 
    - 文字列（String）の場合に、文字単位のインデックスが AST に含まれていても、言語レベルの文字列型として扱うための調整。
    - 畳み込まれた変数（Collapsed Variables）の次元復元。

### 2. Universal Generator (`src/generator/universal.ts`)
言語に依存しない共通の生成ロジックを提供します。
- **Template Context の構築**: 変数宣言、入力処理、関数の引数リストなど、テンプレートに渡すためのデータを生成。
- **入力処理の生成**: AST の構造（ループ、分岐、順次）に従って、標準入力から値を読み込むコード断片（`input_part`）を構築。
- **宣言と確保**: 配列のサイズに基づいたメモリ確保（`vector::assign` や `resize` など）のコードを生成。

### 3. CPlusPlus Generator (`src/generator/cplusplus.ts`)
C++ に特化した生成器です。
- **Nunjucks の統合**: JavaScript 用の強力なテンプレートエンジン Nunjucks を使用して、最終的なソースコードをレンダリング。
- **設定のロード**: `cpp.json5` から C++ 特有の型名（`long long`, `double` など）や入力構文（`cin >>` など）をロード。
- **テンプレートのロード**: `cpp.njk` テンプレートを使用して、 include 文、マクロ、`main` 関数、および問題解決用の関数 `solve` の骨組みを生成。

### 4. Pipeline (`src/generator/pipeline.ts`)
`analyzer` と `generator` を繋ぐオーケストレーターです。
- HTML のパースから始まり、AST 構築、型推論、変数抽出を経て、最終的なコード生成までの一連の流れ（パイプライン）を管理。

## 設定とテンプレート

### 設定ファイル (`src/generator/config/cpp.json5`)
言語ごとの構文ルールを定義します。
- `type`: 言語内での型名定義（例：`int` -> `long long`）。
- `input`: 入力読み込みのテンプレート（例：`cin >> {name};`）。
- `loop`: ループの構文（例：`for (int {loop_var} = 0; {loop_var} < {length}; {loop_var}++) {`）。

### テンプレートファイル (`src/generator/templates/cpp.njk`)
ソースコード全体の構造を定義します。
- `include` 文や、競技プログラミングで頻用されるマクロ、定数（MODなど）の定義。
- `input_part` を埋め込む場所の指定。
- ユーザーがロジックを記述するための `solve` 関数の雛形。

## 処理フロー

1. **抽出**: `VariableExtractor` が AST を走査し、変数名、型、次元、サイズを特定。
2. **準備**: `UniversalGenerator` が設定ファイルに基づき、以下のコード断片を生成：
   - 変数宣言（`long long N;` 等）
   - メモリ確保（`A.assign(N, 0);` 等）
   - 入力処理（`cin >> A[i];` 等）
3. **構築**: これらの断片を `TemplateContext` にまとめる。
4. **出力**: `CPlusPlusGenerator` が Nunjucks を使用して、コンテキストをテンプレートに流し込み、最終的な `main.cpp` を生成。

## 設計上の特徴

- **言語中立性**: `UniversalGenerator` がロジックの大部分を担い、構文の差異を設定ファイルで吸収しているため、Python や Java などの他言語対応が容易。
- **カスタマイズ性**: ユーザーが独自の `cpp.json5` や `cpp.njk` を設定ディレクトリに配置することで、生成されるコードのスタイル（インデント、型、マクロ等）を自由に変更可能。
- **インテリジェントな解決**: $1$ インデックスから $0$ インデックスへの変換や、複数ケース（Multiple Cases）問題への対応など、競技プログラミング特有のパターンを自動で処理。
