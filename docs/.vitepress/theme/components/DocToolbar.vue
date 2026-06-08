<template>
  <ClientOnly>

    <!-- ─────────────────────────────────────────────────────────────────────
         Toolbar row — Teleported into #doc-toolbar-anchor, which this
         component inserts immediately after the .vp-doc h1 on every
         route change (same 50 ms pattern as RelatedClauses.vue).
         Only rendered on clause pages (path depth ≥ 5, starts with /ebas/).
         ───────────────────────────────────────────────────────────────────── -->
    <Teleport v-if="active" to="#doc-toolbar-anchor">
      <div class="dst-bar" data-pagefind-ignore role="toolbar" aria-label="Page actions">

        <!-- Ask about this page -->
        <button
          class="dst-btn"
          data-tour="ask-this-page-btn"
          title="Open the AI pane to ask a question about this page"
          @click="handleAsk"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
          </svg>
          Ask about this page
        </button>

        <span class="dst-sep" aria-hidden="true">|</span>

        <!-- Copy page contents -->
        <button
          class="dst-btn"
          :class="{ 'dst-btn--ok': copied, 'dst-btn--err': copyErr }"
          :disabled="copying"
          :title="copyTitle"
          data-tour="copy-btn"
          @click="handleCopy"
        >
          <svg v-if="!copied && !copyErr" width="12" height="12" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M16 2H8C6.9 2 6 2.9 6 4V18C6 19.1 6.9 20 8 20H18C19.1 20 20 19.1 20 18V6L16 2Z"/>
            <path d="M16 2V6H20"/>
            <path d="M4 6H3C2.4 4 2 4.6 2 5V21C2 21.6 2.4 22 3 22H15C15.6 22 16 21.6 16 21V20"/>
          </svg>
          <svg v-else-if="copied" width="12" height="12" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12"/>
          </svg>
          <svg v-else width="12" height="12" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
          {{ copyLabel }}
        </button>

        <span class="dst-sep" aria-hidden="true">|</span>

        <!-- View as Markdown -->
        <button
          class="dst-btn"
          :disabled="mdLoading"
          title="View this page as plain text"
          data-tour="view-as-markdown-btn"
          @click="handleMarkdown"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="8" y1="13" x2="16" y2="13"/>
            <line x1="8" y1="17" x2="16" y2="17"/>
          </svg>
          {{ mdLoading ? 'Loading…' : 'View as Markdown' }}
        </button>

        <span class="dst-sep" aria-hidden="true">|</span>

        <!-- Bookmark this page -->
        <button
          class="dst-btn"
          :class="{ 'dst-btn--bm': isBookmarked }"
          :title="isBookmarked ? 'Edit or remove this bookmark' : 'Bookmark this clause'"
          data-tour="bookmark-btn"
          @click="openDialog"
        >
          <svg v-if="isBookmarked" width="12" height="12" viewBox="0 0 24 24"
               fill="currentColor" stroke="currentColor" stroke-width="1.5"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
          <svg v-else width="12" height="12" viewBox="0 0 24 24"
               fill="none" stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
          </svg>
          {{ isBookmarked ? 'Bookmarked' : 'Bookmark this page' }}
        </button>

      </div>
    </Teleport>

    <!-- ─────────────────────────────────────────────────────────────────────
         Bookmark note dialog — Teleported to body so it is never clipped
         by overflow:hidden on ancestor elements.
         Identical in structure and behaviour to the dialog in BookmarkButton.vue.
         ───────────────────────────────────────────────────────────────────── -->
    <Teleport to="body">
      <Transition name="bm-fade">
        <div
          v-if="dialogOpen"
          class="bm-overlay"
          @click.self="cancelDialog"
          role="dialog"
          aria-modal="true"
          :aria-label="isBookmarked ? 'Edit bookmark' : 'Add bookmark'"
        >
          <div class="bm-dialog" ref="dialogRef">

            <div class="bm-dialog-header">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"
                   stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
                   stroke-linejoin="round" aria-hidden="true">
                <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
              </svg>
              <span class="bm-dialog-title">{{ isBookmarked ? 'Edit bookmark' : 'Bookmark this clause' }}</span>
              <button class="bm-dialog-close" @click="cancelDialog" aria-label="Cancel">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                     stroke="currentColor" stroke-width="2.5"
                     stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            <div class="bm-dialog-meta">
              <span class="bm-dialog-clause-title">{{ pageTitle }}</span>
              <span v-if="pageEba" class="bm-dialog-eba">{{ pageEba }}</span>
            </div>

            <label class="bm-dialog-label" for="dst-bm-note">
              Note
              <span class="bm-dialog-label-hint">(optional — max 200 characters)</span>
            </label>
            <textarea
              id="dst-bm-note"
              ref="noteInputRef"
              v-model="draftNote"
              class="bm-dialog-textarea"
              rows="3"
              maxlength="200"
              placeholder='e.g. "Check with IR before citing" or "Used for roster questions"'
              @keydown.enter.ctrl="saveBookmark"
              @keydown.esc="cancelDialog"
            ></textarea>
            <div class="bm-dialog-charcount" :class="{ warn: draftNote.length > 180 }">
              {{ draftNote.length }} / 200
            </div>

            <div class="bm-dialog-actions">
              <button v-if="isBookmarked" class="bm-dialog-remove" @click="removeBookmark">
                Remove bookmark
              </button>
              <div class="bm-dialog-actions-right">
                <button class="bm-dialog-cancel" @click="cancelDialog">Cancel</button>
                <button class="bm-dialog-save" @click="saveBookmark">
                  {{ isBookmarked ? 'Update' : 'Save bookmark' }}
                </button>
              </div>
            </div>

            <p class="bm-dialog-hint">
              <kbd>Ctrl</kbd>+<kbd>Enter</kbd> to save · <kbd>Esc</kbd> to cancel
            </p>

          </div>
        </div>
      </Transition>
    </Teleport>

  </ClientOnly>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useData, useRoute } from 'vitepress'

const { page } = useData()
const route    = useRoute()

// ─── Clause page detection ────────────────────────────────────────────────────
// Mirrors the same guard used in BookmarkButton, AskThisPage, and Breadcrumb.
// A clause page has at least 4 path segments after the leading slash:
//   /ebas/<eba>/<section>/<clause> → split('/') → length 5
// Nested EBAs add a stream segment → length 6. Both satisfy length >= 5.
const isClausePage = computed(() => {
  const parts = (route.path || '').replace(/\/$/, '').replace(/\.html$/, '').split('/')
  return parts.length >= 5 && parts[1] === 'ebas'
})

// ─── Frontmatter helpers ──────────────────────────────────────────────────────
const pageTitle = computed(() =>
  page.value?.frontmatter?.title ??
  (typeof document !== 'undefined' ? document.title : '') ??
  ''
)
const pageEba   = computed(() => page.value?.frontmatter?.eba   ?? '')

// ─── Teleport anchor management ──────────────────────────────────────────────
// On every route change (immediate:true covers first load), we:
//   1. Deactivate the Teleport (cleanly unmounts the old toolbar from the DOM)
//   2. Wait 50 ms — VitePress replaces .vp-doc > div on SPA navigation and
//      needs one tick to finish before we can safely query the new DOM
//   3. Remove any stale anchor left from the previous page (defensive)
//   4. Find the h1 inside .vp-doc on the new page
//   5. Insert a fresh <div id="doc-toolbar-anchor"> immediately after the h1
//   6. Re-activate the Teleport so it mounts into the new anchor
//
// This is the same deactivate → wait → reactivate pattern used by
// RelatedClauses.vue and LegislationPanel.vue.
const active = ref(false)

function mountAnchor() {
  active.value = false
  setTimeout(() => {
    // Guard: this callback can fire during VitePress SSR builds where
    // document does not exist. ClientOnly protects the template, but not
    // script-level watch() callbacks or their scheduled setTimeout calls.
    if (typeof document === 'undefined') return
    if (!isClausePage.value) return
    // Remove any stale anchor from a previous route (idempotent)
    document.getElementById('doc-toolbar-anchor')?.remove()
    const h1 = document.querySelector('.vp-doc h1')
    if (!h1) return
    const anchor = document.createElement('div')
    anchor.id = 'doc-toolbar-anchor'
    h1.insertAdjacentElement('afterend', anchor)
    active.value = true
  }, 50)
}

watch(() => route.path, mountAnchor, { immediate: true })

// ─── Ask about this page ──────────────────────────────────────────────────────
// Dispatches the same CustomEvent that AskPanel.vue listens for.
// Passes scope:'page' so the panel scopes its answer to this clause.
function handleAsk() {
  window.dispatchEvent(
    new CustomEvent('open-ask-panel', {
      detail: {
        scope:     'page',
        pageUrl:   route.path,
        pageTitle: page.value?.frontmatter?.title ?? '',
      }
    })
  )
}

// ─── Copy page contents ───────────────────────────────────────────────────────
// Same logic as CopyButton.vue: clones .vp-doc, strips UI chrome, writes
// both text/html (for rich paste into Jira/email) and text/plain to clipboard.
const copied  = ref(false)
const copyErr = ref(false)
const copying = ref(false)

const copyLabel = computed(() => {
  if (copied.value)  return 'Copied!'
  if (copyErr.value) return 'Copy failed'
  return 'Copy page contents'
})

const copyTitle = computed(() => {
  if (copied.value)  return 'Copied to clipboard'
  if (copyErr.value) return 'Copy failed — try again'
  return 'Copy the clause contents'
})

async function handleCopy() {
  copying.value = true
  copyErr.value = false
  copied.value  = false
  try {
    const container = document.querySelector('.vp-doc')
    if (!container) throw new Error('No .vp-doc container found')
    const clone = container.cloneNode(true)
    // Remove UI chrome that should not appear in the clipboard payload
    const stripSelectors = [
      '.dst-bar', '.copy-btn-wrap', '#print-btn', '.edit-link', '.pager',
      '.vp-nolebase-git-changelog', '.nolebase-git-changelog',
      '[class*="git-changelog"]', '[class*="GitChangelog"]',
      '.header-anchor', '.lang', '.line-numbers-wrapper',
    ]
    stripSelectors.forEach(sel =>
      clone.querySelectorAll(sel).forEach(el => el.remove())
    )
    // Remove the changelog H2 and everything that follows it
    const changelogH2 = clone.querySelector('h2[id="changelog"]')
    if (changelogH2) {
      let sibling = changelogH2.nextElementSibling
      while (sibling) { const t = sibling; sibling = sibling.nextElementSibling; t.remove() }
      changelogH2.remove()
    }
    const html  = `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.6;color:#172b4d;">${clone.innerHTML}</div>`
    const plain = clone.innerText || clone.textContent || ''
    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([new ClipboardItem({
        'text/html':  new Blob([html],  { type: 'text/html'  }),
        'text/plain': new Blob([plain], { type: 'text/plain' }),
      })])
    } else {
      await navigator.clipboard.writeText(plain)
    }
    copied.value = true
    setTimeout(() => { copied.value = false }, 2500)
  } catch (err) {
    console.error('[DocToolbar] copy failed:', err)
    copyErr.value = true
    setTimeout(() => { copyErr.value = false }, 3000)
  } finally {
    copying.value = false
  }
}

// ─── View as Markdown ─────────────────────────────────────────────────────────
// Fetches the raw source .md file from the GitHub main branch, strips all
// pagefind HTML that is baked into the source files (data-pagefind-meta spans,
// data-pagefind-filter spans, pagefind-weight divs, pagefind-synonyms divs),
// then opens the cleaned plain markdown in a new tab via a Blob URL.
//
// Strip patterns match the exact HTML shapes written by patch-pagefind.mjs:
//   <span data-pagefind-meta="..." style="display:none"></span>
//   <span data-pagefind-filter="..." style="display:none"></span>
//   <div class="pagefind-weight" ...>...</div>
//   <div class="pagefind-synonyms" ...>...</div>
//
// Fallback: if the fetch fails (network issue, 404), the raw GitHub URL is
// opened directly — better than a silent no-op.
const mdLoading = ref(false)

async function handleMarkdown() {
  mdLoading.value = true
  const path   = route.path.replace(/\/$/, '').replace(/\.html$/, '')
  const rawUrl = `https://raw.githubusercontent.com/dreadnaughtasaurous/dreadnaughtasaurous.github.io/main/docs${path}.md`
  try {
    const res = await fetch(rawUrl)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    let text = await res.text()
    // Strip self-closing pagefind spans (meta and filter variants)
    text = text.replace(/<span[^>]*data-pagefind[^>]*>\s*<\/span>\n?/g, '')
    // Strip pagefind-weight and pagefind-synonyms divs (may be multi-line)
    text = text.replace(/<div[^>]*(?:pagefind-weight|pagefind-synonyms)[^>]*>[\s\S]*?<\/div>\n?/g, '')
    // Collapse 3+ consecutive blank lines (left behind after div removal) to 2
    text = text.replace(/\n{3,}/g, '\n\n').trim()
    const blob    = new Blob([text], { type: 'text/plain; charset=utf-8' })
    const blobUrl = URL.createObjectURL(blob)
    window.open(blobUrl, '_blank', 'noopener')
  } catch {
    // Fallback to raw GitHub URL rather than failing silently
    window.open(rawUrl, '_blank', 'noopener')
  } finally {
    mdLoading.value = false
  }
}

// ─── Bookmark ─────────────────────────────────────────────────────────────────
// Full bookmark logic identical to BookmarkButton.vue. The dialog in the
// template above is also a direct port of BookmarkButton's dialog.
// BookmarkButton.vue remains registered but is no longer injected into the
// layout — DocToolbar is now the sole bookmark entry point on clause pages.
const LOCAL_KEY    = 'eba-bookmarks'
const MAX_BM       = 50
const bookmarks    = ref([])
const dialogOpen   = ref(false)
const draftNote    = ref('')
const noteInputRef = ref(null)
const dialogRef    = ref(null)

function loadBookmarks() {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (raw) bookmarks.value = JSON.parse(raw)
  } catch { /* corrupt storage — degrade silently */ }
}

function persistBookmarks() {
  try { localStorage.setItem(LOCAL_KEY, JSON.stringify(bookmarks.value)) }
  catch { /* storage full — degrade silently */ }
}

const normPath = computed(() =>
  (route.path || '').replace(/\/$/, '').replace(/\.html$/, '')
)

const currentBookmark = computed(() =>
  bookmarks.value.find(b =>
    b.url.replace(/\/$/, '').replace(/\.html$/, '') === normPath.value
  ) ?? null
)

const isBookmarked = computed(() => currentBookmark.value !== null)

// Close the dialog whenever the user navigates away (SPA route change)
watch(() => route.path, () => { dialogOpen.value = false })

function openDialog() {
  draftNote.value  = currentBookmark.value?.note ?? ''
  dialogOpen.value = true
  nextTick(() => noteInputRef.value?.focus())
}

function cancelDialog() {
  dialogOpen.value = false
  draftNote.value  = ''
}

function saveBookmark() {
  const url   = normPath.value
  const title = pageTitle.value
  const eba   = pageEba.value
  const note  = draftNote.value.trim()
  if (currentBookmark.value) {
    currentBookmark.value.note = note
    persistBookmarks()
  } else {
    const entry = {
      id:      Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      url, title, eba, note,
      savedAt: new Date().toISOString(),
    }
    bookmarks.value = [entry, ...bookmarks.value].slice(0, MAX_BM)
    persistBookmarks()
  }
  dialogOpen.value = false
  draftNote.value  = ''
  window.dispatchEvent(new CustomEvent('eba-bookmarks-updated'))
}

function removeBookmark() {
  const id = currentBookmark.value?.id
  if (!id) return
  bookmarks.value = bookmarks.value.filter(b => b.id !== id)
  persistBookmarks()
  dialogOpen.value = false
  draftNote.value  = ''
  window.dispatchEvent(new CustomEvent('eba-bookmarks-updated'))
}

// Load at setup time — ClientOnly guarantees client-side execution
loadBookmarks()

if (typeof window !== 'undefined') {
  window.addEventListener('eba-bookmarks-updated', loadBookmarks)
  window.addEventListener('storage', e => { if (e.key === LOCAL_KEY) loadBookmarks() })
}
</script>

<style scoped>
/* ── Stripe-style toolbar bar ─────────────────────────────────────────────── */
.dst-bar {
  display:       flex;
  align-items:   center;
  flex-wrap:     wrap;
  gap:           0;
  padding:       0.5rem 0 0.65rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--vp-c-divider);
}

.dst-btn {
  display:       inline-flex;
  align-items:   center;
  gap:           0.3rem;
  font-size:     0.78rem;
  font-family:   inherit;
  color:         var(--vp-c-text-2);
  background:    none;
  border:        none;
  padding:       0.1rem 0.3rem;
  border-radius: 3px;
  cursor:        pointer;
  line-height:   1;
  white-space:   nowrap;
  transition:    color 0.15s;
}

.dst-btn:hover:not(:disabled) { color: var(--vp-c-brand-1); }
.dst-btn:disabled              { opacity: 0.5; cursor: default; }
.dst-btn:focus-visible         { outline: 2px solid var(--vp-c-brand); outline-offset: 2px; }

.dst-sep {
  font-size:   0.75rem;
  color:       var(--vp-c-divider);
  padding:     0 0.1rem;
  user-select: none;
  line-height: 1;
}

/* Copy success / error states */
.dst-btn--ok          { color: #22863a; }
.dst-btn--ok:hover    { color: #22863a; }
.dst-btn--err         { color: #cb2431; }
.dst-btn--err:hover   { color: #cb2431; }

/* Bookmarked state — amber accent */
.dst-btn--bm                   { color: #F59E0B; }
.dst-btn--bm:hover:not(:disabled) { color: #D97706; }

/* ── Bookmark dialog ──────────────────────────────────────────────────────── */
.bm-overlay {
  position:        fixed;
  inset:           0;
  background:      rgba(0,0,0,0.45);
  display:         flex;
  align-items:     center;
  justify-content: center;
  z-index:         9999;
  padding:         1rem;
}

.bm-dialog {
  background:    var(--vp-c-bg);
  border:        1px solid var(--vp-c-divider);
  border-radius: 12px;
  width:         100%;
  max-width:     440px;
  padding:       1.25rem;
  box-shadow:    0 20px 60px rgba(0,0,0,0.25);
}

.bm-dialog-header {
  display:       flex;
  align-items:   center;
  gap:           0.5rem;
  margin-bottom: 0.9rem;
  color:         #F59E0B;
}

.bm-dialog-title { flex: 1; font-size: 0.9rem; font-weight: 700; color: var(--vp-c-text-1); }

.bm-dialog-close {
  display: flex; align-items: center; justify-content: center;
  width: 24px; height: 24px; padding: 0;
  background: transparent; border: none; border-radius: 4px;
  color: var(--vp-c-text-3); cursor: pointer;
  transition: background 0.12s, color 0.12s;
}
.bm-dialog-close:hover { background: var(--vp-c-bg-mute); color: var(--vp-c-text-1); }

.bm-dialog-meta {
  display: flex; flex-wrap: wrap; align-items: baseline; gap: 0.5rem;
  margin-bottom: 1rem; padding: 0.6rem 0.75rem;
  background: var(--vp-c-bg-soft); border-radius: 6px; border: 1px solid var(--vp-c-divider);
}

.bm-dialog-clause-title { font-size: 0.82rem; font-weight: 600; color: var(--vp-c-text-1); line-height: 1.4; }
.bm-dialog-eba          { font-size: 0.72rem; color: var(--vp-c-text-3); font-style: italic; white-space: nowrap; }

.bm-dialog-label {
  display: block; font-size: 0.72rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.06em;
  color: var(--vp-c-text-3); margin-bottom: 0.35rem;
}
.bm-dialog-label-hint { font-size: 0.68rem; font-weight: 400; text-transform: none; letter-spacing: 0; color: var(--vp-c-text-3); margin-left: 0.25rem; }

.bm-dialog-textarea {
  width: 100%; box-sizing: border-box; padding: 0.5rem 0.65rem;
  font-size: 0.82rem; line-height: 1.5; color: var(--vp-c-text-1);
  background: var(--vp-c-bg); border: 1px solid var(--vp-c-divider);
  border-radius: 6px; resize: vertical; font-family: inherit; transition: border-color 0.15s;
}
.bm-dialog-textarea:focus       { outline: none; border-color: var(--vp-c-brand); }
.bm-dialog-textarea::placeholder { color: var(--vp-c-text-3); }

.bm-dialog-charcount {
  font-size: 0.68rem; color: var(--vp-c-text-3);
  text-align: right; margin-top: 0.2rem; margin-bottom: 0.9rem; transition: color 0.15s;
}
.bm-dialog-charcount.warn { color: #D97706; }

.bm-dialog-actions       { display: flex; align-items: center; gap: 0.5rem; }
.bm-dialog-actions-right { display: flex; align-items: center; gap: 0.5rem; margin-left: auto; }

.bm-dialog-cancel {
  padding: 0.35rem 0.75rem; font-size: 0.8rem; border-radius: 6px;
  border: 1px solid var(--vp-c-divider); background: var(--vp-c-bg);
  color: var(--vp-c-text-2); cursor: pointer; transition: background 0.12s;
}
.bm-dialog-cancel:hover { background: var(--vp-c-bg-mute); }

.bm-dialog-save {
  padding: 0.35rem 0.85rem; font-size: 0.8rem; font-weight: 600; border-radius: 6px;
  border: none; background: var(--vp-c-brand); color: #fff; cursor: pointer;
  transition: filter 0.12s, transform 0.12s;
}
.bm-dialog-save:hover  { filter: brightness(1.1); }
.bm-dialog-save:active { transform: scale(0.96); }

.bm-dialog-remove {
  padding: 0.35rem 0.75rem; font-size: 0.78rem; border-radius: 6px;
  border: 1px solid var(--vp-c-danger-1, #cb2431);
  background: transparent; color: var(--vp-c-danger-1, #cb2431);
  cursor: pointer; transition: background 0.12s;
}
.bm-dialog-remove:hover { background: var(--vp-c-danger-soft, #fff5f5); }

.bm-dialog-hint { font-size: 0.68rem; color: var(--vp-c-text-3); text-align: center; margin-top: 0.75rem; margin-bottom: 0; }
.bm-dialog-hint kbd { font-size: 0.68rem; padding: 0.05rem 0.3rem; border: 1px solid var(--vp-c-divider); border-radius: 3px; background: var(--vp-c-bg-soft); }

/* Transition */
.bm-fade-enter-active, .bm-fade-leave-active { transition: opacity 0.18s ease, transform 0.18s ease; }
.bm-fade-enter-from, .bm-fade-leave-to       { opacity: 0; transform: scale(0.96) translateY(-6px); }
</style>