// patch-pagefind.mjs
// Runs after vitepress build.
// 1. Injects data-pagefind-body onto the vp-doc div
// 2. Injects data-pagefind-filter spans for eba and topics filters

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { glob } from 'fs/promises'
import { join, relative } from 'path'

const distDir = new URL('../.vitepress/dist', import.meta.url).pathname
  .replace(/^\/([A-Z]:)/, '$1') // fix Windows drive letter

const docsDir = new URL('..', import.meta.url).pathname
  .replace(/^\/([A-Z]:)/, '$1')

let patched = 0
let skipped = 0

// Helper: extract front matter value from .md file
function getFrontMatter(mdPath) {
  if (!existsSync(mdPath)) return {}
  const content = readFileSync(mdPath, 'utf8')
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return {}
  const fm = {}
  for (const line of match[1].split(/\r?\n/)) {
    const kv = line.match(/^(\w+):\s*(.+)$/)
    if (!kv) continue
    const key = kv[1].trim()
    let val = kv[2].trim()
    // Strip surrounding quotes: 'value' or "value"
    val = val.replace(/^['"](.*)['"]$/, '$1')
    // Strip array brackets: ['a', 'b'] → 'a, b'
    if (val.startsWith('[')) {
      val = val
        .replace(/^\[|\]$/g, '')           // remove [ and ]
        .split(',')
        .map(v => v.trim().replace(/^['"]|['"]$/g, ''))  // remove quotes from each item
        .filter(v => v.length > 0)
        .join(', ')
    }
    fm[key] = val
  }
  return fm
}

// Find all HTML files in dist
const htmlFiles = []
for await (const f of glob('**/*.html', { cwd: distDir })) {
  htmlFiles.push(join(distDir, f))
}

for (const file of htmlFiles) {
  let html = readFileSync(file, 'utf8')

  // Find the matching .md source file
  const relHtml = relative(distDir, file)               // e.g. ebas\allied-health.html
  const relMd   = relHtml.replace(/\.html$/, '.md')     // e.g. ebas\allied-health.md
  const mdPath  = join(docsDir, relMd)
  const fm      = getFrontMatter(mdPath)

    // Build filter span HTML — one span per value so Pagefind indexes each separately
    let filterSpans = ''
    if (fm.eba) {
      filterSpans += `<span data-pagefind-filter="eba">${fm.eba}</span>`
    }
    if (fm.topics && fm.topics.length > 0) {
      // fm.topics is already a comma-separated string from getFrontMatter()
      const topicArr = fm.topics.split(',').map(t => t.trim()).filter(t => t.length > 0)
      for (const topic of topicArr) {
        filterSpans += `<span data-pagefind-filter="topics">${topic}</span>`
      }
    }

  // Inject data-pagefind-body and filter spans onto the vp-doc div
  if (html.includes('class="vp-doc ')) {
    html = html.replace(
      /class="vp-doc ([^"]*)"/,
      `class="vp-doc $1" data-pagefind-body`
    )
    // Insert filter spans immediately after the opening vp-doc div tag
    if (filterSpans) {
      html = html.replace(
        /(class="vp-doc [^"]*" data-pagefind-body[^>]*>)/,
        `$1${filterSpans}`
      )
    }
    writeFileSync(file, html, 'utf8')
    patched++
  } else {
    skipped++
  }
}

console.log(`Patched ${patched} files, skipped ${skipped}`)