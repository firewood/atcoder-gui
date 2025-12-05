# AtCoder GUI

A browser automation tool for AtCoder with CLI interface built with Node.js, TypeScript, and Playwright.

## Features

- **Browser Automation**: Launch a browser with UI using Playwright
- **Session Management**: Persistent browser sessions with automatic restoration
- **CLI Commands**: Interactive command line interface
- **Configuration Management**: Persistent settings using the conf module
- **URL Opening**: Open URLs with the `open URL` command
- **Automatic Startup**: Opens default URL on application launch

## Project Structure

```
atcoder-gui/
├── src/
│   ├── main.ts      # CLI application entry point and command handling
│   ├── browser.ts   # Playwright browser management and automation
│   ├── config.ts    # Configuration management using conf module
│   ├── session.ts   # Session persistence and restoration
│   └── *.test.ts    # Test files
├── dist/            # Compiled JavaScript output
├── eslint.config.js # ESLint configuration
└── package.json     # Project configuration
```

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Install Playwright browsers:
   ```bash
   npx playwright install chromium
   ```
4. Build the project:
   ```bash
   pnpm run build
   ```

## Usage

### Interactive CLI

Start the interactive command prompt:

```bash
pnpm run start
```

This will start an interactive CLI with a command prompt where you can enter commands:

```
AtCoder GUI Interactive CLI
Type "help" for available commands or "exit" to quit
command> open https://atcoder.jp
command> config
command> help
command> exit
```

### Available Commands

- `open <URL>` - Open a URL in the browser
- `config` - Show current configuration
- `help` - Show available commands
- `exit` - Exit the application

### Configuration

Configuration is automatically managed using the `conf` module (similar to atcoder-cli). Settings are stored in the standard configuration directory for your operating system:

- **Windows**: `%APPDATA%\atcoder-gui\config.json`
- **macOS**: `~/Library/Preferences/atcoder-gui/config.json`
- **Linux**: `~/.config/atcoder-gui/config.json`

Default configuration values:

```typescript
{
  theme: 'light',
  autoStart: false,
  defaultUrl: 'https://atcoder.jp',
  windowSize: {
    width: 1200,
    height: 800
  },
  headless: false,
  devtools: true
}
```

You can modify settings programmatically through the configuration API, and they will be automatically persisted.

### Session Management

The application automatically saves and restores browser sessions, including:
- Cookies
- Local storage data
- Login states

Session data is stored separately from configuration and is automatically restored when the browser launches.

## Development

### Available Scripts

- `pnpm run build` - Compile TypeScript to JavaScript
- `pnpm run dev` - Watch mode compilation
- `pnpm run test` - Run tests in watch mode
- `pnpm run test:run` - Run tests once
- `pnpm run lint` - Run ESLint
- `pnpm run lint:fix` - Fix ESLint issues automatically
- `pnpm run start` - Run the compiled CLI application
- `pnpm run clean` - Remove compiled output

### Testing

Run tests with Vitest:

```bash
pnpm run test
```

### Code Quality

The project uses ESLint with TypeScript-specific rules for code quality:

```bash
pnpm run lint      # Check code quality
pnpm run lint:fix  # Auto-fix issues where possible
```

## Technology Stack

- **Node.js** - Runtime environment
- **TypeScript** - Programming language
- **Playwright** - Browser automation
- **Vitest** - Testing framework
- **ESLint** - Code linting
- **conf** - Configuration management library

## License

MIT
