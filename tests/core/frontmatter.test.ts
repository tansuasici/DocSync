import { describe, it, expect } from 'vitest'
import { extractFrontmatter } from '../../src/transform/frontmatter.js'
import type { ResolvedPage } from '../../src/core/source-resolver.js'

function makePage(overrides: Partial<ResolvedPage> = {}): ResolvedPage {
  return {
    filePath: '/test/README.md',
    relativePath: 'README.md',
    slug: 'index',
    order: 0,
    ...overrides,
  }
}

describe('extractFrontmatter', () => {
  it('extracts title from first H1', () => {
    const result = extractFrontmatter('# Hello World\n\nSome content.', makePage())
    expect(result.title).toBe('Hello World')
  })

  it('extracts description from first paragraph after H1', () => {
    const result = extractFrontmatter(
      '# Title\n\nThis is the description.\n\n## Next Section',
      makePage(),
    )
    expect(result.description).toBe('This is the description.')
  })

  it('uses config title override', () => {
    const result = extractFrontmatter(
      '# Markdown Title',
      makePage({ title: 'Config Title' }),
    )
    expect(result.title).toBe('Config Title')
  })

  it('removes H1 from content', () => {
    const result = extractFrontmatter('# Title\n\nContent here.', makePage())
    expect(result.contentWithoutH1).not.toContain('# Title')
    expect(result.contentWithoutH1).toContain('Content here.')
  })

  it('falls back to slug-based title', () => {
    const result = extractFrontmatter(
      'No heading here, just text.',
      makePage({ slug: 'getting-started' }),
    )
    expect(result.title).toBe('Getting Started')
  })

  it('falls back to "Introduction" for index slug', () => {
    const result = extractFrontmatter(
      'No heading here.',
      makePage({ slug: 'index' }),
    )
    expect(result.title).toBe('Introduction')
  })
})
