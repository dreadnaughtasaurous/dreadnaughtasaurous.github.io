<template>
  <Teleport to="body">
    <Transition name="kb-help">
      <div
        v-if="open"
        class="kb-overlay"
        @click.self="close"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
      >
        <div class="kb-modal" ref="modalRef" tabindex="-1">

          <!-- Header -->
          <div class="kb-header">
            <div class="kb-title">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <rect x="2" y="4" width="20" height="16" rx="2"/>
                <path d="M6 8h.01M10 8h.01M14 8h.01M18 8h.01M8 12h.01M12 12h.01M16 12h.01M7 16h10"/>
              </svg>
              Keyboard shortcuts
            </div>
            <button class="kb-close" @click="close" aria-label="Close keyboard shortcuts">
              <kbd>Esc</kbd>
            </button>
          </div>

          <!-- Tab strip -->
          <div class="kb-tabs" role="tablist">
            <button
              v-for="tab in TABS"
              :key="tab.id"
              role="tab"
              :aria-selected="activeTab === tab.id"
              class="kb-tab"
              :class="{ 'kb-tab--active': activeTab === tab.id }"
              @click="activeTab = tab.id"
            >{{ tab.label }}</button>
          </div>

          <!-- Tab body -->
          <div class="kb-body">

            <!-- ── NAVIGATION tab ── -->
            <template v-if="activeTab === 'navigation'">
              <div class="kb-section">
                <div class="kb-section-label">Search &amp; Ask AI</div>
                <div class="kb-row">
                  <span class="kb-desc">Open search modal</span>
                  <span class="kb-keys"><kbd>/</kbd></span>
                </div>
                <div class="kb-row">
                  <span class="kb-desc">Open Ask AI panel</span>
                  <span class="kb-keys">
                    <kbd>Ctrl</kbd><span class="kb-plus">+</span><kbd>K</kbd>
                  </span>
                </div>
                <div class="kb-row">
                  <span class="kb-desc">Close / dismiss overlay</span>
                  <span class="kb-keys"><kbd>Esc</kbd></span>
                </div>
                <div class="kb-row">
                  <span class="kb-desc">Move through results</span>
                  <span class="kb-keys"><kbd>↑</kbd><kbd>↓</kbd></span>
                </div>
                <div class="kb-row">
                  <span class="kb-desc">Open result</span>
                  <span class="kb-keys"><kbd>Enter</kbd></span>
                </div>
              </div>
              <div class="kb-section">
                <div class="kb-section-label">Sidebar filter</div>
                <div class="kb-row">
                  <span class="kb-desc">Focus sidebar clause filter</span>
                  <span class="kb-keys"><kbd>F</kbd></span>
                </div>
                <div class="kb-row">
                  <span class="kb-desc">Clear filter and return focus</span>
                  <span class="kb-keys"><kbd>Esc</kbd></span>
                </div>
                <div class="kb-row">
                  <span class="kb-desc">Move through filter results</span>
                  <span class="kb-keys"><kbd>↑</kbd><kbd>↓</kbd></span>
                </div>
              </div>
              <div class="kb-section">
                <div class="kb-section-label">Browser</div>
                <div class="kb-row">
                  <span class="kb-desc">Navigate back</span>
                  <span class="kb-keys"><kbd>Alt</kbd><span class="kb-plus">+</span><kbd>←</kbd></span>
                </div>
                <div class="kb-row">
                  <span class="kb-desc">Navigate forward</span>
                  <span class="kb-keys"><kbd>Alt</kbd><span class="kb-plus">+</span><kbd>→</kbd></span>
                </div>
                <div class="kb-row">
                  <span class="kb-desc">Jump to top / bottom</span>
                  <span class="kb-keys"><kbd>Home</kbd><kbd>End</kbd></span>
                </div>
              </div>
              <div class="kb-section">
                <div class="kb-section-label">General</div>
                <div class="kb-row">
                  <span class="kb-desc">Show this help overlay</span>
                  <span class="kb-keys"><kbd>?</kbd></span>
                </div>
                <div class="kb-row">
                  <span class="kb-desc">Toggle reading mode</span>
                  <span class="kb-keys"><kbd>R</kbd></span>
                </div>
                <div class="kb-row">
                  <span class="kb-desc">Open command palette</span>
                  <span class="kb-keys"><kbd>></kbd></span>
                </div>
              </div>
            </template>

            <!-- ── SEARCH tab ── -->
            <template v-else-if="activeTab === 'search'">
              <div class="kb-section">
                <div class="kb-section-label">Advanced search operators</div>
                <div class="kb-row">
                  <span class="kb-desc">Filter to an EBA</span>
                  <span class="kb-keys"><kbd>eba:nurses</kbd></span>
                </div>
                <div class="kb-row">
                  <span class="kb-desc">Filter by topic</span>
                  <span class="kb-keys"><kbd>topic:overtime</kbd></span>
                </div>
                <div class="kb-row">
                  <span class="kb-desc">Jump to clause</span>
                  <span class="kb-keys"><kbd>clause:42</kbd></span>
                </div>
                <div class="kb-row">
                  <span class="kb-desc">Exclude a word from results</span>
                  <span class="kb-keys"><kbd>-casual</kbd></span>
                </div>
                <div class="kb-row">
                  <span class="kb-desc">Combine freely</span>
                  <span class="kb-keys"><kbd>eba:has topic:leave -casual</kbd></span>
                </div>
              </div>
            </template>

            <!-- ── EBA FILTERS tab ── -->
            <template v-else-if="activeTab === 'eba'">
              <div class="kb-section">
                <div class="kb-section-label">Shift + F-key — applies EBA filter (toggle)</div>
                <div
                  v-for="item in EBA_SHORTCUTS"
                  :key="item.num"
                  class="kb-row"
                >
                  <span class="kb-desc">{{ item.label }}</span>
                  <span class="kb-keys">
                    <kbd>Shift</kbd><span class="kb-plus">+</span><kbd>F{{ item.num }}</kbd>
                  </span>
                </div>
              </div>
              <p class="kb-eba-note">Press the same shortcut again to clear the filter. Works on both the Search tab and all Ask AI modes. Can be pressed immediately after opening the modal — no need to move focus first.</p>
            </template>

            <!-- ── ACCESSIBILITY tab ── -->
            <template v-else-if="activeTab === 'accessibility'">
              <div class="kb-section">
                <div class="kb-section-label">Display</div>
                <div class="kb-row">
                  <span class="kb-desc">Toggle reading mode (hides navigation)</span>
                  <span class="kb-keys"><kbd>R</kbd></span>
                </div>
                <div class="kb-row">
                  <span class="kb-desc">Cycle font size (normal → large → XL)</span>
                  <span class="kb-keys">Aa button in nav</span>
                </div>
              </div>
              <div class="kb-section">
                <div class="kb-section-label">Overlays</div>
                <div class="kb-row">
                  <span class="kb-desc">Show keyboard shortcuts</span>
                  <span class="kb-keys"><kbd>?</kbd></span>
                </div>
                <div class="kb-row">
                  <span class="kb-desc">Open command palette</span>
                  <span class="kb-keys"><kbd>></kbd></span>
                </div>
                <div class="kb-row">
                  <span class="kb-desc">Close any overlay</span>
                  <span class="kb-keys"><kbd>Esc</kbd></span>
                </div>
              </div>
            </template>

          </div><!-- /kb-body -->

          <div class="kb-footer">
            Press <kbd>Esc</kbd> or click outside to close
          </div>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'

const open     = ref(false)
const modalRef = ref(null)
const activeTab = ref('navigation')

const TABS = [
  { id: 'navigation',   label: 'Navigation'   },
  { id: 'search',       label: 'Search'       },
  { id: 'eba',          label: 'EBA Filters'  },
  { id: 'accessibility',label: 'Accessibility'},
]

// EBA shortcut data — order matches ebaList in SearchModal.vue exactly.
// Short label used for the coloured pill; full label used for the description column.
const EBA_SHORTCUTS = [
  { num: 1, short: 'Allied Health',       label: 'Allied Health Professionals 2021–2026',       color: '#EA580C', bg: '#EA580C1A' },
  { num: 2, short: 'Biomedical Eng.',     label: 'Biomedical Engineers 2025–2028',               color: '#4F46E5', bg: '#4F46E51A' },
  { num: 3, short: "Children's Services", label: "Children's Services Award 2010",               color: '#DB2777', bg: '#DB27771A' },
  { num: 4, short: 'Doctors in Training', label: 'Doctors in Training 2022–2026',                color: '#D97706', bg: '#D977061A' },
  { num: 5, short: 'HAS Managers',        label: 'Health Allied & Managers Admin 2021–2025',     color: '#3B82F6', bg: '#3B82F61A' },
  { num: 6, short: 'Med. Specialists',    label: 'Medical Specialists 2022–2026',                color: '#0891B2', bg: '#0891B21A' },
  { num: 7, short: 'Mental Health',       label: 'Mental Health Services 2024–2028',             color: '#7C3AED', bg: '#7C3AED1A' },
  { num: 8, short: 'Med. Scientists',     label: 'Medical Scientists, Pharm & Psych 2021–2025', color: '#059669', bg: '#0596691A' },
  { num: 9, short: 'Nurses & Midwives',   label: 'Nurses and Midwives 2024–2028',                color: '#E11D48', bg: '#E11D481A' },
]

function isTyping() {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if (el.isContentEditable) return true
  if (el.closest('.search-modal')) return true
  return false
}

function onKeydown(e) {
  // Open on '?' — never when the user is typing
  if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping()) {
    e.preventDefault()
    open.value = true
    activeTab.value = 'navigation'   // always open to Navigation tab
    nextTick(() => modalRef.value?.focus())
    return
  }

  // Toggle reading mode on 'R'
  if (
    e.key === 'r' &&
    !e.ctrlKey && !e.metaKey && !e.altKey &&
    !isTyping() &&
    !open.value
  ) {
    e.preventDefault()
    window.dispatchEvent(new CustomEvent('toggle-reading-mode'))
    return
  }

  if (e.key === 'Escape' && open.value) {
    close()
  }
}

function close() {
  open.value = false
}

function openFromEvent() {
  open.value = true
  activeTab.value = 'navigation'
  nextTick(() => modalRef.value?.focus())
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('open-keyboard-help', openFromEvent)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('open-keyboard-help', openFromEvent)
})
</script>

<style scoped>
/* ── Overlay ── */
.kb-overlay {
  position: fixed; inset: 0; z-index: 10000;
  background: oklch(0 0 0 / 0.55);
  display: flex; align-items: center; justify-content: center;
  padding: 1.5rem;
}

/* ── Modal ── */
.kb-modal {
  width: min(560px, calc(100vw - 3rem));
  max-height: min(600px, calc(100vh - 6rem));
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  box-shadow: 0 24px 64px oklch(0 0 0 / 0.3);
  display: flex; flex-direction: column;
  overflow: hidden;
  outline: none;
}

/* ── Header ── */
.kb-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--vp-c-divider);
  flex-shrink: 0;
}
.kb-title {
  display: flex; align-items: center; gap: 0.5rem;
  font-size: 0.9rem; font-weight: 700; color: var(--vp-c-text-1);
}
.kb-close {
  background: none; border: 1px solid var(--vp-c-divider);
  border-radius: 4px; padding: 0.125rem 0.4rem;
  font-size: 0.75rem; color: var(--vp-c-text-3); cursor: pointer;
}
.kb-close:hover { color: var(--vp-c-text-1); }

/* ── Tab strip ── */
.kb-tabs {
  display: flex; flex-shrink: 0;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  overflow-x: auto;           /* allows horizontal scroll on very narrow screens */
  scrollbar-width: none;
}
.kb-tabs::-webkit-scrollbar { display: none; }
.kb-tab {
  flex: 1; min-width: max-content;
  padding: 0.5rem 0.75rem;
  font-size: 0.78rem; font-weight: 500;
  color: var(--vp-c-text-2);
  background: none; border: none; border-bottom: 2px solid transparent;
  cursor: pointer; transition: color 0.12s, border-color 0.12s;
  white-space: nowrap;
}
.kb-tab:hover { color: var(--vp-c-text-1); }
.kb-tab--active {
  color: var(--vp-c-brand-1);
  border-bottom-color: var(--vp-c-brand-1);
  font-weight: 600;
}

/* ── Body ── */
.kb-body {
  flex: 1; overflow-y: auto;
  padding: 0.75rem 1rem;
  display: flex; flex-direction: column; gap: 0.25rem;
}

/* ── Section ── */
.kb-section { margin-bottom: 1rem; }
.kb-section-label {
  font-size: 0.7rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.07em;
  color: var(--vp-c-text-3);
  padding: 0.35rem 0 0.4rem;
  border-bottom: 1px solid var(--vp-c-divider);
  margin-bottom: 0.5rem;
}

/* ── Row ── */
.kb-row {
  display: flex; align-items: center; justify-content: space-between;
  padding: 0.35rem 0.25rem;
  border-radius: 6px;
  transition: background 0.12s;
}
.kb-row:hover { background: var(--vp-c-bg-soft); }
.kb-desc {
  font-size: 0.85rem; color: var(--vp-c-text-2);
  flex: 1;
}

.kb-eba-note {
  font-size: 0.78rem; color: var(--vp-c-text-3);
  margin: 0.25rem 0.25rem 0;
  line-height: 1.5;
}

/* ── Key chips ── */
.kb-keys {
  display: flex; align-items: center; gap: 0.25rem; flex-shrink: 0;
}
.kb-keys kbd {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 1.75rem; height: 1.75rem; padding: 0 0.4rem;
  font-family: var(--vp-font-family-mono, ui-monospace, monospace);
  font-size: 0.75rem; font-weight: 600;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-bottom: 2px solid var(--vp-c-divider);
  border-radius: 5px;
  box-shadow: 0 1px 0 var(--vp-c-divider);
  line-height: 1;
  white-space: nowrap;
}
.kb-plus {
  font-size: 0.7rem; color: var(--vp-c-text-3); padding: 0 0.1rem;
}

/* Wide kbd chips for operator syntax examples (Search tab) */
.kb-keys kbd:only-child {
  min-width: unset;
  font-size: 0.68rem;
  padding: 0.1rem 0.5rem;
}

/* ── Footer ── */
.kb-footer {
  padding: 0.6rem 1rem;
  border-top: 1px solid var(--vp-c-divider);
  font-size: 0.75rem; color: var(--vp-c-text-3);
  background: var(--vp-c-bg-soft);
  text-align: center;
  flex-shrink: 0;
}
.kb-footer kbd {
  font-family: var(--vp-font-family-mono, ui-monospace, monospace);
  font-size: 0.72rem; font-weight: 600;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-bottom: 2px solid var(--vp-c-divider);
  border-radius: 4px;
  padding: 0.05rem 0.35rem;
}

/* ── Transition ── */
.kb-help-enter-active,
.kb-help-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.kb-help-enter-from,
.kb-help-leave-to { opacity: 0; transform: scale(0.97); }
</style>
