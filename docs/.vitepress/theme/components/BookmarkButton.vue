<template>
  <ClientOnly>
    <div v-if="isClausePage" class="bm-wrap">

      <!-- ── Trigger button ── -->
      <button
        class="bm-btn"
        :class="{ 'bm-btn--active': isBookmarked }"
        @click="openDialog"
        :aria-label="isBookmarked ? `Edit bookmark: ${pageTitle}` : `Bookmark this clause: ${pageTitle}`"
        :title="isBookmarked ? 'Edit bookmark / note' : 'Bookmark this clause'"
      >
        <!-- Filled bookmark icon — shown when page is already bookmarked -->
        <svg v-if="isBookmarked" width="16" height="16" viewBox="0 0 24 24"
             fill="currentColor" stroke="currentColor" stroke-width="1.5"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
        <!-- Outline bookmark icon — shown when page is not yet bookmarked -->
        <svg v-else width="16" height="16" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
        </svg>
      </button>

      <!-- ── Note dialog (Teleport to body so it is never clipped by overflow:hidden) ── -->
      <Teleport to="body">
        <Transition name="bm-dialog">
          <div
            v-if="dialogOpen"
            class="bm-overlay"
            @click.self="cancel"
            role="dialog"
            aria-modal="true"
            :aria-label="isBookmarked ? 'Edit bookmark' : 'Add bookmark'"
          >
            <div class="bm-dialog" ref="dialogRef">

              <!-- Header -->
              <div class="bm-dialog-header">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"
                     stroke="currentColor" stroke-width="1.5" stroke-linecap="round"
                     stroke-linejoin="round" aria-hidden="true">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>
                <span class="bm-dialog-title">{{ isBookmarked ? 'Edit bookmark' : 'Bookmark this clause' }}</span>
                <button class="bm-dialog-close" @click="cancel" aria-label="Cancel">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" stroke-width="2.5"
                       stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <line x1="18" y1="6" x2="6" y2="18"/>
                    <line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>

              <!-- Clause identity (read-only) -->
              <div class="bm-dialog-meta">
                <span class="bm-dialog-clause-title">{{ pageTitle }}</span>
                <span v-if="pageEba" class="bm-dialog-eba">{{ pageEba }}</span>
              </div>

              <!-- Note textarea -->
              <label class="bm-dialog-label" for="bm-note-input">
                Note
                <span class="bm-dialog-label-hint">(optional — max 200 characters)</span>
              </label>
              <textarea
                id="bm-note-input"
                ref="noteInputRef"
                v-model="draftNote"
                class="bm-dialog-textarea"
                rows="3"
                maxlength="200"
                placeholder='e.g. "Check with IR before citing" or "Used for roster change questions"'
                @keydown.enter.ctrl="save"
                @keydown.esc="cancel"
              ></textarea>
              <div class="bm-dialog-charcount" :class="{ warn: draftNote.length > 180 }">
                {{ draftNote.length }} / 200
              </div>

              <!-- Action row -->
              <div class="bm-dialog-actions">
                <!-- Remove bookmark (only shown if already bookmarked) -->
                <button
                  v-if="isBookmarked"
                  class="bm-dialog-remove"
                  @click="remove"
                  aria-label="Remove bookmark"
                >
                  Remove bookmark
                </button>
                <div class="bm-dialog-actions-right">
                  <button class="bm-dialog-cancel" @click="cancel">Cancel</button>
                  <button class="bm-dialog-save" @click="save">
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

    </div>
  </ClientOnly>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useData, useRoute } from 'vitepress'

// ─── VitePress hooks ──────────────────────────────────────────────────────────
const { page } = useData()
const route    = useRoute()

// ─── Constants ────────────────────────────────────────────────────────────────
const LOCAL_BOOKMARKS_KEY = 'eba-bookmarks'
const MAX_BOOKMARKS       = 50

// ─── Page detection ───────────────────────────────────────────────────────────
// Mirrors the same logic used in AskThisPage.vue and Breadcrumb.vue.
// A clause page has parts.length >= 5 with parts[1] === 'ebas'.
// /ebas/<eba>/<section>/<clause> → split('/') gives ['', 'ebas', eba, section, clause]
const isClausePage = computed(() => {
  const parts = (route.path || '')
    .replace(/\/$/, '')
    .replace(/\.html$/, '')
    .split('/')
  return parts.length >= 5 && parts[1] === 'ebas'
})

// ─── Frontmatter helpers ──────────────────────────────────────────────────────
const pageTitle = computed(() => page.value?.frontmatter?.title ?? document.title ?? '')
const pageEba   = computed(() => page.value?.frontmatter?.eba   ?? '')

// ─── Bookmarks state ──────────────────────────────────────────────────────────
// bookmarks is the in-memory copy of localStorage['eba-bookmarks'].
// It is loaded once on component mount and kept in sync by all mutating functions.
// Shape: Array<{ id: string, url: string, title: string, eba: string, note: string, savedAt: string }>
const bookmarks = ref([])

function loadBookmarks() {
  try {
    const raw = localStorage.getItem(LOCAL_BOOKMARKS_KEY)
    if (raw) bookmarks.value = JSON.parse(raw)
  } catch { /* corrupt storage — degrade silently */ }
}

function persistBookmarks() {
  try {
    localStorage.setItem(LOCAL_BOOKMARKS_KEY, JSON.stringify(bookmarks.value))
  } catch { /* storage full — degrade silently */ }
}

// Derive whether the current page is already bookmarked.
// We normalise both sides: strip trailing slash and .html for reliable comparison
// across dev (serves .html) and production (serves trailing-slash clean URLs).
const normPath = computed(() =>
  (route.path || '')
    .replace(/\/$/, '')
    .replace(/\.html$/, '')
)

const currentBookmark = computed(() =>
  bookmarks.value.find(b =>
    b.url.replace(/\/$/, '').replace(/\.html$/, '') === normPath.value
  ) ?? null
)

const isBookmarked = computed(() => currentBookmark.value !== null)

// ─── Dialog state ─────────────────────────────────────────────────────────────
const dialogOpen  = ref(false)
const draftNote   = ref('')
const noteInputRef = ref(null)
const dialogRef   = ref(null)

// When the route changes (SPA navigation), close the dialog without saving.
// This prevents the dialog from lingering open when the user navigates away.
watch(() => route.path, () => { dialogOpen.value = false })

function openDialog() {
  // Pre-fill with the existing note if we are editing an existing bookmark.
  draftNote.value = currentBookmark.value?.note ?? ''
  dialogOpen.value = true
  // Focus the textarea after the Teleport DOM has painted.
  nextTick(() => noteInputRef.value?.focus())
}

function cancel() {
  dialogOpen.value = false
  draftNote.value  = ''
}

function save() {
  const url   = normPath.value
  const title = pageTitle.value
  const eba   = pageEba.value
  const note  = draftNote.value.trim()

  if (currentBookmark.value) {
    // Update existing — mutate note in-place without changing id or savedAt.
    currentBookmark.value.note = note
    persistBookmarks()
  } else {
    // Insert new bookmark at the front of the array.
    // Enforce the 50-bookmark cap by trimming the oldest entries (end of array).
    const entry = {
      id:      Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      url,
      title,
      eba,
      note,
      savedAt: new Date().toISOString(),
    }
    bookmarks.value = [entry, ...bookmarks.value].slice(0, MAX_BOOKMARKS)
    persistBookmarks()
  }

  dialogOpen.value = false
  draftNote.value  = ''

  // Notify SearchModal (if open) to refresh its own bookmark list.
  // SearchModal listens for this event in its own onMounted handler.
  window.dispatchEvent(new CustomEvent('eba-bookmarks-updated'))
}

function remove() {
  const id = currentBookmark.value?.id
  if (!id) return
  bookmarks.value = bookmarks.value.filter(b => b.id !== id)
  persistBookmarks()
  dialogOpen.value = false
  draftNote.value  = ''
  window.dispatchEvent(new CustomEvent('eba-bookmarks-updated'))
}

// ─── Initial load ─────────────────────────────────────────────────────────────
// We call loadBookmarks() outside onMounted because ClientOnly guarantees this
// script already runs client-side. Using onMounted is also fine, but calling it
// at setup time means isBookmarked resolves correctly on the very first render.
loadBookmarks()

// Re-sync bookmarks when another tab or component modifies localStorage.
if (typeof window !== 'undefined') {
  window.addEventListener('eba-bookmarks-updated', loadBookmarks)
  window.addEventListener('storage', (e) => {
    if (e.key === LOCAL_BOOKMARKS_KEY) loadBookmarks()
  })
}
</script>

<style scoped>
/* ── Wrapper — matches CopyButton's .copy-btn-wrap ── */
.bm-wrap {
  display: flex;
  align-items: center;
}

/* ── Trigger button — identical dimensions and border style to CopyButton ── */
.bm-btn {
  display:         inline-flex;
  align-items:     center;
  justify-content: center;
  width:           2rem;
  height:          2rem;
  padding:         0;
  color:           var(--vp-c-text-2);
  background-color: var(--vp-c-bg-soft);
  border:          1px solid var(--vp-c-divider);
  border-radius:   6px;
  cursor:          pointer;
  flex-shrink:     0;
  transition:
    background-color 150ms ease,
    color            150ms ease,
    border-color     150ms ease,
    transform        150ms ease;
}

.bm-btn:hover {
  background-color: var(--vp-c-bg-mute);
  color:            var(--vp-c-text-1);
  border-color:     var(--vp-c-brand);
}

.bm-btn:active { transform: scale(0.92); }

.bm-btn:focus-visible {
  outline:        3px solid var(--vp-c-brand);
  outline-offset: 3px;
}

/* Active (bookmarked) state — amber bookmark icon */
.bm-btn--active {
  color:            #F59E0B;
  border-color:     #F59E0B80;
  background-color: #F59E0B12;
}

.bm-btn--active:hover {
  background-color: #F59E0B1E;
  border-color:     #F59E0B;
}

/* ── Overlay ── */
.bm-overlay {
  position:        fixed;
  inset:           0;
  background:      rgba(0, 0, 0, 0.45);
  display:         flex;
  align-items:     center;
  justify-content: center;
  z-index:         9999;
  padding:         1rem;
}

/* ── Dialog box ── */
.bm-dialog {
  background:    var(--vp-c-bg);
  border:        1px solid var(--vp-c-divider);
  border-radius: 12px;
  width:         100%;
  max-width:     440px;
  padding:       1.25rem;
  box-shadow:    0 20px 60px rgba(0,0,0,0.25);
}

/* Header row */
.bm-dialog-header {
  display:     flex;
  align-items: center;
  gap:         0.5rem;
  margin-bottom: 0.9rem;
  color:       #F59E0B;
}

.bm-dialog-title {
  flex:        1;
  font-size:   0.9rem;
  font-weight: 700;
  color:       var(--vp-c-text-1);
}

.bm-dialog-close {
  display:          flex;
  align-items:      center;
  justify-content:  center;
  width:            24px;
  height:           24px;
  padding:          0;
  background-color: transparent;
  border:           none;
  border-radius:    4px;
  color:            var(--vp-c-text-3);
  cursor:           pointer;
  transition:       background-color 0.12s, color 0.12s;
}

.bm-dialog-close:hover {
  background-color: var(--vp-c-bg-mute);
  color:            var(--vp-c-text-1);
}

/* Clause identity block */
.bm-dialog-meta {
  display:       flex;
  flex-wrap:     wrap;
  align-items:   baseline;
  gap:           0.5rem;
  margin-bottom: 1rem;
  padding:       0.6rem 0.75rem;
  background:    var(--vp-c-bg-soft);
  border-radius: 6px;
  border:        1px solid var(--vp-c-divider);
}

.bm-dialog-clause-title {
  font-size:   0.82rem;
  font-weight: 600;
  color:       var(--vp-c-text-1);
  line-height: 1.4;
}

.bm-dialog-eba {
  font-size:    0.72rem;
  color:        var(--vp-c-text-3);
  font-style:   italic;
  white-space:  nowrap;
}

/* Label */
.bm-dialog-label {
  display:     block;
  font-size:   0.72rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color:       var(--vp-c-text-3);
  margin-bottom: 0.35rem;
}

.bm-dialog-label-hint {
  font-size:    0.68rem;
  font-weight:  400;
  text-transform: none;
  letter-spacing: 0;
  color:        var(--vp-c-text-3);
  margin-left:  0.25rem;
}

/* Textarea */
.bm-dialog-textarea {
  width:         100%;
  box-sizing:    border-box;
  padding:       0.5rem 0.65rem;
  font-size:     0.82rem;
  line-height:   1.5;
  color:         var(--vp-c-text-1);
  background:    var(--vp-c-bg);
  border:        1px solid var(--vp-c-divider);
  border-radius: 6px;
  resize:        vertical;
  font-family:   inherit;
  transition:    border-color 0.15s;
}

.bm-dialog-textarea:focus {
  outline:      none;
  border-color: var(--vp-c-brand);
}

.bm-dialog-textarea::placeholder {
  color: var(--vp-c-text-3);
}

/* Character counter */
.bm-dialog-charcount {
  font-size:  0.68rem;
  color:      var(--vp-c-text-3);
  text-align: right;
  margin-top: 0.2rem;
  margin-bottom: 0.9rem;
  transition: color 0.15s;
}

.bm-dialog-charcount.warn { color: #D97706; }

/* Action row */
.bm-dialog-actions {
  display:     flex;
  align-items: center;
  gap:         0.5rem;
}

.bm-dialog-actions-right {
  display:     flex;
  align-items: center;
  gap:         0.5rem;
  margin-left: auto;
}

.bm-dialog-cancel {
  padding:       0.35rem 0.75rem;
  font-size:     0.8rem;
  border-radius: 6px;
  border:        1px solid var(--vp-c-divider);
  background-color: var(--vp-c-bg);
  color:         var(--vp-c-text-2);
  cursor:        pointer;
  transition:    background-color 0.12s;
}

.bm-dialog-cancel:hover { background-color: var(--vp-c-bg-mute); }

.bm-dialog-save {
  padding:       0.35rem 0.85rem;
  font-size:     0.8rem;
  font-weight:   600;
  border-radius: 6px;
  border:        none;
  background-color: var(--vp-c-brand);
  color:         #fff;
  cursor:        pointer;
  transition:    filter 0.12s, transform 0.12s;
}

.bm-dialog-save:hover  { filter: brightness(1.1); }
.bm-dialog-save:active { transform: scale(0.96); }

.bm-dialog-remove {
  padding:       0.35rem 0.75rem;
  font-size:     0.78rem;
  border-radius: 6px;
  border:        1px solid var(--vp-c-danger-1, #cb2431);
  background-color: transparent;
  color:         var(--vp-c-danger-1, #cb2431);
  cursor:        pointer;
  transition:    background-color 0.12s;
}

.bm-dialog-remove:hover {
  background-color: var(--vp-c-danger-soft, #fff5f5);
}

/* Keyboard hint */
.bm-dialog-hint {
  font-size:  0.68rem;
  color:      var(--vp-c-text-3);
  text-align: center;
  margin-top: 0.75rem;
  margin-bottom: 0;
}

.bm-dialog-hint kbd {
  font-size:     0.68rem;
  padding:       0.05rem 0.3rem;
  border:        1px solid var(--vp-c-divider);
  border-radius: 3px;
  background:    var(--vp-c-bg-soft);
}

/* ── Transition ── */
.bm-dialog-enter-active,
.bm-dialog-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.bm-dialog-enter-from,
.bm-dialog-leave-to {
  opacity:   0;
  transform: scale(0.96) translateY(-6px);
}
</style>