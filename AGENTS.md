# Project Overview
This project, "Task", is a TypeScript-based framework for creating and managing sophisticated AI task loops. It emphasizes features like chain-of-thought processing, meta-cognition, and dynamic model rotation to build robust and intelligent agent systems.

## Core Modules & Files
- `index.ts`: Main entry point for the library.
- `src/core/engine.ts`: The core task execution engine.
- `src/state/state.ts`: Manages the state of the tasks.
- `src/types/task-state.ts`: Defines the core data structures for task state.
- `examples/`: Contains various examples of how to use the library.
- `test/`: Unit and integration tests.

## `project_map.json`
- `project_map.json`: A detailed, machine-readable overview of the project, including key files, languages, and build commands. It's used by AI agents to quickly understand the project structure.

## Common Bash Commands
```bash
# Install dependencies
npm install

# Run tests
npm test

# Build the project
npm run build

# Run a simple example
npm run example:simple
```

## Code Style Guidelines
- Uses Prettier for automated formatting (though not explicitly configured in `package.json`).
- Adheres to standard TypeScript best practices.
- Type checking is enforced via `tsc --noEmit`.

## Testing Instructions
- Tests are written using Vitest.
- Run all tests with `npm test`.
- Add new tests to the `test/` directory.

## Repository Etiquette
- The project uses Conventional Commits, but this is not strictly enforced.
- Pull Requests are the preferred method for submitting changes.

## Developer Environment Setup
- Requires Node.js v18+ and npm v8+.
- Install dependencies with `npm install`.
- Copy `.env.example` to `.env` and add any necessary environment variables.

## Project-Specific Warnings
- Be aware of the peer dependencies (`anthropic`, `openai`) which are optional and may be required for certain functionalities.
