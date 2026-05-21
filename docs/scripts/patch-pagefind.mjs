// patch-pagefind.mjs
// Runs after vitepress build.
// 1. Strips ALL previously injected pagefind divs (idempotent, handles duplicates)
// 2. Injects data-pagefind-body onto the vp-doc div
// 3. Injects data-pagefind-filter spans for eba and topics filters
// 4. Injects data-pagefind-weight div — score based on slug/topic relevance
// 5. Injects hidden synonyms div at END of body with data-pagefind-ignore

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { glob } from 'fs/promises'
import { join, relative } from 'path'

const distDir = new URL('../.vitepress/dist', import.meta.url).pathname
  .replace(/^\/([A-Z]:)/, '$1')

const docsDir = new URL('..', import.meta.url).pathname
  .replace(/^\/([A-Z]:)/, '$1')

let patched = 0
let skipped = 0

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
    val = val.replace(/^['"](.*)['"]$/, '$1')
    if (val.startsWith('[')) {
      val = val
        .replace(/^\[|\]$/g, '')
        .split(',')
        .map(v => v.trim().replace(/^['"]|['"]$/g, ''))
        .filter(v => v.length > 0)
        .join(', ')
    }
    fm[key] = val
  }
  return fm
}

// Strip all instances of a div pattern — loops until none remain.
// This handles cases where multiple divs exist (old hardcoded + newly injected).
function stripAllDivs(html, classPattern) {
  const re = new RegExp(`<div[^>]*class="${classPattern}"[^>]*>[\\s\\S]*?<\\/div>`, 'g')
  let prev
  do {
    prev = html
    html = html.replace(re, '')
  } while (html !== prev)
  return html
}

// Compute relevance weight from slug and topic tags.
// Weight 10: slug contains ALL words of a topic keyword → this page IS the topic
// Weight 5:  page is tagged but slug does not directly match any topic
function computeWeight(slug, topics) {
  if (!topics || topics.trim().length === 0) return 5

  const topicList = topics
    .split(',')
    .map(t => t.trim().toLowerCase())
    .filter(t => t.length > 0)

  const slugNorm = slug.toLowerCase()

  for (const topic of topicList) {
    // Split hyphenated topic into constituent words, ignore short words (≤2 chars)
    const topicWords = topic.split(/[-\s]+/).filter(w => w.length > 2)
    if (topicWords.length === 0) continue

    // ALL words in the topic must appear in the slug for a weight-10 match
    const allMatch = topicWords.every(word => slugNorm.includes(word))
    if (allMatch) return 10
  }

  return 5
}

const htmlFiles = []
for await (const f of glob('**/*.html', { cwd: distDir })) {
  htmlFiles.push(join(distDir, f))
}

for (const file of htmlFiles) {
  let html = readFileSync(file, 'utf8')

  // ── EXTRACT synonyms content before stripping ────────────────────────────────
  let extractedSynonyms = ''
  const synonymsMatch = html.match(
    /<div[^>]*class="pagefind-synonyms"[^>]*>([\s\S]*?)<\/div>/
  )
  if (synonymsMatch) {
    extractedSynonyms = synonymsMatch[1].trim()
  }

  // ── STRIP PASS — removes ALL instances of each div class ─────────────────────
  // Uses a loop to handle duplicates: old hardcoded .md body divs AND any
  // previously injected divs from prior script runs are both removed.
  html = stripAllDivs(html, 'pagefind-synonyms')
  html = stripAllDivs(html, 'pagefind-weight')

  // ── SOURCE FILE + FRONT MATTER ───────────────────────────────────────────────
  const relHtml = relative(distDir, file)
  const relMd = relHtml.replace(/\.html$/, '.md')
  const mdPath = join(docsDir, relMd)
  const fm = getFrontMatter(mdPath)

  const slug = relHtml
    .replace(/\.html$/, '')
    .split(/[/\\]/)
    .pop() || ''

  // ── RESOLVE synonyms text ────────────────────────────────────────────────────
  const synonymsText = (fm.synonyms && fm.synonyms.trim().length > 0)
    ? fm.synonyms.trim()
    : extractedSynonyms

  // ── FILTER SPANS ─────────────────────────────────────────────────────────────
  let filterSpans = ''
  if (fm.eba) {
    filterSpans += `<span data-pagefind-filter="eba" data-pagefind-ignore data-allow-mismatch style="display:none">${fm.eba}</span>`
  }
  if (fm.topics && fm.topics.length > 0) {
    const topicArr = fm.topics
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0)
    for (const topic of topicArr) {
      filterSpans += `<span data-pagefind-filter="topics" data-pagefind-ignore data-allow-mismatch style="display:none">${topic}</span>`
    }
  }

  // ── WEIGHT DIV ───────────────────────────────────────────────────────────────
  const weight = computeWeight(slug, fm.topics || '')
  const weightDiv = `<div class="pagefind-weight" data-pagefind-weight="${weight}" data-allow-mismatch style="display:none" aria-hidden="true"></div>`

  // ── SYNONYMS BLOCK ───────────────────────────────────────────────────────────
  let synonymBlock = ''
  if (synonymsText.length > 0) {
    synonymBlock = `<div class="pagefind-synonyms" data-pagefind-ignore data-allow-mismatch style="display:none" aria-hidden="true">${synonymsText}</div>`
  }

  if (html.includes('class="vp-doc ')) {
    html = html.replace(
      /class="vp-doc ([^"]*)"/,
      `class="vp-doc $1" data-pagefind-body`
    )

    const topMarkup = `${filterSpans}${weightDiv}`

    const allBlocks = `${topMarkup}${synonymBlock}`
    if (allBlocks) {
      if (html.includes('</main>')) {
        html = html.replace('</main>', `</main>${allBlocks}`)
      } else {
        html = html.replace('</body>', `${allBlocks}</body>`)
      }
    }

    writeFileSync(file, html, 'utf8')
    patched++
  } else {
    skipped++
  }
}

console.log(`Patched ${patched} files, skipped ${skipped}`)