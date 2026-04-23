# AtCoder GUI

A browser automation tool for AtCoder with a CLI interface designed to streamline competitive programming workflows.

## Features

- **Browser Automation**: Launch a browser with UI using Playwright
- **Problem Interaction**: Seamlessly navigate to problem directories and interact with them
- **Code Generation**: The `gen` command extracts information from the current page to generate problem templates, support test case fetching, and manage contest structures.
- **Workflow Automation**: Build, test, and submit solutions directly from your terminal.
- **Configurable Commands**: Define allowed system commands in `config.json5` for direct execution.
- **Session Management**: Persistent browser sessions with cookie exporting capabilities.

## Usage

### Interactive CLI

Start the interactive command prompt:

```bash
pnpm run start
```

### Key Commands

- `gen <contest-id>`: Generate a problem directory and template from the current page or a given contest ID.
- `submit <filename>`: Submit your solution to the current problem.
- `test`: Run test cases for the current problem.
- `build`: Build the source code.
- `open <URL>`: Open a specific URL in the browser.
- `cd <directory>`: Change the current directory and automatically detect problem metadata.
- `config`: Display the current configuration.

### Customizing Commands

You can define custom shell commands that are allowed to be executed directly from the CLI by adding them to the `allowedCommands` array in `config.json5`:

```json5
allowedCommands: ["cp", "copy", "del", "dir", "ls", "make", "pwd", "rm", "code"],
```

## Technology Stack

- **Node.js**
- **TypeScript**
- **Playwright**
- **Vitest**
- **ESLint**
