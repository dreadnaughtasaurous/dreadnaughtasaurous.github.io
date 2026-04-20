import { execSync } from 'child_process'
import { writeFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Get full git log — hash, date, and subject line
const raw = execSync(
  'git log --pretty=format:"%h|%as|%s" --no-merges',
  { encoding: 'utf8' }
).trim()

if (!raw) {
  console.log('No git history found.')
  process.exit(0)
}

const lines = raw.split('\n')

// Group commits by year-month
const grouped = {}
for (const line of lines) {
  const [hash, date, ...subjectParts] = line.split('|')
  const subject = subjectParts.join('|').trim()
  const [year, month] = date.split('-')
  const key = `${year}-${month}`
  if (!grouped[key]) grouped[key] = []
  grouped[key].push({ hash, date, subject })
}

// Build markdown content
const monthNames = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

let md = `---
title: Changelog
description: A full history of all updates made to the Austin Health EBA Wiki.
nolebase:
  gitChangelog: false
---

# Changelog

A complete record of all changes made to the Austin Health EBA Wiki, updated automatically on every deployment. Most recent changes appear first.

`

for (const key of Object.keys(grouped).sort().reverse()) {
  const [year, month] = key.split('-')
  md += `## ${monthNames[parseInt(month)]} ${year}\n\n`
  for (const { hash, date, subject } of grouped[key]) {
    md += `- **${date}** — ${subject} [\`${hash}\`](https://github.com/dreadnaughtasaurous/dreadnaughtasaurous.github.io/commit/${hash})\n`
  }
  md += '\n'
}

const outPath = resolve(__dirname, '../changelog.md')
writeFileSync(outPath, md, 'utf8')
console.log(`Changelog written to ${outPath} with ${lines.length} entries.`)