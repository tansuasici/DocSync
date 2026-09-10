import type { ResolvedPage } from '../core/source-resolver.js'

export interface NavTreeEntry {
  /** Page or folder name within its directory */
  name: string
  /** The page itself, when the entry is a page rather than a folder */
  page?: ResolvedPage
}

/**
 * Group pages by output directory ('' = root). Each directory lists its pages
 * and subfolders, ordered by the lowest `order` found beneath them; ties keep
 * source registration order.
 *
 *   index, agents/index, agents/fundamentals/roles, guide
 *   → ''                   [index, agents, guide]
 *     'agents'             [index, fundamentals]
 *     'agents/fundamentals' [roles]
 */
export function groupByDirectory(pages: ResolvedPage[]): Map<string, NavTreeEntry[]> {
  const dirs = new Map<string, Map<string, { order: number; page?: ResolvedPage }>>()

  for (const page of pages) {
    const parts = page.slug.split('/')
    for (let depth = 0; depth < parts.length; depth++) {
      const dir = parts.slice(0, depth).join('/')
      const entries = dirs.get(dir) ?? new Map<string, { order: number; page?: ResolvedPage }>()
      dirs.set(dir, entries)

      const name = parts[depth]
      const entry = entries.get(name) ?? { order: page.order }
      entry.order = Math.min(entry.order, page.order)
      if (depth === parts.length - 1) entry.page = page
      entries.set(name, entry)
    }
  }

  const result = new Map<string, NavTreeEntry[]>()
  for (const [dir, entries] of dirs) {
    // Array sort is stable: ties keep first-seen order.
    const sorted = [...entries].sort((a, b) => a[1].order - b[1].order)
    result.set(dir, sorted.map(([name, { page }]) => ({ name, page })))
  }
  return result
}

/** Known acronyms that should be uppercased in directory titles */
const ACRONYMS = new Set(['llm', 'mcp', 'api', 'rag', 'cli', 'sdk', 'spi', 'bdi', 'fsm'])

export function formatDirectoryTitle(name: string): string {
  if (ACRONYMS.has(name.toLowerCase())) {
    return name.toUpperCase()
  }
  return name.charAt(0).toUpperCase() + name.slice(1)
}
