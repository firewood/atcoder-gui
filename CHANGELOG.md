# Changelog

## [1.1.9] - 2026-08-30

### Fixed

- Generate 0-based array accesses for literal subscripts (`P_{i,1} P_{i,2} P_{i,3}`), which used to index past the end of the allocated row.
- Type a multi-line, multi-value answer as `std::vector<std::vector<int64_t>>` instead of `std::vector<pair<int64_t, int64_t>>`, which only fitted output exactly two values wide.

## [1.1.8] - 2026-08-23

### Added

- Generate a skeleton solution when input format prediction fails, instead of failing outright.
- Install `acl-cpp-python` when initializing a Python workspace.

### Changed

- Prioritize `allowedCommands` over built-in commands.

### Fixed

- Fold literal alphabetic subscripts (`P_x`, `Q_y`) into the variable name instead of treating them as array indices.
- Scope loop variables when folding subscripts, and fold loop bounds consistently.
- Parse non-braced subscripts as a single atom.
- Harden error handling in code generation.

## [1.1.7] - 2026-05-08

### Added

- Auto-initialize a uv project in `setup-vscode` for Python workspaces.
- Open the source file, not just the directory, when entering a problem directory.

### Changed

- Replace `conf` with `FileStore`, preserving comments in `config.json5`.

## [1.1.6] - 2026-04-29

### Added

- Support 2-character problem navigation (aa-bz).

## [1.1.5] - 2026-04-29

### Added

- Added `2d_outer_only` configuration option.
