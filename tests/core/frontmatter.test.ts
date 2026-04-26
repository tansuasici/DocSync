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

  it('removes H1 and description paragraph from content', () => {
    const result = extractFrontmatter('# Title\n\nFirst paragraph.\n\nSecond paragraph.', makePage())
    expect(result.contentWithoutH1).not.toContain('# Title')
    expect(result.contentWithoutH1).not.toContain('First paragraph.')
    expect(result.contentWithoutH1).toContain('Second paragraph.')
    expect(result.description).toBe('First paragraph.')
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

  describe('description: strip inline markdown', () => {
    it('strips inline link to plain text', () => {
      const result = extractFrontmatter(
        '# Title\n\nConnects with the [SCOP framework](https://scop-framework.netlify.app/) — a Java multi-agent framework.',
        makePage(),
      )
      expect(result.description).toBe(
        'Connects with the SCOP framework — a Java multi-agent framework.',
      )
    })

    it('strips bold, italic, and inline code', () => {
      const result = extractFrontmatter(
        '# Title\n\nUses **bold** and *italic* and `code` markers.',
        makePage(),
      )
      expect(result.description).toBe('Uses bold and italic and code markers.')
    })

    it('strips images and reference links', () => {
      const result = extractFrontmatter(
        '# Title\n\nSee ![logo](logo.png) and [docs][ref] for more.\n\n[ref]: /docs',
        makePage(),
      )
      expect(result.description).toBe('See logo and docs for more.')
    })

    it('strips stray inline HTML tags', () => {
      const result = extractFrontmatter(
        '# Title\n\nLine one<br>line two with <span>span</span>.',
        makePage(),
      )
      expect(result.description).toBe('Line oneline two with span.')
    })

    it('joins multi-line paragraphs into one description', () => {
      const result = extractFrontmatter(
        '# Title\n\nFirst sentence on line one.\nSecond sentence on line two.\nThird on three.\n\n## Next',
        makePage(),
      )
      expect(result.description).toBe(
        'First sentence on line one. Second sentence on line two. Third on three.',
      )
    })

    it('removes the multi-line description paragraph from body', () => {
      const result = extractFrontmatter(
        '# Title\n\nFirst line.\nSecond line.\n\n## Next\n\nBody.',
        makePage(),
      )
      expect(result.contentWithoutH1).not.toContain('First line.')
      expect(result.contentWithoutH1).not.toContain('Second line.')
      expect(result.contentWithoutH1).toContain('## Next')
    })

    it('respects explicit YAML frontmatter description (no override)', () => {
      const result = extractFrontmatter(
        '---\ndescription: Hand-written\n---\n\n# Title\n\nFirst paragraph with [link](url).',
        makePage({ description: 'Hand-written' }),
      )
      expect(result.description).toBe('Hand-written')
    })
  })
})
