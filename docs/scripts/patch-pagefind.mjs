// patch-pagefind.mjs
// Runs after vitepress build.
// 1. Strips ALL previously injected pagefind divs (idempotent, handles duplicates)
// 2. Injects data-pagefind-body onto the vp-doc div
// 3. Injects data-pagefind-filter spans for eba and topics filters
// 4. Injects data-pagefind-weight div — score based on slug/topic relevance
// 5. Injects data-pagefind-meta="excerpt" div — custom excerpt fallback for
//    title-only / table-cell matches (consumed by SearchModal getExcerpt())
// 6. Injects hidden synonyms div at END of body with data-pagefind-ignore

import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const distDir = new URL('../.vitepress/dist', import.meta.url).pathname
  .replace(/^\/([A-Z]:)/, '$1')

const docsDir = new URL('..', import.meta.url).pathname
  .replace(/^\/([A-Z]:)/, '$1')

let patched          = 0
let skipped          = 0
let excerptMetaCount = 0

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

// Escape characters that are special inside HTML attribute values and text content.
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// ── getFirstProse ─────────────────────────────────────────────────────────────
// Reads the markdown source file and returns the first meaningful prose
// sentence from the clause body — skipping frontmatter, headings, HTML tags,
// table rows, code fences, VitePress containers, and horizontal rules.
//
// Used to build the custom meta excerpt fallback injected into HTML so that
// SearchModal can display a relevant excerpt when Pagefind's auto-excerpt
// anchors on a table cell or clause-opening preamble unrelated to the query.
//
// Rules:
//   - Line must be ≥ 20 chars after stripping markdown syntax
//   - Markdown bold, italic, links, inline code, bullet/blockquote/list
//     markers are stripped to leave clean readable prose
//   - Truncated at 130 chars at a word boundary with ellipsis
function getFirstProse(mdPath) {
  if (!existsSync(mdPath)) return ''
  const content = readFileSync(mdPath, 'utf8')

  // Strip the frontmatter block entirely before scanning lines.
  const body = content.replace(/^---[\s\S]*?---\r?\n/, '')
  const lines = body.split(/\r?\n/)

  let inCodeFence = false
  for (const rawLine of lines) {
    const line = rawLine.trim()

    // Track code fence blocks — skip everything inside them.
    if (line.startsWith('```') || line.startsWith('~~~')) {
      inCodeFence = !inCodeFence
      continue
    }
    if (inCodeFence) continue

    if (!line)                              continue  // empty
    if (line.startsWith('#'))              continue  // headings
    if (line.startsWith('<'))              continue  // HTML tags/elements
    if (line.startsWith('|'))             continue  // table rows
    if (line.startsWith(':'))             continue  // VitePress containers (:::tip etc.)
    if (/^[-*_=]{3,}$/.test(line))       continue  // horizontal rules / separators
    if (line.length < 20)                 continue  // too short to be meaningful prose

    // Strip markdown formatting to produce clean readable text.
    let clean = line
      .replace(/\*\*([^*]+)\*\*/g, '$1')           // **bold** → bold
      .replace(/\*([^*]+)\*/g, '$1')                // *italic* → italic
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')     // [text](url) → text
      .replace(/`([^`]+)`/g, '$1')                  // `code` → code
      .replace(/^[-*+]\s+/, '')                     // bullet markers
      .replace(/^>\s*/, '')                         // blockquote markers
      .replace(/^\d+\.\s+/, '')                     // ordered list markers
      .trim()

    if (clean.length < 20) continue

    // Truncate at 130 chars at the nearest word boundary.
    if (clean.length > 130) {
      clean = clean.slice(0, 127).replace(/\s+\S*$/, '') + '…'
    }

    return clean
  }
  return ''
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
//  2      10    Primary numbered clause whose slug directly matches its topic,
//               confirmed by a slug-specificity ratio ≥ 0.30 (see below)
//  3       7    Named section-index (no leading digit, not preliminary)
//  4       6    General numbered clause — tagged but no primary slug-topic match
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
  // ── G2: Subsidiary overtime consequence clauses ───────────────────────────────
  // "Rest period after overtime" and "ten hour break" pages describe a mandatory
  // rest entitlement triggered BY overtime — they are not overtime clauses.
  // Their body text references overtime conditions extensively, causing TF-IDF
  // contamination. Weight 3 + full body suppression (BODY_IGNORE_PATTERNS) is
  // the combined defence. Pattern coverage ensures future EBAs are caught
  // automatically without needing explicit slug entries.
  /rest.period.after.overtime/,
  /rest.period.after.excessive/,
  /ten.hour.break/,
  // ── F2: Subsidiary leave clauses ─────────────────────────────────────────────
  // "Cashing out" clauses are procedural sub-clauses of the parent leave clause.
  // They match "annual leave" queries via TF-IDF but should never outrank the
  // primary annual leave clause. Weight 3 ensures they appear well below it.
  /cashing.out/,
  // RCH-specific Mental Health schedule pages (e.g. 211-conversion-of-unused-
  // sick-leave-to-annual-leave) contain formal sick-leave terminology in their
  // title and body but are narrow sub-schedules for a single hospital.
  // Weight 3 prevents them surfacing above cross-EBA primary clauses.
  /conversion.of.unused/,
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
  '54-parental-leave':   'maternity leave paternity leave adoption leave',
  '50-parental-leave':   'maternity leave paternity leave adoption leave',

  // ── COMPASSIONATE LEAVE ───────────────────────────────────────────────────────
  // "bereavement leave" is the common search term; EBAs use "compassionate leave".
  '65-compassionate-leave':  'bereavement leave funeral leave',
  '56-compassionate-leave':  'bereavement leave funeral leave',
  '62-compassionate-leave':  'bereavement leave funeral leave',
  '57-compassionate-leave':  'bereavement leave funeral leave',
  '63-compassionate-leave':  'bereavement leave funeral leave',
  '48-compassionate-leave':  'bereavement leave funeral leave',
  '39A-compassionate-leave': 'bereavement leave funeral leave',
  '26-compassionate-leave':  'bereavement leave funeral leave',
  '62-personal-leave-including-carer-s-leave': 'bereavement leave funeral leave',

  // ── FAMILY VIOLENCE LEAVE ─────────────────────────────────────────────────────
  // "domestic violence" is the common search term.
  '71-family-violence-leave': 'domestic violence leave DV leave',
  '64-family-violence-leave': 'domestic violence leave DV leave',
  '69-family-violence-leave': 'domestic violence leave DV leave',
  '63-family-violence-leave': 'domestic violence leave DV leave',
  '68-family-violence-leave': 'domestic violence leave DV leave',
  '56-family-violence-leave': 'domestic violence leave DV leave',
  '40A-family-violence-leave':'domestic violence leave DV leave',
  '27-family-violence-leave': 'domestic violence leave DV leave',
  '69-family-violence-leave': 'domestic violence leave DV leave',

  // ── JURY DUTY ─────────────────────────────────────────────────────────────────
  '69-jury-service':    'jury duty court attendance',
  '62-jury-service':    'jury duty court attendance',
  '66-jury-service':    'jury duty court attendance',
  '61-jury-service':    'jury duty court attendance',
  '66-jury-service':    'jury duty court attendance',
  '53-jury-service':    'jury duty court attendance',
  '37A-jury-service':   'jury duty court attendance',
  '24-jury-service':    'jury duty court attendance',
  '66-jury-service':    'jury duty court attendance',

  // ── REDUNDANCY ────────────────────────────────────────────────────────────────
  // "retrenchment" is an alternate term still found in older HR correspondence.
  '80-redundancy':  'retrenchment severance redundancy pay',
  '72-redundancy':  'retrenchment severance redundancy pay',
  '77-redundancy':  'retrenchment severance redundancy pay',
  '76-redundancy':  'retrenchment severance redundancy pay',
  '74-redundancy':  'retrenchment severance redundancy pay',
  '62-redundancy':  'retrenchment severance redundancy pay',
  '47-redundancy':  'retrenchment severance redundancy pay',
  '35-redundancy':  'retrenchment severance redundancy pay',

  // ── MEAL ALLOWANCE ────────────────────────────────────────────────────────────
  // "meal break allowance" and "food allowance" absent from EBA text.
  '36-allowances-related-to-overtime-and-on-call': 'meal break allowance food allowance',
  '34-overtime-and-on-call-allowances':            'meal break allowance food allowance',
  '38-overtime-and-on-call-allowances':            'meal break allowance food allowance',
  '35-overtime-and-on-call-allowances':            'meal break allowance food allowance',
  '37-overtime-and-on-call-allowances':            'meal break allowance food allowance',

  // ── SHIFT WORK / PENALTY RATES ────────────────────────────────────────────────
  // "afternoon shift", "night shift loading" absent from most EBA text.
  '38-shift-work-allowance':       'night shift loading afternoon penalty shift penalty',
  '36-shift-work-allowances':      'night shift loading afternoon penalty shift penalty',
  '40-shift-work-allowances':      'night shift loading afternoon penalty shift penalty',
  '39-shift-work-allowances':      'night shift loading afternoon penalty shift penalty',
  '41-shift-work-allowances':      'night shift loading afternoon penalty shift penalty',
  '194-shift-work-allowances':     'night shift loading afternoon penalty shift penalty',
  '34-shift-allowance':            'night shift loading afternoon penalty shift penalty',

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
  // ── Transition to retirement ──────────────────────────────────────────────────
  // These pages reference LSL extensively in EBA drafting language for preserved
  // LSL calculations — not because the page is about LSL. Body suppression
  // prevents TF-IDF contamination of primary LSL clause searches.
  '27-transition-to-retirement',   // allied-health
  '25-transition-to-retirement',   // biomedical-engineers
  '32-transition-to-retirement',   // doctors-in-training
  '27-transition-to-retirement',   // has-managers-admin (same slug, Set deduplicates)
  '22-transition-to-retirement',   // medical-specialists
  '27A-transition-to-retirement',  // mental-health
  '20-transition-to-retirement',   // mspp
  '24-transition-to-retirement',   // nurses-midwives

  // ── Rest period after overtime / ten hour break ───────────────────────────────
  // These pages describe a consequence of overtime (a mandatory rest period) and
  // reference "overtime" heavily in their body text. This causes them to outrank
  // primary overtime clauses for broad "overtime" queries via TF-IDF dominance —
  // confirmed by diagnostic testing where weight changes alone were insufficient.
  //
  // Body suppression means these pages remain findable by their title
  // (e.g. searching "ten hour break" or "rest period after overtime" still works)
  // but no longer pollute broad single-word "overtime" searches.
  '55-rest-period-after-overtime-recall-ten-hour-break',  // allied-health
  '48-rest-period-after-overtime-recall-ten-hour-break',  // biomedical-engineers
  '131-ten-hour-break',                                   // mental-health (health-professionals stream)
  '93-ten-hour-break-between-overtime-recall',            // mental-health (rpn-pen-mho stream)
  '53-rest-period-after-overtime-recall',                 // nurses-midwives
  '54-rest-period-after-excessive-hours',                 // nurses-midwives

  // ── Cashing out of annual leave ───────────────────────────────────────────────
  // These pages define the cashing-out procedure and mention "annual leave"
  // extensively — EBA text must define the leave being cashed, calculate balances,
  // and set conditions, all of which repeat "annual leave" many times.
  //
  // PRELIMINARY_PATTERNS already assigns these weight 3 (vs primary clause weight
  // 10), but diagnostic testing confirmed the TF-IDF gap exceeds the 3.33× weight
  // advantage. Body suppression is the correct additional lever: these pages remain
  // findable when searching "cashing out annual leave" (title match) but no longer
  // dominate a general "annual leave" search.
  '60-cashing-out-of-annual-leave',  // allied-health
  '52-cashing-out-of-annual-leave',  // biomedical-engineers
  '59-cashing-out-of-annual-leave',  // nurses-midwives
])

// ── BODY-IGNORE PATTERNS ──────────────────────────────────────────────────────
// Regex patterns that extend BODY_IGNORE_SLUGS with class-based coverage.
// Where BODY_IGNORE_SLUGS requires an exact slug, these patterns match any
// slug that fits a known problematic class — so future EBAs are suppressed
// automatically without needing manual slug additions.
//
// Convention: use . as a wildcard between words (matches hyphens in slug strings).
// All patterns are tested against the lowercase slug.
//
// Pair each pattern with a matching entry in PRELIMINARY_PATTERNS (weight 3)
// for defence in depth: body suppressed AND weight reduced.
const BODY_IGNORE_PATTERNS = [
  // Transition to retirement — also named explicitly in BODY_IGNORE_SLUGS;
  // pattern here catches any variant added by a future EBA.
  /transition.to.retirement/,
  // Rest period / ten hour break after overtime or excessive hours.
  // These describe a consequence of overtime, not overtime itself.
  /rest.period.after.overtime/,
  /rest.period.after.excessive/,
  /ten.hour.break/,
  // Cashing out of leave — procedure clauses that saturate "annual leave" TF-IDF.
  /cashing.out.of.annual.leave/,
  // Conversion procedures (e.g. RCH sick-leave-to-annual-leave sub-schedules).
  /conversion.of.unused/,
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

  // ── F1: Slug specificity ratio ────────────────────────────────────────────────
  // Extract content words from the slug by stripping the leading clause number
  // and splitting on hyphens. Short connector words (≤2 chars, e.g. "of", "to",
  // "in", "s") are filtered out — they are not meaningful for specificity scoring.
  //
  // The ratio measures what fraction of a slug's meaningful words are covered
  // by the topic words. A high ratio (≥0.30) means this slug IS primarily about
  // the topic → primary clause → weight 10. A low ratio means the topic word
  // appears incidentally inside a longer subsidiary clause → weight 6.
  //
  // Calibration examples (threshold 0.30):
  //   52-overtime                              → 1/1 = 1.00 → weight 10 ✓ (primary)
  //   55-rest-period-after-overtime-recall-... → 1/8 = 0.13 → weight  6 ✓ (subsidiary)
  //   57-annual-leave                          → 1/2 = 0.50 → weight 10 ✓ (primary)
  //   59-cashing-out-of-annual-leave           → 1/4 = 0.25 → weight  6 ✓ (subsidiary)
  //   54-personal-carer-s-leave                → 1/3 = 0.33 → weight 10 ✓ (primary)
  //   33-allowances-related-to-overtime        → 1/3 = 0.33 → weight 10 ✓ (primary allowance)
  const slugContentWords = slugNorm
    .replace(/^\d+[a-z]?-/, '')   // strip leading clause number (e.g. "52-", "38A-")
    .split('-')
    .filter(w => w.length > 2)    // drop connectors: "of", "to", "in", "s", "at"

  for (const topic of topicList) {
    // Split hyphenated topic into words; ignore short connectors (≤2 chars)
    const topicWords = topic.split(/[-\s]+/).filter(w => w.length > 2)
    if (topicWords.length === 0) continue

    // ALL topic words must appear in the full slug — necessary condition.
    const allMatch = topicWords.every(word => slugNorm.includes(word))
    if (!allMatch) continue

    // Specificity: count slug content words covered by any topic word.
    // Bi-directional substring match handles plurals and compound words
    // (e.g. slug word "allowance" is covered by topic word "allowances").
    const matchCount = slugContentWords.filter(w =>
      topicWords.some(tw => w.includes(tw) || tw.includes(w))
    ).length

    const specificity = slugContentWords.length > 0
      ? matchCount / slugContentWords.length
      : 1  // no content words after stripping number → treat as full match

    if (specificity >= 0.30) return 10
    // allMatch was true but specificity is low → topic word appears incidentally
    // in a longer subsidiary clause. Fall through to weight 6.
  }

  // Tagged but no primary slug-topic match → general supporting clause
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
  html = stripAllDivs(html, 'pagefind-excerpt-meta')

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
  // Archived agreements are excluded from filter spans entirely so they cannot
  // appear in the EBA filter dropdown's underlying Pagefind facet counts, and
  // cannot surface via filtered search even if data-pagefind-ignore is bypassed.
  const isArchivedSlugPath = relative(distDir, file).replace(/\\/g, '/').startsWith('ebas/archive/')
  let filterSpans = ''
  if (fm.eba && !isArchivedSlugPath) {
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

  // ── EXCERPT META DIV ─────────────────────────────────────────────────────────
  // Injects a custom Pagefind meta "excerpt" field built from the page's
  // frontmatter title and the first meaningful prose sentence in the .md source.
  //
  // SearchModal.vue's getExcerpt() consumes this via result.meta?.excerpt when
  // Pagefind's auto-excerpt contains no <mark> highlights — i.e. when the match
  // was via page title or table cell content rather than prose body text.
  //
  // Placed outside data-pagefind-body (after </main>) so the synthetic text
  // does not affect TF-IDF scoring of the page's content index.
  let excerptMetaDiv = ''
  if (fm.title) {
    const prose = getFirstProse(mdPath)
    if (prose) {
      const metaText = escapeHtml(`${fm.title} — ${prose}`)
      excerptMetaDiv = `<div class="pagefind-excerpt-meta" data-pagefind-meta="excerpt" data-allow-mismatch style="display:none" aria-hidden="true">${metaText}</div>`
      excerptMetaCount++
    }
  }

  // Archived pages get data-pagefind-ignore on <html> itself. Without this,
  // Pagefind falls back to indexing the entire <body> for any page that has
  // no data-pagefind-body element anywhere on it — which is exactly what an
  // archived page looks like once vp-doc is marked ignore-only. That fallback
  // was why archived content kept surfacing in search despite vp-doc being
  // excluded.
  const isFullyArchived = relHtml.replace(/\\/g, '/').startsWith('ebas/archive/')
  if (isFullyArchived && /<html\b[^>]*>/.test(html)) {
    html = html.replace(/<html\b([^>]*)>/, (m, attrs) => {
      if (/data-pagefind-ignore/.test(attrs)) return m
      return `<html${attrs} data-pagefind-ignore>`
    })
  }

  if (html.includes('class="vp-doc ')) {
    // Body-ignore slugs and patterns get data-pagefind-ignore instead of
    // data-pagefind-body. This removes body text from TF-IDF scoring while
    // keeping the page title indexed (via <title> outside vp-doc) so the
    // page remains findable when searched directly by its own name.
    // BODY_IGNORE_SLUGS: exact named slugs (confirmed problem pages).
    // BODY_IGNORE_PATTERNS: regex class coverage (catches future EBAs automatically).
    const isArchivedPath = relHtml.replace(/\\/g, '/').startsWith('ebas/archive/')
    const pagefindBodyAttr = (
      isArchivedPath ||
      BODY_IGNORE_SLUGS.has(slug) ||
      BODY_IGNORE_PATTERNS.some(re => re.test(slug.toLowerCase()))
    ) ? 'data-pagefind-ignore' : 'data-pagefind-body'
    html = html.replace(
      /class="vp-doc ([^"]*)"/,
      `class="vp-doc $1" ${pagefindBodyAttr}`
    )

    const topMarkup = `${filterSpans}${weightDiv}`

    const allBlocks = `${topMarkup}${synonymBlock}${excerptMetaDiv}`
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

console.log(`Patched ${patched} files, skipped ${skipped}, excerpt meta injected on ${excerptMetaCount} pages`)
