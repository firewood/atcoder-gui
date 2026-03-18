# Specification: Generate input/output files for gen2 command

## Overview
Implement input and output file generation for the `gen2` command that matches the structure produced by `atcoder-tools` for the currently analyzed AtCoder problem.

## Functional Requirements
- Generate input and output files based on the sample data for the currently analyzed AtCoder problem in the root directory.
- Ensure file naming conventions match `atcoder-tools` defaults.

## Acceptance Criteria
- Running `gen2` generates `input_X.txt` and `output_X.txt` in the root directory where `X` is the sample case index.
- Generated files match the content of samples exactly.

## Out of Scope
- Support for all contest problems at once.
- Advanced file format customization beyond `atcoder-tools` standard.
