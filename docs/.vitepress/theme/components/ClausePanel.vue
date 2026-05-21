<template>
  <ClientOnly>
    <!--
      ClausePanel.vue
      ───────────────
      Renders a slide-in panel showing the content of a referenced clause.
      Triggered by the 'open-clause-panel' CustomEvent dispatched from
      index.js's router.onBeforeRouteChange hook — the only reliable place
      to intercept VitePress internal navigation before it commits.

      This component has no event interception logic of its own. It is purely
      a display component: it listens for the custom event, fetches the target
      page's HTML, and renders it in a fixed panel.
    -->
    <Transition name="clause-panel">
      <div
        v-if="open"
        class="clause-panel"
        role="complementary"
        :aria-label="`Clause reference: ${currentEntry?.title || 'Loading…'}`"
      >
        <!-- ── Header ─────────────────────────────────────────────────── -->
        <div class="cp-header">
          <div class="cp-header-left">

            <!-- Back button — shown when history stack has > 1 entry -->
            <button
              v-if="history.length > 1"
              class="cp-back-btn"
              @click="goBack"
              aria-label="Go back to previous clause"
              title="Back"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2.5"
                   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M19 12H5"/><path d="m12 5-7 7 7 7"/>
              </svg>
              Back
            </button>

            <!-- Breadcrumb trail when history stack has > 1 entry -->
            <div class="cp-breadcrumb" v-if="history.length > 1">
              <span
                v-for="(entry, idx) in history.slice(0, -1)"
                :key="entry.url"
                class="cp-breadcrumb-item"
              >
                <button class="cp-breadcrumb-link" @click="jumpTo(idx)">
                  {{ truncateTitle(entry.title, 28) }}
                </button>
                <span class="cp-breadcrumb-sep" aria-hidden="true">›</span>
              </span>
            </div>

            <!-- Current clause title -->
            <div class="cp-title-block">
              <span class="cp-eyebrow">Referenced clause</span>
              <span class="cp-title">{{ currentEntry?.title || 'Loading…' }}</span>
              <span
                v-if="currentEntry?.eba"
                class="cp-eba-badge"
                :style="ebaBadgeStyle(currentEntry.eba)"
              >{{ currentEntry.eba }}</span>
            </div>
          </div>

          <!-- Close button -->
          <button
            class="cp-close-btn"
            @click="close"
            aria-label="Close clause panel"
            title="Close (Esc)"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2.5"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>

        <!-- ── Body ───────────────────────────────────────────────────── -->
        <div class="cp-body" ref="bodyRef">

          <div v-if="loading" class="cp-loading" aria-live="polite">
            <span class="cp-spinner" aria-hidden="true"></span>
            Loading clause…
          </div>

          <div v-else-if="error" class="cp-error" role="alert">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <span>{{ error }}</span>
          </div>

          <!--
            v-html is safe: content is fetched only from our own GitHub Pages
            domain (same origin), extracted from .vp-doc which contains only
            clause text authored by the wiki editor, never user-supplied input.
          -->
          <div
            v-else-if="currentEntry?.html"
            class="cp-content vp-doc"
            v-html="currentEntry.html"
          ></div>
        </div>

        <!-- ── Footer ─────────────────────────────────────────────────── -->
        <div class="cp-footer" v-if="currentEntry?.url && !loading && !error">
          <span v-if="atMaxDepth" class="cp-depth-notice">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            Further links open in a new tab
          </span>

          <a
            :href="currentEntry.url.replace(/\.html$/, '') + '.html'"
            class="cp-open-link"
            target="_blank"
            rel="noopener noreferrer"
          >
            Open full page
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                 stroke="currentColor" stroke-width="2"
                 stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>
        </div>
      </div>
    </Transition>

    <!-- Scrim — mobile only -->
    <Transition name="cp-scrim">
      <div
        v-if="open"
        class="cp-scrim"
        aria-hidden="true"
        @click="close"
      ></div>
    </Transition>
  </ClientOnly>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute } from 'vitepress'

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_HISTORY = 3

const EBA_COLORS = {
  'Allied Health Professionals 2021-2026':        { color: '#EA580C', bg: '#EA580C1A' },
  'Biomedical Engineers 2025-2028':               { color: '#4F46E5', bg: '#4F46E51A' },
  "Children's Services Award 2010":               { color: '#DB2777', bg: '#DB27771A' },
  'Doctors in Training 2022-2026':                { color: '#D97706', bg: '#D977061A' },
  'Health Allied Managers Admin 2021-2025':        { color: '#3B82F6', bg: '#3B82F61A' },
  'Medical Specialists 2022-2026':                { color: '#0891B2', bg: '#0891B21A' },
  'Mental Health Services 2024-2028':             { color: '#7C3AED', bg: '#7C3AED1A' },
  'Medical Scientists, Pharm & Psych 2021-2025':  { color: '#059669', bg: '#0596691A' },
  'Nurses and Midwives 2024-2028':                { color: '#E11D48', bg: '#E11D481A' },
}

// ─── State ────────────────────────────────────────────────────────────────────

const route   = useRoute()
const open    = ref(false)
const loading = ref(false)
const error   = ref('')
const bodyRef = ref(null)

// History stack — each entry: { url, title, eba, html }
const history    = ref([])
const currentEntry = computed(() => history.value[history.value.length - 1] ?? null)
const atMaxDepth   = computed(() => history.value.length >= MAX_HISTORY)

// ─── EBA badge styling ────────────────────────────────────────────────────────

function ebaBadgeStyle(ebaName) {
  const scheme = EBA_COLORS[ebaName]
  if (!scheme) return {}
  return {
    color:           scheme.color,
    backgroundColor: scheme.bg,
    border:          `1px solid ${scheme.color}33`,
  }
}

function truncateTitle(title, maxLen) {
  if (!title) return ''
  return title.length > maxLen ? title.slice(0, maxLen - 1) + '…' : title
}

// ─── Fetch clause HTML ────────────────────────────────────────────────────────

async function fetchClause(url) {
  const fetchUrl = url.replace(/\/$/, '').replace(/\.html$/, '') + '.html'
  const res      = await fetch(fetchUrl)
  if (!res.ok) throw new Error(`Could not load clause (HTTP ${res.status})`)

  const parser = new DOMParser()
  const doc    = parser.parseFromString(await res.text(), 'text/html')

    const vpDoc = doc.querySelector('.vp-doc')
    if (!vpDoc) {
    // In VitePress dev mode, pages are rendered client-side from a JS shell —
    // the fetched HTML contains only <div id="app"></div> with no static content.
    // This feature requires pre-rendered static HTML and will work correctly
    // in production (GitHub Pages). It cannot be tested in the dev server.
    const isDevShell = doc.querySelector('#app') && !doc.querySelector('main')
    if (isDevShell) {
        throw new Error('Clause preview is not available in the local dev server. Deploy to GitHub Pages to test this feature — production builds include pre-rendered HTML that can be fetched.')
    }
    throw new Error('Could not find clause content on this page.')
    }

  // Remove elements that don't belong in the panel
  vpDoc.querySelectorAll([
    '[class*="vp-nolebase-git-changelog"]',
    '.related-clauses-panel',
    '.doc-toolbar',
  ].join(',')).forEach(el => el.remove())

  // Remove trailing Changelog H2
  const allH2s = [...vpDoc.querySelectorAll('h2')]
  const lastH2 = allH2s[allH2s.length - 1]
  if (lastH2 && /changelog/i.test(lastH2.textContent)) lastH2.remove()

  // Extract title — strip " | EBA Wiki" suffix
  const rawTitle = doc.querySelector('title')?.textContent ?? ''
  const title    = rawTitle.replace(/\s*[|–—]\s*EBAdb.*$/, '').trim() || url

  // Extract EBA name from pagefind filter span
  const ebaSpan = doc.querySelector('[data-pagefind-filter^="eba["]')
  let   eba     = ''
  if (ebaSpan) {
    const m = (ebaSpan.getAttribute('data-pagefind-filter') ?? '').match(/^eba\[(.+)\]$/)
    if (m) eba = m[1]
  }

  return { url, title, eba, html: vpDoc.innerHTML }
}

// ─── Panel open / close / navigation ─────────────────────────────────────────

async function openPanel(url) {
  if (bodyRef.value) bodyRef.value.scrollTop = 0
  loading.value = true
  error.value   = ''
  open.value    = true
  lockBodyScroll(true)

  try {
    history.value.push(await fetchClause(url))
  } catch (e) {
    error.value = e.message || 'Failed to load clause.'
    history.value.push({ url, title: url, eba: '', html: '' })
  } finally {
    loading.value = false
    await nextTick()
    if (bodyRef.value) bodyRef.value.scrollTop = 0
  }
}

async function pushPanel(url) {
  if (bodyRef.value) bodyRef.value.scrollTop = 0
  loading.value = true
  error.value   = ''

  try {
    history.value.push(await fetchClause(url))
  } catch (e) {
    error.value = e.message || 'Failed to load clause.'
    history.value.push({ url, title: url, eba: '', html: '' })
  } finally {
    loading.value = false
    await nextTick()
    if (bodyRef.value) bodyRef.value.scrollTop = 0
  }
}

function close() {
  open.value    = false
  loading.value = false
  error.value   = ''
  history.value = []
  lockBodyScroll(false)
}

function goBack() {
  if (history.value.length <= 1) { close(); return }
  history.value.pop()
  error.value = ''
  nextTick(() => { if (bodyRef.value) bodyRef.value.scrollTop = 0 })
}

function jumpTo(idx) {
  history.value = history.value.slice(0, idx + 1)
  error.value   = ''
  nextTick(() => { if (bodyRef.value) bodyRef.value.scrollTop = 0 })
}

// ─── Scroll lock ──────────────────────────────────────────────────────────────

let savedScrollY = 0

function lockBodyScroll(lock) {
  console.log('[ClausePanel] lockBodyScroll called with lock:', lock, 'savedScrollY:', savedScrollY)
  if (lock) {
    savedScrollY                 = window.scrollY
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top      = `-${savedScrollY}px`
    document.body.style.width    = '100%'
  } else {
    document.body.style.overflow = ''
    document.body.style.position = ''
    document.body.style.top      = ''
    document.body.style.width    = ''
    window.scrollTo(0, savedScrollY)
  }
}

// ─── Custom event handler ─────────────────────────────────────────────────────
//
// Listens for 'open-clause-panel' dispatched by router.onBeforeRouteChange
// in index.js. detail.url is the path of the clause to display.
//
// If the panel is already open:
//   - Link from inside .cp-content → push onto history stack (chained browse)
//   - Link from main page → replace panel with fresh clause
// If the panel is closed: open fresh.

function handleOpenPanel(e) {
  const url = e.detail?.url
  if (!url) return

  if (open.value) {
    // Check if the event was triggered from inside the panel content.
    // We detect this via document.activeElement at the moment the event fires —
    // same approach used in the router hook's scope guard.
    const active    = document.activeElement
    const inPanel   = active && active.closest('.cp-content')

    if (inPanel && atMaxDepth.value) {
      // At max depth: open in a new tab instead
      window.open(url, '_blank', 'noopener,noreferrer')
      return
    }

    if (inPanel) {
      pushPanel(url)
    } else {
      // Fresh clause from main page while panel is already open
      history.value = []
      openPanel(url)
    }
  } else {
    openPanel(url)
  }
}

// ─── Keyboard ─────────────────────────────────────────────────────────────────

function handleKeydown(e) {
  if (!open.value) return
  if (e.key === 'Escape') close()
}

// ─── Route watcher — close on navigation ─────────────────────────────────────

watch(() => route.path, (newPath, oldPath) => {
  console.log('[ClausePanel] route watcher fired', { newPath, oldPath, open: open.value })
  lockBodyScroll(false)
  if (open.value) close()
})

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(() => {
  window.addEventListener('open-clause-panel', handleOpenPanel)
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('open-clause-panel', handleOpenPanel)
  window.removeEventListener('keydown', handleKeydown)
  if (open.value) lockBodyScroll(false)
})
</script>

<style scoped>
/* ── Panel container ──────────────────────────────────────────────────────── */
.clause-panel {
  position: fixed;
  top: var(--vp-nav-height, 64px);
  right: 0;
  bottom: 0;
  width: min(480px, 45vw);
  z-index: 60;
  display: flex;
  flex-direction: column;
  background: var(--vp-c-bg);
  border-left: 2px solid #4A2A72;
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.12);
  overflow: hidden;
}

.dark .clause-panel {
  box-shadow: -4px 0 24px rgba(0, 0, 0, 0.4);
}

/* ── Slide-in transition ──────────────────────────────────────────────────── */
.clause-panel-enter-active,
.clause-panel-leave-active {
  transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1),
              opacity   0.28s cubic-bezier(0.4, 0, 0.2, 1);
}
.clause-panel-enter-from,
.clause-panel-leave-to {
  transform: translateX(100%);
  opacity: 0;
}

/* ── Header ───────────────────────────────────────────────────────────────── */
.cp-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 14px 10px;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  flex-shrink: 0;
}

.cp-header-left {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;
}

.cp-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 2px 0;
  background: none;
  border: none;
  cursor: pointer;
  color: #4A2A72;
  font-size: 0.8rem;
  font-weight: 500;
}
.cp-back-btn:hover { opacity: 0.8; }

/* ── Breadcrumb ───────────────────────────────────────────────────────────── */
.cp-breadcrumb {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 2px;
  font-size: 0.75rem;
  color: var(--vp-c-text-3);
}

.cp-breadcrumb-link {
  background: none;
  border: none;
  cursor: pointer;
  color: #4A2A72;
  font-size: 0.75rem;
  padding: 0;
  text-decoration: underline;
  text-underline-offset: 2px;
  opacity: 0.8;
}
.cp-breadcrumb-link:hover { opacity: 1; }

.cp-breadcrumb-sep {
  color: var(--vp-c-text-3);
  margin: 0 1px;
}

/* ── Title block ──────────────────────────────────────────────────────────── */
.cp-title-block {
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}

.cp-eyebrow {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vp-c-text-3);
}

.cp-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 360px;
}

.cp-eba-badge {
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 500;
  padding: 2px 8px;
  border-radius: 4px;
  align-self: flex-start;
}

/* ── Close button ─────────────────────────────────────────────────────────── */
.cp-close-btn {
  flex-shrink: 0;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg);
  color: var(--vp-c-text-2);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.cp-close-btn:hover {
  background: var(--vp-c-bg-elv);
  color: var(--vp-c-text-1);
}

/* ── Body ─────────────────────────────────────────────────────────────────── */
.cp-body {
  flex: 1;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 20px 20px;
}

/* ── Loading ──────────────────────────────────────────────────────────────── */
.cp-loading {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 2.5rem 0;
  font-size: 0.88rem;
  color: var(--vp-c-text-2);
}

.cp-spinner {
  display: inline-block;
  width: 16px;
  height: 16px;
  border: 2px solid var(--vp-c-divider);
  border-top-color: #4A2A72;
  border-radius: 50%;
  animation: cp-spin 0.7s linear infinite;
  flex-shrink: 0;
}
@keyframes cp-spin { to { transform: rotate(360deg); } }

/* ── Error ────────────────────────────────────────────────────────────────── */
.cp-error {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 1rem;
  margin: 1.5rem 0;
  background: var(--vp-c-danger-soft);
  border: 1px solid var(--vp-c-danger-2);
  border-radius: 8px;
  font-size: 0.85rem;
  color: var(--vp-c-danger-1);
  line-height: 1.5;
}
.cp-error svg { flex-shrink: 0; margin-top: 1px; }

/* ── Content ──────────────────────────────────────────────────────────────── */
.cp-content {
  padding-top: 16px;
  font-size: 0.9rem;
}
.cp-content :deep(h1) { font-size: 1.3rem; }
.cp-content :deep(h2) { font-size: 1.1rem; }
.cp-content :deep(h3) { font-size: 1rem; }
.cp-content :deep(table) {
  display: block;
  overflow-x: auto;
  max-width: 100%;
}

/* ── Footer ───────────────────────────────────────────────────────────────── */
.cp-footer {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 8px 14px;
  border-top: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
}

.cp-depth-notice {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.72rem;
  color: var(--vp-c-text-3);
}

.cp-open-link {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 0.8rem;
  font-weight: 600;
  color: #fff;
  background: #3451b2;
  text-decoration: none;
  margin-left: auto;
  padding: 5px 12px;
  border-radius: 6px;
  transition: background 0.15s, opacity 0.15s;
  white-space: nowrap;
}
.cp-open-link:hover {
  background: #3a5ccc;
  text-decoration: none;
}

/* ── Scrim — mobile only ──────────────────────────────────────────────────── */
.cp-scrim { display: none; }

/* ── Mobile: bottom drawer ────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .clause-panel {
    top: auto;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    height: 65vh;
    border-left: none;
    border-top: 2px solid #4A2A72;
    border-radius: 16px 16px 0 0;
    box-shadow: 0 -4px 24px rgba(0, 0, 0, 0.18);
  }
  .clause-panel-enter-from,
  .clause-panel-leave-to {
    transform: translateY(100%);
    opacity: 1;
  }
  .cp-scrim {
    display: block;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 59;
  }
  .cp-scrim-enter-active,
  .cp-scrim-leave-active { transition: opacity 0.25s ease; }
  .cp-scrim-enter-from,
  .cp-scrim-leave-to { opacity: 0; }
  .cp-title { max-width: none; }
}

/* ── Tablet ───────────────────────────────────────────────────────────────── */
@media (min-width: 769px) and (max-width: 1100px) {
  .clause-panel { width: min(420px, 55vw); }
}
</style>