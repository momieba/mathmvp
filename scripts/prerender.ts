/**
 * Post-build step: prerenders the public pages (landing, Impressum, Datenschutz) into dist/*.html
 * and keeps an empty SPA shell as dist/spa.html for all other routes (see vercel.json).
 * Run via `npm run build` (uses tsx with tsconfig.app.json for the "@/" alias and JSX).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

type Page = {
  path: string
  file: string
  title: string
  description: string
  jsonLd?: () => string
}
type Entry = { pages: Page[]; renderPage: (page: Page) => string }

const SITE_URL = 'https://mathmvp.vercel.app'
const dist = join(import.meta.dirname, '..', 'dist')
const entryPath = '../src/prerender/entry.tsx'
// Non-literal specifier keeps tsc (node config) from type-checking the TSX entry.
const { pages, renderPage } = (await import(entryPath)) as Entry

const shell = readFileSync(join(dist, 'index.html'), 'utf8')
const rootTag = '<div id="root"></div>'
const headMarker = '<!--prerender:head-->'
for (const needle of [rootTag, headMarker, '<title>', 'name="description"', 'rel="canonical"']) {
  if (!shell.includes(needle)) throw new Error(`dist/index.html is missing ${needle}`)
}

const escapeAttr = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')

// SPA shell for /login, /app, /profil … – not indexable, no canonical.
const spa = shell
  .replace(/\s*<link rel="canonical"[^>]*>/, '')
  .replace(headMarker, '<meta name="robots" content="noindex" />')
writeFileSync(join(dist, 'spa.html'), spa)

for (const page of pages) {
  const url = SITE_URL + page.path
  const html = shell
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeAttr(page.title)}</title>`)
    .replace(
      /(<meta\s+name="description"\s+content=")[^"]*(")/,
      `$1${escapeAttr(page.description)}$2`,
    )
    .replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${url}$2`)
    .replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${url}$2`)
    .replace(
      headMarker,
      page.jsonLd ? `<script type="application/ld+json">${page.jsonLd()}</script>` : '',
    )
    .replace(rootTag, `<div id="root">${renderPage(page)}</div>`)
  writeFileSync(join(dist, page.file), html)
  console.log(`prerendered ${page.path} → dist/${page.file}`)
}
console.log('wrote dist/spa.html (app shell)')
