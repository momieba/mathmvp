/**
 * Post-build step: prerenders the landing page into dist/index.html and keeps an empty SPA shell
 * as dist/spa.html for all other routes (see vercel.json rewrites).
 * Run via `npm run build` (uses tsx with tsconfig.app.json for the "@/" alias and JSX).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

type Entry = { renderLanding: () => string; landingJsonLd: () => string }

const dist = join(import.meta.dirname, '..', 'dist')
const entryPath = '../src/prerender/entry.tsx'
// Non-literal specifier keeps tsc (node config) from type-checking the TSX entry.
const { renderLanding, landingJsonLd } = (await import(entryPath)) as Entry

const shell = readFileSync(join(dist, 'index.html'), 'utf8')
const rootTag = '<div id="root"></div>'
const headMarker = '<!--prerender:head-->'
if (!shell.includes(rootTag) || !shell.includes(headMarker)) {
  throw new Error('dist/index.html is missing the root element or the prerender:head marker')
}

// SPA shell for /login, /app, … – not indexable, no canonical to the landing page.
const spa = shell
  .replace(/\s*<link rel="canonical"[^>]*>/, '')
  .replace(headMarker, '<meta name="robots" content="noindex" />')
writeFileSync(join(dist, 'spa.html'), spa)

const landing = shell
  .replace(headMarker, `<script type="application/ld+json">${landingJsonLd()}</script>`)
  .replace(rootTag, `<div id="root">${renderLanding()}</div>`)
writeFileSync(join(dist, 'index.html'), landing)

console.log('prerendered dist/index.html (landing) + dist/spa.html (app shell)')
