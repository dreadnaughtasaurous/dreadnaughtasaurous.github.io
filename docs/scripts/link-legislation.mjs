// link-legislation.mjs
// Scans all EBA .md files and hyperlinks the FIRST occurrence of each
// external legislation reference to its authoritative source URL.
//
// Rules:
//   1. Only links the FIRST occurrence of each matched name per file.
//      Subsequent bare references (e.g. repeated "NES", "OHS Act") are
//      left as plain text — this avoids cluttering dense clause pages.
//   2. Never modifies frontmatter (everything above and including the
//      closing --- delimiter).
//   3. Never modifies lines that already contain a Markdown link to any
//      of the legislation domains (already linked).
//   4. Skips heading lines (# ...) for link insertion — headings should
//      remain plain text.
//   5. Does NOT link bare "the Act" or "the Commission" — too short and
//      contextually ambiguous across different EBAs.
//   6. Matches are applied in PRIORITY ORDER — longer, more specific
//      patterns are matched before shorter abbreviations, so
//      "Fair Work Act 2009 (Cth)" is matched before any shorter token.
//   7. Produces a full log at C:\Projects\EBAdb\link-legislation-log.txt
//
// Usage (run from C:\Projects\EBAdb\docs):
//   node scripts/link-legislation.mjs            — all EBAs
//   node scripts/link-legislation.mjs --dry-run  — preview, no writes
//   node scripts/link-legislation.mjs --eba allied-health
//
// The authoritative legislation URL map is defined below in LEGISLATION_MAP.
// To add a new piece of legislation, append an entry there and add its
// abbreviation patterns to the ABBREVIATIONS array.

import { readFileSync, writeFileSync, readdirSync, statSync } from 'fs'
import { join, relative } from 'path'

// ─── CLI args ─────────────────────────────────────────────────────────────────
const args       = process.argv.slice(2)
const DRY_RUN    = args.includes('--dry-run')
const EBA_FILTER = (() => { const i = args.indexOf('--eba'); return i !== -1 ? args[i + 1] : null })()

const DOCS_ROOT = new URL('..', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1')
const EBAS_ROOT = join(DOCS_ROOT, 'ebas')

// ─── Legislation URL map ──────────────────────────────────────────────────────
// Each entry: { url, shortName }
//   url       — the authoritative external URL
//   shortName — the label used inside the Markdown link text
//
// IMPORTANT: This is the single source of truth for legislation URLs.
// When a URL changes, update it here only — all .md files will pick it
// up on the next run of this script.

const LEGISLATION_MAP = {
  'Fair Work Act 2009 (Cth)': {
    url: 'https://www.legislation.gov.au/C2009A00028/latest/text',
    shortName: 'Fair Work Act 2009 (Cth)',
  },
  'Fair Work Act 2009': {
    url: 'https://www.legislation.gov.au/C2009A00028/latest/text',
    shortName: 'Fair Work Act 2009 (Cth)',
  },
  'Occupational Health and Safety Act 2004 (Vic)': {
    url: 'https://www.legislation.vic.gov.au/in-force/acts/occupational-health-and-safety-act-2004/045',
    shortName: 'Occupational Health and Safety Act 2004 (Vic)',
  },
  'Occupational Health and Safety Act 2004': {
    url: 'https://www.legislation.vic.gov.au/in-force/acts/occupational-health-and-safety-act-2004/045',
    shortName: 'Occupational Health and Safety Act 2004 (Vic)',
  },
  'Occupational and Health Safety Act 2004': {
    url: 'https://www.legislation.vic.gov.au/in-force/acts/occupational-health-and-safety-act-2004/045',
    shortName: 'Occupational Health and Safety Act 2004 (Vic)',
  },
  'Workplace Injury Rehabilitation and Compensation Act 2013 (Vic)': {
    url: 'https://www.legislation.vic.gov.au/in-force/acts/workplace-injury-rehabilitation-and-compensation-act-2013/053',
    shortName: 'Workplace Injury Rehabilitation and Compensation Act 2013 (Vic)',
  },
  'Workplace Injury Rehabilitation and Compensation Act 2013': {
    url: 'https://www.legislation.vic.gov.au/in-force/acts/workplace-injury-rehabilitation-and-compensation-act-2013/053',
    shortName: 'Workplace Injury Rehabilitation and Compensation Act 2013 (Vic)',
  },
  'Equal Opportunity Act 2010 (Vic)': {
    url: 'https://www.legislation.vic.gov.au/in-force/acts/equal-opportunity-act-2010/032',
    shortName: 'Equal Opportunity Act 2010 (Vic)',
  },
  'Equal Opportunity Act 2010': {
    url: 'https://www.legislation.vic.gov.au/in-force/acts/equal-opportunity-act-2010/032',
    shortName: 'Equal Opportunity Act 2010 (Vic)',
  },
  'Fair Work Regulations 2009 (Cth)': {
    url: 'https://www.legislation.gov.au/F2009L02356/latest/text',
    shortName: 'Fair Work Regulations 2009 (Cth)',
  },
  'Fair Work Regulations 2009': {
    url: 'https://www.legislation.gov.au/F2009L02356/latest/text',
    shortName: 'Fair Work Regulations 2009 (Cth)',
  },
  'Superannuation Guarantee (Administration) Act 1992 (Cth)': {
    url: 'https://www.legislation.gov.au/C2004A04402/latest/text',
    shortName: 'Superannuation Guarantee (Administration) Act 1992 (Cth)',
  },
  'Superannuation Guarantee (Administration) Act 1992': {
    url: 'https://www.legislation.gov.au/C2004A04402/latest/text',
    shortName: 'Superannuation Guarantee (Administration) Act 1992 (Cth)',
  },
  'Superannuation Industry (Supervision) Act 1993 (Cth)': {
    url: 'https://www.legislation.gov.au/C2004A04633/2017-03-01/text',
    shortName: 'Superannuation Industry (Supervision) Act 1993 (Cth)',
  },
  'Superannuation Industry (Supervision) Act 1993': {
    url: 'https://www.legislation.gov.au/C2004A04633/2017-03-01/text',
    shortName: 'Superannuation Industry (Supervision) Act 1993 (Cth)',
  },
  'Health Services Act 1988 (Vic)': {
    url: 'https://www.legislation.vic.gov.au/in-force/acts/health-services-act-1988/188',
    shortName: 'Health Services Act 1988 (Vic)',
  },
  'Health Services Act 1988': {
    url: 'https://www.legislation.vic.gov.au/in-force/acts/health-services-act-1988/188',
    shortName: 'Health Services Act 1988 (Vic)',
  },
  'Accident Compensation Act 1985 (Vic)': {
    url: 'https://www.legislation.vic.gov.au/in-force/acts/accident-compensation-act-1985/236',
    shortName: 'Accident Compensation Act 1985 (Vic)',
  },
  'Accident Compensation Act 1985': {
    url: 'https://www.legislation.vic.gov.au/in-force/acts/accident-compensation-act-1985/236',
    shortName: 'Accident Compensation Act 1985 (Vic)',
  },
  'Workers Compensation Act 1958 (Vic)': {
    url: 'https://www.legislation.vic.gov.au/in-force/acts/workers-compensation-act-1958/161',
    shortName: 'Workers Compensation Act 1958 (Vic)',
  },
  'Workers Compensation Act 1958': {
    url: 'https://www.legislation.vic.gov.au/in-force/acts/workers-compensation-act-1958/161',
    shortName: 'Workers Compensation Act 1958 (Vic)',
  },
  'Health Professionals and Support Services Award 2020': {
    url: 'https://awards.fairwork.gov.au/MA000027.html',
    shortName: 'Health Professionals and Support Services Award 2020',
  },
  'Health Practitioner Regulation National Law (Victoria) Act 2009 (Vic)': {
    url: 'https://www.legislation.vic.gov.au/in-force/acts/health-practitioner-regulation-national-law-victoria-act-2009/006',
    shortName: 'Health Practitioner Regulation National Law (Victoria) Act 2009',
  },
  'Health Practitioner Regulation National Law (as adopted in the applicable State or Territory)': {
    url: 'https://www.legislation.vic.gov.au/in-force/acts/health-practitioner-regulation-national-law-victoria-act-2009/006',
    shortName: 'Health Practitioner Regulation National Law',
  },
  'Health Practitioner Regulation National Law Act 2009 (Vic)': {
    url: 'https://www.legislation.vic.gov.au/in-force/acts/health-practitioner-regulation-national-law-victoria-act-2009/006',
    shortName: 'Health Practitioner Regulation National Law Act 2009 (Vic)',
  },
  'Health Practitioner Regulation National Law Act': {
    url: 'https://www.legislation.vic.gov.au/in-force/acts/health-practitioner-regulation-national-law-victoria-act-2009/006',
    shortName: 'Health Practitioner Regulation National Law Act',
  },
  'Mental Health and Wellbeing Act 2022 (Vic)': {
    url: 'https://www.health.vic.gov.au/mental-health-and-wellbeing-act',
    shortName: 'Mental Health and Wellbeing Act 2022 (Vic)',
  },
  'Mental Health and Wellbeing Act 2022': {
    url: 'https://www.health.vic.gov.au/mental-health-and-wellbeing-act',
    shortName: 'Mental Health and Wellbeing Act 2022 (Vic)',
  },
  'Safe Patient Care (Nurse to Patient and Midwife to Patient Ratios) Act 2015': {
    url: 'https://www.legislation.vic.gov.au/in-force/acts/safe-patient-care-nurse-patient-and-midwife-patient-ratios-act-2015/011',
    shortName: 'Safe Patient Care Act 2015',
  },
  'Long Service Leave Act 2018 (Vic)': {
    url: 'https://www.legislation.vic.gov.au/in-force/acts/long-service-leave-act-2018/006',
    shortName: 'Long Service Leave Act 2018 (Vic)',
  },
  'Long Service Leave Act 2018': {
    url: 'https://www.legislation.vic.gov.au/in-force/acts/long-service-leave-act-2018/006',
    shortName: 'Long Service Leave Act 2018 (Vic)',
  },
  'Gender Equality Act 2020 (Vic)': {
    url: 'https://www.legislation.vic.gov.au/as-made/acts/gender-equality-act-2020',
    shortName: 'Gender Equality Act 2020 (Vic)',
  },
  'Gender Equality Act 2020': {
    url: 'https://www.legislation.vic.gov.au/as-made/acts/gender-equality-act-2020',
    shortName: 'Gender Equality Act 2020 (Vic)',
  },
  'Fair Work (Transitional Provisions and Consequential Amendments) Act 2009 (Cth)': {
    url: 'https://www.legislation.gov.au/C2009A00055/latest/text',
    shortName: 'Fair Work (Transitional Provisions and Consequential Amendments) Act 2009 (Cth)',
  },
  'Fair Work (Transitional Provisions and Consequential Amendments) Act 2009': {
    url: 'https://www.legislation.gov.au/C2009A00055/latest/text',
    shortName: 'Fair Work (Transitional Provisions and Consequential Amendments) Act 2009 (Cth)',
  },
  'Worker Screening Act 2020 (Vic)': {
    url: 'https://www.legislation.vic.gov.au/as-made/acts/worker-screening-act-2020',
    shortName: 'Worker Screening Act 2020 (Vic)',
  },
  'Worker Screening Act 2020': {
    url: 'https://www.legislation.vic.gov.au/as-made/acts/worker-screening-act-2020',
    shortName: 'Worker Screening Act 2020 (Vic)',
  },
  'Financial Management Act 1994 (Vic)': {
    url: 'https://www.legislation.vic.gov.au/in-force/acts/financial-management-act-1994',
    shortName: 'Financial Management Act 1994 (Vic)',
  },
  'Financial Management Act 1994': {
    url: 'https://www.legislation.vic.gov.au/in-force/acts/financial-management-act-1994',
    shortName: 'Financial Management Act 1994 (Vic)',
  },
  'Assisted Reproductive Treatment Act 2008 (Vic)': {
    url: 'https://www.legislation.vic.gov.au/in-force/acts/assisted-reproductive-treatment-act-2008/030',
    shortName: 'Assisted Reproductive Treatment Act 2008 (Vic)',
  },
  'Assisted Reproductive Treatment Act 2008': {
    url: 'https://www.legislation.vic.gov.au/in-force/acts/assisted-reproductive-treatment-act-2008/030',
    shortName: 'Assisted Reproductive Treatment Act 2008 (Vic)',
  },
  'Defence Reserve Service (Protection) Act 2001 (Cth)': {
    url: 'https://www.legislation.gov.au/C2004A00776/latest',
    shortName: 'Defence Reserve Service (Protection) Act 2001 (Cth)',
  },
  'Defence Reserve Service (Protection) Act 2001': {
    url: 'https://www.legislation.gov.au/C2004A00776/latest',
    shortName: 'Defence Reserve Service (Protection) Act 2001 (Cth)',
  },
  'Juries Act 2000 (Vic)': {
    url: 'https://www.legislation.vic.gov.au/in-force/acts/juries-act-2000/060',
    shortName: 'Juries Act 2000 (Vic)',
  },
  'Juries Act 2000': {
    url: 'https://www.legislation.vic.gov.au/in-force/acts/juries-act-2000/060',
    shortName: 'Juries Act 2000 (Vic)',
  },
  'Family Violence Protection Act 2008 (Vic)': {
    url: 'https://www.legislation.vic.gov.au/in-force/acts/family-violence-protection-act-2008',
    shortName: 'Family Violence Protection Act 2008 (Vic)',
  },
  'Family Violence Protection Act 2008': {
    url: 'https://www.legislation.vic.gov.au/in-force/acts/family-violence-protection-act-2008',
    shortName: 'Family Violence Protection Act 2008 (Vic)',
  },
  'Carer Recognition Act 2010 (Cth)': {
    url: 'https://www.legislation.gov.au/C2010A00123/asmade',
    shortName: 'Carer Recognition Act 2010 (Cth)',
  },
  'Carer Recognition Act 2010': {
    url: 'https://www.legislation.gov.au/C2010A00123/asmade',
    shortName: 'Carer Recognition Act 2010 (Cth)',
  },
  'Health Records Act 2001 (Vic)': {
    url: 'https://www.legislation.vic.gov.au/in-force/acts/health-records-act-2001/050',
    shortName: 'Health Records Act 2001 (Vic)',
  },
  'Health Records Act 2001': {
    url: 'https://www.legislation.vic.gov.au/in-force/acts/health-records-act-2001/050',
    shortName: 'Health Records Act 2001 (Vic)',
  },
  'Disability Services Act 1986 (Cth)': {
    url: 'https://www.legislation.gov.au/C2004A03370/asmade/1986-12-09/text/original/pdf',
    shortName: 'Disability Services Act 1986 (Cth)',
  },
  'Disability Services Act 1986': {
    url: 'https://www.legislation.gov.au/C2004A03370/asmade/1986-12-09/text/original/pdf',
    shortName: 'Disability Services Act 1986 (Cth)',
  },
  'Private Security Act 2004 (Vic)': {
    url: 'https://www.legislation.vic.gov.au/in-force/acts/private-security-act-2004',
    shortName: 'Private Security Act 2004 (Vic)',
  },
  'Private Security Act 2004': {
    url: 'https://www.legislation.vic.gov.au/in-force/acts/private-security-act-2004',
    shortName: 'Private Security Act 2004 (Vic)',
  },
}

// ─── Abbreviation patterns ────────────────────────────────────────────────────
// These are standalone abbreviation tokens (defined per-EBA in definitions
// clauses). Linked as abbreviations — FIRST occurrence per file only.
// Only abbreviations that are unambiguous across all EBAs are included.
// Bare "the Act", "the Commission" are intentionally excluded.
//
// Each entry: { pattern (RegExp), url, label }
// The pattern uses word boundaries so "OHS" doesn't match inside "MOHSA".

const ABBREVIATIONS = [
  {
    // NES — National Employment Standards
    pattern: /\bNES\b/,
    url: 'https://www.fairwork.gov.au/employment-conditions/national-employment-standards#tools-and-resources',
    label: 'NES',
  },
  {
    // OHS Act — Occupational Health and Safety Act 2004 (Vic)
    pattern: /\bOHS Act\b/,
    url: 'https://www.legislation.vic.gov.au/in-force/acts/occupational-health-and-safety-act-2004/045',
    label: 'OHS Act',
  },
  {
    // WIRC Act — Workplace Injury Rehabilitation and Compensation Act 2013
    pattern: /\bWIRC Act\b/,
    url: 'https://www.legislation.vic.gov.au/in-force/acts/workplace-injury-rehabilitation-and-compensation-act-2013/053',
    label: 'WIRC Act',
  },
  {
    // EO Act — Equal Opportunity Act 2010 (Vic)
    pattern: /\bEO Act\b/,
    url: 'https://www.legislation.vic.gov.au/in-force/acts/equal-opportunity-act-2010/032',
    label: 'EO Act',
  },
  {
    // HRP Act — Health Practitioner Regulation National Law Act
    pattern: /\bHRP Act\b/,
    url: 'https://www.legislation.vic.gov.au/in-force/acts/health-practitioner-regulation-national-law-victoria-act-2009/006',
    label: 'HRP Act',
  },
  {
    // Health Services Act (abbreviated form without year)
    pattern: /\bHealth Services Act\b(?!\s+1988)/,
    url: 'https://www.legislation.vic.gov.au/in-force/acts/health-services-act-1988/188',
    label: 'Health Services Act 1988 (Vic)',
  },
  {
    // FW Regulations (abbreviated form)
    pattern: /\bFW Regulations\b/,
    url: 'https://www.legislation.gov.au/F2009L02356/latest/text',
    label: 'Fair Work Regulations 2009 (Cth)',
  },
  {
    // Safe Patient Care Act (abbreviated form)
    pattern: /\bSafe Patient Care Act\b/,
    url: 'https://www.legislation.vic.gov.au/in-force/acts/safe-patient-care-nurse-patient-and-midwife-patient-ratios-act-2015/011',
    label: 'Safe Patient Care Act',
  },
  {
    // Mental Health and Wellbeing Act (abbreviated — without year)
    pattern: /\bMental Health and Wellbeing Act\b(?!\s+2022)/,
    url: 'https://www.health.vic.gov.au/mental-health-and-wellbeing-act',
    label: 'Mental Health and Wellbeing Act 2022 (Vic)',
  },
]

// ─── Legislation domains used to detect already-linked lines ─────────────────
// If any of these strings appear in a line, it already contains a legislation
// link and we skip it for that particular entry (but still process others).
const LEGISLATION_DOMAINS = [
  'legislation.gov.au',
  'legislation.vic.gov.au',
  'fairwork.gov.au',
  'awards.fairwork.gov.au',
  'fwc.gov.au',
  'health.vic.gov.au/mental-health',
]

// ─── Build the ordered match list ────────────────────────────────────────────
// Longer patterns first so "Fair Work Act 2009 (Cth)" doesn't get partially
// consumed by a shorter pattern. We sort by descending pattern string length.
const FULL_PATTERNS = Object.entries(LEGISLATION_MAP)
  .sort((a, b) => b[0].length - a[0].length)
  .map(([name, { url, shortName }]) => ({
    name,
    url,
    shortName,
    // Escape the name for use in a RegExp. \( and \) are the main hazard.
    regex: new RegExp(escapeRegex(name), 'g'),
  }))

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// ─── Detect whether a line already contains a link to a specific URL ─────────
function lineHasLinkTo(line, url) {
  return line.includes(`](${url})`) || line.includes(`](${url}`)
}

// ─── Detect whether a line already contains ANY legislation domain link ───────
function lineHasAnyLegislationLink(line) {
  return LEGISLATION_DOMAINS.some(domain => line.includes(domain))
}

// ─── Log accumulator ─────────────────────────────────────────────────────────
const log        = []
let totalFiles   = 0
let totalChanges = 0

// ─── Process a single file ────────────────────────────────────────────────────
function processFile(filePath) {
  const original   = readFileSync(filePath, 'utf8')
  const normalised = original.replace(/\r\n/g, '\n')

  // Split frontmatter from body. The --- delimiter must be on its own line.
  const fmMatch = normalised.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/)
  if (!fmMatch) return

  const frontMatter = fmMatch[1]
  const body        = fmMatch[2]

  let changeCount   = 0
  const fileChanges = []

  // Per-file "already linked" tracking — keyed by URL, not pattern name.
  const linkedUrls = new Set()

  const newLines = body.split('\n').map((line, lineIdx) => {

    // ── Skip heading lines for insertion (but don't strip them) ──────────────
    if (line.startsWith('#')) return line

    let workingLine = line

    // ── Pass A: Full formal citation names ───────────────────────────────────
    for (const { name, url, shortName, regex } of FULL_PATTERNS) {
      if (linkedUrls.has(url)) continue
      if (lineHasLinkTo(workingLine, url)) {
        linkedUrls.add(url)
        continue
      }

      regex.lastIndex = 0
      const match = regex.exec(workingLine)
      if (!match) continue

      const before = workingLine.substring(0, match.index)
      const after  = workingLine.substring(match.index + match[0].length)

      const opens  = (before.match(/\[/g) || []).length
      const closes = (before.match(/\]/g) || []).length
      if (opens > closes) continue

      if (after.startsWith('](')) continue

      const replacement = `[${shortName}](${url})`
      workingLine = before + replacement + after
      linkedUrls.add(url)
      changeCount++
      fileChanges.push(` ✅ Line ${lineIdx + 1}: '${name}' → [${shortName}](${url})`)
    }

    // ── Pass B: Abbreviations ─────────────────────────────────────────────────
    for (const abbr of ABBREVIATIONS) {
      if (linkedUrls.has(abbr.url)) continue
      if (lineHasLinkTo(workingLine, abbr.url)) {
        linkedUrls.add(abbr.url)
        continue
      }

      abbr.pattern.lastIndex = 0
      const match = abbr.pattern.exec(workingLine)
      if (!match) continue

      const before = workingLine.substring(0, match.index)
      const after  = workingLine.substring(match.index + match[0].length)

      const opens  = (before.match(/\[/g) || []).length
      const closes = (before.match(/\]/g) || []).length
      if (opens > closes) continue

      if (after.startsWith('](')) continue

      const replacement = `[${abbr.label}](${abbr.url})`
      workingLine = before + replacement + after
      linkedUrls.add(abbr.url)
      changeCount++
      fileChanges.push(` ✅ Line ${lineIdx + 1}: '${match[0]}' (abbr) → [${abbr.label}](${abbr.url})`)
    }

    return workingLine
  })

  const newContent = `---\n${frontMatter}\n---\n${newLines.join('\n')}`
  if (newContent === normalised) return

  const relPath = relative(DOCS_ROOT, filePath).replace(/\\/g, '/')
  log.push(`\n📄 ${relPath} (${changeCount} change${changeCount !== 1 ? 's' : ''})`)
  log.push(...fileChanges)

  totalFiles++
  totalChanges += changeCount

  if (!DRY_RUN) writeFileSync(filePath, newContent, 'utf8')
}

// ─── Walk EBA folders ─────────────────────────────────────────────────────────
const ebaFolders = readdirSync(EBAS_ROOT).filter(f => {
  if (EBA_FILTER) return f === EBA_FILTER
  return statSync(join(EBAS_ROOT, f)).isDirectory()
})

function walkAndProcess(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stat = statSync(full)
    if (stat.isDirectory()) walkAndProcess(full)
    else if (entry.endsWith('.md')) processFile(full)
  }
}

for (const ebaFolder of ebaFolders) {
  walkAndProcess(join(EBAS_ROOT, ebaFolder))
}

// ─── Output log ───────────────────────────────────────────────────────────────
const mode = DRY_RUN ? '🔍 DRY RUN — no files were written' : '✏️ FILES UPDATED'
console.log(`\n${mode}`)
console.log(`EBA filter: ${EBA_FILTER ?? 'all EBAs'}`)
console.log(`Files changed: ${totalFiles}`)
console.log(`Total legislation links inserted: ${totalChanges}`)
console.log(log.join('\n'))

const logPath = join(DOCS_ROOT, '..', 'link-legislation-log.txt')
writeFileSync(
  logPath,
  `${mode}\nEBA: ${EBA_FILTER ?? 'all'}\nFiles changed: ${totalFiles}\nLegislation links inserted: ${totalChanges}\n${log.join('\n')}`,
  'utf8'
)
console.log(`\n📋 Full log written to: C:\\Projects\\EBAdb\\link-legislation-log.txt`)