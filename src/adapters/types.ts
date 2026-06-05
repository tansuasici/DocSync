import type { Blockquote, RootContent } from 'mdast'
import type { AlertType } from '../transform/gfm-alerts.js'
import type { ResolvedPage } from '../core/source-resolver.js'

export interface NavConfigOutput {
  filename: string
  content: string
}

export interface TargetAdapter {
  name: string

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

  /** Generate per-directory nav configs (e.g. Fumadocs needs meta.json per directory) */
  generatePerDirectoryNavConfig?(pages: ResolvedPage[]): Map<string, NavConfigOutput>

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
