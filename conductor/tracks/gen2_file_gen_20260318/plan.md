# Implementation Plan: Generate input/output files for gen2 command

## Phase 1: Research and Design
- [ ] Research `atcoder-tools` input/output file structure and naming conventions.
- [ ] Define the output directory and file pattern for `gen2` (root directory).
- [ ] Update `tech-stack.md` if new dependencies are needed for file I/O or directory handling.

## Phase 2: Implementation (TDD)
- [ ] Write failing test for generating input file for a single sample case in the root directory.
- [ ] Implement `InputFileGenerator` or update `gen2.ts` to write input files to the root.
- [ ] Write failing test for generating output file for a single sample case in the root directory.
- [ ] Implement `OutputFileGenerator` or update `gen2.ts` to write output files to the root.
- [ ] Integrate file generation into the `gen2` command execution pipeline.

## Phase 3: Verification
- [ ] Verify generated files match `atcoder-tools` format and are located in the root directory.
- [ ] Run full `gen2` pipeline to ensure no regressions.
- [ ] Task: Conductor - User Manual Verification 'Phase 3' (Protocol in workflow.md)
