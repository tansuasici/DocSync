import fs from 'node:fs/promises'
import path from 'node:path'
import { defineCommand } from 'citty'

const CONFIG_TEMPLATE = `import { defineConfig } from '@tansuasici/docsync'

export default defineConfig({
  sources: [
    { path: 'README.md', slug: 'index', title: 'Introduction' },
    { path: 'docs/**/*.md' },
  ],
  target: 'fumadocs',
  outDir: '.docsync',
  // github: { repo: 'user/repo' },
})
`

export const initCommand = defineCommand({
  meta: {
    name: 'init',
    description: 'Initialize a docsync config file.',
  },
  args: {
    cwd: {
      type: 'string',
      description: 'Working directory',
      default: '.',
    },
  },
  async run({ args }) {
    const cwd = args.cwd === '.' ? process.cwd() : args.cwd
    const configPath = path.join(cwd, 'docsync.config.ts')

    // Check if config already exists
    try {
      await fs.access(configPath)
      console.log('[docsync] Config file already exists: docsync.config.ts')
      return
    } catch {
      // File doesn't exist — good
    }

    await fs.writeFile(configPath, CONFIG_TEMPLATE, 'utf-8')
    console.log('[docsync] Created docsync.config.ts')

    // Add .docsync/ to .gitignore if it exists
    const gitignorePath = path.join(cwd, '.gitignore')
    try {
      const gitignore = await fs.readFile(gitignorePath, 'utf-8')
      if (!gitignore.includes('.docsync')) {
        await fs.appendFile(gitignorePath, '\n.docsync/\n')
        console.log('[docsync] Added .docsync/ to .gitignore')
      }
    } catch {
      // No .gitignore — skip
    }

    console.log('\nNext steps:')
    console.log('  1. Edit docsync.config.ts to configure your sources')
    console.log('  2. Run: npx docsync build')
  },
})
