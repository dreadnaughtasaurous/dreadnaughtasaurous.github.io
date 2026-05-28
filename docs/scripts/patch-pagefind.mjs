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
  // transition-to-retirement clauses reference LSL heavily in body text but
  // are never the primary answer when an advisor searches for an entitlement.
  // Weight 3 prevents them outranking primary leave clauses via TF-IDF.
  /transition.to.retirement/,
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

// ── GLOBAL SLUG SYNONYM MAP ───────────────────────────────────────────────────
// Keys: exact slug strings (filename without .md extension).
// Values: space-separated plain-language phrases an HR advisor would type.
//
// Rules:
//   1. Each phrase appears on ONE slug only — no phrase in two entries.
//   2. Only phrases absent from formal EBA body text are included.
//      Words already in clause titles/body text are excluded — Pagefind
//      finds those via content indexing without needing a synonym.
//   3. Generic single words are never added.
//   4. Every slug verified against the actual file tree.

const SLUG_SYNONYMS = {

  // ── PERSONAL / SICK LEAVE ────────────────────────────────────────────────────
  // "sick leave" and "sick day" do not appear in any EBA text.
  '62-personal-leave-including-carer-s-leave':      'sick leave sick day carer leave',
  '54-personal-carer-s-leave':                      'sick leave sick day carer leave',
  '61-personal-sick-carer-s-leave':                 'sick leave sick day carer leave',
  '55-personal-leave':                              'sick leave sick day carer leave',
  '64-personal-carer-s-leave':                      'sick leave sick day carer leave',
  '49-personal-carer-s-leave':                      'sick leave sick day carer leave',
  '38A-personal-leave':                             'sick leave sick day carer leave',
  '25-personal-carer-s-leave-and-compassionate-leave': 'sick leave sick day carer leave',
  '61-personal-leave':                              'sick leave sick day carer leave',

  // ── LONG SERVICE LEAVE (LSL) ──────────────────────────────────────────────────
  // "LSL" appears in EBA body text but the synonym ensures the PRIMARY clause
  // page carries it as a searchable term with full weight, not just incidentally.
  // medical-specialists confirmed present: 55-long-service-leave.
  '72-long-service-leave': 'LSL long service entitlement',
  '63-long-service-leave': 'LSL long service entitlement',
  '68-long-service-leave': 'LSL long service entitlement',
  '61-long-service-leave': 'LSL long service entitlement',
  '67-long-service-leave': 'LSL long service entitlement',
  '55-long-service-leave': 'LSL long service entitlement',
  '47-long-service-leave': 'LSL long service entitlement',
  '70-long-service-leave': 'LSL long service entitlement',

  // ── PARENTAL LEAVE ────────────────────────────────────────────────────────────
  // "maternity leave" and "paternity leave" are obsolete terms still searched.
  '70-parental-leave':   'maternity leave paternity leave adoption leave',
  '61-parental-leave':   'maternity leave paternity leave adoption leave',
  '67-parental-leave':   'maternity leave paternity leave adoption leave',
  '59-parental-leave':   'maternity leave paternity leave adoption leave',
  '70-parental-leave':   'maternity leave paternity leave adoption leave',
  '54-parental-leave':   'maternity leave paternity leave adoption leave',
  '50-parental-leave':   'maternity leave paternity leave adoption leave',
  '25A-parental-leave-and-related-entitlements': 'maternity leave paternity leave adoption leave',
  '68-parental-leave':   'maternity leave paternity leave adoption leave',

  // ── FAMILY VIOLENCE LEAVE ─────────────────────────────────────────────────────
  // EBAs use "family violence leave"; advisors search "domestic violence leave".
  '66-family-violence-leave':               'domestic violence leave DV leave',
  '56-family-violence-leave':               'domestic violence leave DV leave',
  '71-family-violence-leave':               'domestic violence leave DV leave',
  '67-family-violence-leave':               'domestic violence leave DV leave',
  '82-family-violence-leave':               'domestic violence leave DV leave',
  '60-family-violence-leave':               'domestic violence leave DV leave',
  '45-family-and-domestic-violence-leave':  'domestic violence leave DV leave',
  '28-family-and-domestic-violence-leave':  'domestic violence leave DV leave',
  '64-family-and-domestic-violence-leave':  'domestic violence leave DV leave',

  // ── REDUNDANCY ────────────────────────────────────────────────────────────────
  // "retrenchment" and "severance" do not appear in EBA text.
  '25-redundancy-and-related-entitlements':    'retrenchment severance',
  '24-redundancy-and-associated-entitlements': 'retrenchment severance',
  '11-redundancy-and-associated-entitlements': 'retrenchment severance',
  '26-redundancy-and-associated-entitlements': 'retrenchment severance',
  '32-redundancy-and-associated-entitlements': 'retrenchment severance',
  '10-redundancy-and-associated-entitlements': 'retrenchment severance',
  '20-redundancy-and-associated-entitlements': 'retrenchment severance',
  '12-redundancy':                             'retrenchment severance',
  '12-redundancy-and-associated-entitlements': 'retrenchment severance',

  // ── TERMINATION ───────────────────────────────────────────────────────────────
  // "fired" and "sacked" do not appear in EBA text.
  '24-termination-of-employment':                        'fired sacked notice period',
  '23-termination-of-employment':                        'fired sacked notice period',
  '29-termination-of-employment':                        'fired sacked notice period',
  '5-notice-of-termination-employer':                    'fired sacked notice period',
  '3-notice-of-termination-employer':                    'fired sacked notice period',
  '31-notice-of-termination':                            'fired sacked notice period',
  '23-termination-of-employment-notice-of-termination':  'fired sacked notice period',
  '28-termination-of-employment':                        'fired sacked notice period',
  '11-termination-of-employment':                        'fired sacked notice period',
  '23-notice-period-before-termination':                 'fired sacked notice period',

  // ── ACCRUED DAYS OFF / TOIL ───────────────────────────────────────────────────
  // "TOIL" and "ADO" are HR abbreviations absent from EBA text.
  '48-accrued-days-off':  'TOIL ADO time off in lieu accrued day off',
  '41-accrued-days-off':  'TOIL ADO time off in lieu accrued day off',
  '47-accrued-days-off':  'TOIL ADO time off in lieu accrued day off',
  '123-ados':             'TOIL ADO time off in lieu accrued day off',
  '197-accrued-days-off': 'TOIL ADO time off in lieu accrued day off',
  '97-accrued-days-off':  'TOIL ADO time off in lieu accrued day off',
  '162-accrued-days-off': 'TOIL ADO time off in lieu accrued day off',
  '43-accrued-days-off':  'TOIL ADO time off in lieu accrued day off',

  // ── ON-CALL / RECALL ──────────────────────────────────────────────────────────
  // "on call" and "standby" are plain-language terms absent from EBA titles.
  '53-recall-return-to-workplace':  'on call on-call standby callout',
  '47-recall':                      'on call on-call standby callout',
  '39-recall-return-to-workplace':  'on call on-call standby callout',
  '44-on-call-recall':              'on call on-call standby callout',
  '60-on-call-re-call':             'on call on-call standby callout',
  '26-on-call-full-time-doctors':   'on call on-call standby callout',
  '91-oncall-recall-non-catt':      'on call on-call standby callout',
  '168-on-call-recall':             'on call on-call standby callout',
  '202-on-call-recall':             'on call on-call standby callout',
  '50-recall-return-to-workplace':  'on call on-call standby callout',

  // ── SHIFT ALLOWANCES ──────────────────────────────────────────────────────────
  // "night shift loading" and "shift penalty" absent from EBA allowance titles.
  '38-shift-work-allowance':   'night shift loading afternoon penalty shift penalty',
  '34-shift-allowances':       'night shift loading afternoon penalty shift penalty',
  '45-shiftwork':              'night shift loading afternoon penalty shift penalty',
  '119-shift-work-allowance':  'night shift loading afternoon penalty shift penalty',
  '84-shift-allowances':       'night shift loading afternoon penalty shift penalty',
  '157-shift-work-allowances': 'night shift loading afternoon penalty shift penalty',
  '194-shift-work-allowances': 'night shift loading afternoon penalty shift penalty',
  '34-shift-allowance':        'night shift loading afternoon penalty shift penalty',

  // ── WAGE INCREASES ────────────────────────────────────────────────────────────
  // "pay rise" and "pay increase" absent from EBA formal language.
  '28-wages-and-wage-increases':                'pay rise pay increase',
  '26-wages-and-allowances':                    'pay rise pay increase',
  '42-remuneration-and-remuneration-increases': 'pay rise pay increase',
  '28-salary-and-allowances-increases':         'pay rise pay increase',
  '51-salaries-and-allowances':                 'pay rise pay increase',
  '31-remuneration-and-remuneration-increases': 'pay rise pay increase',
  '25-salary':                                  'pay rise pay increase',

}

// ── BODY-IGNORE SLUGS ─────────────────────────────────────────────────────────
// Pages whose body text contains high-frequency incidental matches for terms
// that belong to a different primary clause. Adding data-pagefind-ignore to
// their vp-doc div removes body text from Pagefind's TF-IDF scoring entirely.
// The page title is still indexed (from <title> outside vp-doc) so these pages
// remain findable when searched by their own name.
//
// transition-to-retirement: contains "LSL" 8-12 times as EBA drafting language
// for preserved LSL calculations — not because the page is about LSL.
const BODY_IGNORE_SLUGS = new Set([
  '27-transition-to-retirement',   // allied-health
  '25-transition-to-retirement',   // biomedical-engineers
  '32-transition-to-retirement',   // doctors-in-training
  '27-transition-to-retirement',   // has-managers-admin (same slug, Set deduplicates)
  '22-transition-to-retirement',   // medical-specialists
  '27A-transition-to-retirement',  // mental-health
  '20-transition-to-retirement',   // mspp
  '24-transition-to-retirement',   // nurses-midwives
])

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
  // Priority: frontmatter synonyms > extracted body synonyms > global slug map.
  // Global slug synonyms are MERGED with frontmatter/extracted synonyms so that
  // per-page synonyms and global synonyms both apply.
  const fmOrExtracted = (fm.synonyms && fm.synonyms.trim().length > 0)
    ? fm.synonyms.trim()
    : extractedSynonyms
  const globalSynonyms = SLUG_SYNONYMS[slug] || ''
  const synonymsText = [fmOrExtracted, globalSynonyms]
    .filter(s => s.trim().length > 0)
    .join(' ')

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
    // Body-ignore slugs get data-pagefind-ignore instead of data-pagefind-body.
    // This removes their body text from TF-IDF scoring while keeping their
    // page title indexed via the <title> tag outside vp-doc.
    const pagefindBodyAttr = BODY_IGNORE_SLUGS.has(slug)
      ? 'data-pagefind-ignore'
      : 'data-pagefind-body'
    html = html.replace(
      /class="vp-doc ([^"]*)"/,
      `class="vp-doc $1" ${pagefindBodyAttr}`
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