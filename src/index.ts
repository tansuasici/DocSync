import type { DocSyncConfig } from './config/schema.js'

export { configSchema } from './config/schema.js'
export type { DocSyncConfig, SourceEntry } from './config/schema.js'
export { loadDocSyncConfig } from './config/loader.js'
export { resolveSourceFiles } from './core/source-resolver.js'
export type { ResolvedPage } from './core/source-resolver.js'
export { buildPipeline } from './core/pipeline.js'

/**
 * Helper for type-safe config files.
 *
 * @example
 * ```ts
 * // docsync.config.ts
 * import { defineConfig } from 'docsync'
 *
 * export default defineConfig({
 *   sources: [{ path: 'README.md', slug: 'index' }],
 *   target: 'fumadocs',
 * })
 * ```
 */
export function defineConfig(config: DocSyncConfig): DocSyncConfig {
  return config
}
