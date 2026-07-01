/**
 * generate-clause-counts.mjs
 * Scans all EBA markdown files, counts clauses per EBA and per topic,
 * and writes docs/public/clause-counts.json for use by EBAExplorer.vue.
 * Run: node scripts/generate-clause-counts.mjs
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'fs'
import { join } from 'path'
import { fileURLToPath } from 'url'

const DOCS = join(fileURLToPath(import.meta.url), '../../')
const EBAS = join(DOCS, 'ebas')
const OUT  = join(DOCS, 'public', 'clause-counts.json')

const EBA_SLUGS = [
  'allied-health', 'biomedical-engineers', 'childrens-services',
  'doctors-in-training', 'has-managers-admin-2025-2027', 'medical-specialists',
  'mental-health', 'mspp', 'nurses-midwives',
]

function walkMd(dir) {
  if (!existsSync(dir)) return []
  return readdirSync(dir, { withFileTypes: true }).flatMap(e => {
    const p = join(dir, e.name)
    if (e.isDirectory())                          return walkMd(p)
    if (e.name.endsWith('.md') && e.name !== 'index.md') return [p]
    return []
  })
}

function parseTopics(content) {
  const fm = content.match(/^---[\r\n]([\s\S]*?)[\r\n]---/)
  if (!fm) return []
  const m = fm[1].match(/topics:\s*\[([^\]]*)\]/)
  if (!m)  return []
  return [...m[1].matchAll(/'([^']+)'/g)].map(r => r[1])
}

const result = {}

for (const slug of EBA_SLUGS) {
  const files = walkMd(join(EBAS, slug))
  const topicCounts = {}
  for (const f of files) {
    for (const t of parseTopics(readFileSync(f, 'utf8'))) {
      topicCounts[t] = (topicCounts[t] ?? 0) + 1
    }
  }
  result[slug] = { _total: files.length, ...topicCounts }
}

writeFileSync(OUT, JSON.stringify(result, null, 2))
console.log(`✓ clause-counts.json — ${Object.keys(result).length} EBAs`)
for (const [slug, data] of Object.entries(result)) {
  console.log(`  ${slug}: ${data._total} clauses`)
}