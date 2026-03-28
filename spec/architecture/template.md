# OpenSpec: Template システム詳細設計 (atcoder-gui)

## 役割 (Role)
`template` システムは、解析された問題データを最終的なソースコードへと変換するための「雛形」を管理します。Nunjucks テンプレートエンジンと JSON5 設定ファイルを組み合わせることで、言語ごとの文法差異を吸収し、ユーザー好みのコーディングスタイル（インデント、型、マクロ等）を柔軟に反映させることが可能です。

## 主要構成要素

### 1. Nunjucks テンプレート (`.njk`)
ソースコード全体の構造（スケルトン）を定義します。
- **コード生成の枠組み**: `#include` 文、定数（MOD, YES/NO 等）の定義、`main` 関数、および問題解決用の `solve` 関数の構造を記述します。
- **制御フロー**: `{% if ... %}` や `{% for ... %}` を使用して、複数ケース問題やクエリ形式問題の有無に応じたコードの出し分けを行います。
- **プレースホルダー**: `{{ input_part | safe }}` や `{{ formal_arguments }}` のように、`generator` から渡された動的なコード断片を埋め込みます。

### 2. 言語設定ファイル (`.json5`)
特定のプログラミング言語における具体的な構文ルールと、`UniversalGenerator` がコード断片を生成する際の規則を定義します。

#### 主要な設定項目 (`CodeGeneratorConfig`)
| キー | 型 | 説明 |
| :--- | :--- | :--- |
| `indent_width` | number | インデントの幅。 |
| `indent_type` | string | `"tab"` または `"space"`。 |
| `newline` | string | `"lf"` または `"crlf"`。 |
| `insert_space_around_operators`| boolean | 演算子の周囲にスペースを入れるかどうか（実装予定）。 |
| `declare_group` | boolean | 同じ型の変数を一行でまとめて宣言するかどうか。 |
| `append_semicolon` | boolean | 文末にセミコロンを付与するかどうか。 |
| `input_separator` | string | まとめて入力を受ける際の区切り文字（例：`" >> "`）。 |
| `type` | Object | `int`, `float`, `str` の言語内での型名定義。 |
| `default` | Object | 各型のデフォルト値（初期化用）。 |
| `loop` | Object | `header` (for文開始) と `footer` (終了括弧) の定義。 |
| `arg` | Object | `solve` 関数の引数定義テンプレート（スカラ、1次元、2次元）。 |
| `actual_arg` | Object | 引数として渡す際のリテラル（例：`std::move({name})`）。 |
| `access` | Object | 配列要素へのアクセス構文（例：`{name}[{index}]`）。 |
| `declare` | Object | 変数宣言のみの構文。 |
| `allocate` | Object | 宣言済みの配列へのメモリ確保（例：`assign`）。 |
| `declare_and_allocate` | Object | 宣言と同時にメモリ確保を行う構文。 |
| `input` | Object | 標準入力からの読み込み構文。 |

#### 置換プレースホルダー
設定ファイル内の文字列（`header`, `input` 等）では、以下のプレースホルダーが `UniversalGenerator` によって動的に置換されます。

- `{name}`: 変数名
- `{type}`: 対応する言語内型名
- `{default}`: デフォルト値
- `{length}`: 配列の長さ（1次元）
- `{length_i}`, `{length_j}`: 配列のサイズ（2次元）
- `{index}`: 配列アクセス時のインデックス（1次元）
- `{index_i}`, `{index_j}`: 配列アクセス時のインデックス（2次元）
- `{loop_var}`: ループ変数名（`i`, `j` 等）

## テンプレート・コンテキスト (Template Context)

`UniversalGenerator` から Nunjucks テンプレートに渡される変数は以下の通りです。

| 変数名 | 型 | 説明 |
| :--- | :--- | :--- |
| `prediction_success` | boolean | 入力形式の解析に成功したかどうか。 |
| `input_part` | string | `cin` 等による入力読み込み処理のコード断片（インデント済み）。 |
| `formal_arguments` | string | `solve` 関数の仮引数リスト（例：`long long N, vector<long long> A`）。 |
| `actual_arguments` | string | `solve` 関数を呼び出す際の実引数リスト。 |
| `return_type` | string | `solve` 関数の返り値の型（`int`, `bool`, `float`, `string`, `void`）。 |
| `mod` | number? | 問題文から抽出された MOD 値（存在する場合）。 |
| `yes_str` | string? | 問題文から抽出された YES 文字列（存在する場合）。 |
| `no_str` | string? | 問題文から抽出された NO 文字列（存在する場合）。 |
| `multiple_cases` | boolean | `T` 個のテストケースを回す必要があるかどうか。 |
| `multiple_columns` | boolean | 出力値が複数列（1行に複数の値）からなるかどうか。 |
| `multiple_rows` | boolean | 出力値が複数行からなるかどうか。 |
| `variable_array` | boolean | 返り値が可変長配列かどうか（サイズを出力する必要がある場合）。 |
| `query_cases` | boolean | クエリ形式の問題かどうか。 |
| `query_loop_var` | string? | クエリ回数を表す変数名（例：`Q`）。 |
| `tools.version` | string | `atcoder-gui` のバージョン。 |

## 生成ロジックの詳細 (UniversalGenerator)

### 入力処理のグループ化
`declare_group: true` かつ `input_separator` が定義されている場合、連続する同型の変数入力を一行にまとめます。
- 例 (C++): `cin >> N >> M;`

### 依存関係の解決
変数の宣言と入力は、AST の出現順序に従いますが、配列のサイズ（`indices`）として使用される変数が先に読み込まれていることを保証します。

### クエリ形式への対応
`query_cases: true` の場合、`VariableExtractor` によって抽出された変数のうち、クエリ回数（通常 `Q`）をループ境界として特定し、`query_loop_var` としてテンプレートに提供します。

## カスタマイズ機能 (Customization)

ユーザーは、デフォルトのテンプレートや設定を上書きすることができます。
- **場所**: `ConfigManager` が管理する設定ディレクトリ（通常 `~/.config/atcoder-gui/`）にファイルを配置します。
- **優先順位**:
    1. ユーザー設定ディレクトリの `cpp.njk`, `cpp.json5`
    2. 内蔵のデフォルトファイル
- **メリット**: 独自のライブラリ（マクロ、高速入出力等）をあらかじめテンプレートに含めたり、`int` を `__int128_t` に変更するなどの高度なカスタマイズが可能です。
