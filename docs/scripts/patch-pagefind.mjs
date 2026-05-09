// patch-pagefind.mjs
// Runs after vitepress build.
// 1. Strips previously injected pagefind divs from body (idempotent)
// 2. Injects data-pagefind-body onto the vp-doc div
// 3. Injects data-pagefind-filter spans for eba and topics filters
// 4. Extracts synonyms content (from front matter OR hardcoded body div),
//    then re-injects it at END of body with data-pagefind-ignore — so
//    Pagefind indexes the words for recall but never uses them for excerpts.

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

const htmlFiles = []
for await (const f of glob('**/*.html', { cwd: distDir })) {
  htmlFiles.push(join(distDir, f))
}

for (const file of htmlFiles) {
  let html = readFileSync(file, 'utf8')

  // ── EXTRACT synonyms content before stripping ────────────────────────────────
  // Some .md files have the synonyms div hardcoded in the body (written by
  // Add-SearchSynonyms.ps1) rather than in a front matter field. We extract the
  // inner text from the built HTML BEFORE stripping, so we can re-inject it
  // correctly at the end of the body with data-pagefind-ignore.
  let extractedSynonyms = ''
  const synonymsMatch = html.match(
    /<div[^>]*class="pagefind-synonyms"[^>]*>([\s\S]*?)<\/div>/
  )
  if (synonymsMatch) {
    extractedSynonyms = synonymsMatch[1].trim()
  }

  // ── STRIP PASS ───────────────────────────────────────────────────────────────
  // Remove ALL previously injected pagefind divs so we start clean.
  // Prevents duplicate divs accumulating across repeated builds and removes
  // old markup that may be missing data-pagefind-ignore.
  html = html.replace(/<div[^>]*class="pagefind-synonyms"[^>]*>[\s\S]*?<\/div>/g, '')
  html = html.replace(/<div[^>]*class="pagefind-weight"[^>]*>[\s\S]*?<\/div>/g, '')

  // Find the matching .md source file
  const relHtml = relative(distDir, file)
  const relMd = relHtml.replace(/\.html$/, '.md')
  const mdPath = join(docsDir, relMd)
  const fm = getFrontMatter(mdPath)

  // ── RESOLVE synonyms text ────────────────────────────────────────────────────
  // Priority: front matter 'synonyms:' field first (future-proof), then fall
  // back to the text extracted from the hardcoded div in the built HTML above.
  const synonymsText = (fm.synonyms && fm.synonyms.trim().length > 0)
    ? fm.synonyms.trim()
    : extractedSynonyms

  // ── FILTER SPANS (top of body) ───────────────────────────────────────────────
  // data-pagefind-ignore prevents the filter value text (e.g. "allowances",
  // "Allied Health Professionals 2021-2026") from appearing in excerpt snippets.
  // data-pagefind-filter still registers correctly — it operates independently.
  let filterSpans = ''

  if (fm.eba) {
    filterSpans += `<span data-pagefind-filter="eba" data-pagefind-ignore style="display:none">${fm.eba}</span>`
  }

  if (fm.topics && fm.topics.length > 0) {
    const topicArr = fm.topics
      .split(',')
      .map(t => t.trim())
      .filter(t => t.length > 0)

    for (const topic of topicArr) {
      filterSpans += `<span data-pagefind-filter="topics" data-pagefind-ignore style="display:none">${topic}</span>`
    }
  }

  // ── SYNONYMS BLOCK (end of body) ─────────────────────────────────────────────
  // data-pagefind-ignore = Pagefind indexes these words for search recall but
  // NEVER uses this region to generate an excerpt snippet.
  // Injected before </main> so it is physically after all real clause prose.
  let synonymBlock = ''
  if (synonymsText.length > 0) {
    synonymBlock = `<div class="pagefind-synonyms" data-pagefind-ignore style="display:none" aria-hidden="true">${synonymsText}</div>`
  }

  if (html.includes('class="vp-doc ')) {
    // Stamp data-pagefind-body onto the vp-doc opening tag
    html = html.replace(
      /class="vp-doc ([^"]*)"/,
      `class="vp-doc $1" data-pagefind-body`
    )

    // Inject filter spans immediately after the opening vp-doc tag
    if (filterSpans) {
      html = html.replace(
        /(class="vp-doc [^"]*" data-pagefind-body[^>]*>)/,
        `$1${filterSpans}`
      )
    }

    // Inject synonyms div at the END of the content — before </main>
    if (synonymBlock) {
      if (html.includes('</main>')) {
        html = html.replace('</main>', `${synonymBlock}</main>`)
      } else {
        html = html.replace('</body>', `${synonymBlock}</body>`)
      }
    }

    writeFileSync(file, html, 'utf8')
    patched++
  } else {
    skipped++
  }
}

console.log(`Patched ${patched} files, skipped ${skipped}`)