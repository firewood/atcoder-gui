# Specification: Template Return Type Definition

## Overview
Enhance the code generator to automatically determine the likely return type of the solution based on the problem statement and samples. This type will be exposed to the template as a variable named `return_type`.

## Functional Requirements

### 1. Return Type Detection Logic
The system shall analyze the problem statement (HTML) and sample outputs to determine `return_type`. The logic follows this priority:

1.  **Modulo Arithmetic:**
    -   If the problem statement mentions `998244353` or `1000000007` in the context of modulo operations:
        -   `return_type` = `atcoder::modint998244353` or `atcoder::modint1000000007`.
    -   If "modulo" is mentioned but no specific constant (or variable modulo):
        -   `return_type` = `atcoder::modint` (dynamic).

2.  **String Output:**
    -   If the problem is detected as a Yes/No problem (via existing `yesStr`/`noStr` logic):
        -   `return_type` = `string`.

3.  **Vector/List Output:**
    -   If sample outputs contain multiple numbers (separated by space or newline):
        -   `return_type` = `std::vector<long long>`.

4.  **Integer Output (Default):**
    -   Otherwise:
        -   `return_type` = `long long`.

### 2. Template Context Update
-   Update `TemplateContext` interface in `src/generator/types.ts` to include `return_type: string`.
-   Pass this variable to the Nunjucks template engine.

### 3. Scope
-   **Language:** C++ templates only (initially).
-   **Configuration:** No new user configuration required; purely heuristic.

## Non-Functional Requirements
-   The detection should be robust enough to handle common AtCoder problem formats.
-   Performance impact on generation should be negligible.

## Acceptance Criteria
-   `return_type` is correctly populated in `TemplateContext`.
-   Modint problems correctly identify `atcoder::modint998244353` / `1000000007`.
-   Yes/No problems identify `string`.
-   Sequence output problems identify `std::vector<long long>`.
-   Standard integer problems identify `long long`.
