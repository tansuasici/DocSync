import { loadConfig } from 'c12'
import { configSchema, type DocSyncConfig } from './schema.js'

export async function loadDocSyncConfig(
  cwd: string = process.cwd(),
): Promise<DocSyncConfig> {
  const { config } = await loadConfig<DocSyncConfig>({
    name: 'docsync',
    cwd,
  })

  const result = configSchema.safeParse(config)

  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n')
    throw new Error(`Invalid docsync config:\n${errors}`)
  }

  return result.data
}
