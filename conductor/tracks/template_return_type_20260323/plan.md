# Implementation Plan: Template Return Type Definition

## Phase 1: Output Analysis Logic (TDD)
- [x] Task: Create `src/generator/output-analyzer.test.ts` defining test cases for:
    - [x] Modulo 998244353 detection.
    - [x] Modulo 1000000007 detection.
    - [x] Dynamic Modulo detection.
    - [x] Yes/No string detection.
    - [x] Vector/List detection.
    - [x] Default integer fallback.
- [x] Task: Create `src/generator/output-analyzer.ts` and implement `OutputAnalyzer` class to pass tests.
    - [x] Implement `analyze(html: string, samples: string[], yesStr?: string): string`.
    - [x] Implement modulo regex logic.
    - [x] Implement sample analysis logic.
- [x] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md) [checkpoint: 80bddcf].

## Phase 2: Integration
- [ ] Task: Update `src/generator/types.ts`.
    - [ ] Add `return_type` to `TemplateContext`.
- [ ] Task: Update `src/generator/pipeline.ts`.
    - [ ] Import and instantiate `OutputAnalyzer`.
    - [ ] Call `analyze` in `generateParseResult`.
    - [ ] Pass `return_type` to the template context.
- [ ] Task: Verify integration with existing tests (ensure no regression).
- [ ] Task: Conductor - User Manual Verification 'Integration' (Protocol in workflow.md).
