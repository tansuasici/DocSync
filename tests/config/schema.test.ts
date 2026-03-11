import { describe, it, expect } from 'vitest'
import { configSchema } from '../../src/config/schema.js'

describe('configSchema', () => {
  it('validates a minimal valid config', () => {
    const result = configSchema.safeParse({
      sources: [{ path: 'README.md' }],
      target: 'fumadocs',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.outDir).toBe('.docsync')
      expect(result.data.baseUrl).toBe('/docs')
      expect(result.data.clean).toBe(true)
    }
  })

  it('validates a full config', () => {
    const result = configSchema.safeParse({
      sources: [
        { path: 'README.md', slug: 'index', title: 'Home', order: 0 },
        { path: 'docs/**/*.md' },
      ],
      target: 'fumadocs',
      outDir: '.output',
      github: { repo: 'user/repo', branch: 'develop' },
      baseUrl: '/documentation',
      clean: false,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.outDir).toBe('.output')
      expect(result.data.github?.branch).toBe('develop')
    }
  })

  it('rejects empty sources', () => {
    const result = configSchema.safeParse({
      sources: [],
      target: 'fumadocs',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid target', () => {
    const result = configSchema.safeParse({
      sources: [{ path: 'README.md' }],
      target: 'unknown',
    })
    expect(result.success).toBe(false)
  })

  it('applies defaults for optional fields', () => {
    const result = configSchema.safeParse({
      sources: [{ path: 'docs/**/*.md' }],
      target: 'fumadocs',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.outDir).toBe('.docsync')
      expect(result.data.baseUrl).toBe('/docs')
      expect(result.data.clean).toBe(true)
      expect(result.data.github).toBeUndefined()
    }
  })
})
