// audit-links.mjs
// Scans all EBA .md files for two categories of bad internal links:
//
//   1. CROSS-EBA LINKS  — a link whose URL belongs to a different EBA than
//      the file it lives in. These were caused by the Pass A / Pass B offset
//      bug in link-clauses.mjs where Pass B re-processed a match that Pass A
//      had already correctly linked, pointing it at a different EBA's slug map.
//
//   2. SELF-REFERENCING LINKS — a link whose URL resolves to the same page as
//      the file that contains it. These should always be plain text.
//
// The script does NOT modify any files. It writes a full report to:
//   C:\Projects\EBAdb\audit-links-report.txt
//
// Run from: C:\Projects\EBAdb\docs
// Usage:    node scripts/audit-links.mjs [--eba allied-health]

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const args      = process.argv.slice(2)
const EBA_FILTER = (() => { const i = args.indexOf('--eba'); return i !== -1 ? args[i + 1] : null })()

// ─── Resolve paths ────────────────────────────────────────────────────────────
const DOCS_ROOT  = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
const EBAS_ROOT  = join(DOCS_ROOT, 'ebas')
const REPORT_OUT = join(DOCS_ROOT, '..', 'audit-links-report.txt')

// ─── Regex: find ALL internal wiki links anywhere in a line ───────────────────
// Matches [any text](/ebas/<eba>/<anything>) — captures the full URL only.
// We deliberately cast the net wide and filter by /ebas/ prefix so we only
// examine links that link-clauses.mjs could have generated.
const INTERNAL_LINK_RE = /\[([^\]]*)\]\((\/ebas\/[^)]+)\)/g

// ─── Counters and report buckets ─────────────────────────────────────────────
let totalFilesScanned   = 0
let totalCrossEba       = 0
let totalSelfRef        = 0

// Each entry: { file, line, lineNum, linkText, url, reason }
const crossEbaIssues = []
const selfRefIssues  = []

// ─── Walk all EBA folders ─────────────────────────────────────────────────────
const ebaFolders = readdirSync(EBAS_ROOT)
  .filter(f => statSync(join(EBAS_ROOT, f)).isDirectory())
  .filter(f => EBA_FILTER ? f === EBA_FILTER : true)

for (const ebaFolder of ebaFolders) {

  // Derive the expected URL prefix for this EBA.
  // Any internal link from a file in this EBA whose URL does NOT start with
  // this prefix is a cross-EBA link.
  const expectedPrefix = `/ebas/${ebaFolder}/`

  walkDir(join(EBAS_ROOT, ebaFolder), (filePath) => {

    const raw = readFileSync(filePath, 'utf8')
    const normalised = raw.replace(/\r\n/g, '\n')

    // Strip frontmatter before scanning — frontmatter cannot contain bad links
    // and its --- delimiters can interfere with line counting.
    const fmMatch = normalised.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/)
    const body    = fmMatch ? fmMatch[1] : normalised

    // Derive the canonical URL for THIS file (what a self-referencing link
    // would look like). Strip .md, normalise to forward slashes, prepend /.
    const selfUrl = '/' + relative(DOCS_ROOT, filePath)
      .replace(/\\/g, '/')
      .replace(/\.md$/, '')

    totalFilesScanned++

    const lines = body.split('\n')
    lines.forEach((line, idx) => {
      // lineNum is 1-based and offset by the frontmatter block length.
      // We report it relative to the body only — good enough for VS Code Ctrl+G.
      const lineNum = idx + 1

      let m
      // Reset lastIndex each time we reuse the regex on a new string
      INTERNAL_LINK_RE.lastIndex = 0

      // Use a fresh regex instance per line to avoid stateful lastIndex issues
      const re = new RegExp(INTERNAL_LINK_RE.source, 'g')

      while ((m = re.exec(line)) !== null) {
        const linkText = m[1]
        const url      = m[2]

        // ── Check 1: Self-reference ────────────────────────────────────────────
        // Strip trailing slash from url for comparison robustness
        const normUrl = url.replace(/\/$/, '')
        if (normUrl === selfUrl) {
          selfRefIssues.push({
            file:     relative(DOCS_ROOT, filePath).replace(/\\/g, '/'),
            lineNum,
            linkText,
            url,
            line:     line.trim(),
          })
          totalSelfRef++
          continue // No need to also flag it as cross-EBA
        }

        // ── Check 2: Cross-EBA link ────────────────────────────────────────────
        // The URL starts with /ebas/ but NOT with this EBA's expected prefix.
        if (!url.startsWith(expectedPrefix)) {
          // Extract the EBA folder the link actually points to
          const parts      = url.split('/')  // ['', 'ebas', '<folder>', ...]
          const actualEba  = parts[2] ?? 'unknown'

          crossEbaIssues.push({
            file:      relative(DOCS_ROOT, filePath).replace(/\\/g, '/'),
            lineNum,
            linkText,
            url,
            actualEba,
            line:      line.trim(),
          })
          totalCrossEba++
        }
      }
    })
  })
}

// ─── Build report ─────────────────────────────────────────────────────────────

const reportLines = []

reportLines.push('═══════════════════════════════════════════════════════════════════════')
reportLines.push('  EBA WIKI — Internal Link Audit Report')
reportLines.push(`  Generated: ${new Date().toLocaleString('en-AU')}`)
reportLines.push(`  EBA filter: ${EBA_FILTER ?? 'all EBAs'}`)
reportLines.push('═══════════════════════════════════════════════════════════════════════')
reportLines.push('')
reportLines.push(`  Files scanned:        ${totalFilesScanned}`)
reportLines.push(`  Cross-EBA links:      ${totalCrossEba}`)
reportLines.push(`  Self-referencing:     ${totalSelfRef}`)
reportLines.push(`  Total issues:         ${totalCrossEba + totalSelfRef}`)
reportLines.push('')

// ── Section 1: Cross-EBA links ────────────────────────────────────────────────
reportLines.push('───────────────────────────────────────────────────────────────────────')
reportLines.push('  SECTION 1 — CROSS-EBA LINKS')
reportLines.push('  These links point to a page in a DIFFERENT EBA than the file they')
reportLines.push('  live in. They must be corrected or removed.')
reportLines.push('───────────────────────────────────────────────────────────────────────')
reportLines.push('')

if (crossEbaIssues.length === 0) {
  reportLines.push('  ✅ No cross-EBA links found.')
  reportLines.push('')
} else {
  // Group by file for readability
  const byFile = groupBy(crossEbaIssues, i => i.file)
  for (const [file, issues] of Object.entries(byFile)) {
    reportLines.push(`  📄 ${file}`)
    for (const issue of issues) {
      reportLines.push(`     Line ${String(issue.lineNum).padEnd(4)}  ❌ CROSS-EBA`)
      reportLines.push(`            Link text : "${issue.linkText}"`)
      reportLines.push(`            URL       : ${issue.url}`)
      reportLines.push(`            Points to : ${issue.actualEba}`)
      reportLines.push(`            Context   : ${issue.line.substring(0, 120)}${issue.line.length > 120 ? '…' : ''}`)
      reportLines.push('')
    }
  }
}

// ── Section 2: Self-referencing links ─────────────────────────────────────────
reportLines.push('───────────────────────────────────────────────────────────────────────')
reportLines.push('  SECTION 2 — SELF-REFERENCING LINKS')
reportLines.push('  These links point back to the same page they live on. They should')
reportLines.push('  be plain text — a link to self only scrolls to the page top.')
reportLines.push('───────────────────────────────────────────────────────────────────────')
reportLines.push('')

if (selfRefIssues.length === 0) {
  reportLines.push('  ✅ No self-referencing links found.')
  reportLines.push('')
} else {
  const byFile = groupBy(selfRefIssues, i => i.file)
  for (const [file, issues] of Object.entries(byFile)) {
    reportLines.push(`  📄 ${file}`)
    for (const issue of issues) {
      reportLines.push(`     Line ${String(issue.lineNum).padEnd(4)}  🔁 SELF-REF`)
      reportLines.push(`            Link text : "${issue.linkText}"`)
      reportLines.push(`            URL       : ${issue.url}`)
      reportLines.push(`            Context   : ${issue.line.substring(0, 120)}${issue.line.length > 120 ? '…' : ''}`)
      reportLines.push('')
    }
  }
}

// ── Section 3: Per-EBA summary table ──────────────────────────────────────────
reportLines.push('───────────────────────────────────────────────────────────────────────')
reportLines.push('  SECTION 3 — PER-EBA SUMMARY')
reportLines.push('───────────────────────────────────────────────────────────────────────')
reportLines.push('')

// Build counts keyed by the host EBA (the EBA the file lives in)
const crossByEba = {}
const selfByEba  = {}
for (const issue of crossEbaIssues) {
  const eba = issue.file.split('/')[1] ?? 'unknown'
  crossByEba[eba] = (crossByEba[eba] ?? 0) + 1
}
for (const issue of selfRefIssues) {
  const eba = issue.file.split('/')[1] ?? 'unknown'
  selfByEba[eba] = (selfByEba[eba] ?? 0) + 1
}

const allEbas = [...new Set([...Object.keys(crossByEba), ...Object.keys(selfByEba)])]
  .sort()

if (allEbas.length === 0) {
  reportLines.push('  ✅ No issues found across any EBA.')
} else {
  reportLines.push(`  ${'EBA'.padEnd(30)} ${'Cross-EBA'.padStart(10)} ${'Self-ref'.padStart(10)} ${'Total'.padStart(8)}`)
  reportLines.push(`  ${'-'.repeat(60)}`)
  for (const eba of allEbas) {
    const c = crossByEba[eba] ?? 0
    const s = selfByEba[eba]  ?? 0
    reportLines.push(`  ${eba.padEnd(30)} ${String(c).padStart(10)} ${String(s).padStart(10)} ${String(c + s).padStart(8)}`)
  }
}

reportLines.push('')
reportLines.push('═══════════════════════════════════════════════════════════════════════')
reportLines.push('  END OF REPORT')
reportLines.push('  Next step: run node scripts/link-clauses.mjs (corrected version)')
reportLines.push('  to strip all existing internal links and re-apply correctly.')
reportLines.push('═══════════════════════════════════════════════════════════════════════')

const report = reportLines.join('\n')

// ─── Write report file ────────────────────────────────────────────────────────
writeFileSync(REPORT_OUT, report, 'utf8')

// ─── Console summary ──────────────────────────────────────────────────────────
console.log('\n📋 EBA Wiki — Link Audit Complete')
console.log(`   Files scanned    : ${totalFilesScanned}`)
console.log(`   Cross-EBA links  : ${totalCrossEba}`)
console.log(`   Self-referencing : ${totalSelfRef}`)
console.log(`   Total issues     : ${totalCrossEba + totalSelfRef}`)
console.log(`\n📄 Full report written to: C:\\Projects\\EBAdb\\audit-links-report.txt`)
if (totalCrossEba + totalSelfRef === 0) {
  console.log('\n✅ No issues found — all internal links are correctly scoped.')
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function walkDir(dir, fn) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      walkDir(full, fn)
    } else if (entry.endsWith('.md')) {
      fn(full)
    }
  }
}

function groupBy(arr, keyFn) {
  const result = {}
  for (const item of arr) {
    const key = keyFn(item)
    if (!result[key]) result[key] = []
    result[key].push(item)
  }
  return result
}
