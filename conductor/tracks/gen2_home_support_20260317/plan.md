# Plan: Home Directory (~) Support for `gen2` Command

## Phase 1: Preparation
- [x] Task: Research how `src/gen2.ts` uses `workspaceDir` and identify the optimal injection point for `expandHomeDir`. (818b786)
- [x] Task: Examine `src/tests/gen2.test.ts` to understand how `ConfigManager` and `workspaceDir` are currently tested/mocked. (dbee898)
- [~] Task: Conductor - User Manual Verification 'Phase 1: Preparation' (Protocol in workflow.md)

## Phase 2: Core Utility Integration (TDD)
- [x] Task: Add new test cases to `src/tests/gen2.test.ts` that specifically use a `workspaceDir` starting with `~`. (ad964ae)
- [x] Task: Verify that the new tests fail (Red Phase).
- [x] Task: Update `src/gen2.ts` to wrap `workspaceDir` with `expandHomeDir`. (e439ba7)
- [x] Task: Verify that the new tests pass (Green Phase).
- [x] Task: Conductor - User Manual Verification 'Phase 2: Core Utility Integration (TDD)' (Protocol in workflow.md) [checkpoint: 1628b51]

## Phase 3: Integration and Final Verification
- [x] Task: Verify that both C++ and Python code generation correctly handle the expanded `workspaceDir`. (734df54)
- [x] Task: Run the complete test suite to ensure no side effects or regressions in other areas.
- [x] Task: Conductor - User Manual Verification 'Phase 3: Integration and Final Testing' (Protocol in workflow.md) [checkpoint: 1eeb614]
