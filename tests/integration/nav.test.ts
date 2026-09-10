import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { buildPipeline } from '../../src/core/pipeline.js'
import type { DocSyncConfig } from '../../src/config/schema.js'

let cwd: string

async function write(file: string, content: string): Promise<void> {
  const target = path.join(cwd, file)
  await fs.mkdir(path.dirname(target), { recursive: true })
  await fs.writeFile(target, content, 'utf-8')
}

async function read(file: string): Promise<string> {
  return fs.readFile(path.join(cwd, 'out', file), 'utf-8')
}

async function readMeta(dir = ''): Promise<Record<string, unknown>> {
  return JSON.parse(await read(dir ? `${dir}/meta.json` : 'meta.json'))
}

function makeConfig(overrides: Partial<DocSyncConfig> = {}): DocSyncConfig {
  return {
    sources: [
      { path: 'README.md', slug: 'index', order: 0 },
      { path: 'docs/**/*.md', rootDir: 'docs', order: 10 },
    ],
    target: 'fumadocs',
    outDir: 'out',
    baseUrl: '/docs',
    clean: true,
    ...overrides,
  }
}

// Slugs: index, agents/index, agents/fundamentals/index,
// agents/fundamentals/roles, guide
beforeEach(async () => {
  cwd = await fs.mkdtemp(path.join(os.tmpdir(), 'docsync-nav-'))
  await write(
    'README.md',
    [
      '# Home',
      '',
      'Welcome.',
      '',
      '## [1.0.0](https://github.com/o/r/compare/v0.9.0...v1.0.0) (2026-01-01)',
      '',
      'See [roles](docs/agents/fundamentals/roles.md) and [fundamentals](docs/agents/fundamentals/README.md#top).',
      '',
    ].join('\n'),
  )
  await write('docs/guide.md', '# Guide\n\nText.\n')
  await write('docs/agents/README.md', '# Agents\n\nText.\n')
  await write('docs/agents/fundamentals/README.md', '# Fundamentals\n\nText.\n')
  await write('docs/agents/fundamentals/roles.md', '# Roles\n\nText.\n')
})

afterEach(() => fs.rm(cwd, { recursive: true, force: true }))

describe('fumadocs output fixes', () => {
  it('links to a nested index page resolve to the folder route', async () => {
    await buildPipeline(makeConfig(), cwd)
    const index = await read('index.mdx')

    expect(index).toContain('(/docs/agents/fundamentals#top)')
    expect(index).toContain('(/docs/agents/fundamentals/roles)')
    expect(index).not.toContain('/index')
  })

  it('unwraps links in headings', async () => {
    await buildPipeline(makeConfig(), cwd)
    const index = await read('index.mdx')

    expect(index).toContain('## 1.0.0 (2026-01-01)')
    expect(index).not.toContain('## [1.0.0]')
  })
})

describe('default meta.json generation', () => {
  it('lists nested folders level by level', async () => {
    const result = await buildPipeline(makeConfig(), cwd)

    expect((await readMeta()).pages).toEqual(['index', 'agents', 'guide'])
    expect((await readMeta('agents')).pages).toEqual(['index', 'fundamentals'])
    expect((await readMeta('agents/fundamentals')).pages).toEqual(['index', 'roles'])
    expect(result.warnings).toEqual([])
  })
})

describe('nav config', () => {
  it('writes explicit pages verbatim', async () => {
    const pages = ['index', '---Guides---', 'guide', 'agents', '[GitHub](https://github.com/o/r)']
    const result = await buildPipeline(
      makeConfig({ nav: { '': { title: 'Docs', pages } } }),
      cwd,
    )

    expect(await readMeta()).toEqual({ title: 'Docs', pages })
    expect(result.warnings).toEqual([])
  })

  it('keeps the generated order when only the title is overridden', async () => {
    await buildPipeline(
      makeConfig({ nav: { agents: { title: 'Agent Guide', icon: 'Bot' } } }),
      cwd,
    )

    expect(await readMeta('agents')).toEqual({
      title: 'Agent Guide',
      icon: 'Bot',
      pages: ['index', 'fundamentals'],
    })
  })

  it('writes meta for a folder DocSync does not generate', async () => {
    await write('out/recipes/first.mdx', '# First\n')
    await write('out/recipes/second.mdx', '# Second\n')

    await buildPipeline(
      makeConfig({ clean: false, nav: { recipes: { title: 'Recipes', pages: ['second', 'first'] } } }),
      cwd,
    )

    expect(await readMeta('recipes')).toEqual({ title: 'Recipes', pages: ['second', 'first'] })
  })

  it('does not merge an explicit entry with the existing file (clean: false)', async () => {
    await write('out/meta.json', JSON.stringify({ title: 'Old', pages: ['stale', 'index'] }))

    await buildPipeline(
      makeConfig({ clean: false, nav: { '': { pages: ['index', 'agents', 'guide'] } } }),
      cwd,
    )

    expect(await readMeta()).toEqual({
      title: 'Documentation',
      pages: ['index', 'agents', 'guide'],
    })
  })

  it('accepts pages written by other tools without a warning', async () => {
    await write('out/extra.mdx', '# Extra\n')

    const result = await buildPipeline(
      makeConfig({ clean: false, nav: { '': { pages: ['index', 'extra', 'agents', 'guide'] } } }),
      cwd,
    )

    expect(result.warnings).toEqual([])
  })
})

describe('nav validation', () => {
  it('warns about entries that match no page or folder', async () => {
    const result = await buildPipeline(
      makeConfig({ nav: { '': { pages: ['index', 'agents', 'guide', 'typo'] } } }),
      cwd,
    )

    expect(result.warnings).toEqual(['meta.json: "typo" matches no page or folder'])
  })

  it('warns about pages hidden from the sidebar, including non-DocSync pages', async () => {
    await write('out/extra.mdx', '# Extra\n')

    const result = await buildPipeline(makeConfig({ clean: false }), cwd)

    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).toContain('meta.json: not in "pages"')
    expect(result.warnings[0]).toContain('extra')
  })

  it('does not report a subfolder index as hidden', async () => {
    const result = await buildPipeline(
      makeConfig({ nav: { agents: { pages: ['fundamentals'] } } }),
      cwd,
    )

    expect(result.warnings).toEqual([])
  })

  it('a rest entry ("...") covers unlisted pages', async () => {
    await write('out/extra.mdx', '# Extra\n')

    const result = await buildPipeline(
      makeConfig({ clean: false, nav: { '': { pages: ['index', '...'] } } }),
      cwd,
    )

    expect(result.warnings).toEqual([])
  })

  it('warns that nav is ignored by targets without meta.json', async () => {
    const result = await buildPipeline(
      makeConfig({ target: 'nextra', nav: { '': { pages: ['index'] } } }),
      cwd,
    )

    expect(result.warnings).toEqual(['"nav" is not supported by the nextra target — ignored'])
  })
})
