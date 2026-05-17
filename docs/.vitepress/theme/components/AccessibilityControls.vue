<template>
  <ClientOnly>
    <div class="a11y-controls" aria-label="Accessibility controls">

      <!-- ── Separator (left edge — mirrors VitePress appearance + social-links divider) ── -->
      <div class="a11y-sep" aria-hidden="true"></div>

      <!-- ── Font size cycle button ── -->
      <button
        class="a11y-btn"
        :class="{ 'a11y-btn--active': fontSize !== 'normal' }"
        :aria-label="`Font size: ${fontSizeLabel}. Click to cycle.`"
        :title="`Font size: ${fontSizeLabel} — click to cycle`"
        @click="cycleFont"
      >
        <span class="a11y-font-icon" aria-hidden="true">Aa</span>
      </button>

      <!-- ── Reading mode toggle ── -->
      <button
        class="a11y-btn"
        :class="{ 'a11y-btn--active': readingMode }"
        :aria-label="readingMode ? 'Reading mode on — click to disable' : 'Reading mode off — click to enable (R)'"
        :title="readingMode ? 'Reading mode: ON — click to disable' : 'Reading mode: OFF — click to enable (R)'"
        @click="toggleReading"
      >
        <!-- Book-open icon -->
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/>
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>
        </svg>
      </button>

    </div>
  </ClientOnly>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useRoute } from 'vitepress'

// ─── Route watcher — reset reading mode on every navigation ──────────────────
const route = useRoute()
watch(() => route.path, () => {
  readingMode.value = false
  applyReadingMode(false)
})

// ─── Font size ────────────────────────────────────────────────────────────────
const FONT_STEPS  = ['normal', 'large', 'xl']
const LS_KEY_FONT = 'eba-font-size'

const fontSize = ref('normal')

const fontSizeLabel = computed(() => ({
  normal: 'Normal',
  large:  'Large',
  xl:     'Extra Large',
}[fontSize.value]))

function applyFont(size) {
  if (size === 'normal') {
    document.documentElement.removeAttribute('data-font-size')
  } else {
    document.documentElement.setAttribute('data-font-size', size)
  }
}

function cycleFont() {
  const currentIdx = FONT_STEPS.indexOf(fontSize.value)
  const nextIdx    = (currentIdx + 1) % FONT_STEPS.length
  fontSize.value   = FONT_STEPS[nextIdx]
  localStorage.setItem(LS_KEY_FONT, fontSize.value)
  applyFont(fontSize.value)
}

// ─── Reading mode ─────────────────────────────────────────────────────────────
const readingMode = ref(false)

function applyReadingMode(active) {
  if (active) {
    document.documentElement.setAttribute('data-reading-mode', '')
  } else {
    document.documentElement.removeAttribute('data-reading-mode')
  }
}

function toggleReading() {
  readingMode.value = !readingMode.value
  applyReadingMode(readingMode.value)
}

// ─── Keyboard shortcut — R key ────────────────────────────────────────────────
function onToggleReadingEvent() {
  toggleReading()
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(() => {
  const saved = localStorage.getItem(LS_KEY_FONT)
  if (saved && FONT_STEPS.includes(saved)) {
    fontSize.value = saved
    applyFont(saved)
  }
  window.addEventListener('toggle-reading-mode', onToggleReadingEvent)
})

onUnmounted(() => {
  window.removeEventListener('toggle-reading-mode', onToggleReadingEvent)
  document.documentElement.removeAttribute('data-reading-mode')
})
</script>

<style scoped>
/* ── Wrapper ── */
.a11y-controls {
  display: flex;
  align-items: center;
  gap: 0;
  height: 100%;
}

/* ── Separator ───────────────────────────────────────────────────────────────
   Matches VitePress's native ::before separator:
     height: 24px              — same as .appearance + .social-links::before
     background: divider token — same token
     margin-left: 16px         — confirmed visually via DevTools; matches the
                                  space VitePress uses between groups
     margin-right: 8px         — base margin-right from VitePress rule
   ──────────────────────────────────────────────────────────────────────────── */
.a11y-sep {
  width: 1px;
  height: 24px;
  background: var(--vp-c-divider);
  margin-left: 16px;
  margin-right: 8px;
  flex-shrink: 0;
}

/* ── Shared button shell ── */
.a11y-btn {
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

.a11y-btn:hover {
  background: var(--vp-c-bg-soft);
  color:      var(--vp-c-text-1);
}

.a11y-btn--active {
  background: var(--vp-c-brand-soft);
  color:      var(--vp-c-brand-1);
}

.a11y-btn--active:hover {
  background: var(--vp-c-brand-soft);
  color:      var(--vp-c-brand-1);
}

.a11y-btn:focus-visible {
  outline:        2px solid var(--vp-c-brand);
  outline-offset: 2px;
}

/* ── Font size button text label ── */
.a11y-font-icon {
  font-size:      0.85rem;
  font-weight:    700;
  font-family:    var(--vp-font-family-base, sans-serif);
  letter-spacing: -0.03em;
  line-height:    1;
  user-select:    none;
}
</style>