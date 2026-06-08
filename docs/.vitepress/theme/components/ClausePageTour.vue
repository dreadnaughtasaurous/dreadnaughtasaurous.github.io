<template>
  <ClientOnly>
    <Teleport to="body">
      <!-- Full-screen dim backdrop — always present when tour is active.
           On spotlight steps the spotlight's box-shadow creates the cutout;
           on centred steps the backdrop dims the whole page.               -->
      <Transition name="cpt-fade">
        <div
          v-if="active"
          class="cpt-backdrop"
          :class="{ 'cpt-backdrop--no-dim': spotlightStyle !== null }"
          @click.self="finish"
          aria-hidden="true"
        ></div>
      </Transition>

      <!-- Spotlight cutout — separate from backdrop, sits above it -->
      <Transition name="cpt-fade">
        <div
          v-if="active && spotlightStyle"
          class="cpt-spotlight"
          :style="spotlightStyle"
          aria-hidden="true"
        ></div>
      </Transition>

      <!-- Tooltip -->
      <Transition name="cpt-pop">
        <div
          v-if="active"
          class="cpt-tooltip"
          :style="tooltipStyle"
          role="dialog"
          aria-modal="true"
          :aria-label="`Clause page tour step ${stepIndex + 1} of ${steps.length}: ${currentStep.headline}`"
        >
          <!-- Header -->
          <div class="cpt-header">
            <span class="cpt-badge">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              Clause tour
            </span>
            <span class="cpt-step-counter">{{ stepIndex + 1 }} / {{ steps.length }}</span>
            <button class="cpt-skip" @click="finish" aria-label="Skip clause tour">Skip</button>
          </div>

          <!-- Progress dots -->
          <div class="cpt-dots" role="tablist" aria-label="Clause tour progress">
            <button
              v-for="(s, i) in steps"
              :key="i"
              class="cpt-dot"
              :class="{ 'cpt-dot--active': i === stepIndex, 'cpt-dot--done': i < stepIndex }"
              @click="goTo(i)"
              :aria-label="`Go to step ${i + 1}`"
              :aria-current="i === stepIndex ? 'step' : null"
              role="tab"
            ></button>
          </div>

          <!-- Body -->
          <div class="cpt-body">
            <div class="cpt-icon" v-html="currentStep.icon"></div>
            <h3 class="cpt-headline">{{ currentStep.headline }}</h3>
            <p class="cpt-copy" v-html="currentStep.copy"></p>
          </div>

          <!-- Nav -->
          <div class="cpt-nav">
            <button v-if="stepIndex > 0" class="cpt-btn cpt-btn--ghost" @click="prev">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>
              Back
            </button>
            <span v-else></span>

            <button v-if="stepIndex < steps.length - 1" class="cpt-btn cpt-btn--primary" @click="next">
              Next
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>
            </button>
            <button v-else class="cpt-btn cpt-btn--done" @click="finish">
              Done
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
          </div>

          <!-- Caret -->
          <div
            v-if="caretSide"
            class="cpt-caret"
            :class="`cpt-caret--${caretSide}`"
          ></div>
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'
import { useRoute } from 'vitepress'

// ─── Storage key ──────────────────────────────────────────────────────────────
const CLAUSE_TOUR_KEY = 'eba-clause-tour-complete'

// ─── Toolbar button selector helpers ─────────────────────────────────────────
// data-tour attributes passed as props to components whose root is <ClientOnly>
// are not forwarded to the actual DOM button. Instead we query the doc-toolbar
// button group by positional index — the order is fixed in index.js:
//   index 0 → AskThisPage  (ask-this-page-btn)
//   index 1 → CopyButton   (copy-btn)
//   index 2 → BookmarkButton (bookmark-btn)
// We also fall back to data-tour attributes in case they were added directly.
function getToolbarBtn(role) {
  // Primary: data-tour attribute placed directly on the <button> elements
  // inside DocToolbar.vue — works reliably because they are native elements,
  // not ClientOnly roots.
  const byAttr = document.querySelector(`[data-tour="${role}"]`)
  if (byAttr) return byAttr

  // Fallback: positional query inside .dst-bar (DocToolbar's toolbar row).
  // Button order is fixed: index 0 = Ask, 1 = Copy, 2 = View as Markdown, 3 = Bookmark.
  const bar  = document.querySelector('.dst-bar')
  if (!bar) return null
  const btns = bar.querySelectorAll('button')
  if (role === 'ask-this-page-btn')    return btns[0] ?? null
  if (role === 'copy-btn')             return btns[1] ?? null
  if (role === 'view-as-markdown-btn') return btns[2] ?? null
  if (role === 'bookmark-btn')         return btns[3] ?? null
  return null
}

// ─── Step definitions ─────────────────────────────────────────────────────────
// target: CSS selector string OR a function() => Element|null for complex lookups.
// caretHint: preferred tooltip placement relative to target.
const steps = [
  {
    target: () => getToolbarBtn('ask-this-page-btn'),
    headline: 'Ask AI about this clause',
    icon: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>`,
    copy: 'Opens a sliding AI panel scoped to this specific clause. Ask anything in plain English — about entitlements, conditions, or exceptions — and the AI answers using the EBA text. No need to specify which clause or EBA you mean.',
    caretHint: 'bottom',
  },
  {
    target: () => getToolbarBtn('copy-btn'),
    headline: 'Copy this clause',
    icon: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,
    copy: 'Copies the full clause content to your clipboard — formatted for clean pasting into Jira, email, or any HR system. Rich text and plain text are both copied simultaneously.',
    caretHint: 'bottom',
  },
  {
    target: () => getToolbarBtn('view-as-markdown-btn'),
    headline: 'View as Markdown',
    icon: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="16" y2="17"/></svg>`,
    copy: 'Opens the raw source text of this clause page in a lightbox overlay. Useful for copying clean plain text, checking clause formatting, or grabbing the exact Markdown to use elsewhere.',
    caretHint: 'bottom',
  },
  {
    target: () => getToolbarBtn('bookmark-btn'),
    headline: 'Bookmark this clause',
    icon: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>`,
    copy: 'Save clauses you refer to frequently. Bookmarks persist in your browser across sessions and can include a personal note — handy for recording your interpretation or a reminder to verify with your team.',
    caretHint: 'bottom',
  },
  {
    target: '.VPDocAsideOutline.has-outline',
    headline: 'On this page',
    icon: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6h13"/><path d="M8 12h13"/><path d="M8 18h13"/><path d="M3 6h.01"/><path d="M3 12h.01"/><path d="M3 18h.01"/></svg>`,
    copy: 'The right sidebar shows an outline of this clause\'s sections. Click any heading to jump directly to it — useful on long clauses with multiple subclauses.',
    caretHint: 'left',
    skipIfMissing: true,
  },
  {
    target: '.related-clauses-panel',
    headline: 'Related clauses',
    icon: `<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,
    copy: 'Below each clause, related clauses across all EBAs are automatically surfaced. Click any card to preview it in a side panel without leaving the page.',
    caretHint: 'top',
    skipIfMissing: true,
  },
]

// ─── State ────────────────────────────────────────────────────────────────────
const route      = useRoute()
const active     = ref(false)
const stepIndex  = ref(0)
const tooltipStyle   = ref({ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' })
const spotlightStyle = ref(null)
const caretSide  = ref(null)

const currentStep = computed(() => steps[stepIndex.value])

// ─── Resolve target element (selector string OR function) ─────────────────────
function resolveTarget(step) {
  if (!step.target) return null
  if (typeof step.target === 'function') return step.target()
  return document.querySelector(step.target)
}

// ─── Clause page detection ────────────────────────────────────────────────────
function isClausePage(path) {
  const parts = (path || '').replace(/\/$/, '').replace(/\.html$/, '').split('/')
  return parts.length >= 5 && parts[1] === 'ebas'
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(() => {
  if (typeof localStorage === 'undefined') return
  if (localStorage.getItem(CLAUSE_TOUR_KEY)) return
  if (!isClausePage(route.path)) return
  setTimeout(() => { active.value = true; positionTooltip() }, 1200)
  window.addEventListener('resize', onResize)
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  window.removeEventListener('keydown', onKeydown)
})

// ─── Route watch: fire tour on first clause page visit mid-session ─────────────
watch(() => route.path, async (newPath) => {
  if (typeof localStorage === 'undefined') return
  if (localStorage.getItem(CLAUSE_TOUR_KEY)) return
  if (!isClausePage(newPath)) return
  if (active.value) return
  await sleep(1200)
  active.value = true
  stepIndex.value = 0
  await positionTooltip()
})

function onKeydown(e) {
  if (!active.value) return
  if (e.key === 'ArrowRight') { e.preventDefault(); next() }
  if (e.key === 'ArrowLeft')  { e.preventDefault(); prev() }
  if (e.key === 'Escape')     { e.preventDefault(); finish() }
}

function onResize() {
  if (active.value) positionTooltip()
}

// ─── Navigation ──────────────────────────────────────────────────────────────
async function next() {
  if (stepIndex.value >= steps.length - 1) { finish(); return }
  stepIndex.value++
  await nextTick()
  await positionTooltip()
}

async function prev() {
  if (stepIndex.value <= 0) return
  stepIndex.value--
  await nextTick()
  await positionTooltip()
}

async function goTo(i) {
  stepIndex.value = i
  await nextTick()
  await positionTooltip()
}

function finish() {
  active.value = false
  try { localStorage.setItem(CLAUSE_TOUR_KEY, '1') } catch { /* ignore */ }
}

// ─── Positioning ─────────────────────────────────────────────────────────────
const TOOLTIP_W        = 320
const TOOLTIP_H_APPROX = 220
const MARGIN           = 16
const GAP              = 14
const PAD              = 6

async function positionTooltip() {
  const step = currentStep.value
  const el   = resolveTarget(step)

  if (!el) {
    // Auto-skip steps flagged as skipIfMissing (e.g. related-clauses-panel)
    if (step.skipIfMissing) {
      if (stepIndex.value < steps.length - 1) {
        stepIndex.value++
        await nextTick()
        await positionTooltip()
      } else {
        finish()
      }
      return
    }
    // Otherwise: show centred tooltip with full backdrop, no spotlight
    spotlightStyle.value = null
    caretSide.value      = null
    tooltipStyle.value   = {
      position:  'fixed',
      top:       '50%',
      left:      '50%',
      transform: 'translate(-50%, -50%)',
      width:     `${TOOLTIP_W}px`,
    }
    return
  }

  // Scroll element into view — 'center' ensures the element is visually
  // centred in the viewport, not just barely on-screen. Sleep gives smooth
  // scroll time to finish before getBoundingClientRect() is read.
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  await sleep(500)

  const rect = el.getBoundingClientRect()
  const vw   = window.innerWidth
  const vh   = window.innerHeight

  // Spotlight via box-shadow spread
  spotlightStyle.value = {
    position:     'fixed',
    left:         `${rect.left  - PAD}px`,
    top:          `${rect.top   - PAD}px`,
    width:        `${rect.width  + PAD * 2}px`,
    height:       `${rect.height + PAD * 2}px`,
    borderRadius: '8px',
    boxShadow:    '0 0 0 9999px rgba(0,0,0,0.48)',
    pointerEvents:'none',
    zIndex:       '10000',
  }

  const hint      = step.caretHint ?? 'auto'
  let   placement = hint
  if (hint === 'auto') {
    const spaceBelow = vh - rect.bottom
    const spaceAbove = rect.top
    placement = spaceBelow >= TOOLTIP_H_APPROX + MARGIN ? 'bottom'
              : spaceAbove >= TOOLTIP_H_APPROX + MARGIN ? 'top'
              : rect.left  >= TOOLTIP_W + MARGIN        ? 'left'
              : 'right'
  }
  caretSide.value = placement

  const centerX = rect.left + rect.width  / 2
  const centerY = rect.top  + rect.height / 2
  let   top, left

  if (placement === 'bottom') {
    top  = rect.bottom + GAP
    left = clamp(centerX - TOOLTIP_W / 2, MARGIN, vw - TOOLTIP_W - MARGIN)
  } else if (placement === 'top') {
    top  = rect.top - TOOLTIP_H_APPROX - GAP
    left = clamp(centerX - TOOLTIP_W / 2, MARGIN, vw - TOOLTIP_W - MARGIN)
  } else if (placement === 'right') {
    top  = clamp(centerY - TOOLTIP_H_APPROX / 2, MARGIN, vh - TOOLTIP_H_APPROX - MARGIN)
    left = rect.right + GAP
  } else {
    top  = clamp(centerY - TOOLTIP_H_APPROX / 2, MARGIN, vh - TOOLTIP_H_APPROX - MARGIN)
    left = rect.left - TOOLTIP_W - GAP
  }

  tooltipStyle.value = {
    position:  'fixed',
    top:       `${Math.max(MARGIN, top)}px`,
    left:      `${Math.max(MARGIN, left)}px`,
    width:     `${TOOLTIP_W}px`,
    transform: 'none',
  }
}

function clamp(v, min, max) { return Math.min(Math.max(v, min), max) }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }
</script>

<style scoped>
/* ── Backdrop — always present, full-screen dim ── */
.cpt-backdrop {
  position:       fixed;
  inset:          0;
  z-index:        9999;
  background:     rgba(0, 0, 0, 0.45);
  pointer-events: auto;
}
.cpt-backdrop--no-dim {
  background: transparent;
}

/* ── Spotlight ── */
.cpt-spotlight {
  position:       fixed;
  z-index:        10000;
  pointer-events: none;
  border-radius:  8px;
  transition:
    left   0.28s cubic-bezier(0.4, 0, 0.2, 1),
    top    0.28s cubic-bezier(0.4, 0, 0.2, 1),
    width  0.28s cubic-bezier(0.4, 0, 0.2, 1),
    height 0.28s cubic-bezier(0.4, 0, 0.2, 1);
}

/* ── Tooltip ── */
.cpt-tooltip {
  position:       fixed;
  z-index:        10001;
  width:          320px;
  background:     var(--vp-c-bg);
  border:         1px solid var(--vp-c-divider);
  border-radius:  12px;
  box-shadow:
    0 0 0 1px rgba(74, 42, 114, 0.1),
    0 16px 40px rgba(0, 0, 0, 0.24),
    0 4px 12px rgba(0, 0, 0, 0.1);
  padding:        1rem 1rem 0.8rem;
  display:        flex;
  flex-direction: column;
  gap:            0.55rem;
  pointer-events: auto;
}

/* ── Header ── */
.cpt-header { display: flex; align-items: center; gap: 0.4rem; }

.cpt-badge {
  display:        inline-flex;
  align-items:    center;
  gap:            0.2rem;
  font-size:      0.62rem;
  font-weight:    700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color:          #059669;
  background:     rgba(5, 150, 105, 0.1);
  border-radius:  4px;
  padding:        0.1rem 0.4rem;
}

.cpt-step-counter { font-size: 0.7rem; color: var(--vp-c-text-3); margin-left: auto; }

.cpt-skip {
  font-size:     0.7rem;
  color:         var(--vp-c-text-3);
  background:    none;
  border:        none;
  cursor:        pointer;
  padding:       0.1rem 0.2rem;
  border-radius: 3px;
  transition:    color 0.12s, background-color 0.12s;
}
.cpt-skip:hover { color: var(--vp-c-text-1); background-color: var(--vp-c-bg-mute); }

/* ── Dots ── */
.cpt-dots { display: flex; gap: 0.28rem; align-items: center; }

.cpt-dot {
  width: 5px; height: 5px;
  border-radius: 50%;
  background:    var(--vp-c-divider);
  border: none; padding: 0;
  cursor: pointer;
  transition: all 0.2s ease;
  flex-shrink: 0;
}
.cpt-dot--active { width: 16px; border-radius: 3px; background: #059669; }
.cpt-dot--done   { background: #059669; opacity: 0.5; }

/* ── Body ── */
.cpt-body { display: flex; flex-direction: column; gap: 0.4rem; }
.cpt-icon { color: #059669; opacity: 0.85; line-height: 1; }

.cpt-headline {
  font-size:   0.88rem;
  font-weight: 700;
  color:       var(--vp-c-text-1);
  margin:      0;
  line-height: 1.3;
}

.cpt-copy {
  font-size:   0.78rem;
  color:       var(--vp-c-text-2);
  line-height: 1.6;
  margin:      0;
}

.cpt-copy :deep(kbd) {
  display: inline-block; font-size: 0.7rem; padding: 0.05rem 0.3rem;
  border: 1px solid var(--vp-c-divider); border-radius: 3px;
  background: var(--vp-c-bg-soft); color: var(--vp-c-text-1);
  font-family: ui-monospace, monospace;
}
.cpt-copy :deep(strong) { color: var(--vp-c-text-1); font-weight: 600; }

/* ── Nav ── */
.cpt-nav {
  display:         flex;
  align-items:     center;
  justify-content: space-between;
  margin-top:      0.1rem;
  padding-top:     0.55rem;
  border-top:      1px solid var(--vp-c-divider);
}

.cpt-btn {
  display:     inline-flex;
  align-items: center;
  gap:         0.28rem;
  padding:     0.35rem 0.75rem;
  font-size:   0.76rem;
  font-weight: 600;
  border-radius: 6px;
  cursor:      pointer;
  border:      none;
  transition:  filter 0.12s, transform 0.1s;
}
.cpt-btn:active       { transform: scale(0.95); }
.cpt-btn--ghost       { background: var(--vp-c-bg-soft); border: 1px solid var(--vp-c-divider); color: var(--vp-c-text-2); }
.cpt-btn--ghost:hover { color: var(--vp-c-text-1); }
.cpt-btn--primary       { background: var(--vp-c-brand-1); color: #fff; }
.cpt-btn--primary:hover { filter: brightness(1.1); }
.cpt-btn--done          { background: #059669; color: #fff; }
.cpt-btn--done:hover    { filter: brightness(1.1); }

/* ── Caret ── */
.cpt-caret {
  position: absolute;
  width: 9px; height: 9px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  transform: rotate(45deg);
}
.cpt-caret--top    { bottom: -5px; left: 50%; margin-left: -4px; border-top: none; border-left: none; }
.cpt-caret--bottom { top: -5px;    left: 50%; margin-left: -4px; border-bottom: none; border-right: none; }
.cpt-caret--left   { right: -5px;  top: 50%;  margin-top: -4px;  border-bottom: none; border-left: none; }
.cpt-caret--right  { left: -5px;   top: 50%;  margin-top: -4px;  border-top: none; border-right: none; }

/* ── Transitions ── */
.cpt-fade-enter-active, .cpt-fade-leave-active { transition: opacity 0.22s ease; }
.cpt-fade-enter-from,   .cpt-fade-leave-to     { opacity: 0; }

.cpt-pop-enter-active { transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
.cpt-pop-leave-active { transition: opacity 0.13s ease; }
.cpt-pop-enter-from   { opacity: 0; transform: scale(0.94) translateY(5px); }
.cpt-pop-leave-to     { opacity: 0; }

@media (max-width: 600px) {
  .cpt-tooltip { width: calc(100vw - 2rem) !important; left: 1rem !important; transform: none !important; }
  .cpt-caret   { display: none; }
}

@media print { .cpt-backdrop, .cpt-spotlight, .cpt-tooltip { display: none !important; } }
</style>