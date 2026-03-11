import type { Blockquote, RootContent } from 'mdast'
import type { AlertType } from '../transform/gfm-alerts.js'
import type { ResolvedPage } from '../core/source-resolver.js'

export interface NavConfigOutput {
  filename: string
  content: string
}

export interface TargetAdapter {
  name: string

  /** Transform a GFM alert blockquote to framework-specific node */
  transformAlert(type: AlertType, node: Blockquote): RootContent | null

  /** Generate navigation/sidebar config file */
  generateNavConfig(pages: ResolvedPage[]): NavConfigOutput | null

  /** Generate frontmatter fields for a page */
  generateFrontmatter(page: ResolvedPage): Record<string, unknown>

  /** Return import statements needed at top of MDX files */
  getImports?(): string[]
}
