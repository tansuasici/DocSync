import type { Blockquote, RootContent } from 'mdast'
import type { AlertType } from '../transform/gfm-alerts.js'
import type { ResolvedPage } from '../core/source-resolver.js'
import type { NavConfig } from '../config/schema.js'

export interface NavConfigOutput {
  filename: string
  content: string
  /**
   * Set when the file comes from an explicit `nav` config entry. Explicit
   * entries are the source of truth: they are written as-is and never merged
   * with the file already on disk.
   */
  explicit?: boolean
}

export interface TargetAdapter {
  name: string

  /**
   * Replace links inside headings with their text. Needed when the framework
   * wraps headings in its own anchor, which would otherwise nest `<a>` in `<a>`.
   */
  unwrapHeadingLinks?: boolean

  /** Whether the adapter honors the `nav` config */
  supportsNav?: boolean

  /**
   * Parse an existing nav config file for merging. Defaults to `JSON.parse`.
   * Throwing means "can't merge safely" — the file is left untouched.
   */
  parseNavConfig?(content: string): Record<string, unknown>

  /**
   * Transform a GFM alert blockquote into the framework-specific callout.
   * Returns the replacement nodes that take the blockquote's place — the
   * alert's children are kept as real mdast nodes (not flattened to text)
   * so inline formatting, links, lists, and code survive. Return `null` to
   * leave the blockquote untouched.
   */
  transformAlert(type: AlertType, node: Blockquote): RootContent[] | null

  /** Generate navigation/sidebar config file */
  generateNavConfig(pages: ResolvedPage[]): NavConfigOutput | null

  /** Merge generated nav config with existing file content, preserving user customizations */
  mergeNavConfig?(existing: Record<string, unknown>, pages: ResolvedPage[]): NavConfigOutput

  /**
   * Generate per-directory nav configs (e.g. Fumadocs needs meta.json per
   * directory). `nav` holds the user's explicit per-directory overrides.
   */
  generatePerDirectoryNavConfig?(pages: ResolvedPage[], nav?: NavConfig): Map<string, NavConfigOutput>

  /**
   * Check a written per-directory nav config against what actually exists in
   * that directory on disk (page names without extension, plus subfolder
   * names). Returns human-readable warnings.
   */
  validateNavConfig?(output: NavConfigOutput, available: Set<string>): string[]

  /**
   * Merge a freshly generated per-directory nav config with the existing
   * file on disk, preserving user customizations (extra keys, custom title,
   * manual page ordering / separators). Only consulted when `clean: false`
   * and the file already exists.
   */
  mergePerDirectoryNavConfig?(
    existing: Record<string, unknown>,
    generated: NavConfigOutput,
  ): NavConfigOutput

  /** Generate frontmatter fields for a page */
  generateFrontmatter(page: ResolvedPage): Record<string, unknown>

  /** Return import statements needed at top of MDX files */
  getImports?(): string[]
}
