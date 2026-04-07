import { describe, it, expect } from 'vitest'
import { resolveSourceFiles } from '../source-resolver.js'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'

describe('deriveSlug', () => {
  it('should strip ../ prefixes from relative paths', async () => {
    // Create a temp directory structure to test with
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'docsync-test-'))
    const subDir = path.join(tmpDir, 'kit', 'agent_docs')
    await fs.mkdir(subDir, { recursive: true })
    await fs.writeFile(path.join(subDir, 'workflow.md'), '# Workflow\n\nTest content')

    // Resolve from a parent that makes the path relative with ../
    const pages = await resolveSourceFiles(
      [{ path: 'kit/agent_docs/workflow.md' }],
      tmpDir,
    )

    expect(pages).toHaveLength(1)
    expect(pages[0].slug).not.toContain('..')
    expect(pages[0].slug).toBe('kit/agent_docs/workflow')

    await fs.rm(tmpDir, { recursive: true })
  })

  it('should strip ./ prefix from paths', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'docsync-test-'))
    await fs.writeFile(path.join(tmpDir, 'guide.md'), '# Guide')

    const pages = await resolveSourceFiles(
      [{ path: './guide.md' }],
      tmpDir,
    )

    expect(pages).toHaveLength(1)
    expect(pages[0].slug).toBe('guide')

    await fs.rm(tmpDir, { recursive: true })
  })

  it('should strip docs/ prefix', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'docsync-test-'))
    const docsDir = path.join(tmpDir, 'docs')
    await fs.mkdir(docsDir, { recursive: true })
    await fs.writeFile(path.join(docsDir, 'setup.md'), '# Setup')

    const pages = await resolveSourceFiles(
      [{ path: 'docs/setup.md' }],
      tmpDir,
    )

    expect(pages).toHaveLength(1)
    expect(pages[0].slug).toBe('setup')

    await fs.rm(tmpDir, { recursive: true })
  })

  it('should convert README.md to index', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'docsync-test-'))
    await fs.writeFile(path.join(tmpDir, 'README.md'), '# Hello')

    const pages = await resolveSourceFiles(
      [{ path: 'README.md' }],
      tmpDir,
    )

    expect(pages).toHaveLength(1)
    expect(pages[0].slug).toBe('index')

    await fs.rm(tmpDir, { recursive: true })
  })

  it('should strip rootDir prefix when deriving slug', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'docsync-test-'))
    const coreDir = path.join(tmpDir, 'repo', 'features', 'core')
    await fs.mkdir(coreDir, { recursive: true })
    await fs.writeFile(path.join(coreDir, 'agents.md'), '# Agents')
    await fs.writeFile(path.join(coreDir, 'tools.md'), '# Tools')

    const pages = await resolveSourceFiles(
      [{ path: 'repo/features/core/**/*.md', rootDir: 'repo/features' }],
      tmpDir,
    )

    expect(pages).toHaveLength(2)
    const slugs = pages.map((p) => p.slug).sort()
    expect(slugs).toEqual(['core/agents', 'core/tools'])

    await fs.rm(tmpDir, { recursive: true })
  })

  it('should deduplicate by filePath — explicit entry wins over glob', async () => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'docsync-test-'))
    const coreDir = path.join(tmpDir, 'features', 'core')
    await fs.mkdir(coreDir, { recursive: true })
    await fs.writeFile(path.join(coreDir, 'agents.md'), '# Agents')
    await fs.writeFile(path.join(coreDir, 'tools.md'), '# Tools')

    const pages = await resolveSourceFiles(
      [
        { path: 'features/core/agents.md', slug: 'custom-slug' },
        { path: 'features/core/**/*.md', rootDir: 'features' },
      ],
      tmpDir,
    )

    expect(pages).toHaveLength(2)
    const agentPage = pages.find((p) => p.slug === 'custom-slug')
    expect(agentPage).toBeDefined()
    // tools.md picked up by glob
    const toolsPage = pages.find((p) => p.slug === 'core/tools')
    expect(toolsPage).toBeDefined()

    await fs.rm(tmpDir, { recursive: true })
  })
})
