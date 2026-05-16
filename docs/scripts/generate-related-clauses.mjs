/**
 * generate-related-clauses.mjs
 *
 * Build-time script. Scans all EBA clause pages (three levels deep:
 * ebas/<eba-folder>/<section-folder>/<clause-file>.md), scores relatedness
 * between pages using hyperlinked clause references (strong signal) and shared
 * topic tags (weak signal), then writes:
 *
 *   docs/generated/related-clauses.json   ← consumed by RelatedClauses.vue
 *   ../related-clauses-log.txt            ← audit log; .gitignored
 *
 * Scoring per candidate page:
 *   +10  direct hyperlink in page content pointing to candidate URL
 *   +3   per shared topic tag (same EBA only; each tag counted once)
 *
 * Exclusions:
 *   - Section index pages (e.g. allowances.md, leave.md) — navigation only
 *   - EBA index pages (index.md)
 *   - Cross-EBA results
 *   - Self-links (current page excluded from its own results)
 *
 * Run:  node scripts/generate-related-clauses.mjs
 *       npm run docs:related
 */

import fs   from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

// ─── Configuration ────────────────────────────────────────────────────────────

const MAX_RELATED    = 6    // Maximum related clauses shown per page (configurable)
const EXCERPT_LENGTH = 220  // Characters of body prose to store as excerpt
const POINTS_LINK    = 10   // Score awarded per direct hyperlink to candidate
const POINTS_TAG     = 3    // Score awarded per shared topic tag

// ─── Paths ────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DOCS_ROOT = path.resolve(__dirname, '..')
const EBAS_ROOT = path.join(DOCS_ROOT, 'ebas')
const OUT_FILE  = path.join(DOCS_ROOT, 'generated', 'related-clauses.json')
const LOG_FILE  = path.resolve(DOCS_ROOT, '..', 'related-clauses-log.txt')

// ─── EBA folders (must exactly match directory names) ─────────────────────────

const EBA_FOLDERS = [
  'allied-health',
  'biomedical-engineers',
  'childrens-services',
  'doctors-in-training',
  'has-managers-admin',
  'mspp',
  'medical-specialists',
  'mental-health',
  'nurses-midwives',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Parse YAML frontmatter from a markdown string.
 * Handles --- delimiters and the single-quoted array format:
 *   topics: ['allowances', 'wages']
 * Returns a plain object of key → string | string[].
 */
function parseFrontmatter(raw) {
  // Match --- delimited frontmatter block
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return {}

  const result = {}
  for (const line of match[1].split('\n')) {
    const colonIdx = line.indexOf(':')
    if (colonIdx === -1) continue

    const key = line.slice(0, colonIdx).trim()
    let   val = line.slice(colonIdx + 1).trim()

    // Array: ['a', 'b'] or ["a", "b"] or [a, b]
    if (val.startsWith('[') && val.endsWith(']')) {
      result[key] = val
        .slice(1, -1)
        .split(',')
        .map(s => s.trim().replace(/^['"]|['"]$/g, ''))
        .filter(Boolean)
    } else {
      // Scalar: strip surrounding quotes
      result[key] = val.replace(/^['"]|['"]$/g, '')
    }
  }
  return result
}

/**
 * Strip frontmatter block and all injected HTML spans/divs (pagefind meta,
 * synonyms, weight divs) from the raw markdown, returning only the prose body.
 * This prevents those elements from polluting the excerpt text.
 */
function getBody(raw) {
  return raw
    .replace(/^---\r?\n[\s\S]*?\r?\n---/, '')   // frontmatter
    .replace(/<[^>]+>[\s\S]*?<\/[^>]+>/g, '')   // HTML elements with content
    .replace(/<[^>]+>/g, '')                     // self-closing / remaining tags
    .trim()
}

/**
 * Extract a clean plain-text excerpt from markdown body text.
 * Strips headings, code fences, link syntax, bold/italic markers, and
 * list markers. Returns the first EXCERPT_LENGTH characters of readable prose.
 */
function extractExcerpt(body) {
  const text = body
    .replace(/```[\s\S]*?```/g, '')           // fenced code blocks
    .replace(/`[^`]+`/g, '')                  // inline code
    .replace(/^#{1,6}\s+.+$/gm, '')           // headings
    .replace(/!\[.*?\]\(.*?\)/g, '')          // images
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links → label text only
    .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1') // bold / italic
    .replace(/^\s*[-*+]\s+/gm, '')           // unordered list markers
    .replace(/^\s*\d+\.\s+/gm, '')           // ordered list markers
    .replace(/\|.+/g, '')                    // table rows
    .replace(/[-*_]{3,}/g, '')               // horizontal rules
    .replace(/\r?\n+/g, ' ')                 // collapse newlines
    .replace(/\s{2,}/g, ' ')                 // collapse whitespace
    .trim()

  return text.length > EXCERPT_LENGTH
    ? text.slice(0, EXCERPT_LENGTH).replace(/\s+\S*$/, '') + '…'
    : text
}

/**
 * Extract all unique internal wiki URLs hyperlinked in the page body.
 * Matches: [label](/ebas/eba-folder/section/clause-slug)
 * Strips anchors (#subclause-ref) and normalises the URL.
 * Returns a Set<string> of root-relative URLs without trailing slashes.
 */
function extractLinkedUrls(body) {
  const linked = new Set()
  // Match markdown links whose href starts with /ebas/
  const RE = /\[[^\]]*\]\((\/ebas\/[^)#\s]+)/g
  let m
  while ((m = RE.exec(body)) !== null) {
    const url = m[1].replace(/\/$/, '')  // strip trailing slash
    linked.add(url)
  }
  return linked
}

/**
 * Recursively collect all clause-level .md files under an EBA folder.
 * Clause files live exactly two levels below the EBA root:
 *   ebas/<eba-folder>/<section-folder>/<clause>.md
 *
 * Excluded from results:
 *   - index.md at any level
 *   - Section-level files (one level below EBA root, e.g. allowances.md)
 *     These are navigation index pages, not clause content pages.
 */
/**
 * Recursively collect all clause-level .md files under an EBA folder.
 *
 * Handles both the standard three-level structure:
 *   ebas/<eba>/<section>/<clause>.md
 * and the four-level sub-sectioned structure used by has-managers-admin
 * and mental-health:
 *   ebas/<eba>/<sub-section>/<section>/<clause>.md
 *
 * A file is treated as a CLAUSE file (included) if:
 *   - It ends in .md
 *   - It is NOT named index.md
 *   - Its immediate parent directory is NOT the EBA root
 *     (i.e. section index pages like allowances.md are excluded)
 *   - It does NOT have any subdirectory siblings containing .md files
 *     (i.e. it is a leaf node, not itself a section index)
 *
 * In practice: we recurse fully and collect every .md file that is not
 * index.md and whose parent directory contains no subdirectories —
 * meaning it is a terminal clause folder, not an intermediate index folder.
 */
function collectClauseFiles(ebaFolder) {
  const ebaDir = path.join(EBAS_ROOT, ebaFolder)
  if (!fs.existsSync(ebaDir)) return []

  const clauseFiles = []

  function recurse(dir, depth) {
    const entries = fs.readdirSync(dir, { withFileTypes: true })

    // Check if this directory contains any subdirectories
    const hasSubDirs = entries.some(e => e.isDirectory())

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)

      if (entry.isDirectory()) {
        // Always recurse into subdirectories
        recurse(fullPath, depth + 1)
      } else if (entry.isFile() && entry.name.endsWith('.md')) {
        // Skip index files at any depth
        if (entry.name === 'index.md') continue

        // Skip files at depth 0 (direct children of EBA root — these are
        // section nav pages like allowances.md, leave.md, common-terms.md)
        if (depth === 0) continue

        // Skip .md files whose parent directory ALSO has subdirectories.
        // These are section-level index pages (e.g. common-terms/allowances.md
        // sits alongside common-terms/allowances/ subdirectory).
        if (hasSubDirs) continue

        clauseFiles.push(fullPath)
      }
    }
  }

  recurse(ebaDir, 0)
  return clauseFiles
}

/**
 * Derive the root-relative wiki URL from a full file path.
 * C:\Projects\EBAdb\docs\ebas\allied-health\allowances\33-increases-to-allowances.md
 *   → /ebas/allied-health/allowances/33-increases-to-allowances
 */
function filePathToUrl(filePath) {
  const rel = path.relative(DOCS_ROOT, filePath)  // ebas\allied-health\...
  return '/' + rel.replace(/\\/g, '/').replace(/\.md$/, '')
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const startTime = Date.now()
  const logLines  = [
    `generate-related-clauses.mjs — ${new Date().toISOString()}`,
    `MAX_RELATED=${MAX_RELATED}  POINTS_LINK=${POINTS_LINK}  POINTS_TAG=${POINTS_TAG}  EXCERPT_LENGTH=${EXCERPT_LENGTH}`,
    '─'.repeat(72),
  ]

  console.log('📎 generate-related-clauses.mjs starting…')

  // ── Phase 1: Collect all clause pages ───────────────────────────────────────

  /**
   * @type {Array<{
   *   filePath:   string,
   *   url:        string,
   *   ebaFolder:  string,
   *   title:      string,
   *   topics:     string[],
   *   excerpt:    string,
   *   linkedUrls: Set<string>,
   * }>}
   */
  const pages = []

  for (const ebaFolder of EBA_FOLDERS) {
    const clauseFiles = collectClauseFiles(ebaFolder)

    if (clauseFiles.length === 0) {
      logLines.push(`SKIP  ${ebaFolder}  — folder not found or empty`)
      continue
    }

    for (const filePath of clauseFiles) {
      const raw        = fs.readFileSync(filePath, 'utf8')
      const fm         = parseFrontmatter(raw)
      const body       = getBody(raw)
      const url        = filePathToUrl(filePath)
      const title      = fm.title  || path.basename(filePath, '.md')
      const topics     = Array.isArray(fm.topics)
                           ? fm.topics
                           : (fm.topics ? [fm.topics] : [])
      const excerpt    = extractExcerpt(body)
      const linkedUrls = extractLinkedUrls(body)

      pages.push({ filePath, url, ebaFolder, title, topics, excerpt, linkedUrls })
    }

    logLines.push(`SCAN  ${ebaFolder}  — ${clauseFiles.length} clause pages loaded`)
  }

  logLines.push('─'.repeat(72))
  logLines.push(`Total clause pages scanned: ${pages.length}`)
  logLines.push('─'.repeat(72))

  // ── Phase 2: Score relatedness ───────────────────────────────────────────────

  /** @type {Record<string, Array<{url:string, title:string, excerpt:string, score:number}>>} */
  const result = {}

  for (const page of pages) {
    const candidates = []

    for (const candidate of pages) {
      if (candidate.url === page.url)           continue  // never self
      if (candidate.ebaFolder !== page.ebaFolder) continue  // same EBA only

      let score = 0

      // Strong signal: page body contains a direct hyperlink to this candidate.
      // Each unique candidate URL is counted once regardless of how many times
      // it appears in the source (prevents artificial score inflation).
      if (page.linkedUrls.has(candidate.url)) {
        score += POINTS_LINK
      }

      // Weak signal: shared topic tags
      for (const tag of page.topics) {
        if (candidate.topics.includes(tag)) {
          score += POINTS_TAG
        }
      }

      if (score > 0) {
        candidates.push({
          url:     candidate.url,
          title:   candidate.title,
          excerpt: candidate.excerpt,
          score,
        })
      }
    }

    // Sort: highest score first; alphabetical by title for stable tie-breaking
    candidates.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title))

    const kept    = candidates.slice(0, MAX_RELATED)
    result[page.url] = kept

    if (kept.length > 0) {
      logLines.push(`OK    ${page.url}  → ${kept.length} related`)
      for (const k of kept) {
        logLines.push(`        score=${String(k.score).padStart(3)}  ${k.url}`)
      }
    } else {
      logLines.push(`NONE  ${page.url}  — no related pages found`)
    }
  }

  // ── Phase 3: Write JSON ──────────────────────────────────────────────────────

  const generatedDir = path.join(DOCS_ROOT, 'generated')
  if (!fs.existsSync(generatedDir)) fs.mkdirSync(generatedDir, { recursive: true })

  fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2), 'utf8')
  console.log(`✅ Written: ${OUT_FILE}`)

  // ── Phase 4: Write audit log ─────────────────────────────────────────────────

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
  logLines.push('─'.repeat(72))
  logLines.push(`Output:      ${OUT_FILE}`)
  logLines.push(`Completed in ${elapsed}s`)

  fs.writeFileSync(LOG_FILE, logLines.join('\n') + '\n', 'utf8')
  console.log(`📄 Log:     ${LOG_FILE}`)
  console.log(`⏱  Done in  ${elapsed}s`)
}

main().catch(err => {
  console.error('❌ generate-related-clauses.mjs failed:', err)
  process.exit(1)
})