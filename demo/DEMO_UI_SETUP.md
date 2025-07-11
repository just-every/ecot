# Demo UI Setup

This demo automatically detects and uses the local `demo-ui` package if available, otherwise falls back to the npm package.

## How it works

1. **Automatic Detection**: When you run `npm install` or `npm run demo`, the setup script checks for `../../demo-ui`
2. **Local Development**: If found, it creates an npm link to use the local version
3. **Fallback**: If not found, it uses the published npm package `@just-every/demo-ui`

## Manual Setup

To manually switch between local and npm versions:

```bash
# Use local demo-ui (if available)
npm run setup-demo-ui

# Force npm package
npm unlink @just-every/demo-ui
npm install @just-every/demo-ui
```

## Benefits

- **No manual configuration needed** - It just works™
- **Hot reload** - Changes to local demo-ui are reflected immediately
- **Easy switching** - Can switch between local and npm versions anytime
- **Team friendly** - Works for developers with or without local demo-ui

## File Structure

```
just-every/
├── task/
│   └── demo/
│       ├── setup-demo-ui.js    # Setup script
│       └── package.json        # Includes postinstall hook
└── demo-ui/                    # Local demo-ui package (if exists)
```