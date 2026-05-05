// link-clauses.mjs
// Scans all EBA .md files and hyperlinks unlinked clause/subclause references.
// Run from: C:\Projects\EBAdb\docs
// Usage: node scripts/link-clauses.mjs [--dry-run] [--eba allied-health]
// --dry-run: shows changes without writing files
// --eba: limit to one EBA folder name (omit to run all)

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const args = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')
const EBA_FILTER = (() => { const i = args.indexOf('--eba'); return i !== -1 ? args[i + 1] : null })()

const DOCS_ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
const EBAS_ROOT = join(DOCS_ROOT, 'ebas')

const log = []
let totalFiles = 0
let totalChanges = 0

// ─── Known-skip lists ─────────────────────────────────────────────────────────
// Appendix/Schedule label strings that reference external legislation or
// internal PDF structure — not wiki pages. Silently ignored, no warning emitted.
// Key: EBA folder name. Value: Set of exact label strings to skip.

const SKIP_LABELS = {
  // Allied Health has no schedules — all "Schedule N" refs are internal table refs
  'allied-health': new Set([
    'Schedule 1', 'Schedule 2', 'Schedule 3', 'Schedule 4', 'Schedule 5',
  ]),
  // Children's Services: Schedule 3A is a Fair Work Act schedule, not a wiki page
  'childrens-services': new Set([
    'Schedule 3A',
  ]),
  'mental-health': new Set([]),
}

// ─── Known-skip clause patterns ───────────────────────────────────────────────
// Clause references that point to external legislation (e.g. the Fair Work Act).
// These are matched as exact strings against the full clause match text.
// Key: EBA folder name. Value: Set of exact clause reference strings to skip.

const SKIP_CLAUSE_REFS = {
  // clause 102(3) is a Fair Work Act reference, not an EBA clause
  'childrens-services': new Set([
    'clause 102(3)',
  ]),
}

// ─── File-scoped label overrides ──────────────────────────────────────────────
// For cases where a label in a specific file resolves to a different URL than
// the EBA-wide slug map would provide. Handles EBA drafting errors where the
// wrong label was used in the source text.
// Key: relative file path (forward slashes). Value: { 'Label': '/url' }

const FILE_OVERRIDES = {
  // 'Appendix 2' at line 268 is a drafting error — should be 'Schedule 2'
  'ebas/mental-health/common-terms/leave/50-parental-leave.md': {
    'Appendix 2': '/ebas/mental-health/schedules/02-salaries-and-allowances',
  },
}

// ─── Step 1: Build slug map for each EBA ─────────────────────────────────────
// Maps EBA folder name → { label: URL path }
// Auto-discovers clause/appendix/schedule pages from filenames.
// Also applies per-EBA manual alias entries for non-standard naming conventions.

// Manual alias maps: EBA folder → { 'Display Label': '/url/path' }
// Used for pages whose filenames don't follow the standard numeric prefix pattern,
// or where in-text references use a different label than the file's numeric key.
const MANUAL_ALIASES = {
  'has-managers-admin': {
    // Schedules — prefixed with alphanumeric codes, not plain numbers
    'Schedule 1A': '/ebas/has-managers-admin/schedules/1a-employers-covered',
    'Schedule 1B': '/ebas/has-managers-admin/schedules/1b-supported-wage-system-for-employees-with-a-disability',
    'Schedule 2B': '/ebas/has-managers-admin/schedules/2b-wage-rates-health-allied-services',
    'Schedule 2C': '/ebas/has-managers-admin/schedules/2c-allowances-health-allied-services',
    'Schedule 2D': '/ebas/has-managers-admin/schedules/2d-classification-structure-health-allied-services',
    'Schedule 3B': '/ebas/has-managers-admin/schedules/3b-wage-rates-managers-and-administrative-workers',
    'Schedule 3C': '/ebas/has-managers-admin/schedules/3c-allowances-managers-and-administrative-workers',
    'Schedule 3D': '/ebas/has-managers-admin/schedules/3d-classification-structure-managers-and-administrative-workers',
    'Schedule 3E': '/ebas/has-managers-admin/schedules/3e-workplace-trainer-careers-advisor',
    'Schedule 3F': '/ebas/has-managers-admin/schedules/3f-worker-wellbeing-officer',
    'Schedule 3G': '/ebas/has-managers-admin/schedules/3g-aboriginal-employment-support-officer',
    'Schedule 3H': '/ebas/has-managers-admin/schedules/3h-disability-employment-support-officer',
    'Schedule 3I': '/ebas/has-managers-admin/schedules/3i-veteran-employment-support-officer',
  },
  'mental-health': {
    // Schedules 1–3 have zero-padded filenames; auto-discovery resolves these
    // as keys '01', '02', '03' — but in-text references use 'Schedule 1' etc.
    // These aliases bridge that gap.
    'Schedule 1': '/ebas/mental-health/schedules/01-list-of-employers',
    'Schedule 2': '/ebas/mental-health/schedules/02-salaries-and-allowances',
    'Schedule 3': '/ebas/mental-health/schedules/03-role-statement-mental-health-clinical-educator',

    // Internal clause references within 05-classification-definitions-applying-to-
    // health-professionals.md. These use old PDF-internal numbering (clause 1.1,
    // clause 3.3, etc.) that refers back to the schedule itself.
    'clause 1.1(b)': '/ebas/mental-health/schedules/05-classification-definitions-applying-to-health-professionals',
    'clause 3.3':    '/ebas/mental-health/schedules/05-classification-definitions-applying-to-health-professionals',
    'subclause 3.4': '/ebas/mental-health/schedules/05-classification-definitions-applying-to-health-professionals',
    'subclause 2.1(e)': '/ebas/mental-health/schedules/05-classification-definitions-applying-to-health-professionals',
  },
}

function buildSlugMap(ebaFolder) {
  const map = {}
  const ebaPath = join(EBAS_ROOT, ebaFolder)

  function scanDir(dir) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      const stat = statSync(full)
      if (stat.isDirectory()) {
        scanDir(full)
      } else if (entry.endsWith('.md')) {
        // Standard clause/appendix pages: e.g. 54-recall.md, 42A-title.md, 28B-top.md
        // Also matches zero-padded schedule names: 01-schedule-name.md, 02-..., etc.
        const match = entry.match(/^(\d+[A-Za-z]?)-/)
        if (match) {
          const clauseNum = match[1] // e.g. '54', '42A', '28B', '01', '02'
          const relPath = relative(DOCS_ROOT, full)
            .replace(/\\/g, '/')
            .replace(/\.md$/, '')
          map[clauseNum] = '/' + relPath
        }
      }
    }
  }

  scanDir(ebaPath)

  // Apply manual aliases for this EBA (adds/overrides entries in the map)
  const aliases = MANUAL_ALIASES[ebaFolder]
  if (aliases) {
    for (const [label, url] of Object.entries(aliases)) {
      map[label] = url
    }
  }

  return map
}

// ─── Step 2: Regex for Appendix/Schedule label references ────────────────────
// Matches: Appendix 1, Appendix 2A, Schedule 3D, Schedule 1A, etc.
// Used to resolve non-clause references (Appendix/Schedule by label).

const LABEL_REGEX = /\b(Appendix|Schedule)\s+(\d+[A-Za-z]*)\b/g

// ─── Step 3: Regex pattern for unlinked clause/subclause references ──────────
// Matches patterns like:
// subclause 36.1, subclause 36.1(a), subclause 36.1(a)(i)
// subclause 36.1(a)-(g), subclause 41.2 or 41.3
// subclauses 25.7(b) to (f), clause 42A, clause 28.1, Clause 54
// Does NOT match if already inside a Markdown link [..](...)

function buildRegex() {
  const clauseRef = String.raw`(?:sub)?clauses?`
  const clauseNum = String.raw`\d+[A-Za-z]?`
  const subNum = String.raw`(?:\.\d+)?`
  const subLetter = String.raw`(?:\([a-zA-Z0-9]+\))*`
  const range = String.raw`(?:\s*(?:-|to)\s*\([a-zA-Z0-9]+\))?`
  const orMore = String.raw`(?:\s+or\s+` + clauseNum + subNum + subLetter + String.raw`)?`

  const pattern = `(${clauseRef})\\s+(${clauseNum}${subNum}${subLetter}${range}${orMore})`
  return new RegExp(pattern, 'gi')
}

const CLAUSE_REGEX = buildRegex()

// ─── Step 4: Process a single file ───────────────────────────────────────────

function processFile(filePath, slugMap, ebaFolder) {
  const original = readFileSync(filePath, 'utf8')

  const normalised = original.replace(/\r\n/g, '\n')
  const fmMatch = normalised.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/m)
  if (!fmMatch) return

  const frontMatter = fmMatch[1]
  const body = fmMatch[2]

  const skipLabelSet = SKIP_LABELS[ebaFolder] ?? new Set()
  const skipClauseSet = SKIP_CLAUSE_REFS[ebaFolder] ?? new Set()

  // Build a merged slug map: EBA-wide map + any file-scoped overrides
  const relFilePath = relative(DOCS_ROOT, filePath).replace(/\\/g, '/')
  const fileOverrides = FILE_OVERRIDES[relFilePath] ?? {}
  const effectiveMap = { ...slugMap, ...fileOverrides }

  let changeCount = 0
  const fileChanges = []

  const newLines = body.split('\n').map((line, lineIndex) => {
    if (line.startsWith('#')) return line
    if (line.startsWith(' ') || line.startsWith('\t')) return line

    let newLine = line
    let offset = 0

    // ── Pass A: Resolve Appendix/Schedule label references ──────────────────
    const labelMatches = [...line.matchAll(new RegExp(LABEL_REGEX.source, 'g'))]

    for (const match of labelMatches) {
      const fullMatch = match[0]
      const num = match[2]
      const matchStart = match.index

      const before = line.substring(0, matchStart)
      const openBrackets = (before.match(/\[/g) || []).length
      const closeBrackets = (before.match(/\]/g) || []).length
      if (openBrackets > closeBrackets) continue

      const afterMatch = line.substring(matchStart + fullMatch.length)
      if (afterMatch.startsWith('](')) continue

      if (skipLabelSet.has(fullMatch)) continue

      const url = effectiveMap[fullMatch]
        ?? effectiveMap[num]
        ?? effectiveMap[num.replace(/^0+/, '')]

      if (!url) {
        fileChanges.push(` ⚠️ Line ${lineIndex + 1}: No URL found for '${fullMatch}' — left unchanged`)
        continue
      }

      const replacement = `[${fullMatch}](${url})`
      const adjustedStart = matchStart + offset
      newLine = newLine.substring(0, adjustedStart) + replacement + newLine.substring(adjustedStart + fullMatch.length)
      offset += replacement.length - fullMatch.length

      changeCount++
      fileChanges.push(` ✅ Line ${lineIndex + 1}: '${fullMatch}' → [${fullMatch}](${url})`)
    }

    // ── Pass B: Resolve clause/subclause references ──────────────────────────
    const clauseMatches = [...line.matchAll(new RegExp(CLAUSE_REGEX.source, 'gi'))]

    for (const match of clauseMatches) {
      const fullMatch = match[0]
      const ref = match[2]
      const matchStart = match.index

      const before = line.substring(0, matchStart)
      const openBrackets = (before.match(/\[/g) || []).length
      const closeBrackets = (before.match(/\]/g) || []).length
      if (openBrackets > closeBrackets) continue

      const precedingText = line.substring(0, matchStart)
      if (/(?:Appendix|Schedule)\s+\S.*?,?\s*$/.test(precedingText)) continue

      const afterMatch = line.substring(matchStart + fullMatch.length)
      if (afterMatch.startsWith('](')) continue

      // Skip external legislative references (e.g. Fair Work Act clause numbers)
      if (skipClauseSet.has(fullMatch.toLowerCase()) || skipClauseSet.has(fullMatch)) continue

      const primaryClause = ref.match(/^(\d+[A-Za-z]?)/)?.[1]
      if (!primaryClause) continue

      // Check manual aliases first (supports internal self-refs like 'clause 3.3')
      const fullMatchKey = fullMatch.replace(/\s+/g, ' ').trim()
      const url = effectiveMap[fullMatchKey] ?? effectiveMap[primaryClause]

      if (!url) {
        fileChanges.push(` ⚠️ Line ${lineIndex + 1}: No URL found for '${fullMatch}' — left unchanged`)
        continue
      }

      const replacement = `[${fullMatch}](${url})`
      const adjustedStart = matchStart + offset
      newLine = newLine.substring(0, adjustedStart) + replacement + newLine.substring(adjustedStart + fullMatch.length)
      offset += replacement.length - fullMatch.length

      changeCount++
      fileChanges.push(` ✅ Line ${lineIndex + 1}: '${fullMatch}' → [${fullMatch}](${url})`)
    }

    return newLine
  })

  if (changeCount === 0) return

  const newContent = `---\n${frontMatter}\n---\n${newLines.join('\n')}`

  const relPath = relative(DOCS_ROOT, filePath).replace(/\\/g, '/')
  log.push(`\n📄 ${relPath} (${changeCount} change${changeCount > 1 ? 's' : ''})`)
  log.push(...fileChanges)

  totalFiles++
  totalChanges += changeCount

  if (!DRY_RUN) {
    writeFileSync(filePath, newContent, 'utf8')
  }
}

// ─── Step 5: Walk EBA folders ─────────────────────────────────────────────────

const ebaFolders = readdirSync(EBAS_ROOT).filter(f => {
  if (EBA_FILTER) return f === EBA_FILTER
  return statSync(join(EBAS_ROOT, f)).isDirectory()
})

for (const ebaFolder of ebaFolders) {
  const slugMap = buildSlugMap(ebaFolder)
  const ebaPath = join(EBAS_ROOT, ebaFolder)

  function walkAndProcess(dir) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      const stat = statSync(full)
      if (stat.isDirectory()) {
        walkAndProcess(full)
      } else if (entry.endsWith('.md')) {
        processFile(full, slugMap, ebaFolder)
      }
    }
  }

  walkAndProcess(ebaPath)
}

// ─── Step 6: Output log ───────────────────────────────────────────────────────

const mode = DRY_RUN ? '🔍 DRY RUN — no files were written' : '✏️ FILES UPDATED'
console.log(`\n${mode}`)
console.log(`EBA filter: ${EBA_FILTER ?? 'all EBAs'}`)
console.log(`Files changed: ${totalFiles}`)
console.log(`Total substitutions: ${totalChanges}`)
console.log(log.join('\n'))

import { writeFileSync as wfs } from 'fs'
const logPath = join(DOCS_ROOT, '..', 'link-clauses-log.txt')
wfs(logPath, `${mode}\nEBA: ${EBA_FILTER ?? 'all'}\nFiles: ${totalFiles}\nSubstitutions: ${totalChanges}\n${log.join('\n')}`, 'utf8')
console.log(`\n📋 Full log written to: C:\\Projects\\EBAdb\\link-clauses-log.txt`)