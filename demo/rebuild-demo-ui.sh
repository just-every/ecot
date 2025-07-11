#\!/bin/bash

# Rebuild the local demo-ui package
echo "🏗️  Rebuilding demo-ui..."

# Navigate to demo-ui directory
cd ../../demo-ui

# Build the package
npm run build

# Navigate back
cd -

echo "✅ Demo-ui rebuilt successfully!"
echo "🔄 You may need to restart your dev server for changes to take effect"
