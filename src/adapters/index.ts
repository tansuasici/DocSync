import type { TargetAdapter } from './types.js'
import { fumadocsAdapter } from './fumadocs.js'

const adapters: Record<string, TargetAdapter> = {
  fumadocs: fumadocsAdapter,
}

export function getAdapter(target: string): TargetAdapter {
  const adapter = adapters[target]
  if (!adapter) {
    throw new Error(
      `Unknown target "${target}". Available targets: ${Object.keys(adapters).join(', ')}`,
    )
  }
  return adapter
}

export type { TargetAdapter, NavConfigOutput } from './types.js'
