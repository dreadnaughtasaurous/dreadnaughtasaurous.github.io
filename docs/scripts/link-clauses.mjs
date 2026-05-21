// link-clauses.mjs — CORRECTED VERSION 3
// Scans all EBA .md files and hyperlinks unlinked clause/subclause/appendix/schedule
// references to their correct pages within the same EBA.
//
// Run from: C:\Projects\EBAdb\docs
// Usage:    node scripts/link-clauses.mjs [--dry-run] [--eba allied-health]
//           --dry-run  shows changes without writing files
//           --eba      limit to one EBA folder name
//
// Fix over v2:
//  STRIP PASS NOW RUNS ON ALL LINES — including indented lines (starting with
//  space or tab) and heading lines. Previously, the strip pass was inside the
//  same map() loop that skips those lines for link insertion. This meant any
//  cross-EBA or self-referencing link already present on an indented line
//  (e.g. "  - **(i)** see [clause 9](/ebas/allied-health/...)") was never
//  stripped. The corrected version runs the strip pass unconditionally on
//  every line, then only runs the insertion pass on non-skipped lines.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

const args       = process.argv.slice(2)
const DRY_RUN    = args.includes('--dry-run')
const EBA_FILTER = (() => { const i = args.indexOf('--eba'); return i !== -1 ? args[i + 1] : null })()

const DOCS_ROOT  = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
const EBAS_ROOT  = join(DOCS_ROOT, 'ebas')

const log = []
let totalFiles   = 0
let totalChanges = 0

// ─── Known-skip lists ─────────────────────────────────────────────────────────
const SKIP_LABELS = {
  'allied-health': new Set([
    'Schedule 1', 'Schedule 2', 'Schedule 3', 'Schedule 4', 'Schedule 5',
  ]),
  'childrens-services': new Set([
    'Schedule 3A',
  ]),
  'mental-health': new Set([]),
}

const SKIP_CLAUSE_REFS = {
  'childrens-services': new Set([
    'clause 102(3)',
  ]),
}

// ─── File-scoped label overrides ──────────────────────────────────────────────
const FILE_OVERRIDES = {
  'ebas/mental-health/common-terms/leave/50-parental-leave.md': {
    'Appendix 2': '/ebas/mental-health/schedules/02-salaries-and-allowances',
  },
}

// ─── Multi-stream EBA configuration ───────────────────────────────────────────
const STREAM_EBAS = {
  'has-managers-admin': ['common-terms', 'health-allied-services', 'managers-admin', 'schedules'],
  'mental-health':      ['common-terms', 'rpn-pen-mho', 'health-professionals', 'management-admin', 'support-services', 'schedules'],
}

// ─── Manual alias maps ────────────────────────────────────────────────────────
const MANUAL_ALIASES = {
  'has-managers-admin': {
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
    'Schedule 1':  '/ebas/mental-health/schedules/01-list-of-employers',
    'Schedule 2':  '/ebas/mental-health/schedules/02-salaries-and-allowances',
    'Schedule 3':  '/ebas/mental-health/schedules/03-role-statement-mental-health-clinical-educator',
  },
  'nurses-midwives': {
    'Appendix 1': '/ebas/nurses-midwives/appendices/01-list-of-employers',
    'Appendix 2': '/ebas/nurses-midwives/appendices/02-wages-and-allowances',
    'Appendix 3': '/ebas/nurses-midwives/appendices/03-information-required-for-letter-of-appointment',
    'Appendix 4': '/ebas/nurses-midwives/appendices/04-clinical-nurse-midwife-specialist-criteria',
    'Appendix 5': '/ebas/nurses-midwives/appendices/05-indicative-position-description-for-after-hours-coordinator',
    'Appendix 6': '/ebas/nurses-midwives/appendices/06-template-certificate-of-service',
    'Appendix 7': '/ebas/nurses-midwives/appendices/07-num-mum-matrix',
    'Appendix 8': '/ebas/nurses-midwives/appendices/08-campus-categories',
    'Appendix 9': '/ebas/nurses-midwives/appendices/09-health-service-categories',
  },
}

// ─── Step 1: Build slug maps ───────────────────────────────────────────────────
function buildSlugMap(ebaFolder) {
  const ebaPath = join(EBAS_ROOT, ebaFolder)
  const streams = STREAM_EBAS[ebaFolder]
  const isMulti = !!streams

  const streamMaps = isMulti
    ? Object.fromEntries([...streams, 'global'].map(s => [s, {}]))
    : null

  const flatMap = {}

  function scanDir(dir) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      const stat = statSync(full)
      if (stat.isDirectory()) { scanDir(full); continue }
      if (!entry.endsWith('.md')) continue

      const m = entry.match(/^(\d+[A-Za-z]?)-/)
      if (!m) continue

      const key     = m[1]
      const relPath = relative(DOCS_ROOT, full).replace(/\\/g, '/').replace(/\.md$/, '')
      const url     = '/' + relPath

      const inAppendices  = relPath.includes('/appendices/')
      const inPreliminary = relPath.includes('/preliminary/')
      const appendixKey   = 'appendix:' + key
      const clauseKey     = 'clause:'   + key

      if (inAppendices)  flatMap[appendixKey] = url
      else if (inPreliminary) flatMap[clauseKey] = url

      flatMap[key] = url

      if (isMulti) {
        const parts      = relPath.split('/')
        const streamSlot = parts[2]
        if (streams.includes(streamSlot)) {
          streamMaps[streamSlot][key]         = url
          streamMaps[streamSlot][appendixKey] = url
          streamMaps[streamSlot][clauseKey]   = url
        } else {
          streamMaps['global'][key] = url
        }
      }
    }
  }

  scanDir(ebaPath)

  const aliases = MANUAL_ALIASES[ebaFolder]
  if (aliases) {
    for (const [label, url] of Object.entries(aliases)) {
      flatMap[label] = url
      if (isMulti) streamMaps['global'][label] = url
    }
  }

  return isMulti ? { flat: flatMap, streams: streamMaps } : flatMap
}

// ─── Step 1b: Build per-file effective map ────────────────────────────────────
function buildEffectiveMap(slugMapResult, ebaFolder, relFilePath, fileOverrides) {
  const isMulti = !!STREAM_EBAS[ebaFolder]

  if (!isMulti) return { ...slugMapResult, ...fileOverrides }

  const { flat, streams } = slugMapResult
  const parts      = relFilePath.split('/')
  const fileStream = parts[2]
  const streamOrder = STREAM_EBAS[ebaFolder]

  const effective = {}
  Object.assign(effective, streams['global'] ?? {})
  for (const s of streamOrder) {
    if (s !== fileStream && s !== 'schedules') Object.assign(effective, streams[s] ?? {})
  }
  if (fileStream && streams[fileStream]) Object.assign(effective, streams[fileStream])
  Object.assign(effective, fileOverrides)

  return effective
}

// ─── Step 2: Regexes ──────────────────────────────────────────────────────────
const LABEL_REGEX_SRC = String.raw`\b(Appendix|Schedule)\s+(\d+[A-Za-z]*)\b`

function buildClauseRegexSrc() {
  const clauseRef = String.raw`(?:sub)?clauses?`
  const clauseNum = String.raw`\d+[A-Za-z]?`
  const subNum    = String.raw`(?:\.\d+)?`
  const subLetter = String.raw`(?:\([a-zA-Z0-9]+\))*`
  const range     = String.raw`(?:\s*(?:-|to)\s*\([a-zA-Z0-9]+\))?`
  const orMore    = String.raw`(?:\s+or\s+` + clauseNum + subNum + subLetter + String.raw`)?`
  return `(${clauseRef})\\s+(${clauseNum}${subNum}${subLetter}${range}${orMore})`
}
const CLAUSE_REGEX_SRC = buildClauseRegexSrc()

// ─── Step 3: Strip pass ───────────────────────────────────────────────────────
// Removes ALL existing internal /ebas/ Markdown links from a line.
// This now runs unconditionally on EVERY line, including indented and heading
// lines. This is the key fix in v3 — previously the strip was inside the
// insertion loop that skips indented lines, so pre-existing cross-EBA links
// on indented lines (e.g. "  - **(i)** see [clause 9](/ebas/allied-health/...)")
// were never removed.

function stripInternalLinks(line) {
  let prev
  let current = line

  do {
    prev = current
    // Stage A: corrupted links — URL contains '[' (nested link remnant).
    current = current.replace(/\[([^\]]*)\]\(([^)]*\[[^)]*)\)/g, '$1')
    // Stage B: well-formed internal links — URL starts with /ebas/.
    current = current.replace(/\[([^\]]*)\]\(\/ebas\/[^)]*\)/g, '$1')
  } while (current !== prev)

  // Stage C: remove fused URL fragments from partially-unwound nested links.
  // e.g. "Appendix 4h", "Appendix 4e" — single lowercase letter fused after number.
  current = current.replace(
    /\b((?:Appendix|Schedule)\s+\d+[A-Za-z]?)([a-z]+)(?=\b|[\s.,;:)\]]|$)/g,
    (_, token, fragment) => {
      const commonSuffixes = new Set(['th', 'st', 'nd', 'rd'])
      if (fragment.length <= 12 && !commonSuffixes.has(fragment)) return token
      return token + fragment
    }
  )

  return current
}

// ─── Step 4: URL lookup helpers ───────────────────────────────────────────────
function resolveLabel(effectiveMap, fullMatch, labelType, num) {
  if (labelType === 'Appendix') {
    return effectiveMap[fullMatch]
      ?? effectiveMap['appendix:' + num]
      ?? effectiveMap['appendix:' + num.replace(/^0+/, '')]
      ?? effectiveMap[num]
      ?? effectiveMap[num.replace(/^0+/, '')]
  }
  return effectiveMap[fullMatch]
    ?? effectiveMap[num]
    ?? effectiveMap[num.replace(/^0+/, '')]
}

function resolveClause(effectiveMap, fullMatchKey, primaryClause) {
  return effectiveMap[fullMatchKey]
    ?? effectiveMap['clause:' + primaryClause]
    ?? effectiveMap[primaryClause]
}

// ─── Step 5: Process a single file ───────────────────────────────────────────
function processFile(filePath, slugMapResult, ebaFolder) {
  const original   = readFileSync(filePath, 'utf8')
  const normalised = original.replace(/\r\n/g, '\n')

  const fmMatch = normalised.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/m)
  if (!fmMatch) return

  const frontMatter = fmMatch[1]
  const body        = fmMatch[2]

  const selfUrl = '/' + relative(DOCS_ROOT, filePath)
    .replace(/\\/g, '/')
    .replace(/\.md$/, '')

  const skipLabelSet  = SKIP_LABELS[ebaFolder]      ?? new Set()
  const skipClauseSet = SKIP_CLAUSE_REFS[ebaFolder] ?? new Set()

  const relFilePath   = relative(DOCS_ROOT, filePath).replace(/\\/g, '/')
  const fileOverrides = FILE_OVERRIDES[relFilePath] ?? {}
  const effectiveMap  = buildEffectiveMap(slugMapResult, ebaFolder, relFilePath, fileOverrides)

  let changeCount   = 0
  const fileChanges = []

  const newLines = body.split('\n').map((line, lineIdx) => {

    // ── STRIP PASS: runs on ALL lines unconditionally ─────────────────────────
    // This ensures pre-existing cross-EBA and self-referencing links are removed
    // even from indented lines (sub-list items starting with spaces) and headings.
    let workingLine = stripInternalLinks(line)

    // ── INSERTION PASS: skips heading and indented lines ─────────────────────
    // We only skip the *insertion* of new links on these lines, not the stripping.
    // Headings and code-indented lines should not have auto-inserted clause links.
    if (workingLine.startsWith('#'))                            return workingLine
    if (workingLine.startsWith(' ') || workingLine.startsWith('\t')) return workingLine

    // Collect all candidate matches from the stripped line, sorted by position.
    const labelMatches  = [...workingLine.matchAll(new RegExp(LABEL_REGEX_SRC,  'g'))]
    const clauseMatches = [...workingLine.matchAll(new RegExp(CLAUSE_REGEX_SRC, 'gi'))]

    const allMatches = [
      ...labelMatches.map(m  => ({ ...m, kind: 'label'  })),
      ...clauseMatches.map(m => ({ ...m, kind: 'clause' })),
    ].sort((a, b) => a.index - b.index)

    let offset = 0

    for (const match of allMatches) {
      const fullMatch  = match[0]
      const matchStart = match.index

      const adjustedStart = matchStart + offset
      const before = workingLine.substring(0, adjustedStart)
      const opens  = (before.match(/\[/g) || []).length
      const closes = (before.match(/\]/g) || []).length
      if (opens > closes) continue

      const after = workingLine.substring(adjustedStart + fullMatch.length)
      if (after.startsWith('](')) continue

      if (match.kind === 'label') {
        const labelType = match[1]
        const num       = match[2]

        if (skipLabelSet.has(fullMatch)) continue

        const url = resolveLabel(effectiveMap, fullMatch, labelType, num)
        if (!url) {
          fileChanges.push(` ⚠️ Line ${lineIdx + 1}: No URL for '${fullMatch}' — left unchanged`)
          continue
        }
        if (url === selfUrl) {
          fileChanges.push(` ⏭️ Line ${lineIdx + 1}: '${fullMatch}' → self-reference, left as plain text`)
          continue
        }

        const replacement = `[${fullMatch}](${url})`
        workingLine = workingLine.substring(0, adjustedStart)
          + replacement
          + workingLine.substring(adjustedStart + fullMatch.length)
        offset += replacement.length - fullMatch.length
        changeCount++
        fileChanges.push(` ✅ Line ${lineIdx + 1}: '${fullMatch}' → [${fullMatch}](${url})`)
        continue
      }

      if (match.kind === 'clause') {
        const precedingText = workingLine.substring(0, adjustedStart)
        if (/(?:Appendix|Schedule)\s+\S.*?,?\s*$/.test(precedingText)) continue

        const matchLower = fullMatch.toLowerCase()
        if (skipClauseSet.has(matchLower) || skipClauseSet.has(fullMatch)) continue

        const ref = match[2]
        const primaryClause = ref.match(/^(\d+[A-Za-z]?)/)?.[1]
        if (!primaryClause) continue

        const fullMatchKey = fullMatch.replace(/\s+/g, ' ').trim()
        const url = resolveClause(effectiveMap, fullMatchKey, primaryClause)

        if (!url) {
          fileChanges.push(` ⚠️ Line ${lineIdx + 1}: No URL for '${fullMatch}' — left unchanged`)
          continue
        }
        if (url === selfUrl) {
          fileChanges.push(` ⏭️ Line ${lineIdx + 1}: '${fullMatch}' → self-reference, left as plain text`)
          continue
        }

        const replacement = `[${fullMatch}](${url})`
        workingLine = workingLine.substring(0, adjustedStart)
          + replacement
          + workingLine.substring(adjustedStart + fullMatch.length)
        offset += replacement.length - fullMatch.length
        changeCount++
        fileChanges.push(` ✅ Line ${lineIdx + 1}: '${fullMatch}' → [${fullMatch}](${url})`)
      }
    }

    return workingLine
  })

  const newContent = `---\n${frontMatter}\n---\n${newLines.join('\n')}`
  if (newContent === normalised) return

  const relPath      = relative(DOCS_ROOT, filePath).replace(/\\/g, '/')
  const strippedOnly = changeCount === 0 && newContent !== normalised

  if (strippedOnly) {
    log.push(`\n📄 ${relPath} (stripped existing links, no new links added)`)
  } else {
    log.push(`\n📄 ${relPath} (${changeCount} change${changeCount !== 1 ? 's' : ''})`)
  }
  log.push(...fileChanges)

  totalFiles++
  totalChanges += changeCount

  if (!DRY_RUN) writeFileSync(filePath, newContent, 'utf8')
}

// ─── Step 6: Walk EBA folders ─────────────────────────────────────────────────
const ebaFolders = readdirSync(EBAS_ROOT).filter(f => {
  if (EBA_FILTER) return f === EBA_FILTER
  return statSync(join(EBAS_ROOT, f)).isDirectory()
})

for (const ebaFolder of ebaFolders) {
  const slugMapResult = buildSlugMap(ebaFolder)
  const ebaPath       = join(EBAS_ROOT, ebaFolder)

  function walkAndProcess(dir) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      const stat = statSync(full)
      if (stat.isDirectory()) walkAndProcess(full)
      else if (entry.endsWith('.md')) processFile(full, slugMapResult, ebaFolder)
    }
  }

  walkAndProcess(ebaPath)
}

// ─── Step 7: Output log ───────────────────────────────────────────────────────
const mode = DRY_RUN ? '🔍 DRY RUN — no files were written' : '✏️ FILES UPDATED'
console.log(`\n${mode}`)
console.log(`EBA filter: ${EBA_FILTER ?? 'all EBAs'}`)
console.log(`Files changed: ${totalFiles}`)
console.log(`Total new links inserted: ${totalChanges}`)
console.log(log.join('\n'))

import { writeFileSync as wfs } from 'fs'
const logPath = join(DOCS_ROOT, '..', 'link-clauses-log.txt')
wfs(
  logPath,
  `${mode}\nEBA: ${EBA_FILTER ?? 'all'}\nFiles changed: ${totalFiles}\nNew links inserted: ${totalChanges}\n${log.join('\n')}`,
  'utf8'
)
console.log(`\n📋 Full log written to: C:\\Projects\\EBAdb\\link-clauses-log.txt`)
