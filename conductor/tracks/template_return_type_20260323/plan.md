# Implementation Plan: Template Return Type Definition

## Phase 1: Output Analysis Logic (TDD)
- [ ] Task: Create `src/generator/output-analyzer.test.ts` defining test cases for:
    - [ ] Modulo 998244353 detection.
    - [ ] Modulo 1000000007 detection.
    - [ ] Dynamic Modulo detection.
    - [ ] Yes/No string detection.
    - [ ] Vector/List detection.
    - [ ] Default integer fallback.
- [ ] Task: Create `src/generator/output-analyzer.ts` and implement `OutputAnalyzer` class to pass tests.
    - [ ] Implement `analyze(html: string, samples: string[], yesStr?: string): string`.
    - [ ] Implement modulo regex logic.
    - [ ] Implement sample analysis logic.
- [ ] Task: Conductor - User Manual Verification 'Phase 1' (Protocol in workflow.md).

## Phase 2: Integration
- [ ] Task: Update `src/generator/types.ts`.
    - [ ] Add `return_type` to `TemplateContext`.
- [ ] Task: Update `src/generator/pipeline.ts`.
    - [ ] Import and instantiate `OutputAnalyzer`.
    - [ ] Call `analyze` in `generateParseResult`.
    - [ ] Pass `return_type` to the template context.
- [ ] Task: Verify integration with existing tests (ensure no regression).
- [ ] Task: Conductor - User Manual Verification 'Integration' (Protocol in workflow.md).
