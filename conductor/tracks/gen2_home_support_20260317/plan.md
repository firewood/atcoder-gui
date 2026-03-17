# Plan: Home Directory (~) Support for `gen2` Command

## Phase 1: Preparation
- [ ] Task: Research how `src/gen2.ts` uses `workspaceDir` and identify the optimal injection point for `expandHomeDir`.
- [ ] Task: Examine `src/tests/gen2.test.ts` to understand how `ConfigManager` and `workspaceDir` are currently tested/mocked.
- [ ] Task: Conductor - User Manual Verification 'Phase 1: Preparation' (Protocol in workflow.md)

## Phase 2: Core Utility Integration (TDD)
- [ ] Task: Add new test cases to `src/tests/gen2.test.ts` that specifically use a `workspaceDir` starting with `~`.
- [ ] Task: Verify that the new tests fail (Red Phase).
- [ ] Task: Update `src/gen2.ts` to wrap `workspaceDir` with `expandHomeDir`.
- [ ] Task: Verify that the new tests pass (Green Phase).
- [ ] Task: Conductor - User Manual Verification 'Phase 2: Core Utility Integration (TDD)' (Protocol in workflow.md)

## Phase 3: Integration and Final Verification
- [ ] Task: Verify that both C++ and Python code generation correctly handle the expanded `workspaceDir`.
- [ ] Task: Run the complete test suite to ensure no side effects or regressions in other areas.
- [ ] Task: Conductor - User Manual Verification 'Phase 3: Integration and Final Testing' (Protocol in workflow.md)
