// patch-pagefind.mjs
// Runs after vitepress build.
// 1. Strips ALL previously injected pagefind divs (idempotent, handles duplicates)
// 2. Injects data-pagefind-body onto the vp-doc div
// 3. Injects data-pagefind-filter spans for eba and topics filters
// 4. Injects data-pagefind-weight div — score based on slug/topic relevance
// 5. Injects hidden synonyms div at END of body with data-pagefind-ignore

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const distDir = new URL('../.vitepress/dist', import.meta.url).pathname
  .replace(/^\/([A-Z]:)/, '$1')

const docsDir = new URL('..', import.meta.url).pathname
  .replace(/^\/([A-Z]:)/, '$1')

let patched = 0
let skipped = 0

function getFrontMatter(mdPath) {
  if (!existsSync(mdPath)) return {}
  const content = readFileSync(mdPath, 'utf8')
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return {}
  const fm = {}
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w+):\s*(.+)$/)
    if (!kv) continue
    const key = kv[1].trim()
    let val = kv[2].trim()
    val = val.replace(/^['"](.*)['"]$/, '$1')
    if (val.startsWith('[')) {
      val = val
        .replace(/^\[|\]$/g, '')
        .split(',')
        .map(v => v.trim().replace(/^['"]|['"]$/g, ''))
        .filter(v => v.length > 0)
        .join(', ')
    }
    fm[key] = val
  }
  return fm
}

// Strip all instances of a div pattern — loops until none remain.
// This handles cases where multiple divs exist (old hardcoded + newly injected).
function stripAllDivs(html, classPattern) {
  const re = new RegExp(`<div[^>]*class="${classPattern}"[^>]*>[\\s\\S]*?<\\/div>`, 'g')
  let prev
  do {
    prev = html
    html = html.replace(re, '')
  } while (html !== prev)
  return html
}

// ── computeWeight ─────────────────────────────────────────────────────────────
// 5-tier relevance model calibrated for HR advisor search behaviour.
//
// The diagnostic distribution across 1,265 pages is:
//   1,107 numbered clauses  (the primary search targets)
//     144 section-index pages (entry points for broad searches)
//      14 preliminary/definitions pages (reference material, low priority)
//
// Tier  Weight  Page type
// ─────────────────────────────────────────────────────────────────────────────
//  1      12    Wage/appendix tables — HR advisors hunt these for dollar figures
//  2      10    Primary numbered clause whose slug directly matches its topic
//  3       7    Named section-index (no leading digit, not preliminary)
//  4       6    General numbered clause — tagged but no direct slug-topic match
//  5       3    Preliminary / definitions / procedural reference pages
// ─────────────────────────────────────────────────────────────────────────────
//
// NOTE: Pagefind multiplies this weight against its internal TF-IDF score.
// The scale is relative — what matters is the ratio between tiers, not the
// absolute values. Keep the ceiling at 12 and the floor at 3.

// Slugs that identify wage tables and high-priority appendix reference pages.
// These all begin with a digit (caught by ^\d test) but need a higher weight
// than a general numbered clause. Pattern is matched against the FULL slug.
const WAGE_TABLE_PATTERNS = [
  /wage.?rate/,
  /allowance.*top/,
  /top.*band/,
  /classification.def/,
  /salary.*circular/,
  /wage.*increase/,
  /increases.*allowance/,
  /allowances.*top/,
  /pay.*rate/,
]

// Slugs that identify preliminary, definitions, and low-priority reference pages.
// These also begin with a digit in some EBAs (e.g. 4-definitions.md) so we
// must test the slug TEXT, not just whether it starts with a digit.
const PRELIMINARY_PATTERNS = [
  /^preliminary/,
  /\bpreliminary\b/,
  /\bdefinition/,
  /\barrangement\b/,
  /commencement/,
  /\bcoverage\b/,
  /\bincidence\b/,
  /no.extra.claims/,
  /copy.of.agreement/,
  /anti.discrimination/,
  /period.of.operation/,
  /relationship.to.previous/,
  /agreement.title/,
  /\bindex\b/,
  /not.used/,
]

// Section-index slugs — no leading digit, not preliminary.
// These are the section landing pages like hours-of-work, leave, wages, etc.
// They are useful broad-search entry points and warrant a mid-range weight.
const SECTION_INDEX_PATTERNS = [
  /^hours.of.work$/,
  /^leave$/,
  /^wages$/,
  /^allowances$/,
  /^employment$/,
  /^employment.types$/,
  /^classification/,
  /^consultation/,
  /^ohs$/,
  /^union.matters$/,
  /^workplace.rights$/,
  /^education.pd$/,
  /^appendices$/,
  /^safe.patient.care$/,
  /^common.terms$/,
  /^health.allied/,
  /^managers.admin$/,
  /^support.services$/,
  /^schedules$/,
]

function computeWeight(slug, topics) {
  const slugNorm = slug.toLowerCase()

  // ── Tier 5: Preliminary / definitions / low-priority reference ───────────────
  // Check this BEFORE the digit test because some preliminary pages ARE numbered
  // (e.g. 4-definitions.md, 1-agreement-title.md).
  if (PRELIMINARY_PATTERNS.some(re => re.test(slugNorm))) return 3

  // ── Tier 1: Wage tables and high-priority appendix pages ─────────────────────
  // These are numbered slugs whose title signals financial reference content.
  if (WAGE_TABLE_PATTERNS.some(re => re.test(slugNorm))) return 12

  // ── Tier 3: Section-index pages (no leading digit) ───────────────────────────
  // Named section landing pages — useful for broad/untrained searches.
  if (!/^\d/.test(slugNorm)) {
    if (SECTION_INDEX_PATTERNS.some(re => re.test(slugNorm))) return 7
    // Any other non-numbered page (e.g. appendices landing, ebas/index) gets 5
    return 5
  }

  // ── Numbered clauses (tiers 2 and 4) ─────────────────────────────────────────
  // Only numbered pages reach this point.
  if (!topics || topics.trim().length === 0) return 6

  const topicList = topics
    .split(',')
    .map(t => t.trim().toLowerCase())
    .filter(t => t.length > 0)

  for (const topic of topicList) {
    // Split hyphenated topic into words; ignore short connectors (≤2 chars)
    const topicWords = topic.split(/[-\s]+/).filter(w => w.length > 2)
    if (topicWords.length === 0) continue

    // ALL topic words must appear in the slug → this page IS the primary page
    // for that topic (e.g. 52-overtime.md tagged overtime → weight 10)
    const allMatch = topicWords.every(word => slugNorm.includes(word))
    if (allMatch) return 10
  }

  // Tagged but no direct slug-topic match → general supporting clause
  return 6
}

// Collect all HTML files recursively using a synchronous walker.
// fs/promises glob requires Node.js v22+; this approach works on v18 and v20.
const htmlFiles = []
function walkDir(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      walkDir(full)
    } else if (entry.endsWith('.html')) {
      htmlFiles.push(full)
    }
  }
}
walkDir(distDir)

for (const file of htmlFiles) {
  let html = readFileSync(file, 'utf8')

  // ── EXTRACT synonyms content before stripping ────────────────────────────────
  let extractedSynonyms = ''
  const synonymsMatch = html.match(
    /<div[^>]*class="pagefind-synonyms"[^>]*>([\s\S]*?)<\/div>/
  )
  if (synonymsMatch) {
    extractedSynonyms = synonymsMatch[1].trim()
  }

  // ── STRIP PASS — removes ALL instances of each div class ─────────────────────
  // Uses a loop to handle duplicates: old hardcoded .md body divs AND any
  // previously injected divs from prior script runs are both removed.
  html = stripAllDivs(html, 'pagefind-synonyms')
  html = stripAllDivs(html, 'pagefind-weight')

  // ── SOURCE FILE + FRONT MATTER ───────────────────────────────────────────────
  const relHtml = relative(distDir, file)
  const relMd = relHtml.replace(/\.html$/, '.md')
  const mdPath = join(docsDir, relMd)
  const fm = getFrontMatter(mdPath)

  const slug = relHtml
    .replace(/\.html$/, '')
    .split(/[/\\]/)
    .pop() || ''

  // ── RESOLVE synonyms text ────────────────────────────────────────────────────
  const synonymsText = (fm.synonyms && fm.synonyms.trim().length > 0)
    ? fm.synonyms.trim()
    : extractedSynonyms

  // ── FILTER SPANS ─────────────────────────────────────────────────────────────
  let filterSpans = ''
  if (fm.eba) {
    filterSpans += `<span data-pagefind-filter="eba" data-pagefind-ignore data-allow-mismatch style="display:none">${fm.eba}</span>`
  }
  if (fm.topics && fm.topics.length > 0) {
    const topicArr = fm.topics
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0)
    for (const topic of topicArr) {
      filterSpans += `<span data-pagefind-filter="topics" data-pagefind-ignore data-allow-mismatch style="display:none">${topic}</span>`
    }
  }

  // ── WEIGHT DIV ───────────────────────────────────────────────────────────────
  const weight = computeWeight(slug, fm.topics || '')
  const weightDiv = `<div class="pagefind-weight" data-pagefind-weight="${weight}" data-allow-mismatch style="display:none" aria-hidden="true"></div>`

  // ── SYNONYMS BLOCK ───────────────────────────────────────────────────────────
  let synonymBlock = ''
  if (synonymsText.length > 0) {
    synonymBlock = `<div class="pagefind-synonyms" data-pagefind-ignore data-allow-mismatch style="display:none" aria-hidden="true">${synonymsText}</div>`
  }

  if (html.includes('class="vp-doc ')) {
    html = html.replace(
      /class="vp-doc ([^"]*)"/,
      `class="vp-doc $1" data-pagefind-body`
    )

    const topMarkup = `${filterSpans}${weightDiv}`

    const allBlocks = `${topMarkup}${synonymBlock}`
    if (allBlocks) {
      if (html.includes('</main>')) {
        html = html.replace('</main>', `</main>${allBlocks}`)
      } else {
        html = html.replace('</body>', `${allBlocks}</body>`)
      }
    }

    writeFileSync(file, html, 'utf8')
    patched++
  } else {
    skipped++
  }
}

console.log(`Patched ${patched} files, skipped ${skipped}`)