/**
 * convert-section-indexes.mjs
 * ─────────────────────────────────────────────────────────────────────────────
 * Converts every section and stream level index page from a manually maintained
 * link list to a single <SectionIndex /> component call, one EBA at a time.
 *
 * Detection rule:
 *   A .md file is a section/stream index if a directory with the same base name
 *   exists as a sibling (e.g. allowances.md + allowances/).
 *   index.md files at any depth are always skipped.
 *
 * Conversion:
 *   - Frontmatter block is preserved exactly as-is
 *   - A single prose description line between the heading and link list is
 *     automatically migrated to a description: field in the frontmatter
 *   - Body is replaced with <SectionIndex />
 *   - Pages with body content beyond headings, link lists, pagefind divs, and
 *     one prose description line are flagged ⚠ and skipped for manual review
 *   - Files already containing <SectionIndex are skipped silently
 *
 * Usage:
 *   node scripts/convert-section-indexes.mjs              ← interactive
 *   node scripts/convert-section-indexes.mjs --dry-run    ← preview, no writes
 *   node scripts/convert-section-indexes.mjs --eba allied-health
 *   node scripts/convert-section-indexes.mjs --all        ← skip confirmations
 */

import {
  readdirSync, readFileSync, writeFileSync, existsSync,
} from 'fs'
import { join, relative } from 'path'
import { fileURLToPath }  from 'url'
import { createInterface } from 'readline'

// ── Paths ─────────────────────────────────────────────────────────────────────
const __dirname = fileURLToPath(new URL('.', import.meta.url))
const DOCS_DIR  = join(__dirname, '..')
const EBAS_DIR  = join(DOCS_DIR, 'ebas')

const ALL_EBA_SLUGS = [
  'allied-health', 'biomedical-engineers', 'childrens-services',
  'doctors-in-training', 'has-managers-admin-2025-2027', 'medical-specialists',
  'mental-health', 'mspp', 'nurses-midwives',
]

// ── CLI flags ─────────────────────────────────────────────────────────────────
const args     = process.argv.slice(2)
const DRY_RUN  = args.includes('--dry-run')
const SKIP_ALL = args.includes('--all')
const ebaArg   = (() => {
  const idx = args.indexOf('--eba')
  return idx !== -1 ? args[idx + 1] : null
})()
const EBA_SLUGS = ebaArg ? [ebaArg] : ALL_EBA_SLUGS

// ── Interactive prompt ────────────────────────────────────────────────────────
const rl = createInterface({ input: process.stdin, output: process.stdout })
function prompt(question) {
  return new Promise(resolve => rl.question(question, resolve))
}
process.on('SIGINT', () => {
  console.log('\n\nAborted.')
  rl.close()
  process.exit(0)
})

// ── Find all section/stream index pages under a directory ─────────────────────
function findIndexPages(dir) {
  const pages    = []
  const entries  = readdirSync(dir, { withFileTypes: true })
  const dirNames = new Set(entries.filter(e => e.isDirectory()).map(e => e.name))

  for (const e of entries) {
    if (!e.isFile())             continue
    if (!e.name.endsWith('.md')) continue
    if (e.name === 'index.md')   continue

    const slug = e.name.replace(/\.md$/, '')
    if (!dirNames.has(slug))     continue

    pages.push(join(dir, e.name))
    pages.push(...findIndexPages(join(dir, slug)))
  }
  return pages
}

// ── Description line detection ────────────────────────────────────────────────
// Finds a single prose description line that sits between the heading and the
// link list. This is the only extra content that the script handles automatically
// — it is migrated into description: frontmatter rather than flagging the file.
//
// Returns the trimmed description string, or null if no single description found.
// If more than one candidate line exists the function returns null, leaving the
// file to be flagged for manual review.
function findDescriptionLine(body) {
  const lines       = body.split(/\r?\n/)
  let   headingPast = false
  let   candidate   = null
  let   inDiv       = false
  let   divDepth    = 0

  for (const line of lines) {
    const t = line.trim()

    if (/^<div[^>]*class="pagefind-/.test(t)) { inDiv = true; divDepth = 1; continue }
    if (inDiv) {
      if (/<div[\s>]/.test(t)) divDepth++
      if (/<\/div>/.test(t))   divDepth--
      if (divDepth <= 0)       inDiv = false
      continue
    }

    if (!t)                            continue
    if (/^#{1,6}\s/.test(t))           { headingPast = true; continue }
    if (/^-\s+\[.+\]\(.+\)/.test(t))  break  // reached link list — stop searching
    if (/^<\/div>/.test(t))            continue

    // Only accept plain prose — not markdown constructs or HTML
    if (!headingPast)                  continue
    if (t.startsWith('<'))             continue
    if (t.startsWith(':'))             continue
    if (t.startsWith('>'))             continue
    if (t.startsWith('|'))             continue
    if (t.startsWith('['))             continue
    if (t.startsWith('!'))             continue

    // Second candidate means multiple prose lines — can't auto-migrate
    if (candidate !== null) return null

    candidate = t
  }

  return candidate
}

// ── Body analyser ─────────────────────────────────────────────────────────────
// Returns lines that cannot be safely removed or auto-migrated.
// Pass the detected description line so it is excluded from the extra count.
function findExtraContent(body, excludeLine = null) {
  const lines    = body.split(/\r?\n/)
  const extra    = []
  let   inDiv    = false
  let   divDepth = 0

  for (const line of lines) {
    const t = line.trim()

    if (/^<div[^>]*class="pagefind-/.test(t)) { inDiv = true; divDepth = 1; continue }
    if (inDiv) {
      if (/<div[\s>]/.test(t)) divDepth++
      if (/<\/div>/.test(t))   divDepth--
      if (divDepth <= 0)       inDiv = false
      continue
    }

    if (!t)                            continue
    if (/^#{1,6}\s/.test(t))          continue
    if (/^-\s+\[.+\]\(.+\)/.test(t)) continue
    if (/^<\/div>/.test(t))           continue

    // Exclude the description line — it is being migrated to frontmatter
    if (excludeLine && t === excludeLine) continue

    extra.push(line)
  }
  return extra
}

// ── Build converted file ──────────────────────────────────────────────────────
// Injects description: into frontmatter if provided, then appends <SectionIndex />.
function buildConverted(content, description = null) {
  const match = content.match(/^---\r?\n[\s\S]*?\r?\n---/)
  if (!match) return null

  let frontmatter = match[0]

  if (description) {
    // Escape single quotes for YAML single-quoted string ('' is the YAML escape)
    const escaped = description.replace(/'/g, "''")
    // Insert before the closing --- line
    frontmatter = frontmatter.replace(/(\r?\n)---$/, `$1description: '${escaped}'$1---`)
  }

  return `${frontmatter}\n\n<SectionIndex />\n`
}

// ── Relative path for display ─────────────────────────────────────────────────
function rel(abs) {
  return relative(EBAS_DIR, abs).replace(/\\/g, '/')
}

// ── Main ──────────────────────────────────────────────────────────────────────
console.log('\n╔══════════════════════════════════════════════════════════╗')
console.log(  '║        EBAdb — Section Index Page Converter             ║')
console.log(  '╚══════════════════════════════════════════════════════════╝\n')
console.log(`Mode : ${DRY_RUN  ? '🔍 DRY RUN — no files will be written' : '✏  LIVE — files will be modified'}`)
console.log(`EBAs : ${EBA_SLUGS.join(', ')}`)
if (SKIP_ALL && !DRY_RUN) console.log('Confirm : auto-yes (--all flag set)')
console.log('')

let totalConverted = 0
let totalAlready   = 0
let totalFlagged   = 0
let totalDeclined  = 0

for (const slug of EBA_SLUGS) {
  const ebaDir = join(EBAS_DIR, slug)

  if (!existsSync(ebaDir)) {
    console.log(`⚠  ${slug} — folder not found, skipping\n`)
    continue
  }

  const pages = findIndexPages(ebaDir)

  if (pages.length === 0) {
    console.log(`──  ${slug} — no section index pages detected\n`)
    continue
  }

  // ── Analyse ─────────────────────────────────────────────────────────────────
  const plan = pages.map(mdPath => {
    const content        = readFileSync(mdPath, 'utf-8')
    const hasFrontmatter = /^---\r?\n/.test(content)
    const body           = content.replace(/^---\r?\n[\s\S]*?\r?\n---/, '').trim()
    const alreadyDone    = body.includes('<SectionIndex')
    const description    = alreadyDone ? null : findDescriptionLine(body)
    const extra          = alreadyDone ? [] : findExtraContent(body, description)
    return {
      mdPath,
      content,
      hasFrontmatter,
      alreadyDone,
      description,   // non-null means this line migrates to description: frontmatter
      extra,
      convertible: hasFrontmatter && !alreadyDone && extra.length === 0,
    }
  })

  const toConvert = plan.filter(p => p.convertible)
  const flagged   = plan.filter(p => !p.convertible && !p.alreadyDone)
  const already   = plan.filter(p => p.alreadyDone)

  // ── Report ──────────────────────────────────────────────────────────────────
  const bar = '─'.repeat(Math.max(4, 54 - slug.length))
  console.log(`── ${slug} ${bar}`)

  for (const p of plan) {
    const r = rel(p.mdPath)
    if (p.alreadyDone) {
      console.log(`  ✓  ${r}  (already converted)`)
    } else if (p.convertible) {
      const note = p.description ? `  [desc → frontmatter]` : ''
      console.log(`  ✓  ${r}${note}`)
    } else {
      console.log(`  ⚠  ${r}  ← SKIP — manual review needed`)
      if (!p.hasFrontmatter) console.log(`       No frontmatter block found`)
      for (const line of p.extra.slice(0, 3)) {
        console.log(`       → ${line.trim().slice(0, 72)}`)
      }
      if (p.extra.length > 3) console.log(`       … and ${p.extra.length - 3} more line(s)`)
    }
  }

  console.log(`\n  Ready to convert : ${toConvert.length}`)
  if (already.length  > 0) console.log(`  Already done     : ${already.length}`)
  if (flagged.length  > 0) console.log(`  Needs review     : ${flagged.length}  (see ⚠ above)`)

  totalAlready  += already.length
  totalFlagged  += flagged.length

  if (toConvert.length === 0) { console.log(''); continue }

  if (DRY_RUN) {
    const withDesc = toConvert.filter(p => p.description).length
    if (withDesc > 0) {
      console.log(`  [dry-run — ${withDesc} page(s) would have description migrated to frontmatter]`)
    }
    console.log(`  [dry-run — no files written]\n`)
    totalConverted += toConvert.length
    continue
  }

  // ── Confirm ─────────────────────────────────────────────────────────────────
  let proceed = SKIP_ALL
  if (!SKIP_ALL) {
    const answer = await prompt(`\n  Convert ${toConvert.length} page(s) in ${slug}? [y/N] `)
    proceed = answer.trim().toLowerCase() === 'y'
  }

  if (!proceed) {
    console.log(`  Skipped.\n`)
    totalDeclined += toConvert.length
    continue
  }

  // ── Write ────────────────────────────────────────────────────────────────────
  for (const { mdPath, content, description } of toConvert) {
    const converted = buildConverted(content, description)
    writeFileSync(mdPath, converted, 'utf-8')
    const note = description ? `  [description migrated]` : ''
    console.log(`  → ${rel(mdPath)}${note}`)
  }
  totalConverted += toConvert.length
  console.log('')
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('─'.repeat(58))
if (DRY_RUN) {
  console.log(`DRY RUN complete. ${totalConverted} page(s) would be converted.`)
} else {
  console.log(`Converted  : ${totalConverted}`)
}
if (totalAlready  > 0) console.log(`Already done : ${totalAlready}`)
if (totalFlagged  > 0) console.log(`Need review  : ${totalFlagged}  — check ⚠ pages above and convert manually`)
if (totalDeclined > 0) console.log(`Declined     : ${totalDeclined}  — re-run to convert these`)

if (!DRY_RUN && totalConverted > 0) {
  console.log('\nNext steps:')
  console.log('  1.  node scripts/generate-section-index.mjs  — refresh generated data')
  console.log('  2.  npm run docs:dev                         — verify pages in browser')
  console.log('  3.  git add / commit per EBA\n')
}

rl.close()