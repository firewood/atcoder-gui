# Plan: Home Directory (~) Support for `cd` Command

## Phase 1: Preparation [checkpoint: dbee898]
- [x] Task: Research existing `cd` command usage and path resolution patterns in `src/main.ts`. (818b786)
- [x] Task: Conductor - User Manual Verification 'Phase 1: Preparation' (Protocol in workflow.md) (dbee898)

## Phase 2: Core Utility Implementation (TDD) [checkpoint: 684f11b]
- [x] Task: Create or update `src/utils.test.ts` with tests for `expandHomeDir` utility function. (b4ec1db)
- [x] Task: Implement `expandHomeDir` in `src/utils.ts`. (5110118)
- [x] Task: Conductor - User Manual Verification 'Phase 2: Core Utility Implementation (TDD)' (Protocol in workflow.md) (684f11b)

## Phase 3: Integration into CLI
- [ ] Task: Update `src/main.ts` to use `expandHomeDir` for the `cd` command.
- [ ] Task: Add integration test for the `cd` command in `src/tests/scenario.test.ts` or similar.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Integration into CLI' (Protocol in workflow.md)
