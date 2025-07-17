#!/bin/bash

# Script to update dependencies in both root and demo directories

set -e  # Exit on error

echo "🔄 Updating dependencies for @just-every/task..."
echo ""

# Update root dependencies
echo "📦 Updating root package dependencies..."
npm update

# Check if demo directory exists
if [ -d "demo" ]; then
    echo ""
    echo "📦 Updating demo dependencies..."
    cd demo
    npm update
    cd ..
    echo "✅ Demo dependencies updated"
else
    echo "⚠️  Demo directory not found, skipping demo updates"
fi

echo ""
echo "🎉 All dependencies updated successfully!"
echo ""
echo "💡 Tip: Run 'npm run build' to rebuild the project"