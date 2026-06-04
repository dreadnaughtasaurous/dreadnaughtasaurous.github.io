<template>
  <ClientOnly>
    <div class="a11y-controls" aria-label="Accessibility controls">

      <!-- ── Separator ── -->
      <div class="a11y-sep" aria-hidden="true"></div>

      <!-- ── Trigger button ── -->
      <button
        ref="triggerRef"
        class="a11y-btn"
        :class="{ 'a11y-btn--active': anyActive }"
        :aria-label="`Accessibility options${anyActive ? ' — preferences active' : ''}`"
        :aria-expanded="open"
        aria-haspopup="dialog"
        @click="togglePanel"
      >
        <span class="a11y-font-icon" aria-hidden="true">Aa</span>
        <span v-if="anyActive" class="a11y-dot" aria-hidden="true"></span>
        <span class="a11y-hint" aria-hidden="true">Opens the accessibility options</span>
      </button>

    </div>

    <Teleport to="body">

      <!-- ── Click-outside backdrop ── -->
      <div v-if="open" class="a11y-backdrop" @click="close" aria-hidden="true"></div>

      <!-- ── Panel ── -->
      <div
        v-if="open"
        ref="panelRef"
        class="a11y-panel"
        role="dialog"
        aria-label="Accessibility preferences"
        tabindex="-1"
        :style="panelStyle"
        @keydown.esc.stop="close"
      >

        <!-- Header -->
        <div class="a11y-panel-hdr">
          <span class="a11y-panel-title">Accessibility</span>
          <button
            class="a11y-reset-btn"
            :disabled="!anyActive"
            :title="anyActive ? 'Reset all preferences to defaults' : 'No active preferences'"
            @click="resetAll"
          >Reset all</button>
        </div>

        <!-- ── Text size ── -->
        <div class="a11y-row">
          <span class="a11y-row-label">Text size</span>
          <div class="a11y-seg-group" role="group" aria-label="Text size">
            <button
              v-for="s in FONT_STEPS" :key="s.value"
              class="a11y-seg-btn"
              :class="{ 'a11y-seg-btn--on': fontSize === s.value }"
              :aria-pressed="fontSize === s.value"
              @click="setFont(s.value)"
            >{{ s.label }}</button>
          </div>
        </div>

        <!-- ── Line spacing ── -->
        <div class="a11y-row">
          <span class="a11y-row-label">Line spacing</span>
          <div class="a11y-seg-group" role="group" aria-label="Line spacing">
            <button
              v-for="s in LINE_STEPS" :key="s.value"
              class="a11y-seg-btn"
              :class="{ 'a11y-seg-btn--on': lineSpacing === s.value }"
              :aria-pressed="lineSpacing === s.value"
              @click="setLineSpacing(s.value)"
            >{{ s.label }}</button>
          </div>
        </div>

        <div class="a11y-rule"></div>

        <!-- ── Toggle rows ── -->
        <div
          v-for="t in TOGGLES" :key="t.key"
          class="a11y-row a11y-row--toggle"
        >
          <span class="a11y-row-label">{{ t.label }}</span>
          <button
            class="a11y-toggle"
            :class="{ 'a11y-toggle--on': toggleState[t.key] }"
            role="switch"
            :aria-checked="toggleState[t.key]"
            :aria-label="`${t.label}: ${toggleState[t.key] ? 'on' : 'off'}`"
            @click="flipToggle(t.key)"
          >
            <span class="a11y-toggle-track">
              <span class="a11y-toggle-thumb"></span>
            </span>
          </button>
        </div>

      </div><!-- /panel -->

    </Teleport>
  </ClientOnly>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute } from 'vitepress'

// ─── Step definitions ─────────────────────────────────────────────────────────

const FONT_STEPS = [
  { value: 'normal', label: 'Normal' },
  { value: 'large',  label: 'Large'  },
  { value: 'xl',     label: 'XL'     },
]

const LINE_STEPS = [
  { value: 'compact', label: 'Compact' },
  { value: 'normal',  label: 'Normal'  },
  { value: 'relaxed', label: 'Relaxed' },
]

// label shown in the panel, key matches toggleState + APPLY_FNS
const TOGGLES = [
  { key: 'letterSpacing', label: 'Wide letter spacing' },
  { key: 'dyslexicFont',  label: 'OpenDyslexic font'   },
  { key: 'linkHighlight', label: 'Highlight links'      },
  { key: 'highContrast',  label: 'High contrast'        },
  { key: 'reducedMotion', label: 'Reduce motion'        },
  { key: 'readingMode',   label: 'Reading mode'         },
]

// ─── LocalStorage keys ────────────────────────────────────────────────────────

const LS_FONT      = 'eba-font-size'
const LS_LINE      = 'eba-line-spacing'
const LS_LETTER    = 'eba-letter-spacing'
const LS_DYSLEXIC  = 'eba-font-dyslexic'
const LS_HIGHLIGHT = 'eba-link-highlight'
const LS_CONTRAST  = 'eba-high-contrast'
const LS_MOTION    = 'eba-reduced-motion'
// readingMode is session-only — no LS key

// ─── Reactive state ───────────────────────────────────────────────────────────

const open       = ref(false)
const triggerRef = ref(null)
const panelRef   = ref(null)
const panelStyle = ref({})

const fontSize    = ref('normal')
const lineSpacing = ref('normal')

const toggleState = reactive({
  letterSpacing: false,
  dyslexicFont:  false,
  linkHighlight: false,
  highContrast:  false,
  reducedMotion: false,
  readingMode:   false,
})

// ─── Computed ─────────────────────────────────────────────────────────────────

const anyActive = computed(() =>
  fontSize.value    !== 'normal' ||
  lineSpacing.value !== 'normal' ||
  Object.values(toggleState).some(Boolean)
)

// ─── Route watcher — reset reading mode on navigation ────────────────────────

const route = useRoute()
watch(() => route.path, () => {
  toggleState.readingMode = false
  applyReadingMode(false)
})

// ─── Apply functions (DOM → data attributes on <html>) ───────────────────────

function applyFont(size) {
  if (size === 'normal') {
    document.documentElement.removeAttribute('data-font-size')
  } else {
    document.documentElement.setAttribute('data-font-size', size)
  }
}

function applyLineSpacing(value) {
  if (value === 'normal') {
    document.documentElement.removeAttribute('data-line-spacing')
  } else {
    document.documentElement.setAttribute('data-line-spacing', value)
  }
}

function applyLetterSpacing(active) {
  if (active) {
    document.documentElement.setAttribute('data-letter-spacing', 'wide')
  } else {
    document.documentElement.removeAttribute('data-letter-spacing')
  }
}

function applyDyslexicFont(active) {
  // Font is declared via @font-face in style.css — browser downloads the
  // woff2 files only when this attribute is present on <html>.
  if (active) {
    document.documentElement.setAttribute('data-dyslexic-font', '')
  } else {
    document.documentElement.removeAttribute('data-dyslexic-font')
  }
}

function applyLinkHighlight(active) {
  if (active) {
    document.documentElement.setAttribute('data-link-highlight', '')
  } else {
    document.documentElement.removeAttribute('data-link-highlight')
  }
}

function applyHighContrast(active) {
  if (active) {
    document.documentElement.setAttribute('data-high-contrast', '')
  } else {
    document.documentElement.removeAttribute('data-high-contrast')
  }
}

function applyReducedMotion(active) {
  if (active) {
    document.documentElement.setAttribute('data-reduced-motion', '')
  } else {
    document.documentElement.removeAttribute('data-reduced-motion')
  }
}

function applyReadingMode(active) {
  if (active) {
    document.documentElement.setAttribute('data-reading-mode', '')
  } else {
    document.documentElement.removeAttribute('data-reading-mode')
  }
}

// ─── Setter functions (update state + LS + DOM) ───────────────────────────────

function setFont(value) {
  fontSize.value = value
  localStorage.setItem(LS_FONT, value)
  applyFont(value)
}

function setLineSpacing(value) {
  lineSpacing.value = value
  localStorage.setItem(LS_LINE, value)
  applyLineSpacing(value)
}

function flipToggle(key) {
  toggleState[key] = !toggleState[key]
  const v = toggleState[key]
  switch (key) {
    case 'letterSpacing': localStorage.setItem(LS_LETTER,    v ? '1' : '0'); applyLetterSpacing(v);  break
    case 'dyslexicFont':  localStorage.setItem(LS_DYSLEXIC,  v ? '1' : '0'); applyDyslexicFont(v);   break
    case 'linkHighlight': localStorage.setItem(LS_HIGHLIGHT, v ? '1' : '0'); applyLinkHighlight(v);  break
    case 'highContrast':  localStorage.setItem(LS_CONTRAST,  v ? '1' : '0'); applyHighContrast(v);   break
    case 'reducedMotion': localStorage.setItem(LS_MOTION,    v ? '1' : '0'); applyReducedMotion(v);  break
    case 'readingMode':   applyReadingMode(v); break  // session-only, no LS write
  }
}

function resetAll() {
  setFont('normal')
  setLineSpacing('normal')
  for (const key of Object.keys(toggleState)) {
    if (toggleState[key]) flipToggle(key)
  }
}

// ─── Panel position (fixed, below trigger button) ─────────────────────────────

function computePanelPosition() {
  if (!triggerRef.value) return
  const rect   = triggerRef.value.getBoundingClientRect()
  const vw     = window.innerWidth
  // Cap at viewport width minus 16px margin; min 260px for narrow viewports
  const panelW = Math.max(260, Math.min(320, vw - 16))
  let left     = rect.right - panelW          // right-align to trigger
  if (left < 8)               left = 8        // clamp to viewport left
  if (left + panelW > vw - 8) left = vw - panelW - 8  // clamp to viewport right
  panelStyle.value = {
    top:   `${rect.bottom + 6}px`,
    left:  `${left}px`,
    width: `${panelW}px`,
  }
}

function togglePanel() {
  if (open.value) {
    close()
  } else {
    computePanelPosition()
    open.value = true
    nextTick(() => panelRef.value?.focus())
  }
}

function close() {
  open.value = false
  triggerRef.value?.focus()   // return focus to trigger for keyboard users
}

// ─── External reading mode event (R key shortcut via KeyboardHelp) ────────────

function onToggleReadingEvent() {
  toggleState.readingMode = !toggleState.readingMode
  applyReadingMode(toggleState.readingMode)
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────

onMounted(() => {
  // Font size
  const savedFont = localStorage.getItem(LS_FONT)
  if (savedFont && FONT_STEPS.some(s => s.value === savedFont)) {
    fontSize.value = savedFont
    applyFont(savedFont)
  }

  // Line spacing
  const savedLine = localStorage.getItem(LS_LINE)
  if (savedLine && LINE_STEPS.some(s => s.value === savedLine)) {
    lineSpacing.value = savedLine
    applyLineSpacing(savedLine)
  }

  // Toggles (persistent)
  const restoreToggle = (lsKey, stateKey, applyFn) => {
    if (localStorage.getItem(lsKey) === '1') {
      toggleState[stateKey] = true
      applyFn(true)
    }
  }
  restoreToggle(LS_LETTER,    'letterSpacing', applyLetterSpacing)
  restoreToggle(LS_DYSLEXIC,  'dyslexicFont',  applyDyslexicFont)
  restoreToggle(LS_HIGHLIGHT, 'linkHighlight', applyLinkHighlight)
  restoreToggle(LS_CONTRAST,  'highContrast',  applyHighContrast)
  restoreToggle(LS_MOTION,    'reducedMotion', applyReducedMotion)

  // Remove the native browser tooltip from VitePress's dark mode button —
  // our custom CSS hint replaces it and the title causes a duplicate tooltip.
  document.querySelector('.VPSwitchAppearance')?.removeAttribute('title')

  window.addEventListener('toggle-reading-mode', onToggleReadingEvent)
})

onUnmounted(() => {
  window.removeEventListener('toggle-reading-mode', onToggleReadingEvent)
  document.documentElement.removeAttribute('data-reading-mode')
})
</script>

<style scoped>
/* ── Outer wrapper ── */
.a11y-controls {
  display:     flex;
  align-items: center;
  height:      100%;
}

/* ── Separator (matches VitePress native divider) ── */
.a11y-sep {
  width:        1px;
  height:       24px;
  background:   var(--vp-c-divider);
  margin-left:  16px;
  margin-right: 8px;
  flex-shrink:  0;
}

/* ── Trigger button ── */
.a11y-btn {
  position:        relative;
  display:         flex;
  align-items:     center;
  justify-content: center;
  width:           36px;
  height:          36px;
  border:          none;
  border-radius:   8px;
  background:      transparent;
  color:           var(--vp-c-text-2);
  cursor:          pointer;
  transition:      background 0.15s, color 0.15s;
  flex-shrink:     0;
  padding:         0;
}
.a11y-btn:hover            { background: var(--vp-c-bg-soft); color: var(--vp-c-text-1); }
.a11y-btn--active          { background: var(--vp-c-brand-soft); color: var(--vp-c-brand-1); }
.a11y-btn--active:hover    { background: var(--vp-c-brand-soft); color: var(--vp-c-brand-1); }
.a11y-btn:focus-visible    { outline: 2px solid var(--vp-c-brand); outline-offset: 2px; }

/* ── Hover hint tooltip ─────────────────────────────────────────────────────── */
.a11y-hint {
  position:       absolute;
  top:            calc(100% + 10px);
  left:           50%;
  transform:      translateX(-50%);
  padding:        0.4rem 0.7rem;
  background:     var(--vp-c-bg-elv);
  border:         1px solid var(--vp-c-divider);
  border-radius:  6px;
  box-shadow:     0 4px 16px rgba(0, 0, 0, 0.12);
  font-size:      0.76rem;
  font-weight:    500;
  white-space:    nowrap;
  color:          var(--vp-c-text-1);
  opacity:        0;
  visibility:     hidden;
  pointer-events: none;
  transition:     opacity 0.15s, visibility 0.15s;
  z-index:        9999;
}
/* Caret arrow */
.a11y-hint::before {
  content:     '';
  position:    absolute;
  top:         -5px;
  left:        50%;
  width:       8px;
  height:      8px;
  background:  var(--vp-c-bg-elv);
  border-top:  1px solid var(--vp-c-divider);
  border-left: 1px solid var(--vp-c-divider);
  transform:   translateX(-50%) rotate(45deg);
}
.a11y-btn:hover .a11y-hint,
.a11y-btn:focus-visible .a11y-hint {
  opacity:    1;
  visibility: visible;
}
/* Hide hint when the panel is already open */
.a11y-btn[aria-expanded="true"] .a11y-hint {
  opacity:    0 !important;
  visibility: hidden !important;
}
@media (max-width: 767px) {
  .a11y-hint { display: none; }
}

.a11y-font-icon {
  font-size:      0.85rem;
  font-weight:    700;
  font-family:    var(--vp-font-family-base, sans-serif);
  letter-spacing: -0.03em;
  line-height:    1;
  user-select:    none;
}

/* ── Active indicator dot ── */
.a11y-dot {
  position:       absolute;
  top:            5px;
  right:          5px;
  width:          6px;
  height:         6px;
  border-radius:  50%;
  background:     var(--vp-c-brand-1);
  pointer-events: none;
}

/* ── Backdrop (click-outside close, transparent) ── */
.a11y-backdrop {
  position:   fixed;
  inset:      0;
  z-index:    9199;
  background: transparent;
}

/* ── Panel ── */
.a11y-panel {
  position:      fixed;
  z-index:       9200;
  font-size:     16px;         /* anchor: immune to [data-font-size] scaling on <html> */
  background:    var(--vp-c-bg-elv);
  border:        1px solid var(--vp-c-divider);
  border-radius: 12px;
  box-shadow:    0 8px 32px rgba(0,0,0,.12), 0 2px 8px rgba(0,0,0,.06);
  overflow:      hidden;
  outline:       none;         /* receives programmatic focus; no visible ring needed */
}
.dark .a11y-panel {
  box-shadow: 0 8px 32px rgba(0,0,0,.42), 0 2px 8px rgba(0,0,0,.22);
}

/* ── Panel header row ── */
.a11y-panel-hdr {
  display:         flex;
  align-items:     center;
  justify-content: space-between;
  padding:         10px 14px 8px;
  border-bottom:   1px solid var(--vp-c-divider);
}
.a11y-panel-title {
  font-size:      0.72em;
  font-weight:    700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color:          var(--vp-c-text-2);
}
.a11y-reset-btn {
  font-size:     0.75em;
  font-weight:   500;
  color:         var(--vp-c-brand-1);
  background:    none;
  border:        none;
  cursor:        pointer;
  padding:       2px 7px;
  border-radius: 4px;
  transition:    background 0.12s;
}
.a11y-reset-btn:hover:not(:disabled) { background: var(--vp-c-brand-soft); }
.a11y-reset-btn:disabled             { color: var(--vp-c-text-3); cursor: default; }

/* ── Generic row ── */
.a11y-row {
  display:         flex;
  align-items:     center;
  justify-content: space-between;
  gap:             10px;
  padding:         8px 14px;
}
.a11y-row-label {
  font-size:   0.82em;
  color:       var(--vp-c-text-1);
  white-space: nowrap;
  flex-shrink: 0;
}

/* ── Segmented control ── */
.a11y-seg-group {
  display:       flex;
  gap:           2px;
  background:    var(--vp-c-bg-soft);
  border:        1px solid var(--vp-c-divider);
  border-radius: 6px;
  padding:       2px;
}
.a11y-seg-btn {
  font-size:     0.75em;
  font-weight:   500;
  padding:       3px 9px;
  border:        none;
  border-radius: 4px;
  background:    transparent;
  color:         var(--vp-c-text-2);
  cursor:        pointer;
  transition:    background 0.12s, color 0.12s;
  white-space:   nowrap;
}
.a11y-seg-btn:hover          { color: var(--vp-c-text-1); background: var(--vp-c-default-soft); }
.a11y-seg-btn--on            { background: var(--vp-c-bg-elv) !important; color: var(--vp-c-brand-1) !important;
                                font-weight: 600; box-shadow: 0 1px 3px rgba(0,0,0,.10); }
.a11y-seg-btn:focus-visible  { outline: 2px solid var(--vp-c-brand); outline-offset: 1px; }

/* ── Horizontal rule between segmented controls and toggles ── */
.a11y-rule {
  height:     1px;
  background: var(--vp-c-divider);
  margin:     2px 14px 2px;
}

/* ── Toggle row ── */
.a11y-row--toggle {
  padding-top:    6px;
  padding-bottom: 6px;
}

/* ── Toggle switch ── */
.a11y-toggle {
  background:  none;
  border:      none;
  padding:     0;
  cursor:      pointer;
  flex-shrink: 0;
}
.a11y-toggle-track {
  display:       block;
  position:      relative;
  width:         34px;
  height:        18px;
  border-radius: 9px;
  background:    var(--vp-c-default-3);
  transition:    background 0.18s;
}
.a11y-toggle--on .a11y-toggle-track {
  background: var(--vp-c-brand-1);
}
.a11y-toggle-thumb {
  position:      absolute;
  top:           2px;
  left:          2px;
  width:         14px;
  height:        14px;
  border-radius: 50%;
  background:    #fff;
  box-shadow:    0 1px 3px rgba(0,0,0,.2);
  transition:    transform 0.18s;
}
.a11y-toggle--on .a11y-toggle-thumb {
  transform: translateX(16px);
}
.a11y-toggle:focus-visible .a11y-toggle-track {
  outline:        2px solid var(--vp-c-brand);
  outline-offset: 2px;
}
</style>