# Plan: Home Directory (~) Support for `cd` Command

## Phase 1: Preparation [checkpoint: dbee898]
- [x] Task: Research existing `cd` command usage and path resolution patterns in `src/main.ts`. (818b786)
- [x] Task: Conductor - User Manual Verification 'Phase 1: Preparation' (Protocol in workflow.md) (dbee898)

## Phase 2: Core Utility Implementation (TDD)
- [ ] Task: Create or update `src/utils.test.ts` with tests for `expandHomeDir` utility function.
    - Test case: `~` should expand to `os.homedir()`.
    - Test case: `~/path` should expand to `path.join(os.homedir(), 'path')`.
    - Test case: `path/~/other` should NOT be expanded (remain unchanged).
    - Test case: Absolute paths should remain unchanged.
- [ ] Task: Implement `expandHomeDir` in `src/utils.ts`.
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Core Utility Implementation (TDD)' (Protocol in workflow.md)

## Phase 3: Integration into CLI
- [ ] Task: Update `src/main.ts` to use `expandHomeDir` for the `cd` command.
- [ ] Task: Add integration test for the `cd` command in `src/tests/scenario.test.ts` or similar.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Integration into CLI' (Protocol in workflow.md)
