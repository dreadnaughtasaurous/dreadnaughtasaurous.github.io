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

// ─── Step 1: Build clause map for each EBA ───────────────────────────────────
// Maps EBA folder name → { clauseNumber: relative URL path }
// e.g. 'allied-health' → { '54': '/ebas/allied-health/hours-of-work/54-recall-no-return-to-workplace', ... }

function buildClauseMap(ebaFolder) {
  const map = {}
  const ebaPath = join(EBAS_ROOT, ebaFolder)

  function scanDir(dir) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      const stat = statSync(full)
      if (stat.isDirectory()) {
        scanDir(full)
      } else if (entry.endsWith('.md')) {
        // Match filenames like: 54-recall-no-return-to-workplace.md
        // Clause number is everything before the first hyphen that follows digits/letters
        const match = entry.match(/^(\d+[A-Za-z]?)-/)
        if (match) {
          const clauseNum = match[1] // e.g. '54' or '42A' or '28B'
          // Build the URL path relative to docs root
          const relPath = relative(DOCS_ROOT, full)
            .replace(/\\/g, '/')           // Windows backslash → forward slash
            .replace(/\.md$/, '')          // Remove .md extension
          map[clauseNum] = '/' + relPath
        }
      }
    }
  }

  scanDir(ebaPath)
  return map
}

// ─── Step 2: Regex pattern for unlinked clause references ────────────────────
// Matches patterns like:
//   subclause 36.1
//   subclause 36.1(a)
//   subclause 36.1(a)(i)
//   subclause 36.1(a)-(g)
//   subclause 41.2 or 41.3
//   subclauses 25.7(b) to (f)
//   clause 42A
//   clause 28.1
//   Clause 54
// Does NOT match if already inside a Markdown link [...](...) 

function buildRegex() {
  const clauseRef = String.raw`(?:sub)?clauses?`
  const clauseNum = String.raw`\d+[A-Za-z]?`           // 54, 42A, 28B
  const subNum    = String.raw`(?:\.\d+)?`              // .1, .2 (optional)
  const subLetter = String.raw`(?:\([a-zA-Z0-9]+\))*`  // (a), (i), (ii) (optional, repeating)
  const range     = String.raw`(?:\s*(?:-|to)\s*\([a-zA-Z0-9]+\))?` // -(g) or to (f)
  const orMore    = String.raw`(?:\s+or\s+` + clauseNum + subNum + subLetter + String.raw`)?` // or 41.3

  const pattern = `(${clauseRef})\\s+(${clauseNum}${subNum}${subLetter}${range}${orMore})`
  return new RegExp(pattern, 'gi')
}

const CLAUSE_REGEX = buildRegex()

// ─── Step 3: Process a single file ───────────────────────────────────────────

function processFile(filePath, clauseMap, ebaFolder) {
  const original = readFileSync(filePath, 'utf8')

  // Split front matter from body
  const normalised = original.replace(/\r\n/g, '\n')
  const fmMatch = normalised.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/m)
  if (!fmMatch) return // No front matter — skip

  const frontMatter = fmMatch[1]
  const body = fmMatch[2]

  let changeCount = 0
  const fileChanges = []

  // Track positions inside Markdown links to skip them
  // We'll do a line-by-line replacement to stay safe
  const newLines = body.split('\n').map((line, lineIndex) => {
    // Skip lines that are headings — they shouldn't get inline links
    if (line.startsWith('#')) return line

    // Skip lines that are entirely inside a code block (simple heuristic)
    if (line.startsWith('    ') || line.startsWith('\t')) return line

    let newLine = line
    let offset = 0

    // Find all matches, but skip any that are already inside [...](...)
    const matches = [...line.matchAll(new RegExp(CLAUSE_REGEX.source, 'gi'))]

    for (const match of matches) {
      const fullMatch = match[0]        // e.g. 'subclause 36.1(a)'
      const word = match[1]             // e.g. 'subclause'
      const ref = match[2]              // e.g. '36.1(a)'
      const matchStart = match.index

      // Check if this match is already inside a Markdown link
      // by looking for [...] before and (...) after
      const before = line.substring(0, matchStart)
      const openBrackets = (before.match(/\[/g) || []).length
      const closeBrackets = (before.match(/\]/g) || []).length
      if (openBrackets > closeBrackets) continue // Inside [...] — skip

      // Skip if preceded by "Appendix" or "Schedule" on the same line
      // e.g. "Appendix 4 – Section B, subclause 5.4" refers to an appendix subsection,
      // not a top-level EBA clause
      const precedingText = line.substring(0, matchStart)
      if (/(?:Appendix|Schedule)\s+\S.*?,?\s*$/.test(precedingText)) continue

      // Also skip if preceded by "subclause " and the next char after match is "["
      // (handles the malformed "subclause [clause X](...)" pattern)
      const afterMatch = line.substring(matchStart + fullMatch.length)
      if (afterMatch.startsWith('](')) continue // Already linked text right after — skip

      // Extract the primary clause number (before the first dot or letter suffix in subnum)
      const primaryClause = ref.match(/^(\d+[A-Za-z]?)/)?.[1]
      if (!primaryClause) continue

      // Look up URL in clause map
      const url = clauseMap[primaryClause]
      if (!url) {
        fileChanges.push(`  ⚠️  Line ${lineIndex + 1}: No URL found for clause ${primaryClause} — '${fullMatch}' left unchanged`)
        continue
      }

      // Build replacement
      const replacement = `[${fullMatch}](${url})`

      // Apply replacement at correct position accounting for previous replacements
      const adjustedStart = matchStart + offset
      newLine = newLine.substring(0, adjustedStart) + replacement + newLine.substring(adjustedStart + fullMatch.length)
      offset += replacement.length - fullMatch.length

      changeCount++
      fileChanges.push(`  ✅ Line ${lineIndex + 1}: '${fullMatch}' → [${fullMatch}](${url})`)
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

// ─── Step 4: Walk EBA folders ─────────────────────────────────────────────────

const ebaFolders = readdirSync(EBAS_ROOT).filter(f => {
  if (EBA_FILTER) return f === EBA_FILTER
  return statSync(join(EBAS_ROOT, f)).isDirectory()
})

for (const ebaFolder of ebaFolders) {
  const clauseMap = buildClauseMap(ebaFolder)
  const ebaPath = join(EBAS_ROOT, ebaFolder)

  function walkAndProcess(dir) {
    for (const entry of readdirSync(dir)) {
      const full = join(dir, entry)
      const stat = statSync(full)
      if (stat.isDirectory()) {
        walkAndProcess(full)
      } else if (entry.endsWith('.md')) {
        processFile(full, clauseMap, ebaFolder)
      }
    }
  }

  walkAndProcess(ebaPath)
}

// ─── Step 5: Output log ───────────────────────────────────────────────────────

const mode = DRY_RUN ? '🔍 DRY RUN — no files were written' : '✏️  FILES UPDATED'
console.log(`\n${mode}`)
console.log(`EBA filter: ${EBA_FILTER ?? 'all EBAs'}`)
console.log(`Files changed: ${totalFiles}`)
console.log(`Total substitutions: ${totalChanges}`)
console.log(log.join('\n'))

// Write log to file for review
import { writeFileSync as wfs } from 'fs'
const logPath = join(DOCS_ROOT, '..', 'link-clauses-log.txt')
wfs(logPath, `${mode}\nEBA: ${EBA_FILTER ?? 'all'}\nFiles: ${totalFiles}\nSubstitutions: ${totalChanges}\n${log.join('\n')}`, 'utf8')
console.log(`\n📋 Full log written to: C:\\Projects\\EBAdb\\link-clauses-log.txt`)