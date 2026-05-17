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
        <div class="kb-modal" ref="modalRef">

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

          <div class="kb-body">

            <div class="kb-section">
              <div class="kb-section-label">Search</div>
              <div class="kb-row">
                <span class="kb-desc">Open search</span>
                <span class="kb-keys">
                  <kbd>Ctrl</kbd><span class="kb-plus">+</span><kbd>K</kbd>
                </span>
              </div>
              <div class="kb-row">
                <span class="kb-desc">Open search</span>
                <span class="kb-keys"><kbd>/</kbd></span>
              </div>
              <div class="kb-row">
                <span class="kb-desc">Close search</span>
                <span class="kb-keys"><kbd>Esc</kbd></span>
              </div>
              <div class="kb-row">
                <span class="kb-desc">Navigate results</span>
                <span class="kb-keys">
                  <kbd>↑</kbd><kbd>↓</kbd>
                </span>
              </div>
              <div class="kb-row">
                <span class="kb-desc">Open highlighted result</span>
                <span class="kb-keys"><kbd>Enter</kbd></span>
              </div>
            </div>

            <div class="kb-section">
              <div class="kb-section-label">Navigation</div>
              <div class="kb-row">
                <span class="kb-desc">Go to previous page</span>
                <span class="kb-keys">
                  <kbd>Alt</kbd><span class="kb-plus">+</span><kbd>←</kbd>
                </span>
              </div>
              <div class="kb-row">
                <span class="kb-desc">Go to next page</span>
                <span class="kb-keys">
                  <kbd>Alt</kbd><span class="kb-plus">+</span><kbd>→</kbd>
                </span>
              </div>
              <div class="kb-row">
                <span class="kb-desc">Scroll to top</span>
                <span class="kb-keys"><kbd>Home</kbd></span>
              </div>
              <div class="kb-row">
                <span class="kb-desc">Scroll to bottom</span>
                <span class="kb-keys"><kbd>End</kbd></span>
              </div>
            </div>

            <!-- ── Accessibility section — new ── -->
            <div class="kb-section">
              <div class="kb-section-label">Accessibility</div>
              <div class="kb-row">
                <span class="kb-desc">Toggle reading mode (current page)</span>
                <span class="kb-keys"><kbd>R</kbd></span>
              </div>
            </div>

            <div class="kb-section">
              <div class="kb-section-label">General</div>
              <div class="kb-row">
                <span class="kb-desc">Show this help overlay</span>
                <span class="kb-keys"><kbd>?</kbd></span>
              </div>
              <div class="kb-row">
                <span class="kb-desc">Dismiss any overlay</span>
                <span class="kb-keys"><kbd>Esc</kbd></span>
              </div>
            </div>

          </div>

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

const open    = ref(false)
const modalRef = ref(null)

function isTyping() {
  const el  = document.activeElement
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if (el.isContentEditable) return true
  // Also guard against the SearchModal input and Ask AI input
  if (el.closest('.search-modal')) return true
  return false
}

function onKeydown(e) {
  // Open on '?' — never when the user is typing anywhere
  if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey && !isTyping()) {
    e.preventDefault()
    open.value = true
    nextTick(() => modalRef.value?.focus())
    return
  }

  // Toggle reading mode on 'R' — never when typing, never when this overlay is open
  // (Esc should close the overlay, not also fire R accidentally)
  if (
    e.key === 'r' &&
    !e.ctrlKey && !e.metaKey && !e.altKey &&
    !isTyping() &&
    !open.value
  ) {
    e.preventDefault()
    // Dispatch a custom event. AccessibilityControls.vue listens for this
    // so the toggle logic stays in one place and avoids duplication.
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

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
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
  width: min(520px, calc(100vw - 3rem));
  max-height: calc(100vh - 6rem);
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

/* ── Footer ── */
.kb-footer {
  padding: 0.6rem 1rem;
  border-top: 1px solid var(--vp-c-divider);
  font-size: 0.75rem; color: var(--vp-c-text-3);
  background: var(--vp-c-bg-soft);
  text-align: center;
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