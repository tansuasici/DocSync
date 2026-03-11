import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { resolveSourceFiles } from '../../src/core/source-resolver.js'

const FIXTURES_DIR = path.resolve(import.meta.dirname, '../fixtures/basic')

describe('resolveSourceFiles', () => {
  it('resolves explicit file paths', async () => {
    const pages = await resolveSourceFiles(
      [{ path: 'README.md' }],
      FIXTURES_DIR,
    )
    expect(pages).toHaveLength(1)
    expect(pages[0].slug).toBe('index')
    expect(pages[0].relativePath).toBe('README.md')
  })

  it('resolves glob patterns', async () => {
    const pages = await resolveSourceFiles(
      [{ path: 'docs/**/*.md' }],
      FIXTURES_DIR,
    )
    expect(pages.length).toBeGreaterThanOrEqual(2)
    expect(pages.some((p) => p.slug === 'api')).toBe(true)
    expect(pages.some((p) => p.slug === 'getting-started')).toBe(true)
  })

  it('applies config overrides', async () => {
    const pages = await resolveSourceFiles(
      [{ path: 'README.md', slug: 'home', title: 'My Home' }],
      FIXTURES_DIR,
    )
    expect(pages[0].slug).toBe('home')
    expect(pages[0].title).toBe('My Home')
  })

  it('deduplicates by slug', async () => {
    const pages = await resolveSourceFiles(
      [
        { path: 'README.md', slug: 'index' },
        { path: 'README.md', slug: 'index' },
      ],
      FIXTURES_DIR,
    )
    expect(pages).toHaveLength(1)
  })

  it('sorts by order', async () => {
    const pages = await resolveSourceFiles(
      [
        { path: 'docs/api.md', order: 2 },
        { path: 'README.md', slug: 'index', order: 0 },
        { path: 'docs/getting-started.md', order: 1 },
      ],
      FIXTURES_DIR,
    )
    expect(pages[0].slug).toBe('index')
    expect(pages[1].slug).toBe('getting-started')
    expect(pages[2].slug).toBe('api')
  })

  it('warns on no matches', async () => {
    const pages = await resolveSourceFiles(
      [{ path: 'nonexistent/**/*.md' }],
      FIXTURES_DIR,
    )
    expect(pages).toHaveLength(0)
  })
})
