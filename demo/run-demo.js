#!/usr/bin/env node
import { spawn, exec } from 'child_process'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'
import { promisify } from 'util'

const __dirname = dirname(fileURLToPath(import.meta.url))
const execAsync = promisify(exec)

// Kill any existing processes on our demo ports
async function killExistingProcesses(ports) {
  console.log('🔍 Checking for existing processes on demo ports...')

  for (const port of ports) {
    try {
      // Find processes using the port
      const { stdout } = await execAsync(`lsof -ti:${port}`)
      const pids = stdout
        .trim()
        .split('\n')
        .filter(pid => pid)

      if (pids.length > 0) {
        console.log(`   Found ${pids.length} process(es) on port ${port}, killing...`)
        for (const pid of pids) {
          try {
            await execAsync(`kill -9 ${pid}`)
            console.log(`   ✅ Killed process ${pid} on port ${port}`)
          } catch (error) {
            console.log(`   ⚠️  Could not kill process ${pid}: ${error.message}`)
          }
        }
      }
    } catch {
      // No processes found on this port, which is good
    }
  }

  // Wait a moment for processes to fully terminate
  await new Promise(resolve => setTimeout(resolve, 1000))
}

async function startDemo() {
  console.log('🚀 Starting Task Demo...\n')

  // Kill any existing processes on ports 3020 (server) and 3021 (vite)
  await killExistingProcesses([3020, 3021])

  // Start the WebSocket server
  console.log('📡 Starting WebSocket server on port 3020...')
  const server = spawn('node', ['server.js'], {
    cwd: __dirname,
    stdio: 'inherit',
    shell: true
  })

  // Wait a bit for server to start
  setTimeout(() => {
    console.log('\n🌐 Starting Vite dev server on port 3021...')
    const vite = spawn('npm', ['run', 'dev'], {
      cwd: __dirname,
      stdio: 'inherit',
      shell: true
    })

    console.log('\n✅ Task demo is running!')
    console.log(`   • WebSocket server: ws://localhost:3020`)
    console.log(`   • Web interface: http://localhost:3021`)
    console.log('\nPress Ctrl+C to stop all servers\n')

    // Handle cleanup
    const cleanup = () => {
      console.log('\n🛑 Shutting down demo...')
      server.kill()
      vite.kill()
      process.exit(0)
    }

    process.on('SIGINT', cleanup)
    process.on('SIGTERM', cleanup)
    
    vite.on('exit', cleanup)
    server.on('exit', cleanup)
  }, 1000)
}

// Start the demo
startDemo().catch(err => {
  console.error('Failed to start demo:', err)
  process.exit(1)
})