#!/usr/bin/env node

import { existsSync, readFileSync } from 'fs';
import { execSync } from 'child_process';
import { resolve, dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const localDemoUiPath = resolve(__dirname, '../../demo-ui');
const currentPackageJson = resolve(__dirname, 'package.json');

// Check if local demo-ui exists
if (existsSync(localDemoUiPath)) {
  console.log('📦 Found local demo-ui at:', localDemoUiPath);
  console.log('🔗 Linking to local demo-ui package...');
  
  try {
    // Check if package.json exists
    const packageJsonPath = join(localDemoUiPath, 'package.json');
    if (!existsSync(packageJsonPath)) {
      console.log('⚠️  No package.json found in local demo-ui, using npm package');
      throw new Error('No package.json in local demo-ui');
    }
    
    // Check if demo-ui has a build script
    const demoUiPackage = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
    
    // Ensure npm dependencies are installed in demo-ui
    const taskPackagePath = join(localDemoUiPath, 'node_modules', '@just-every', 'task');
    if (!existsSync(join(localDemoUiPath, 'node_modules')) || !existsSync(taskPackagePath)) {
      console.log('📦 Installing demo-ui dependencies...');
      execSync('npm install', { cwd: localDemoUiPath, stdio: 'inherit' });
    }
    
    // Build if build script exists
    if (demoUiPackage.scripts && demoUiPackage.scripts.build) {
      console.log('🏗️  Building local demo-ui...');
      execSync('npm run build', { cwd: localDemoUiPath, stdio: 'inherit' });
      console.log('✅ Local demo-ui built successfully');
    }
    
    // First, remove the npm package if installed
    try {
      execSync('npm uninstall @just-every/demo-ui', { cwd: __dirname, stdio: 'inherit' });
    } catch (e) {
      // Ignore if not installed
    }
    
    // Link using npm link with relative path
    execSync(`npm link ${localDemoUiPath}`, { cwd: __dirname, stdio: 'inherit' });
    
    console.log('✅ Successfully linked to local demo-ui');
    console.log('💡 Any changes to the local demo-ui will be reflected immediately');
  } catch (error) {
    console.error('❌ Error linking local demo-ui:', error.message);
    console.log('⚠️  Falling back to npm package...');
    execSync('npm install @just-every/demo-ui', { cwd: __dirname, stdio: 'inherit' });
  }
} else {
  console.log('📦 Local demo-ui not found at:', localDemoUiPath);
  console.log('📥 Using npm package @just-every/demo-ui');
  
  // Make sure the npm package is installed
  try {
    execSync('npm list @just-every/demo-ui', { cwd: __dirname, stdio: 'ignore' });
    console.log('✅ @just-every/demo-ui is already installed');
  } catch {
    console.log('📥 Installing @just-every/demo-ui from npm...');
    execSync('npm install @just-every/demo-ui', { cwd: __dirname, stdio: 'inherit' });
  }
}