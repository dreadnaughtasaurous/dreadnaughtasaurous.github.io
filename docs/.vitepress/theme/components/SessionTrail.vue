<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vitepress'

const router = useRouter()
const open   = ref(false)
const trail  = ref([])

const DISPLAY_MAX = 10

const EBA_COLORS = {
  'allied-health':        '#EA580C',
  'biomedical-engineers': '#4F46E5',
  'childrens-services':   '#DB2777',
  'doctors-in-training':  '#D97706',
  'has-managers-admin':   '#3B82F6',
  'medical-specialists':  '#0891B2',
  'mental-health':        '#7C3AED',
  'medical-scientists':   '#059669',
  'nurses-midwives':      '#E11D48',
}

const EBA_LABELS = {
  'allied-health':        'Allied Health',
  'biomedical-engineers': 'Biomedical Eng.',
  'childrens-services':   "Children's Svcs",
  'doctors-in-training':  'Doctors in Training',
  'has-managers-admin':   'HAS / Managers',
  'medical-specialists':  'Med. Specialists',
  'mental-health':        'Mental Health',
  'medical-scientists':   'Med. Scientists',
  'nurses-midwives':      'Nurses & Midwives',
}

// ── Trail I/O ─────────────────────────────────────────────────────────────────
function loadTrail() {
  try { trail.value = JSON.parse(sessionStorage.getItem('eba-session-trail') || '[]') }
  catch { trail.value = [] }
}

function clearTrail() {
  try { sessionStorage.removeItem('eba-session-trail') } catch {}
  trail.value = []
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function relativeTime(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1)  return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  return hrs < 24 ? `${hrs}h ago` : `${Math.floor(hrs / 24)}d ago`
}

// Strip VitePress site suffix from document.title (e.g. "Clause 23 | EBA Wiki")
function cleanTitle(raw) {
  // VitePress appends "| Site Name" — strip the last pipe-separated segment
  return (raw || '').replace(/\s*\|\s*[^|]+$/, '').trim() || raw
}

function navigateTo(path) {
  open.value = false
  router.go(path)
}

// ── PDF export ─────────────────────────────────────────────────────────────────
// Opens a fresh window and writes self-contained print HTML so that we never
// need to fight VitePress's own @media print styles on the live page.
function exportPdf() {
  const items = displayItems.value.slice().reverse() // chronological order for print
  const w = window.open('', '_blank')
  if (!w) return
  const rows = items.map(e => {
    const col  = EBA_COLORS[e.eba] || '#64748b'
    const lbl  = EBA_LABELS[e.eba] || e.eba
    const href = `https://dreadnaughtasaurous.github.io${e.path}`
    const time = new Date(e.timestamp).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })
    return `<li>
      <span class="chip" style="background:${col}22;color:${col}">${lbl}</span>
      <a href="${href}">${cleanTitle(e.title)}</a>
      <span class="ts">${time}</span>
    </li>`
  }).join('\n')

  w.document.write(`<!DOCTYPE html><html lang="en"><head><meta charset="utf-8">
<title>EBA Reading Session — ${new Date().toLocaleDateString('en-AU')}</title>
<style>
  body { font-family: system-ui, sans-serif; padding: 2.5rem; color: #1e293b; max-width: 680px; margin: 0 auto; }
  h1   { font-size: 1.15rem; font-weight: 700; margin: 0 0 0.2rem; }
  .meta { font-size: 0.8rem; color: #64748b; margin: 0 0 2rem; }
  ol   { padding-left: 1.2rem; }
  li   { margin-bottom: 0.7rem; line-height: 1.6; }
  .chip { display: inline-block; font-size: 0.65rem; font-weight: 700; padding: 0.1em 0.45em;
          border-radius: 4px; margin-right: 0.4em; vertical-align: middle; }
  a    { color: #2563eb; text-decoration: none; font-size: 0.9rem; }
  a:hover { text-decoration: underline; }
  .ts  { font-size: 0.72rem; color: #94a3b8; margin-left: 0.4em; }
  @media print { body { padding: 1rem; } }
</style>
</head><body>
<h1>EBA Wiki — Reading Session</h1>
<p class="meta">Exported ${new Date().toLocaleString('en-AU')} &nbsp;·&nbsp; ${items.length} page${items.length !== 1 ? 's' : ''} visited</p>
<ol>${rows}</ol>
</body></html>`)
  w.document.close()
  w.focus()
  // Small delay ensures the new window's document is fully ready before print dialog
  setTimeout(() => w.print(), 300)
}

// ── Computed ──────────────────────────────────────────────────────────────────
const displayItems = computed(() => trail.value.slice(0, DISPLAY_MAX))

// ── Lifecycle ─────────────────────────────────────────────────────────────────
function onTrailUpdated() { loadTrail() }
function onKeydown(e) {
  if (e.key === 'Escape' && open.value) { e.stopPropagation(); open.value = false }
}

onMounted(() => {
  loadTrail()
  window.addEventListener('eba-trail-updated', onTrailUpdated)
  window.addEventListener('keydown', onKeydown)
})
onUnmounted(() => {
  window.removeEventListener('eba-trail-updated', onTrailUpdated)
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <ClientOnly>
    <Teleport to="body">

      <!-- ── Floating toggle button ───────────────────────────────────────── -->
      <button
        class="st-fab"
        :class="{ 'st-fab--active': open }"
        @click="open = !open"
        :aria-label="open ? 'Close reading trail' : 'Open reading trail'"
        :title="open ? 'Close' : `Reading trail · ${displayItems.length} page${displayItems.length !== 1 ? 's' : ''}`"
      >
        <span class="st-fab__icon" aria-hidden="true">◷</span>
      </button>

      <!-- ── Backdrop ─────────────────────────────────────────────────────── -->
      <Transition name="st-fade">
        <div v-if="open" class="st-backdrop" @click="open = false" aria-hidden="true" />
      </Transition>

      <!-- ── Panel ────────────────────────────────────────────────────────── -->
      <Transition name="st-slide">
        <div
          v-if="open"
          class="st-panel"
          role="dialog"
          aria-label="Your reading trail"
          aria-modal="true"
        >
          <!-- Header -->
          <div class="st-header">
            <span class="st-header__title">◷ Your reading session</span>
            <div class="st-header__actions">
              <button
                v-if="trail.length > 0"
                class="st-btn-ghost"
                @click="clearTrail"
                title="Clear trail"
              >Clear</button>
              <button class="st-btn-close" @click="open = false" aria-label="Close">✕</button>
            </div>
          </div>

          <!-- Empty state -->
          <div v-if="displayItems.length === 0" class="st-empty">
            <div class="st-empty__icon" aria-hidden="true">◷</div>
            <p>No pages visited yet.</p>
            <p>Browse any clause page and it will appear here.</p>
          </div>

          <!-- Trail list -->
          <ol v-else class="st-list" aria-label="Pages visited this session">
            <li
              v-for="item in displayItems"
              :key="item.path + item.timestamp"
              class="st-item"
            >
              <button class="st-item__row" @click="navigateTo(item.path)">
                <span
                  class="st-item__chip"
                  :style="{
                    background: (EBA_COLORS[item.eba] || '#64748b') + '22',
                    color: EBA_COLORS[item.eba] || '#64748b'
                  }"
                >{{ EBA_LABELS[item.eba] || item.eba || '—' }}</span>
                <div class="st-item__body">
                  <span class="st-item__title">{{ cleanTitle(item.title) }}</span>
                  <span class="st-item__time">{{ relativeTime(item.timestamp) }}</span>
                </div>
              </button>
            </li>
          </ol>

          <!-- Footer -->
          <div v-if="displayItems.length > 0" class="st-footer">
            <span class="st-footer__count">
              {{ trail.length }} page{{ trail.length !== 1 ? 's' : '' }} this session
            </span>
            <button class="st-btn-export" @click="exportPdf">Export PDF ↗</button>
          </div>

        </div>
      </Transition>

    </Teleport>
  </ClientOnly>
</template>

<style scoped>
/* ── Floating button ──────────────────────────────────────────────────────── */
.st-fab {
  position:        fixed;
  bottom:          2rem;
  left:            1.5rem;
  z-index:         9990;
  width:           44px;
  height:          44px;
  border-radius:   50%;
  border:          1.5px solid var(--vp-c-divider);
  background:      var(--vp-c-bg);
  box-shadow:      0 2px 10px oklch(0 0 0 / 0.15);
  cursor:          pointer;
  display:         flex;
  align-items:     center;
  justify-content: center;
  transition:      box-shadow 0.2s, border-color 0.2s, background 0.2s;
}
.st-fab:hover       { box-shadow: 0 4px 16px oklch(0 0 0 / 0.22); border-color: var(--vp-c-brand-1); }
.st-fab--active     { border-color: var(--vp-c-brand-1); background: var(--vp-c-brand-soft); }
.st-fab:focus-visible { outline: 3px solid var(--vp-c-brand-1); outline-offset: 3px; }

.st-fab__icon {
  font-size: 1.15rem;
  line-height: 1;
  color: var(--vp-c-text-1);
}

/* ── Backdrop ─────────────────────────────────────────────────────────────── */
.st-backdrop {
  position:   fixed;
  inset:      0;
  z-index:    9988;
  background: oklch(0 0 0 / 0.25);
}

/* ── Panel ────────────────────────────────────────────────────────────────── */
.st-panel {
  position:              fixed;
  bottom:                0;
  left:                  0;
  z-index:               9989;
  width:                 min(360px, 92vw);
  max-height:            min(520px, 78vh);
  background:            var(--vp-c-bg);
  border-top-right-radius: 14px;
  border-right:          1px solid var(--vp-c-divider);
  border-top:            1px solid var(--vp-c-divider);
  box-shadow:            4px -4px 28px oklch(0 0 0 / 0.14);
  display:               flex;
  flex-direction:        column;
  overflow:              hidden;
}

/* ── Header ──────────────────────────────────────────────────────────────── */
.st-header {
  display:         flex;
  align-items:     center;
  justify-content: space-between;
  padding:         0.65rem 0.85rem;
  border-bottom:   1px solid var(--vp-c-divider);
  flex-shrink:     0;
}
.st-header__title   { font-size: 0.8rem; font-weight: 600; color: var(--vp-c-text-1); }
.st-header__actions { display: flex; align-items: center; gap: 0.4rem; }

.st-btn-ghost {
  font-size:    0.72rem;
  padding:      0.2rem 0.5rem;
  border:       1px solid var(--vp-c-divider);
  border-radius: 4px;
  background:   transparent;
  color:        var(--vp-c-text-2);
  cursor:       pointer;
  transition:   border-color 0.15s, color 0.15s;
}
.st-btn-ghost:hover { border-color: var(--vp-c-brand-1); color: var(--vp-c-text-1); }

.st-btn-close {
  background:   none;
  border:       none;
  cursor:       pointer;
  font-size:    0.82rem;
  color:        var(--vp-c-text-2);
  padding:      0.15rem 0.3rem;
  border-radius: 4px;
  line-height:  1;
}
.st-btn-close:hover { color: var(--vp-c-text-1); }

/* ── Empty state ─────────────────────────────────────────────────────────── */
.st-empty {
  padding:    2.5rem 1.5rem;
  text-align: center;
  color:      var(--vp-c-text-2);
  font-size:  0.82rem;
  line-height: 1.7;
}
.st-empty__icon { font-size: 2rem; opacity: 0.3; margin-bottom: 0.5rem; }
.st-empty p { margin: 0; }

/* ── Trail list ──────────────────────────────────────────────────────────── */
.st-list {
  list-style:      none;
  margin:          0;
  padding:         0.3rem 0;
  overflow-y:      auto;
  flex:            1;
  scrollbar-width: thin;
  scrollbar-color: var(--vp-c-divider) transparent;
}
.st-item { margin: 0; }

/* Each item is a clickable button laid out as a 2-row grid:
   [chip] [title]
   [chip] [time]                                                              */
.st-item__row {
  display:        flex;
  flex-direction: column;
  gap:            0.25rem;
  width:          100%;
  padding:        0.55rem 0.85rem;
  background:     none;
  border:         none;
  border-bottom:  1px solid var(--vp-c-divider);
  cursor:         pointer;
  text-align:     left;
  transition:     background 0.12s;
}
.st-item__row:hover { background: var(--vp-c-default-soft); }

/* EBA chip — full unclipped width, self-sizes to label length */
.st-item__chip {
  display:       inline-flex;
  align-items:   center;
  align-self:    flex-start;
  font-size:     0.6rem;
  font-weight:   700;
  padding:       0.15em 0.5em;
  border-radius: 4px;
  white-space:   nowrap;
  line-height:   1.5;
}

/* Second row: title left, time right, both baseline-aligned */
.st-item__body {
  display:     flex;
  align-items: baseline;
  gap:         0.5rem;
}
.st-item__title {
  flex:          1;
  font-size:     0.79rem;
  font-weight:   500;
  color:         var(--vp-c-text-1);
  line-height:   1.35;
  overflow:      hidden;
  text-overflow: ellipsis;
  white-space:   nowrap;
  min-width:     0; /* required: prevents flex child overflowing its container */
}
.st-item__time {
  flex-shrink: 0;
  font-size:   0.68rem;
  color:       var(--vp-c-text-3);
  line-height: 1;
}

/* ── Footer ──────────────────────────────────────────────────────────────── */
.st-footer {
  display:         flex;
  align-items:     center;
  justify-content: space-between;
  padding:         0.55rem 0.85rem;
  border-top:      1px solid var(--vp-c-divider);
  flex-shrink:     0;
}
.st-footer__count { font-size: 0.7rem; color: var(--vp-c-text-3); }

.st-btn-export {
  font-size:    0.7rem;
  padding:      0.22rem 0.55rem;
  border:       1px solid var(--vp-c-divider);
  border-radius: 5px;
  background:   transparent;
  color:        var(--vp-c-text-2);
  cursor:       pointer;
  transition:   border-color 0.15s, color 0.15s;
}
.st-btn-export:hover { border-color: var(--vp-c-brand-1); color: var(--vp-c-brand-1); }

/* ── Transitions ─────────────────────────────────────────────────────────── */
.st-slide-enter-active,
.st-slide-leave-active { transition: transform 0.22s ease, opacity 0.22s ease; }
.st-slide-enter-from,
.st-slide-leave-to     { transform: translateX(-100%); opacity: 0; }

.st-fade-enter-active,
.st-fade-leave-active  { transition: opacity 0.2s ease; }
.st-fade-enter-from,
.st-fade-leave-to      { opacity: 0; }

/* ── Mobile ──────────────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .st-fab    { bottom: 5rem; left: 1rem; }   /* clear MobileNav bar */
  .st-panel  { width: 100vw; max-height: 55vh; border-top-right-radius: 0; }
}
</style>