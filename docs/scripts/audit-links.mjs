// audit-links.mjs
// Scans all EBA .md files for three categories of bad internal links:
//
//   1. CROSS-EBA LINKS    — a link whose URL belongs to a different EBA than
//      the file it lives in (caused by link-clauses.mjs offset bugs).
//
//   2. SELF-REFERENCING   — a link that points back to its own page.
//
//   3. 404 LINKS          — a link whose target path does not exist on disk,
//      meaning it would return a 404 at runtime. Triggered by --check-404.
//      Clause pages are resolved to .md files; index/section URLs are resolved
//      to folders. Both standard (5-part) and nested (6-part) URL structures
//      are handled.
//
// The script does NOT modify any files. It always writes a human-readable
// report to:
//   C:\Projects\EBAdb\audit-links-report.txt
//
// When --check-404 is passed it ALSO writes a machine-readable JSON report to:
//   C:\Projects\EBAdb\docs\public\link-report.json
// This JSON file is deployed as a static asset and consumed by the
// AnalyticsDashboard "Link Health" tab.
//
// Run from: C:\Projects\EBAdb\docs
// Usage:
//   node scripts/audit-links.mjs                         # cross-EBA + self-ref only
//   node scripts/audit-links.mjs --check-404             # all three checks
//   node scripts/audit-links.mjs --check-404 --eba allied-health
//   node scripts/audit-links.mjs --check-404 --summary   # exit 0; print summary only

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'fs'
import { join, relative } from 'path'

// ─── CLI args ─────────────────────────────────────────────────────────────────
const args        = process.argv.slice(2)
const EBA_FILTER  = (() => { const i = args.indexOf('--eba'); return i !== -1 ? args[i + 1] : null })()
const CHECK_404   = args.includes('--check-404')
const SUMMARY_ONLY = args.includes('--summary')

// ─── Resolve paths ────────────────────────────────────────────────────────────
// import.meta.url points at docs/scripts/audit-links.mjs
// Going up one level (..) lands at docs/
const DOCS_ROOT   = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
const EBAS_ROOT   = join(DOCS_ROOT, 'ebas')
const PUBLIC_DIR  = join(DOCS_ROOT, 'public')
const REPORT_OUT  = join(DOCS_ROOT, '..', 'audit-links-report.txt')
const JSON_OUT    = join(PUBLIC_DIR, 'link-report.json')

// ─── Regex: find ALL internal /ebas/ links anywhere in a line ────────────────
// Captures link text and URL separately.
const INTERNAL_LINK_RE = /\[([^\]]*)\]\((\/ebas\/[^)]+)\)/g

// ─── Counters and report buckets ─────────────────────────────────────────────
let totalFilesScanned = 0
let totalCrossEba     = 0
let totalSelfRef      = 0
let total404          = 0

// Each entry: { file, lineNum, linkText, url, line, [extra fields] }
const crossEbaIssues = []
const selfRefIssues  = []
const missing404     = []   // populated only when --check-404

// ─── Walk all EBA folders ─────────────────────────────────────────────────────
const ebaFolders = readdirSync(EBAS_ROOT)
  .filter(f => statSync(join(EBAS_ROOT, f)).isDirectory())
  .filter(f => EBA_FILTER ? f === EBA_FILTER : true)

for (const ebaFolder of ebaFolders) {

  // Any internal link from a file in this EBA whose URL does NOT start with
  // this prefix is a cross-EBA link.
  const expectedPrefix = `/ebas/${ebaFolder}/`

  walkDir(join(EBAS_ROOT, ebaFolder), (filePath) => {

    const raw        = readFileSync(filePath, 'utf8')
    const normalised = raw.replace(/\r\n/g, '\n')

    // Strip frontmatter before scanning
    const fmMatch = normalised.match(/^---\n[\s\S]*?\n---\n([\s\S]*)$/)
    const body    = fmMatch ? fmMatch[1] : normalised

    // Canonical URL for this file (what a self-referencing link looks like)
    const selfUrl = '/' + relative(DOCS_ROOT, filePath)
      .replace(/\\/g, '/')
      .replace(/\.md$/, '')

    totalFilesScanned++

    const lines = body.split('\n')
    lines.forEach((line, idx) => {
      const lineNum = idx + 1
      const re = new RegExp(INTERNAL_LINK_RE.source, 'g')
      let m

      while ((m = re.exec(line)) !== null) {
        const linkText = m[1]
        const url      = m[2]

        // ── Check 1: Self-reference ───────────────────────────────────────────
        const normUrl = url.replace(/\/$/, '')
        if (normUrl === selfUrl) {
          selfRefIssues.push({
            file: relative(DOCS_ROOT, filePath).replace(/\\/g, '/'),
            lineNum, linkText, url,
            line: line.trim(),
          })
          totalSelfRef++
          continue
        }

        // ── Check 2: Cross-EBA link ───────────────────────────────────────────
        if (!url.startsWith(expectedPrefix)) {
          const parts     = url.split('/')
          const actualEba = parts[2] ?? 'unknown'
          crossEbaIssues.push({
            file: relative(DOCS_ROOT, filePath).replace(/\\/g, '/'),
            lineNum, linkText, url, actualEba,
            line: line.trim(),
          })
          totalCrossEba++
          // Fall through — also check if it 404s (wrong EBA AND missing = worse)
        }

        // ── Check 3: 404 (missing target on disk) ────────────────────────────
        if (CHECK_404) {
          const result = resolveUrl(url, DOCS_ROOT, EBAS_ROOT)
          if (!result.exists) {
            missing404.push({
              file:         relative(DOCS_ROOT, filePath).replace(/\\/g, '/'),
              lineNum, linkText, url,
              line:         line.trim(),
              resolvedPath: result.resolvedPath,
              urlType:      result.urlType,   // 'clause' | 'index' | 'malformed'
            })
            total404++
          }
        }
      }
    })
  })
}

// ─── Build human-readable report ──────────────────────────────────────────────
const generatedAt = new Date().toLocaleString('en-AU')
const reportLines = []

reportLines.push('═══════════════════════════════════════════════════════════════════════')
reportLines.push('  EBA WIKI — Internal Link Audit Report')
reportLines.push(`  Generated : ${generatedAt}`)
reportLines.push(`  EBA filter: ${EBA_FILTER ?? 'all EBAs'}`)
reportLines.push(`  404 check : ${CHECK_404 ? 'enabled' : 'disabled (pass --check-404 to enable)'}`)
reportLines.push('═══════════════════════════════════════════════════════════════════════')
reportLines.push('')
reportLines.push(`  Files scanned:        ${totalFilesScanned}`)
reportLines.push(`  Cross-EBA links:      ${totalCrossEba}`)
reportLines.push(`  Self-referencing:     ${totalSelfRef}`)
if (CHECK_404) {
  reportLines.push(`  Missing targets (404):${total404}`)
}
reportLines.push(`  Total issues:         ${totalCrossEba + totalSelfRef + total404}`)
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

// ── Section 3: Missing targets (404) ──────────────────────────────────────────
if (CHECK_404) {
  reportLines.push('───────────────────────────────────────────────────────────────────────')
  reportLines.push('  SECTION 3 — MISSING LINK TARGETS (would return 404)')
  reportLines.push('  These links point to a URL that has no matching .md file or folder')
  reportLines.push('  on disk. They will return a 404 page at runtime.')
  reportLines.push('───────────────────────────────────────────────────────────────────────')
  reportLines.push('')

  if (missing404.length === 0) {
    reportLines.push('  ✅ No missing link targets found.')
    reportLines.push('')
  } else {
    // Group by EBA (first two path segments of the source file) for readability
    const byFile = groupBy(missing404, i => i.file)
    for (const [file, issues] of Object.entries(byFile)) {
      reportLines.push(`  📄 ${file}`)
      for (const issue of issues) {
        reportLines.push(`     Line ${String(issue.lineNum).padEnd(4)}  🚫 404 — ${issue.urlType.toUpperCase()}`)
        reportLines.push(`            Link text    : "${issue.linkText}"`)
        reportLines.push(`            URL          : ${issue.url}`)
        reportLines.push(`            Resolved to  : ${issue.resolvedPath}`)
        reportLines.push(`            Context      : ${issue.line.substring(0, 120)}${issue.line.length > 120 ? '…' : ''}`)
        reportLines.push('')
      }
    }
  }
}

// ── Section 4 (was 3): Per-EBA summary table ──────────────────────────────────
reportLines.push('───────────────────────────────────────────────────────────────────────')
reportLines.push('  SECTION 4 — PER-EBA SUMMARY')
reportLines.push('───────────────────────────────────────────────────────────────────────')
reportLines.push('')

const crossByEba   = {}
const selfByEba    = {}
const missing4ByEba = {}

for (const issue of crossEbaIssues) {
  const eba = issue.file.split('/')[1] ?? 'unknown'
  crossByEba[eba] = (crossByEba[eba] ?? 0) + 1
}
for (const issue of selfRefIssues) {
  const eba = issue.file.split('/')[1] ?? 'unknown'
  selfByEba[eba] = (selfByEba[eba] ?? 0) + 1
}
for (const issue of missing404) {
  const eba = issue.file.split('/')[1] ?? 'unknown'
  missing4ByEba[eba] = (missing4ByEba[eba] ?? 0) + 1
}

const allEbas = [...new Set([
  ...Object.keys(crossByEba),
  ...Object.keys(selfByEba),
  ...Object.keys(missing4ByEba),
])].sort()

if (allEbas.length === 0) {
  reportLines.push('  ✅ No issues found across any EBA.')
} else {
  if (CHECK_404) {
    reportLines.push(`  ${'EBA'.padEnd(30)} ${'Cross-EBA'.padStart(10)} ${'Self-ref'.padStart(10)} ${'404'.padStart(6)} ${'Total'.padStart(8)}`)
    reportLines.push(`  ${'-'.repeat(68)}`)
    for (const eba of allEbas) {
      const c = crossByEba[eba]    ?? 0
      const s = selfByEba[eba]     ?? 0
      const m = missing4ByEba[eba] ?? 0
      reportLines.push(`  ${eba.padEnd(30)} ${String(c).padStart(10)} ${String(s).padStart(10)} ${String(m).padStart(6)} ${String(c + s + m).padStart(8)}`)
    }
  } else {
    reportLines.push(`  ${'EBA'.padEnd(30)} ${'Cross-EBA'.padStart(10)} ${'Self-ref'.padStart(10)} ${'Total'.padStart(8)}`)
    reportLines.push(`  ${'-'.repeat(60)}`)
    for (const eba of allEbas) {
      const c = crossByEba[eba] ?? 0
      const s = selfByEba[eba]  ?? 0
      reportLines.push(`  ${eba.padEnd(30)} ${String(c).padStart(10)} ${String(s).padStart(10)} ${String(c + s).padStart(8)}`)
    }
  }
}

reportLines.push('')
reportLines.push('═══════════════════════════════════════════════════════════════════════')
reportLines.push('  END OF REPORT')
reportLines.push('  Next step: run node scripts/link-clauses.mjs (corrected version)')
reportLines.push('  to strip all existing internal links and re-apply correctly.')
reportLines.push('═══════════════════════════════════════════════════════════════════════')

const report = reportLines.join('\n')

// ─── Write human-readable report ──────────────────────────────────────────────
writeFileSync(REPORT_OUT, report, 'utf8')

// ─── Write machine-readable JSON (only when --check-404) ──────────────────────
if (CHECK_404) {
  // Ensure docs/public/ exists (it always should, but guard anyway)
  if (!existsSync(PUBLIC_DIR)) mkdirSync(PUBLIC_DIR, { recursive: true })

  const totalIssues = totalCrossEba + totalSelfRef + total404

  // Per-EBA breakdown combining all issue types
  const ebaBreakdown = {}
  for (const eba of ebaFolders) {
    ebaBreakdown[eba] = { crossEba: 0, selfRef: 0, missing404: 0 }
  }
  for (const i of crossEbaIssues) {
    const eba = i.file.split('/')[1] ?? 'unknown'
    if (!ebaBreakdown[eba]) ebaBreakdown[eba] = { crossEba: 0, selfRef: 0, missing404: 0 }
    ebaBreakdown[eba].crossEba++
  }
  for (const i of selfRefIssues) {
    const eba = i.file.split('/')[1] ?? 'unknown'
    if (!ebaBreakdown[eba]) ebaBreakdown[eba] = { crossEba: 0, selfRef: 0, missing404: 0 }
    ebaBreakdown[eba].selfRef++
  }
  for (const i of missing404) {
    const eba = i.file.split('/')[1] ?? 'unknown'
    if (!ebaBreakdown[eba]) ebaBreakdown[eba] = { crossEba: 0, selfRef: 0, missing404: 0 }
    ebaBreakdown[eba].missing404++
  }

  // Only include EBAs that actually have issues in the breakdown array
  const ebaBreakdownArr = Object.entries(ebaBreakdown)
    .filter(([, counts]) => counts.crossEba + counts.selfRef + counts.missing404 > 0)
    .map(([eba, counts]) => ({ eba, ...counts, total: counts.crossEba + counts.selfRef + counts.missing404 }))
    .sort((a, b) => b.total - a.total)

  // Flatten all 404 issues for the table — cap at 500 rows to keep JSON small
  const missing404Flat = missing404.slice(0, 500).map(i => ({
    file:     i.file,
    lineNum:  i.lineNum,
    url:      i.url,
    linkText: i.linkText,
    urlType:  i.urlType,
  }))

  // Cross-EBA flat list — cap at 200
  const crossEbaFlat = crossEbaIssues.slice(0, 200).map(i => ({
    file:      i.file,
    lineNum:   i.lineNum,
    url:       i.url,
    linkText:  i.linkText,
    actualEba: i.actualEba,
  }))

  const json = {
    meta: {
      generatedAt,
      ebaFilter:      EBA_FILTER ?? null,
      filesScanned:   totalFilesScanned,
      totalIssues,
      totalCrossEba,
      totalSelfRef,
      total404,
      // Convenience: health status for the dashboard badge
      // 'ok' = 0 issues, 'warn' = 1–10, 'error' = >10
      health: totalIssues === 0 ? 'ok' : totalIssues <= 10 ? 'warn' : 'error',
    },
    ebaBreakdown:  ebaBreakdownArr,
    missing404:    missing404Flat,
    crossEba:      crossEbaFlat,
    // Self-refs are low-signal for the dashboard; include count only
    selfRefCount:  totalSelfRef,
    // Truncation warnings so the dashboard can show a note
    missing404Truncated: missing404.length > 500,
    crossEbaTruncated:   crossEbaIssues.length > 200,
  }

  writeFileSync(JSON_OUT, JSON.stringify(json, null, 2), 'utf8')
  console.log(`\n📊 JSON report written to: ${JSON_OUT}`)
}

// ─── Console summary ──────────────────────────────────────────────────────────
if (!SUMMARY_ONLY) {
  console.log('\n📋 EBA Wiki — Link Audit Complete')
  console.log(`   Files scanned    : ${totalFilesScanned}`)
  console.log(`   Cross-EBA links  : ${totalCrossEba}`)
  console.log(`   Self-referencing : ${totalSelfRef}`)
  if (CHECK_404) {
    console.log(`   Missing (404)    : ${total404}`)
  }
  console.log(`   Total issues     : ${totalCrossEba + totalSelfRef + total404}`)
  console.log(`\n📄 Full report written to: C:\\Projects\\EBAdb\\audit-links-report.txt`)
}

if (totalCrossEba + totalSelfRef + total404 === 0) {
  console.log('\n✅ No issues found — all internal links are correctly scoped and resolve on disk.')
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Resolve a /ebas/... URL to a disk path and check if it exists.
 *
 * URL structure rules:
 *   /ebas/<eba>                          → EBA index (folder)
 *   /ebas/<eba>/<section>                → section index (folder) — standard EBAs
 *   /ebas/<eba>/<stream>/<section>       → section index (folder) — nested EBAs
 *   /ebas/<eba>/<section>/<clause>       → clause page (.md) — standard EBAs
 *   /ebas/<eba>/<stream>/<section>/<clause> → clause page (.md) — nested EBAs
 *
 * VitePress cleanUrls: true means /ebas/foo/bar maps to docs/ebas/foo/bar.md
 * OR docs/ebas/foo/bar/index.md (for index pages).
 *
 * Returns { exists: boolean, resolvedPath: string, urlType: string }
 */
function resolveUrl(url, docsRoot, ebasRoot) {
  // Strip query string and hash, strip trailing slash
  const clean = url.split('?')[0].split('#')[0].replace(/\/$/, '')

  // parts = ['', 'ebas', <eba>, ...]
  const parts = clean.split('/').filter(Boolean)

  // Must start with 'ebas'
  if (parts[0] !== 'ebas') {
    return { exists: false, resolvedPath: clean, urlType: 'malformed' }
  }

  const partCount = parts.length
  // parts[0]='ebas', parts[1]=eba, parts[2..]=path segments

  // /ebas only — shouldn't exist as a link but handle gracefully
  if (partCount === 1) {
    return { exists: existsSync(ebasRoot), resolvedPath: ebasRoot, urlType: 'index' }
  }

  // Build the file-system path from the URL segments after 'ebas'
  // e.g. /ebas/allied-health/allowances/33-foo
  //   → docsRoot/ebas/allied-health/allowances/33-foo.md
  const relSegments = parts.slice(1)   // drop 'ebas'
  const candidate   = join(ebasRoot, ...relSegments)

  //
  // Decide whether this is a clause page (check .md) or an index (check folder)
  //
  // Heuristic: the last path segment looks like a clause if it contains a digit
  // (e.g. "33-increases-to-allowances", "42A-title", "appendices").
  // Section/EBA index segments are typically word-only slugs (e.g. "allowances",
  // "allied-health", "common-terms").
  // This heuristic handles the vast majority of cases. The edge case of a
  // section folder that starts with a digit is theoretically possible but does
  // not exist in the current EBA content.
  //
  const lastSeg   = relSegments[relSegments.length - 1] ?? ''
  const looksLikeClause = /\d/.test(lastSeg)

  if (looksLikeClause) {
    // Try .md file first (cleanUrls: true pattern)
    const mdPath    = candidate + '.md'
    // Also try index.md inside a same-named folder (less common but possible)
    const idxPath   = join(candidate, 'index.md')

    if (existsSync(mdPath)) {
      return { exists: true,  resolvedPath: mdPath,    urlType: 'clause' }
    }
    if (existsSync(idxPath)) {
      return { exists: true,  resolvedPath: idxPath,   urlType: 'clause' }
    }
    return         { exists: false, resolvedPath: mdPath, urlType: 'clause' }

  } else {
    // Index page — check for folder existence
    if (existsSync(candidate) && statSync(candidate).isDirectory()) {
      return { exists: true,  resolvedPath: candidate, urlType: 'index' }
    }
    // Also accept a bare .md file (e.g. a section that's a single page)
    const mdPath = candidate + '.md'
    if (existsSync(mdPath)) {
      return { exists: true,  resolvedPath: mdPath,    urlType: 'index' }
    }
    return         { exists: false, resolvedPath: candidate, urlType: 'index' }
  }
}

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
