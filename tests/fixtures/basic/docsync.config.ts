export default {
  sources: [
    { path: 'README.md', slug: 'index', title: 'Introduction' },
    { path: 'docs/**/*.md' },
  ],
  target: 'fumadocs' as const,
  outDir: '.docsync',
  github: { repo: 'test/my-project', branch: 'main' },
}
