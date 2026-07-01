/**
 * generate-section-index.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Scans every EBA folder and builds a static data module consumed by
 * SectionIndex.vue at compile time.
 *
 * For every .md / directory pair found at any depth under docs/ebas/:
 *   - "section" type — paired directory contains leaf clause .md files
 *   - "stream"  type — paired directory contains further .md / dir pairs
 *                      (only occurs in has-managers-admin and mental-health)
 *
 * Output : docs/generated/section-index-data.js
 * Run    : node scripts/generate-section-index.mjs
 *
 * IMPORTANT: This script must run before `npm run docs:dev` or
 * `npm run docs:build` because SectionIndex.vue statically imports the output.
 */

import {
  readdirSync, readFileSync, writeFileSync,
  existsSync, mkdirSync,
} from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = fileURLToPath(new URL('.', import.meta.url))
const DOCS_DIR  = join(__dirname, '..')
const EBAS_DIR  = join(DOCS_DIR, 'ebas')
const OUT       = join(DOCS_DIR, 'generated', 'section-index-data.js')

// Each entry's `folder` is the path under docs/ebas/ to scan — also used as
// the URL prefix and the section-index-data.js key prefix. `registrySlug` is
// only needed when the on-disk folder path no longer matches the EBA's slug
// in eba-registry.js — currently true only for the archived agreement, whose
// folder was moved under archive/<slug-year>/ but whose registry `slug` field
// was deliberately left unchanged so colour lookups keep working everywhere
// else. If registrySlug is omitted it defaults to folder.
const EBA_SOURCES = [
  { folder: 'allied-health' },
  { folder: 'biomedical-engineers' },
  { folder: 'childrens-services' },
  { folder: 'doctors-in-training' },
  { folder: 'archive/has-managers-admin-2021-2025', registrySlug: 'has-managers-admin-2021-2025' },
  { folder: 'has-managers-admin-2025-2027', registrySlug: 'has-managers-admin' },
  { folder: 'medical-specialists' },
  { folder: 'mental-health' },
  { folder: 'mspp' },
  { folder: 'nurses-midwives' },
]

// ── Frontmatter parser ────────────────────────────────────────────────────────
// Identical to the pattern used in generate-page-catalog.mjs.
// Handles inline arrays [a, b] and multi-line array blocks.
function parseFrontmatter(content) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return {}
  const fm    = {}
  const lines = match[1].split(/\r?\n/)
  let i = 0
  while (i < lines.length) {
    const line     = lines[i]
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) { i++; continue }
    const key = line.slice(0, colonIdx).trim()
    const raw = line.slice(colonIdx + 1).trim()
    if (raw.startsWith('[') && raw.endsWith(']')) {
      fm[key] = raw.slice(1, -1)
        .split(',')
        .map(v => v.trim().replace(/^["']|["']$/g, ''))
        .filter(Boolean)
    } else if (raw === '') {
      const items = []
      i++
      while (i < lines.length && /^\s+-\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s+-\s+/, '').trim().replace(/^["']|["']$/g, ''))
        i++
      }
      fm[key] = items.length ? items : ''
      continue
    } else {
      fm[key] = raw.replace(/^["']|["']$/g, '')
    }
    i++
  }
  return fm
}

// ── Clause display number ─────────────────────────────────────────────────────
// Extracts the leading number (and optional letter) from a filename.
//   "33-increases-to-allowances.md"    → "33"
//   "42A-travelling-and-relocation.md" → "42A"
function getDisplayNumber(filename) {
  const m = filename.match(/^(\d+[A-Za-z]?)-/)
  return m ? m[1].toUpperCase() : ''
}

// ── Clause sort comparator ────────────────────────────────────────────────────
// Sorts numerically by leading number, then alphabetically by letter suffix.
// Ensures 42 < 42A < 43, and 9 < 10 (not lexicographic "10" < "9").
function clauseSortKey(filename) {
  const m = filename.match(/^(\d+)([A-Za-z]?)-/)
  if (!m) return { n: 9999, s: filename }
  return { n: parseInt(m[1], 10), s: (m[2] || '').toUpperCase() }
}

function compareClauses(a, b) {
  const ka = clauseSortKey(a.name)
  const kb = clauseSortKey(b.name)
  if (ka.n !== kb.n) return ka.n - kb.n
  return ka.s < kb.s ? -1 : ka.s > kb.s ? 1 : 0
}

// ── Count all leaf clause .md files under a directory ─────────────────────────
// A leaf clause file lives in a directory that has no subdirectories.
// Used to populate the "N clauses" count on stream child cards.
function countLeafClauses(dir) {
  if (!existsSync(dir)) return 0
  let count = 0
  const entries   = readdirSync(dir, { withFileTypes: true })
  const hasSubDir = entries.some(e => e.isDirectory())
  for (const e of entries) {
    if (e.isDirectory()) {
      count += countLeafClauses(join(dir, e.name))
    } else if (e.name.endsWith('.md') && e.name !== 'index.md' && !hasSubDir) {
      count++
    }
  }
  return count
}

// ── Section label map ─────────────────────────────────────────────────────────
// Determines the label rendered above the list in SectionIndex.vue.
// Stream type always returns 'Subsections'. Section type defaults to 'Clauses'
// but uses specific labels for known non-clause folder names.
const SECTION_LABELS = {
  appendices: 'Appendices',
  schedules:  'Schedules',
}

function getSectionLabel(sectionSlug, type) {
  if (type === 'stream') return 'Subsections'
  return SECTION_LABELS[sectionSlug] ?? 'Clauses'
}

// ── Locate the index/meta file for a section or stream directory ─────────────
// Two conventions must be supported side by side:
//   • Sibling file : parentDir/<name>.md        (old agreements, e.g. has-managers-admin)
//   • Nested index : parentDir/<name>/index.md  (has-managers-admin-2025-2027 onward)
function findIndexFile(parentDir, name) {
  const siblingPath = join(parentDir, `${name}.md`)
  if (existsSync(siblingPath)) return siblingPath
  const nestedPath = join(parentDir, name, 'index.md')
  if (existsSync(nestedPath)) return nestedPath
  return null
}

// ── Directory type detection ──────────────────────────────────────────────────
// A directory is "stream" if it contains any subdirectories (i.e. its children
// are subsection folders, not leaf clause files).
// A directory is "section" if it contains only .md files (leaf clauses).
function getDirType(dir) {
  const entries = readdirSync(dir, { withFileTypes: true })
  return entries.some(e => e.isDirectory()) ? 'stream' : 'section'
}

// ── Build clauses array for a "section" directory ────────────────────────────
function buildClauses(dir, urlBase) {
  const entries = readdirSync(dir, { withFileTypes: true })
  const mdFiles = entries
    .filter(e => e.isFile() && e.name.endsWith('.md') && e.name !== 'index.md')
    .sort(compareClauses)

  return mdFiles.map(e => {
    const content = readFileSync(join(dir, e.name), 'utf-8')
    const fm      = parseFrontmatter(content)
    const slug    = e.name.replace(/\.md$/, '')
    return {
      displayNumber: getDisplayNumber(e.name),
      title:         String(fm.title   || slug),
      path:          `${urlBase}${slug}/`,
      topics:        Array.isArray(fm.topics)
                       ? fm.topics
                       : (fm.topics ? [String(fm.topics)] : []),
      summary:       fm.summary ? String(fm.summary) : null,
    }
  })
}

// ── Build children array for a "stream" directory ────────────────────────────
// Children are the .md / dir pairs one level inside the stream directory.
// Each child entry carries its title and a computed clause count.
function buildChildren(dir, urlBase) {
  const entries = readdirSync(dir, { withFileTypes: true })

  return entries
    .filter(e => e.isDirectory())
    .map(e => {
      const slug   = e.name
      const mdPath = findIndexFile(dir, slug)
      if (!mdPath) return null
      const content = readFileSync(mdPath, 'utf-8')
      const fm      = parseFrontmatter(content)
      return {
        title:       String(fm.title || slug),
        path:        `${urlBase}${slug}/`,
        clauseCount: countLeafClauses(join(dir, slug)),
      }
    })
    .filter(Boolean)
}

// ── Recursively find all .md / dir pairs within a directory ──────────────────
// Returns an array of descriptor objects — one per valid section/stream index.
// keyBase  : dot-path key being built (e.g. "has-managers-admin/common-terms")
// urlBase  : URL prefix being built   (e.g. "/ebas/has-managers-admin/common-terms/")
function findPairs(parentDir, keyBase, urlBase) {
  const pairs   = []
  const entries = readdirSync(parentDir, { withFileTypes: true })

  for (const e of entries) {
    if (!e.isDirectory()) continue
    const slug    = e.name
    const dirPath = join(parentDir, slug)
    const mdPath  = findIndexFile(parentDir, slug)
    if (!mdPath) continue  // no sibling .md and no nested index.md — skip

    const key     = `${keyBase}/${slug}`
    const nextUrl = `${urlBase}${slug}/`

    pairs.push({ mdPath, dirPath, key, urlBase: nextUrl })

    // Recurse so nested EBA streams produce entries for their children too
    pairs.push(...findPairs(dirPath, key, nextUrl))
  }

  return pairs
}

// ── Main ──────────────────────────────────────────────────────────────────────
mkdirSync(join(DOCS_DIR, 'generated'), { recursive: true })

const output        = {}
let   totalSections = 0
let   totalStreams   = 0

for (const source of EBA_SOURCES) {
  const { folder, registrySlug = folder } = source
  const ebaDir = join(EBAS_DIR, folder)
  if (!existsSync(ebaDir)) {
    console.warn(`  ⚠  EBA folder not found, skipping: ${folder}`)
    continue
  }

  const pairs = findPairs(ebaDir, folder, `/ebas/${folder}/`)

  for (const { mdPath, dirPath, key, urlBase } of pairs) {
    const content = readFileSync(mdPath, 'utf-8')
    const fm      = parseFrontmatter(content)
    const type        = getDirType(dirPath)
    const sectionSlug = key.split('/').pop()

    if (type === 'section') {
      const clauses  = buildClauses(dirPath, urlBase)
      output[key] = {
        type:        'section',
        label:       getSectionLabel(sectionSlug, 'section'),
        title:       String(fm.title       || key),
        description: fm.description ? String(fm.description) : null,
        eba:         String(fm.eba         || ''),
        ebaSlug:     registrySlug,
        clauseCount: clauses.length,
        clauses,
      }
      totalSections++
    } else {
      const children = buildChildren(dirPath, urlBase)
      output[key] = {
        type:        'stream',
        label:       getSectionLabel(sectionSlug, 'stream'),
        title:       String(fm.title       || key),
        description: fm.description ? String(fm.description) : null,
        eba:         String(fm.eba         || ''),
        ebaSlug:     registrySlug,
        childCount:  children.length,
        children,
      }
      totalStreams++
    }
  }
}

// Write as a JS module so Vite can statically import it at build time.
// JSON.stringify produces a valid JS literal for object/array/string/null values.
const js = `// AUTO-GENERATED by scripts/generate-section-index.mjs — do not edit manually.
// Regenerate: node scripts/generate-section-index.mjs
export default ${JSON.stringify(output, null, 2)}
`

writeFileSync(OUT, js, 'utf-8')
console.log(`\n✓ section-index-data.js written`)
console.log(`  Sections : ${totalSections}`)
console.log(`  Streams  : ${totalStreams}`)
console.log(`  Total    : ${totalSections + totalStreams}`)
console.log(`  → ${OUT}`)