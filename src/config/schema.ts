import { z } from 'zod'

const sourceEntrySchema = z.object({
  /** File path or glob pattern (repo-relative) */
  path: z.string(),
  /** Override slug (for explicit entries only) */
  slug: z.string().optional(),
  /** Override page title */
  title: z.string().optional(),
  /** Override page description */
  description: z.string().optional(),
  /** Sidebar position (lower = higher) */
  order: z.number().optional(),
  /** Directory prefix to strip when deriving slugs from glob matches */
  rootDir: z.string().optional(),
})

/**
 * One directory's navigation, written to its `meta.json` (Fumadocs).
 * `pages` is passed through verbatim, so Fumadocs syntax works as-is:
 * `---Section---` separators, `...` (rest), `...folder`, `!page`, and
 * `[Text](url)` links. Extra keys (`icon`, `defaultOpen`, …) pass through too.
 */
const navEntrySchema = z.looseObject({
  /** Sidebar title of the directory (root: the docs title) */
  title: z.string().optional(),
  /** Exact page order. Omit to keep the generated order. */
  pages: z.array(z.string()).optional(),
})

export const configSchema = z.object({
  /** Source files to include */
  sources: z.array(sourceEntrySchema).min(1),
  /** Target docs framework */
  target: z.enum(['fumadocs', 'docusaurus', 'nextra', 'starlight']),
  /** Output directory for generated files */
  outDir: z.string().default('.docsync'),
  /** GitHub repository info for external link rewriting */
  github: z
    .object({
      repo: z.string(),
      branch: z.string().default('main'),
      /** Path to the GitHub repo root, relative to cwd (default: '.') */
      rootDir: z.string().default('.'),
    })
    .optional(),
  /** Base URL path for docs */
  baseUrl: z.string().default('/docs'),
  /** Clean output directory before build */
  clean: z.boolean().default(true),
  /**
   * Explicit navigation per output directory — key `''` is the root,
   * `'agents'` is `agents/meta.json`. Fumadocs target only.
   */
  nav: z.record(z.string(), navEntrySchema).optional(),
})

export type DocSyncConfig = z.infer<typeof configSchema>
export type SourceEntry = z.infer<typeof sourceEntrySchema>
export type NavEntry = z.infer<typeof navEntrySchema>
export type NavConfig = Record<string, NavEntry>
