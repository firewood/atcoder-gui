# OpenSpec: Generator 詳細設計 (atcoder-gui)

## 役割 (Role)
`generator` コンポーネントは、`analyzer` によって構造化された問題データ（ASTおよび変数メタデータ）を受け取り、特定のプログラミング言語のソースコードへと変換する役割を担います。

## 主要コンポーネント

### 1. Variable Extractor (`src/generator/variable-extractor.ts`)
`analyzer` が出力した AST を走査し、コード生成に必要な変数の情報を抽出・整理します。
- **次元の特定**: ループ内での使用状況から、変数がスカラー、1次元配列（vector）、または2次元配列（matrix）のいずれであるかを判定。
- **インデックスの解決**: ループ変数（$i, j$ など）をループの終了条件（$N, M$ など）に紐付け、配列のサイズを特定。
- **次元の調整 (Heuristics)**:
    - **畳み込まれた変数の調整 (Collapsed Variables)**: `analyzer` で畳み込まれた変数について、抽出時に次元を1つ減らし、対応する配列サイズを調整。
    - **String Anomaly への対応**: 型が `String` であり、かつ AST 上の次元がループの深さを超えている場合（例：$S_{i,j}$ のように文字単位でアクセスされている場合）、次元を下げる。

### 2. Universal Generator (`src/generator/universal.ts`)
言語に依存しない共通の生成ロジックを提供します。
- **Template Context の構築**: 変数宣言、入力処理、関数の引数リストなど、テンプレートに渡すための `TemplateContext` オブジェクトを生成。
- **コード断片の生成**: 設定ファイル (`.json5`) のルールに従い、標準入力からの読み込みコード (`input_part`) を AST の構造（ループ、順次）に合わせて構築。
- **依存関係の解決**: 配列のサイズ指定に使用される変数が、その配列より先に読み込まれるように順序を制御。

### 3. 言語別 Generator (例: `CPlusPlusGenerator`, `PythonGenerator`)
特定の言語に特化した生成器で、`UniversalGenerator` とテンプレートエンジンを統合します。
- **設定とテンプレートの管理**: デフォルトの `.json5` および `.njk` ファイルをロードし、必要に応じてユーザーによるオーバーライドを適用。
- **レンダリング**: `UniversalGenerator` が生成した `TemplateContext` を Nunjucks テンプレートに流し込み、最終的なソースコード文字列を出力。

### 4. Pipeline (`src/generator/pipeline.ts`)
`analyzer` と `generator` を繋ぐオーケストレーターです。
- HTML のパースから始まり、AST 構築、型推論、変数抽出を経て、最終的なコード生成までの一連の流れ（パイプライン）を管理。

## 処理フロー

1. **抽出**: `VariableExtractor` が AST を走査し、変数のリスト（名前、型、次元、サイズ）を作成。
2. **変換 (Universal)**: `UniversalGenerator` が言語設定 (`.json5`) を参照し、変数のリストを `TemplateContext` へと変換。この過程で以下のコード断片が生成される：
   - 変数宣言とメモリ確保
   - 入力読み込みの `for` ループ構造
   - `solve` 関数の引数リスト
3. **レンダリング (Language Specific)**: Nunjucks が `TemplateContext` を受け取り、テンプレート (`.njk`) に基づいて最終的なソースコードを生成。

## 設計上の特徴

- **ロジックと構文の分離**: `UniversalGenerator` がロジック（どの順番で何を読み込むか）を、設定ファイルとテンプレートが構文（どう書くか）を分担することで、新言語への対応コストを最小化。
- **拡張性**: ユーザーが独自のテンプレートを用意することで、コード生成の挙動を根本から変更可能。
- **競技プログラミング最適化**: $1$ インデックスの自動修正、クエリ問題のループ自動生成、MOD 値や YES/NO 定数の自動埋め込みなど、実戦的な機能を備える。
