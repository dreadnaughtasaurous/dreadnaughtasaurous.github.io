/**
 * generate-page-catalog.mjs
 *
 * Scans every EBA clause page and writes docs/public/page-catalog.json.
 * Each entry carries the metadata ForYou.vue needs for its recommendation
 * engine: path, title, eba (full name from frontmatter), ebaSlug (folder
 * name), section, topics, clause, and a short excerpt.
 *
 * Run:   node scripts/generate-page-catalog.mjs
 * Output: docs/public/page-catalog.json  (served at /page-catalog.json)
 */

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, relative }                                      from 'path'
import { fileURLToPath }                                       from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const DOCS_DIR  = join(__dirname, '..')          // …/docs/
const EBAS_DIR  = join(DOCS_DIR, 'ebas')
const OUTPUT    = join(DOCS_DIR, 'public', 'page-catalog.json')

// ── Recursive directory walker ────────────────────────────────────────────────
// Returns absolute paths of all .md files except index.md files (those are
// section landing pages, not individual clause pages).
function walkDir(dir) {
  const results = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'archive') continue  // archived agreements excluded from the recommendation catalog
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      results.push(...walkDir(full))
    } else if (entry.endsWith('.md') && entry !== 'index.md') {
      results.push(full)
    }
  }
  return results
}

// ── Minimal YAML frontmatter parser ──────────────────────────────────────────
// Handles every pattern used in EBA pages:
//   key: "quoted string"
//   key: unquoted string
//   topics: [topic1, topic2]           ← single-line array (primary format)
//   topics:                            ← multi-line array fallback
//     - topic1
//     - topic2
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return {}

  const fm    = {}
  const lines = match[1].split(/\r?\n/)
  let i = 0

  while (i < lines.length) {
    const line      = lines[i]
    const colonIdx  = line.indexOf(':')
    if (colonIdx === -1) { i++; continue }

    const key = line.slice(0, colonIdx).trim()
    const raw = line.slice(colonIdx + 1).trim()

    if (raw.startsWith('[') && raw.endsWith(']')) {
      // Inline array: [a, b, c] or ["a", "b"]
      fm[key] = raw.slice(1, -1)
        .split(',')
        .map(v => v.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean)
    } else if (raw === '') {
      // Multi-line array: collect subsequent "  - item" lines
      const items = []
      i++
      while (i < lines.length && /^\s+-\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s+-\s+/, '').trim().replace(/^["']|["']$/g, ''))
        i++
      }
      fm[key] = items.length ? items : ''
      continue  // i already advanced inside while loop
    } else {
      fm[key] = raw.replace(/^["']|["']$/g, '')
    }
    i++
  }
  return fm
}

// ── Absolute file path → URL path ────────────────────────────────────────────
// docs\ebas\nurses-midwives\32-overtime.md  →  /ebas/nurses-midwives/32-overtime
function pathToUrl(absPath) {
  return '/' + relative(DOCS_DIR, absPath)
    .replace(/\\/g, '/')
    .replace(/\.md$/, '')
}

// ── Short excerpt from first body paragraph ───────────────────────────────────
// Strips frontmatter, headings, component tags, VitePress containers, and
// tables before picking the first substantive prose line.
function extractExcerpt(content) {
  const body = content.replace(/^---[\s\S]*?---\r?\n/, '').trim()
  for (const line of body.split(/\r?\n/)) {
    const s = line.trim()
    if (!s)                     continue  // blank
    if (s.startsWith('#'))      continue  // heading
    if (s.startsWith('<'))      continue  // Vue component
    if (s.startsWith(':::'))    continue  // VitePress container
    if (s.startsWith('|'))      continue  // table row
    if (s.startsWith('>'))      continue  // blockquote
    if (s.startsWith('```'))    continue  // code fence
    // Strip inline markdown: [label](url), **, *, _, `
    const clean = s
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[*_`]/g, '')
      .trim()
    if (clean.length < 10) continue       // skip trivially short lines
    return clean.slice(0, 140)
  }
  return ''
}

// ── Main ─────────────────────────────────────────────────────────────────────
const files   = walkDir(EBAS_DIR)
const catalog = []
let   skipped = 0

for (const file of files) {
  const content = readFileSync(file, 'utf-8')
  const fm      = parseFrontmatter(content)

  if (!fm.title) { skipped++; continue }  // skip files without a title

  const url     = pathToUrl(file)
  const parts   = url.split('/').filter(Boolean)  // ['ebas', '<slug>', ...]
  const ebaSlug = parts[1] || ''

  catalog.push({
    path:    url,
    title:   String(fm.title   || ''),
    eba:     String(fm.eba     || ''),
    ebaSlug,
    section: String(fm.section || ''),
    topics:  Array.isArray(fm.topics) ? fm.topics : (fm.topics ? [String(fm.topics)] : []),
    clause:  String(fm.clause  || ''),
    excerpt: extractExcerpt(content),
  })
}

writeFileSync(OUTPUT, JSON.stringify(catalog, null, 2), 'utf-8')
console.log(`✓ page-catalog.json — ${catalog.length} pages written (${skipped} skipped — no title)`)
console.log(`  → ${OUTPUT}`)