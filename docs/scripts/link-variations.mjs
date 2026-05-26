// link-variations.mjs
// Scans all Children's Services Award .md files and hyperlinks PR variation
// codes found on blockquote lines (lines beginning with '>') to their
// corresponding Fair Work Commission library URLs.
//
// Run from: C:\Projects\EBAdb\docs
// Usage:    node scripts/link-variations.mjs [--dry-run]
//           --dry-run  shows changes without writing any files
//
// Only operates on: docs\ebas\childrens-services\**\*.md
// Only modifies:    lines whose first non-whitespace character(s) are '>'
// PR codes not in the map are left as plain text and logged as warnings.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'

const args    = process.argv.slice(2)
const DRY_RUN = args.includes('--dry-run')

// Resolve docs root from this script's location (docs/scripts/link-variations.mjs)
const DOCS_ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
const TARGET_DIR = join(DOCS_ROOT, 'ebas', 'childrens-services')

// ─── Variation map ────────────────────────────────────────────────────────────
// Complete map of all PR variation codes for the Children's Services Award 2010.
// Key:   PR code exactly as it appears in award text (e.g. 'PR795749' or 'PR566800V')
// Value: Full URL to the variation document on the FWC website.
//
// Three URL patterns are used depending on the code's age:
//   1. https://library.fairwork.gov.au/award/?krn=PRXXXXXX   — modern codes
//   2. http://www.fwc.gov.au/documents/awardsandorders/html/PRXXXXXX.htm — legacy codes
//
// IMPORTANT: Some codes exist in BOTH a plain form (e.g. PR503637) and a V-suffix
// form (e.g. PR503637V). These are separate FWC documents with different URLs.
// Both are included here so the regex matches each form to the correct URL.
const VARIATION_MAP = {
  'PR795749':  'https://library.fairwork.gov.au/award/?krn=PR795749',
  'PR794808':  'https://library.fairwork.gov.au/award/?krn=PR794808',
  'PR794818':  'https://library.fairwork.gov.au/award/?krn=PR794818',
  // ── Modern codes (library.fairwork.gov.au) ───────────────────────────────
  'PR795749':  'https://library.fairwork.gov.au/award/?krn=PR795749',
  'PR794932':  'https://library.fairwork.gov.au/award/?krn=PR794932',
  'PR794818':  'https://library.fairwork.gov.au/award/?krn=PR794818',
  'PR794808':  'https://library.fairwork.gov.au/award/?krn=PR794808',
  'PR796954':  'https://library.fairwork.gov.au/award/?krn=PR796954',
  'PR786828':  'https://library.fairwork.gov.au/award/?krn=PR786828',
  'PR786659':  'https://library.fairwork.gov.au/award/?krn=PR786659',
  'PR780234':  'https://library.fairwork.gov.au/award/?krn=PR780234',
  'PR778104':  'https://library.fairwork.gov.au/award/?krn=PR778104',
  'PR777356':  'https://library.fairwork.gov.au/award/?krn=PR777356',
  'PR774849':  'https://library.fairwork.gov.au/award/?krn=PR774849',
  'PR774179':  'https://library.fairwork.gov.au/award/?krn=PR774179',
  'PR774011':  'https://library.fairwork.gov.au/award/?krn=PR774011',
  'PR771396':  'https://library.fairwork.gov.au/award/?krn=PR771396',
  'PR763327':  'https://library.fairwork.gov.au/award/?krn=PR763327',
  'PR762400':  'https://library.fairwork.gov.au/award/?krn=PR762400',
  'PR762229':  'https://library.fairwork.gov.au/award/?krn=PR762229',
  'PR751244':  'https://library.fairwork.gov.au/award/?krn=PR751244',
  'PR750444':  'https://library.fairwork.gov.au/award/?krn=PR750444',
  'PR747480':  'https://library.fairwork.gov.au/award/?krn=PR747480',
  'PR746868':  'https://library.fairwork.gov.au/award/?krn=PR746868',
  'PR745330':  'https://library.fairwork.gov.au/award/?krn=PR745330',
  'PR743360':  'https://library.fairwork.gov.au/award/?krn=PR743360',
  'PR740969':  'https://library.fairwork.gov.au/award/?krn=PR740969',
  'PR740806':  'https://library.fairwork.gov.au/award/?krn=PR740806',
  'PR740264':  'https://library.fairwork.gov.au/award/?krn=PR740264',
  'PR736911':  'https://library.fairwork.gov.au/award/?krn=PR736911',
  'PR736141':  'https://library.fairwork.gov.au/award/?krn=PR736141',
  'PR733842':  'https://library.fairwork.gov.au/award/?krn=PR733842',
  'PR729563':  'https://library.fairwork.gov.au/award/?krn=PR729563',
  'PR729383':  'https://library.fairwork.gov.au/award/?krn=PR729383',
  'PR728080':  'https://library.fairwork.gov.au/award/?krn=PR728080',
  'PR727866':  'https://library.fairwork.gov.au/award/?krn=PR727866',
  'PR724049':  'https://library.fairwork.gov.au/award/?krn=PR724049',
  'PR723880':  'https://library.fairwork.gov.au/award/?krn=PR723880',
  'PR723827':  'https://library.fairwork.gov.au/award/?krn=PR723827',
  'PR723626':  'https://library.fairwork.gov.au/award/?krn=PR723626',
  'PR723048':  'https://library.fairwork.gov.au/award/?krn=PR723048',
  'PR720705':  'https://library.fairwork.gov.au/award/?krn=PR720705',
  'PR720159':  'https://library.fairwork.gov.au/award/?krn=PR720159',
  'PR719090':  'https://library.fairwork.gov.au/award/?krn=PR719090',
  'PR718938':  'https://library.fairwork.gov.au/award/?krn=PR718938',
  'PR715110':  'https://library.fairwork.gov.au/award/?krn=PR715110',
  'PR712288':  'https://library.fairwork.gov.au/award/?krn=PR712288',
  'PR710965':  'https://library.fairwork.gov.au/award/?krn=PR710965',
  'PR707765':  'https://library.fairwork.gov.au/award/?krn=PR707765',
  'PR707547':  'https://library.fairwork.gov.au/award/?krn=PR707547',
  'PR706934':  'https://library.fairwork.gov.au/award/?krn=PR706934',
  'PR704124':  'https://library.fairwork.gov.au/award/?krn=PR704124',
  'PR701683':  'https://library.fairwork.gov.au/award/?krn=PR701683',
  'PR701523':  'https://library.fairwork.gov.au/award/?krn=PR701523',
  'PR700551':  'https://library.fairwork.gov.au/award/?krn=PR700551',
  'PR610286':  'https://library.fairwork.gov.au/award/?krn=PR610286',
  'PR609454':  'https://library.fairwork.gov.au/award/?krn=PR609454',
  'PR606596':  'https://library.fairwork.gov.au/award/?krn=PR606596',
  'PR606446':  'https://library.fairwork.gov.au/award/?krn=PR606446',
  'PR598110':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR598110.htm',
  'PR593886':  'https://library.fairwork.gov.au/award/?krn=PR593886',
  'PR592373':  'https://library.fairwork.gov.au/award/?krn=PR592373',
  'PR592223':  'https://library.fairwork.gov.au/award/?krn=PR592223',
  'PR584086':  'https://library.fairwork.gov.au/award/?krn=PR584086',
  'PR582984':  'https://library.fairwork.gov.au/award/?krn=PR582984',
  'PR580863':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR580863.htm',
  'PR579915':  'https://library.fairwork.gov.au/award/?krn=PR579915',
  'PR579627':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR579627.htm',
  'PR573679':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR573679.htm',
  'PR566929':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR566929.htm',
  'PR566800':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR566800.htm',
  'PR559272':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR559272.htm',
  'PR557581':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR557581.htm',
  'PR551828':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR551828.htm',
  'PR551708':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR551708.htm',
  'PR546288':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR546288.htm',
  'PR546127':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR546127.htm',
  'PR545787':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR545787.htm',
  'PR544519':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR544519.htm',
  'PR544170':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR544170.htm',
  'PR542240':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR542240.htm',
  'PR536905':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR536905.htm',
  'PR536785':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR536785.htm',
  'PR532630':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR532630.htm',
  'PR530861':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR530861.htm',
  'PR530219':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR530219.htm',
  'PR523102':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR523102.htm',
  'PR522982':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR522982.htm',
  'PR509272':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR509272.htm',
  'PR509151':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR509151.htm',
  'PR503637':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR503637.htm',
  // ── Legacy V-suffix codes (library.fairwork.gov.au) ──────────────────────
  // These are versioned variants of the same base code number. The V-suffix
  // form and the plain form are separate FWC documents with different URLs.
  'PR998159V': 'https://library.fairwork.gov.au/award/?krn=PR998159V',
  'PR998020V': 'https://library.fairwork.gov.au/award/?krn=PR998020V',
  'PR996603V': 'https://library.fairwork.gov.au/award/?krn=PR996603V',
  'PR991783V': 'https://library.fairwork.gov.au/award/?krn=PR991783V',
  'PR991088V': 'https://library.fairwork.gov.au/award/?krn=PR991088V',
  'PR566800V': 'https://library.fairwork.gov.au/award/?krn=PR566800V',
  'PR559272V': 'https://library.fairwork.gov.au/award/?krn=PR559272V',
  'PR551708V': 'https://library.fairwork.gov.au/award/?krn=PR551708V',
  'PR546127V': 'https://library.fairwork.gov.au/award/?krn=PR546127V',
  'PR544170V': 'https://library.fairwork.gov.au/award/?krn=PR544170V',
  'PR542240V': 'https://library.fairwork.gov.au/award/?krn=PR542240V',
  'PR536905V': 'https://library.fairwork.gov.au/award/?krn=PR536905V',
  'PR536785V': 'https://library.fairwork.gov.au/award/?krn=PR536785V',
  'PR530861V': 'https://library.fairwork.gov.au/award/?krn=PR530861V',
  'PR530219V': 'https://library.fairwork.gov.au/award/?krn=PR530219V',
  'PR523102V': 'https://library.fairwork.gov.au/award/?krn=PR523102V',
  'PR522982V': 'https://library.fairwork.gov.au/award/?krn=PR522982V',
  'PR509272V': 'https://library.fairwork.gov.au/award/?krn=PR509272V',
  'PR509151V': 'https://library.fairwork.gov.au/award/?krn=PR509151V',
  'PR503637V': 'https://library.fairwork.gov.au/award/?krn=PR503637V',
  // ── Legacy plain codes (fwc.gov.au/awardsandorders) ──────────────────────
  // Older variations hosted on the legacy FWC document server (http).
  'PR998748':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR998748.htm',
  'PR998159':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR998159.htm',
  'PR998020':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR998020.htm',
  'PR996603':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR996603.htm',
  'PR991783':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR991783.htm',
  'PR606630':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR606630.htm',
  'PR592689':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR592689.htm',
  'PR581528':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR581528.htm',
  'PR568050':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR568050.htm',
  'PR561478':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR561478.htm',
  'PR551831':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR551831.htm',
  'PR537893':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR537893.htm',
  'PR525068':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR525068.htm',
  'PR510670':  'http://www.fwc.gov.au/documents/awardsandorders/html/PR510670.htm',
  // ── Additional modern codes identified in second dry-run ─────────────────
  'PR786538':  'https://library.fairwork.gov.au/award/?krn=PR786538',
  'PR774051':  'https://library.fairwork.gov.au/award/?krn=PR774051',
  'PR762969':  'https://library.fairwork.gov.au/award/?krn=PR762969',
  'PR742256':  'https://library.fairwork.gov.au/award/?krn=PR742256',
  'PR729672':  'https://library.fairwork.gov.au/award/?krn=PR729672',
  'PR719661':  'https://library.fairwork.gov.au/award/?krn=PR719661',
  'PR718141':  'https://library.fairwork.gov.au/award/?krn=PR718141',
  'PR709080':  'https://library.fairwork.gov.au/award/?krn=PR709080',
}

// ─── Regex ────────────────────────────────────────────────────────────────────
// Matches PR codes in two forms:
//   Modern: PR followed by exactly 6 digits           e.g. PR795749
//   Legacy: PR followed by exactly 6 digits then 'V'  e.g. PR566800V
//
// Word-boundary anchors (\b) prevent partial matches inside longer tokens.
// The 'g' flag is required — a single blockquote line can reference multiple
// PR codes (e.g. "> Varied by PR740264 and PR740806").
const PR_REGEX = /\bPR\d{6}V?\b/g

// ─── Strip pass ───────────────────────────────────────────────────────────────
// Removes existing Markdown links of the form [PRxxxxxx](https://...) from a
// line, reducing them back to plain PR codes.
// This runs before re-linking so we always apply the current map from scratch,
// guaranteeing any previously wrong URLs are corrected.
function stripVariationLinks(line) {
  // Matches: [PR123456](https://...) or [PR123456V](https://...)
  return line.replace(/\[PR\d{6}V?\]\(https?:\/\/[^)]+\)/g, match => {
    // Extract just the PR code from inside the square brackets
    const code = match.match(/\[(PR\d{6}V?)\]/)[1]
    return code
  })
}

// ─── Process a single file ────────────────────────────────────────────────────
function processFile(filePath) {
  const original   = readFileSync(filePath, 'utf8')
  const normalised = original.replace(/\r\n/g, '\n')
  const lines      = normalised.split('\n')

  const fileLog     = []
  let   changeCount = 0

  const newLines = lines.map((line, lineIdx) => {
    // Only operate on blockquote lines.
    // A blockquote line starts with optional whitespace then '>'.
    if (!/^\s*>/.test(line)) return line

    // Strip pass: remove any existing PR variation links on this line.
    // This guarantees idempotency and corrects any previously wrong URLs.
    const stripped = stripVariationLinks(line)

    // Find all PR codes on this stripped line.
    const matches = [...stripped.matchAll(PR_REGEX)]
    if (matches.length === 0) return stripped

    // Insertion pass: replace each PR code with a Markdown link.
    // We iterate right-to-left through the matches so that inserting the
    // longer link text at a given position doesn't shift earlier match indices.
    let working = stripped
    for (let i = matches.length - 1; i >= 0; i--) {
      const match = matches[i]
      const code  = match[0]
      const start = match.index
      const url   = VARIATION_MAP[code]

      if (!url) {
        fileLog.push(` ⚠️  Line ${lineIdx + 1}: '${code}' not in variation map — left as plain text`)
        continue
      }

      const linked = `[${code}](${url})`
      working = working.substring(0, start) + linked + working.substring(start + code.length)
      changeCount++
      fileLog.push(` ✅ Line ${lineIdx + 1}: '${code}' → [${code}](${url})`)
    }

    return working
  })

  // Only record and write files that actually changed.
  const newContent = newLines.join('\n')
  if (newContent === normalised) return { changed: false, log: [] }

  if (!DRY_RUN) writeFileSync(filePath, newContent, 'utf8')
  return { changed: true, log: fileLog, count: changeCount }
}

// ─── Walk childrens-services directory ───────────────────────────────────────
const log         = []
let totalFiles    = 0
let totalLinks    = 0
let totalWarnings = 0

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) { walk(full); continue }
    if (!entry.endsWith('.md')) continue

    const result = processFile(full)

    // Always accumulate warnings even if the file had no net content change
    const warns = result.log ? result.log.filter(l => l.includes('⚠️')) : []
    totalWarnings += warns.length

    if (result.changed) {
      totalFiles += 1
      totalLinks += result.count
      log.push(`\n📄 ${full}`)
      log.push(...result.log)
    } else if (warns.length > 0) {
      // File unchanged but had warnings — still surface them in the log
      log.push(`\n📄 ${full} (no changes — warnings only)`)
      log.push(...warns)
    }
  }
}

walk(TARGET_DIR)

// ─── Output ───────────────────────────────────────────────────────────────────
const mode = DRY_RUN ? '🔍 DRY RUN — no files were written' : '✏️  FILES UPDATED'
console.log(`\n${mode}`)
console.log(`Target: docs\\ebas\\childrens-services`)
console.log(`Files changed:    ${totalFiles}`)
console.log(`Links inserted:   ${totalLinks}`)
console.log(`Warnings (codes not in map): ${totalWarnings}`)
if (log.length) console.log(log.join('\n'))

const logPath = join(DOCS_ROOT, '..', 'link-variations-log.txt')
writeFileSync(
  logPath,
  `${mode}\nTarget: docs\\ebas\\childrens-services\nFiles changed: ${totalFiles}\nLinks inserted: ${totalLinks}\nWarnings: ${totalWarnings}\n${log.join('\n')}`,
  'utf8'
)
console.log(`\n📋 Full log written to: C:\\Projects\\EBAdb\\link-variations-log.txt`)
