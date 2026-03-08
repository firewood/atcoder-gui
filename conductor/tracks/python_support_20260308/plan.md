# Implementation Plan: Python Support for Code Generator

## Phase 1: Setup & Configuration
- [x] Task: Python 固有の設定ファイルの作成 (fcc3873)
    - [x] `src/generator/config/python.json5` を作成 (fcc3873)
- [ ] Task: Python Nunjucks テンプレートの作成
    - [ ] `src/generator/templates/python.njk` を作成
- [ ] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md)

## Phase 2: Core Implementation
- [ ] Task: `PythonGenerator` クラスの実装
    - [ ] `CPlusPlusGenerator` をベースに `src/generator/python.ts` を作成
- [ ] Task: `PythonGenerator` のユニットテストの実装
    - [ ] `src/generator/python.test.ts` を作成
    - [ ] 様々な入力形式に対して Python コードが正しく生成されることを確認
- [ ] Task: Conductor - User Manual Verification 'Phase 2' (Protocol in workflow.md)

## Phase 3: Integration
- [ ] Task: 言語選択をサポートするための `gen2.ts` の更新
    - [ ] 要求に応じて `PythonGenerator` をインスタンス化するロジックを `gen2.ts` に追加
- [ ] Task: エンドツーエンドのフロー確認
    - [ ] サンプル問題で `gen2` を実行し、`main.py` が正しく生成されることを確認
- [ ] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)
