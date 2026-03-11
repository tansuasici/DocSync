import { defineConfig } from 'tsup'
import { readFileSync, writeFileSync, chmodSync } from 'node:fs'

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    cli: 'src/cli/index.ts',
  },
  format: ['esm'],
  dts: { entry: 'src/index.ts' },
  clean: true,
  splitting: true,
  sourcemap: true,
  shims: true,
  async onSuccess() {
    // Add shebang only to CLI entry
    const cliPath = 'dist/cli.js'
    const content = readFileSync(cliPath, 'utf-8')
    if (!content.startsWith('#!')) {
      writeFileSync(cliPath, `#!/usr/bin/env node\n${content}`)
    }
    chmodSync(cliPath, 0o755)
  },
})
