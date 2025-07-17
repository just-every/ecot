# Update Scripts Documentation

This directory contains scripts to help manage dependencies across the task project and its demo.

## Available Commands

### Basic Update Commands

- `npm run update` - Updates all dependencies in both root and demo directories
- `npm run update:all` - Same as above (alias)

### Targeted Update Commands

- `npm run update:root` - Updates only the root project dependencies
- `npm run update:demo` - Updates only the demo dependencies

### Installation Commands

- `npm run install:all` - Runs `npm install` in both root and demo directories
- `npm run ci:all` - Runs `npm ci` in both directories for reproducible builds

## Script Details

### update-all.sh
Simple script that runs `npm update` in both the root directory and the demo directory.

### update-with-options.sh
Advanced script with command-line options:
- `--root-only` - Only update root dependencies
- `--demo-only` - Only update demo dependencies  
- `--install` - Run npm install instead of npm update
- `--ci` - Run npm ci for reproducible builds
- `--help` - Show usage information

## Usage Examples

```bash
# Update everything
npm run update

# Update only root dependencies
npm run update:root

# Fresh install in both directories
npm run install:all

# Reproducible install for CI/CD
npm run ci:all
```