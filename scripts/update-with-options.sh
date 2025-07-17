#!/bin/bash

# Advanced update script with options for different update scenarios

set -e  # Exit on error

# Default values
UPDATE_ROOT=true
UPDATE_DEMO=true
UPDATE_TYPE="update"  # Can be "update", "install", or "ci"

# Parse command line arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --root-only)
            UPDATE_DEMO=false
            shift
            ;;
        --demo-only)
            UPDATE_ROOT=false
            shift
            ;;
        --install)
            UPDATE_TYPE="install"
            shift
            ;;
        --ci)
            UPDATE_TYPE="ci"
            shift
            ;;
        --help)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --root-only    Only update root dependencies"
            echo "  --demo-only    Only update demo dependencies"
            echo "  --install      Run npm install instead of npm update"
            echo "  --ci           Run npm ci for reproducible builds"
            echo "  --help         Show this help message"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Run '$0 --help' for usage information"
            exit 1
            ;;
    esac
done

echo "🔄 Updating dependencies for @just-every/task..."
echo "   Update type: $UPDATE_TYPE"
echo ""

# Function to run the appropriate npm command
run_npm_command() {
    local dir=$1
    case $UPDATE_TYPE in
        "update")
            npm update
            ;;
        "install")
            npm install
            ;;
        "ci")
            npm ci
            ;;
    esac
}

# Update root dependencies if requested
if [ "$UPDATE_ROOT" = true ]; then
    echo "📦 Updating root package dependencies..."
    run_npm_command "."
    echo "✅ Root dependencies updated"
fi

# Update demo dependencies if requested
if [ "$UPDATE_DEMO" = true ] && [ -d "demo" ]; then
    echo ""
    echo "📦 Updating demo dependencies..."
    cd demo
    run_npm_command "demo"
    cd ..
    echo "✅ Demo dependencies updated"
elif [ "$UPDATE_DEMO" = true ]; then
    echo "⚠️  Demo directory not found, skipping demo updates"
fi

echo ""
echo "🎉 All requested dependencies updated successfully!"
echo ""

# Show next steps based on what was updated
if [ "$UPDATE_ROOT" = true ]; then
    echo "💡 Next steps:"
    echo "   - Run 'npm run build' to rebuild the project"
    echo "   - Run 'npm test' to ensure everything works"
fi

if [ "$UPDATE_DEMO" = true ] && [ -d "demo" ]; then
    echo "   - Run 'npm run demo' to test the demo"
fi