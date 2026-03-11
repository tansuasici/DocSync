import { defineCommand } from 'citty'
import { loadDocSyncConfig } from '../../config/loader.js'
import { buildPipeline } from '../../core/pipeline.js'

export const buildCommand = defineCommand({
  meta: {
    name: 'build',
    description: 'Transform markdown sources into docs-framework output.',
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

    console.log('[docsync] Loading config...')

    let config
    try {
      config = await loadDocSyncConfig(cwd)
    } catch (err) {
      console.error(
        `[docsync] ${err instanceof Error ? err.message : String(err)}`,
      )
      process.exit(1)
    }

    console.log(`[docsync] Target: ${config.target}`)
    console.log(`[docsync] Output: ${config.outDir}`)

    const result = await buildPipeline(config, cwd)

    // Report results
    for (const page of result.pages) {
      console.log(`  ✓ ${page.slug}.mdx`)
    }

    for (const error of result.errors) {
      console.error(`  ✗ ${error.file}: ${error.error}`)
    }

    console.log(
      `\n[docsync] Done! ${result.pages.length} files written to ${config.outDir}/`,
    )

    if (result.errors.length > 0) {
      console.error(`[docsync] ${result.errors.length} error(s) occurred.`)
      process.exit(1)
    }
  },
})
