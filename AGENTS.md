# AGENTS.md - MiniMax Usage Monitor VS Code Extension

This is a VS Code extension that monitors MiniMax API usage and displays it in the status bar.

## Build & Lint Commands

| Command | Description |
|---------|-------------|
| `npm run compile` | Type-check and compile TypeScript to `dist/` |
| `npm run package` | Full build: compile + esbuild bundle with minification |
| `npm run lint` | Run ESLint on `src/` TypeScript files |
| `npm run watch` | Watch mode for development |

- Always run `npm run lint` after making changes.
- No test framework is configured. There are no tests in this project.
- The extension entry point is `dist/extension.js`, bundled by esbuild.

## Project Structure

- `src/extension.ts` - The single source file containing all extension logic
- `dist/` - Compiled/bundled output (do not edit manually)
- `package.json` - Extension manifest with commands, configuration schema
- `tsconfig.json` - TypeScript configuration (strict mode enabled)

## Code Style

### TypeScript
- Strict mode is enabled (`"strict": true` in tsconfig).
- Use explicit types for function parameters and return values.
- Use `interface` for object shapes (see `ModelRemains`, `ApiResponse`).
- Use `as` type assertions only for JSON responses, not for other casts.
- Prefer `const` over `let`; avoid `var`.

### Imports
- Import vscode API as: `import * as vscode from 'vscode';`
- No other external runtime dependencies — only `vscode` and Node built-ins.

### Naming
- Interfaces: PascalCase (`ModelRemains`, `ApiResponse`)
- Functions: camelCase (`updateUsageInfo`, `startTimer`)
- Variables: camelCase (`statusBarItem`, `refreshTimer`)
- Configuration keys: camelCase with namespace prefix (`minimaxUsage.apiKey`)

### Error Handling
- Wrap API calls in try/catch blocks.
- Use `error instanceof Error ? error.message : String(error)` for error message extraction.
- Log errors to both `outputChannel` and `console.error`.
- Show user-facing errors via `vscode.window.showErrorMessage` when `showNotifications` is enabled.

### Formatting
- 2-space indentation.
- Use single quotes for strings.
- Trailing semicolons required.
- No trailing whitespace.

### VS Code Extension Patterns
- Register disposables via `context.subscriptions.push(...)`.
- Use `vscode.workspace.getConfiguration()` for reading settings.
- Use `vscode.StatusBarItem` for status bar UI.
- Use `vscode.OutputChannel` for debug/log output.
- Always clean up timers in `deactivate()` function.

### Comments
- Write comments only for complex logic. Keep them in Chinese to match existing codebase style.
- Do not add JSDoc or file-level comments.

## Key Configuration (package.json contributes)

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `minimaxUsage.apiKey` | string | `""` | MiniMax API key |
| `minimaxUsage.refreshInterval` | number | `30` | Refresh interval in seconds (10-3600) |
| `minimaxUsage.showNotifications` | boolean | `true` | Show error notifications |

## Common Tasks

- **Adding a new setting**: Update `contributes.configuration.properties` in `package.json`, then read it with `vscode.workspace.getConfiguration('minimaxUsage').get<type>('key')`.
- **Adding a new command**: Register in `contributes.commands` in `package.json`, then `vscode.commands.registerCommand()` in `activate()`.
- **Modifying the status bar**: Edit `updateUsageInfo()` function.
