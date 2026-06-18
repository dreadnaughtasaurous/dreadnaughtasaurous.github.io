<template>
  <ClientOnly>
    <div class="theme-switch-wrap">

      <!-- ── Trigger button ──
           Shows whichever icon matches the currently active mode, with a
           fade cross-transition when it changes (mirrors FMHY's
           ThemeDropdown.vue trigger). Native browser tooltip (title attr)
           shows the *current* mode name, same as FMHY's Appearance.vue. -->
      <button
        ref="triggerRef"
        class="theme-switch-btn"
        :aria-label="`Theme: ${modeLabel}. Click to change appearance`"
        :title="modeLabel"
        :aria-expanded="open"
        aria-haspopup="menu"
        @click="togglePanel"
      >
        <Transition name="fade" mode="out-in">
          <!-- Light = sun -->
          <svg v-if="themeMode === 'light'" key="light" class="theme-switch-trigger-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </svg>
          <!-- Dark = plain crescent moon -->
          <svg v-else-if="themeMode === 'dark'" key="dark" class="theme-switch-trigger-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
          </svg>
          <!-- AMOLED = crescent moon + sparkle stars -->
          <svg v-else key="amoled" class="theme-switch-trigger-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M18 12.5A7 7 0 1 1 10.5 5a5.5 5.5 0 0 0 7.5 7.5z" />
            <path d="M19 3v3M20.5 4.5h-3" />
            <path d="M5 16v2M6 17h-2" />
          </svg>
        </Transition>
      </button>

    </div>

    <Teleport to="body">

      <!-- ── Click-outside backdrop (transparent, same approach as AccessibilityControls) ── -->
      <div v-if="open" class="theme-switch-backdrop" @click="close" aria-hidden="true"></div>

      <!-- ── Dropdown panel ──
           Monochrome rows: every icon/label uses the default text colour.
           Only the active row picks up the EBA wiki's brand colour, via the
           [aria-checked="true"] CSS hook below — no per-option accent colours. -->
      <div
        v-if="open"
        ref="panelRef"
        class="theme-switch-panel"
        role="menu"
        aria-label="Theme"
        tabindex="-1"
        :style="panelStyle"
        @keydown.esc.stop="close"
      >

        <!-- Light -->
        <button
          class="theme-switch-option"
          role="menuitemradio"
          :aria-checked="themeMode === 'light'"
          @click="selectMode('light')"
        >
          <span class="theme-switch-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          </span>
          <span class="theme-switch-label">Light</span>
          <svg v-if="themeMode === 'light'" class="theme-switch-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </button>

        <!-- Dark -->
        <button
          class="theme-switch-option"
          role="menuitemradio"
          :aria-checked="themeMode === 'dark'"
          @click="selectMode('dark')"
        >
          <span class="theme-switch-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3a7 7 0 0 0 9.79 9.79z" />
            </svg>
          </span>
          <span class="theme-switch-label">Dark</span>
          <svg v-if="themeMode === 'dark'" class="theme-switch-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </button>

        <!-- AMOLED -->
        <button
          class="theme-switch-option"
          role="menuitemradio"
          :aria-checked="themeMode === 'amoled'"
          @click="selectMode('amoled')"
        >
          <span class="theme-switch-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M18 12.5A7 7 0 1 1 10.5 5a5.5 5.5 0 0 0 7.5 7.5z" />
              <path d="M19 3v3M20.5 4.5h-3" />
              <path d="M5 16v2M6 17h-2" />
            </svg>
          </span>
          <span class="theme-switch-label">AMOLED</span>
          <svg v-if="themeMode === 'amoled'" class="theme-switch-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </button>

      </div><!-- /panel -->

    </Teleport>
  </ClientOnly>
</template>

<script setup>
import { ref, computed, onMounted, nextTick } from 'vue'
import { useData } from 'vitepress'

// ─── VitePress's own dark-mode engine ──────────────────────────────────────
// isDark is the SAME ref VitePress's built-in switch uses internally.
// Writing to isDark.value automatically:
//   1. toggles the .dark class on <html>
//   2. writes 'dark' / 'light' to the 'vitepress-theme-appearance' localStorage key
// We deliberately reuse this instead of inventing our own dark/light
// mechanism, so every existing .dark CSS rule in the wiki keeps working
// unchanged, and VitePress's built-in anti-flash <head> script (which reads
// 'vitepress-theme-appearance' before paint) still prevents a light/dark flash.
const { isDark } = useData()

// ─── Our own state: which of the 3 menu items is selected ─────────────────
// 'light' and 'dark' map 1:1 onto isDark false/true.
// 'amoled' ALSO sets isDark = true (it is a dark-mode variant) plus an
// extra data-theme-amoled attribute that the AMOLED CSS override block
// in style.css uses to force pure-black backgrounds.
const LS_MODE = 'eba-theme-mode'   // 'light' | 'dark' | 'amoled'

const open       = ref(false)
const triggerRef = ref(null)
const panelRef   = ref(null)
const panelStyle = ref({})
const themeMode  = ref('light')

const modeLabel = computed(() => {
  if (themeMode.value === 'light')  return 'Light'
  if (themeMode.value === 'dark')   return 'Dark'
  return 'AMOLED'
})

// ─── Apply a mode to the DOM + VitePress's isDark ref ──────────────────────
// persist=false is used on initial mount, where the value just came FROM
// localStorage — re-writing it back would be a harmless no-op, but skipping
// it makes the intent clearer when reading this function later.
function applyMode(mode, persist = true) {
  themeMode.value = mode
  if (mode === 'light') {
    isDark.value = false
    document.documentElement.removeAttribute('data-theme-amoled')
  } else if (mode === 'dark') {
    isDark.value = true
    document.documentElement.removeAttribute('data-theme-amoled')
  } else {
    isDark.value = true
    document.documentElement.setAttribute('data-theme-amoled', '')
  }
  if (persist) localStorage.setItem(LS_MODE, mode)
}

function selectMode(mode) {
  applyMode(mode)
  close()
}

// ─── Panel position (fixed, below trigger button, RIGHT-aligned) ──────────
// Right-aligned to match AccessibilityControls.vue's own computePanelPosition
// (rect.right - panelW) — consistent with where this button sits near the
// right edge of the nav bar, and matches FMHY's own placement="bottom-end".
function computePanelPosition() {
  if (!triggerRef.value) return
  const rect   = triggerRef.value.getBoundingClientRect()
  const vw     = window.innerWidth
  const panelW = Math.max(180, Math.min(200, vw - 16))
  let left     = rect.right - panelW
  if (left < 8)               left = 8
  if (left + panelW > vw - 8) left = vw - panelW - 8
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

// ─── Restore saved mode on mount ───────────────────────────────────────────
// The inline <head> script added to config.js already set data-theme-amoled
// (if needed) before first paint, so there is no AMOLED flash. Here we just
// sync our Vue-side themeMode ref + isDark to match.
onMounted(() => {
  const saved = localStorage.getItem(LS_MODE)
  if (saved === 'light' || saved === 'dark' || saved === 'amoled') {
    applyMode(saved, false)
  } else {
    // First-time visitor — no EBA-specific preference saved yet.
    // Fall back to whatever VitePress's own toggle already decided
    // (system preference or its own localStorage key).
    themeMode.value = isDark.value ? 'dark' : 'light'
  }
})
</script>

<style scoped>
/* ── Outer wrapper — matches a11y-controls sizing so both sit flush in the nav bar ── */
.theme-switch-wrap {
  display:     flex;
  align-items: center;
  height:      100%;
}

/* ── Trigger button ── */
.theme-switch-btn {
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
.theme-switch-btn:hover         { background: var(--vp-c-bg-soft); color: var(--vp-c-text-1); }
.theme-switch-btn:focus-visible { outline: 2px solid var(--vp-c-brand); outline-offset: 2px; }

.theme-switch-trigger-icon {
  width:  20px;
  height: 20px;
}

/* ── Backdrop (click-outside close, transparent) ── */
.theme-switch-backdrop {
  position:   fixed;
  inset:      0;
  z-index:    9201;
  background: transparent;
}

/* ── Dropdown panel ── */
.theme-switch-panel {
  position:      fixed;
  z-index:       9202;
  font-size:     16px;
  padding:       4px;
  background:    var(--vp-c-bg-elv);
  border:        1px solid var(--vp-c-divider);
  border-radius: 10px;
  box-shadow:    0 8px 32px rgba(0,0,0,.12), 0 2px 8px rgba(0,0,0,.06);
  overflow:      hidden;
  outline:       none;
}
.dark .theme-switch-panel {
  box-shadow: 0 8px 32px rgba(0,0,0,.42), 0 2px 8px rgba(0,0,0,.22);
}

/* ── Option row — monochrome by default ── */
.theme-switch-option {
  display:         flex;
  align-items:     center;
  gap:             10px;
  width:           100%;
  padding:         8px 10px;
  border:          none;
  border-radius:   7px;
  background:      transparent;
  color:           var(--vp-c-text-1);
  font-size:       0.86em;
  font-weight:     500;
  text-align:      left;
  cursor:          pointer;
  transition:      background 0.12s, color 0.12s;
}
.theme-switch-option:hover         { background: var(--vp-c-bg-soft); }
.theme-switch-option:focus-visible { outline: 2px solid var(--vp-c-brand); outline-offset: -2px; }

/* Active row — the ONLY place colour is used, picked up from the EBA
   wiki's existing brand variable (same one RelatedClauses/etc. already use).
   Both the icon and the check inherit this via currentColor — no separate
   colour rules needed for them. */
.theme-switch-option[aria-checked="true"] {
  color: var(--vp-c-brand-1);
}

.theme-switch-icon {
  display:         flex;
  align-items:     center;
  justify-content: center;
  width:           18px;
  height:          18px;
  flex-shrink:     0;
}
.theme-switch-icon svg { width: 18px; height: 18px; }

.theme-switch-label {
  flex: 1;
}

.theme-switch-check {
  width:       16px;
  height:      16px;
  flex-shrink: 0;
}

/* ── Fade transition for the trigger icon (mirrors FMHY's ThemeDropdown.vue) ── */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.25s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>