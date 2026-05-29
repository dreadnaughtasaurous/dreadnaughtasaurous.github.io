<template>
  <ClientOnly>
    <div class="sf-wrap">

      <div class="sf-input-row" :class="{ 'sf-input-row--active': query.length > 0 }">
        <svg class="sf-icon" width="13" height="13" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
        </svg>
        <input
          ref="inputRef"
          v-model="query"
          class="sf-input"
          type="text"
          placeholder="Filter clauses…"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          aria-label="Filter sidebar navigation"
          @input="onInput"
          @keydown.escape.prevent="clearFilter"
        />
        <button
          v-if="query.length > 0"
          class="sf-clear"
          @click="clearFilter"
          aria-label="Clear filter"
          tabindex="-1"
        >
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2.5"
               stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M18 6 6 18M6 6l12 12"/>
          </svg>
        </button>
        <kbd v-else class="sf-kbd-hint">F</kbd>
      </div>

      <div v-if="query.length > 0" class="sf-status">
        <span v-if="matchCount > 0" class="sf-status-count">
          {{ matchCount }} match{{ matchCount === 1 ? '' : 'es' }}
        </span>
        <span v-else class="sf-status-none">No matches</span>
      </div>

    </div>
  </ClientOnly>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from 'vue'

const query      = ref('')
const inputRef   = ref(null)
const matchCount = ref(0)

// ── Core approach ─────────────────────────────────────────────────────────────
// Rather than manipulating collapsed/expanded state (which fights VitePress
// CSS transitions), we use a single CSS class 'sf-active' on the nav element
// itself to switch into "filter mode". In filter mode:
//   - All .group divs are hidden by default (via CSS: .sf-active .group)
//   - Only groups that have the class 'sf-match' are shown
//   - Inside a matching group, all .VPSidebarItem.level-2 are hidden by default
//   - Only those with class 'sf-match' are shown
//   - All .VPSidebarItem.level-1 section headers are shown always (they act
//     as group labels for the visible clauses beneath them)
// This approach never touches .collapsed — no animation conflicts.

function getSidebarNav() {
  return document.querySelector('.VPSidebar .nav')
}

function onInput() {
  nextTick(() => applyFilter())
}

function applyFilter() {
  const q   = query.value.trim().toLowerCase()
  const nav = getSidebarNav()
  if (!nav) return

  // Always clear previous filter state first
  clearFilterClasses(nav)

  if (!q) {
    matchCount.value = 0
    return
  }

  // Enter filter mode — CSS takes over default visibility
  nav.classList.add('sf-active')

  let matches = 0

  // For each top-level EBA group
  const groups = Array.from(nav.querySelectorAll('.group'))
  groups.forEach(group => {

    // Find all leaf <a> links in this group (clause pages, not section indexes)
    const leaves = Array.from(group.querySelectorAll('a')).filter(a => {
      const parts = (a.getAttribute('href') || '').split('/').filter(Boolean)
      return parts[0] === 'ebas' && parts.length >= 4
    })

    // Find which leaves match
    const matchingLeaves = leaves.filter(a =>
      a.textContent.trim().toLowerCase().includes(q)
    )

    if (matchingLeaves.length === 0) return // group stays hidden (no sf-match)

    // Mark this group visible
    group.classList.add('sf-match')
    matches += matchingLeaves.length

    // Mark each matching leaf's .VPSidebarItem.level-2 wrapper as visible.
    // Also mark its level-1 parent section so only sections with matches show.
    matchingLeaves.forEach(a => {
      // Find the immediate VPSidebarItem wrapper (level-2 for standard EBAs,
      // level-3 for nested EBAs like has-managers-admin and mental-health)
      const leafItem = a.closest('.VPSidebarItem.level-3')
                    ?? a.closest('.VPSidebarItem.level-2')
                    ?? a.closest('.VPSidebarItem')
      if (!leafItem) return
      leafItem.classList.add('sf-match')

      // Mark all ancestor VPSidebarItem levels so their sections stay visible
      let el = leafItem.parentElement
      while (el && el !== group) {
        if (el.classList.contains('VPSidebarItem')) el.classList.add('sf-match')
        el = el.parentElement
      }

      // Highlight the matching portion of the clause title text
      const textEl = a.querySelector('.text')
      if (textEl && !textEl.querySelector('mark')) {
        const original = textEl.textContent
        const lower    = original.toLowerCase()
        const idx      = lower.indexOf(q)
        if (idx !== -1) {
          textEl.innerHTML =
            escapeHtml(original.slice(0, idx)) +
            '<mark class="sf-highlight">' +
            escapeHtml(original.slice(idx, idx + q.length)) +
            '</mark>' +
            escapeHtml(original.slice(idx + q.length))
        }
      }
    })
  })

  matchCount.value = matches
}

function escapeHtml(s) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function clearFilterClasses(nav) {
  if (!nav) return
  nav.classList.remove('sf-active')
  nav.querySelectorAll('.sf-match').forEach(el => el.classList.remove('sf-match'))
  // Restore any highlighted text nodes to their original plain text
  nav.querySelectorAll('mark.sf-highlight').forEach(mark => {
    const parent = mark.parentNode
    if (parent) {
      parent.replaceChild(document.createTextNode(mark.textContent), mark)
      parent.normalize()
    }
  })
}

function clearFilter() {
  query.value = ''
  matchCount.value = 0
  clearFilterClasses(getSidebarNav())
  inputRef.value?.blur()
}

// ── F key shortcut ────────────────────────────────────────────────────────────
function isTyping() {
  const el = document.activeElement
  if (!el) return false
  const tag = el.tagName.toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if (el.isContentEditable) return true
  if (el.closest('.search-modal-overlay')) return true
  if (el.closest('.kb-overlay')) return true
  return false
}

function onGlobalKeydown(e) {
  if (
    e.code === 'KeyF' &&
    !e.ctrlKey && !e.metaKey && !e.altKey && !e.shiftKey &&
    !isTyping()
  ) {
    e.preventDefault()
    inputRef.value?.focus()
    inputRef.value?.select()
  }
}

onMounted(() => window.addEventListener('keydown', onGlobalKeydown))
onUnmounted(() => {
  clearFilterClasses(getSidebarNav())
  window.removeEventListener('keydown', onGlobalKeydown)
})
</script>

<style scoped>
.sf-wrap {
  padding: 16px 0px 10px 0px;
}

.sf-input-row {
  display: flex;
  align-items: center;
  width: 100%;
  box-sizing: border-box;
  height: 34px;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  padding: 0 8px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}

.sf-input-row:focus-within,
.sf-input-row--active {
  border-color: var(--vp-c-brand-1);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--vp-c-brand-1) 15%, transparent);
}

.sf-icon {
  color: var(--vp-c-text-3);
  flex-shrink: 0;
  margin-right: 6px;
}

.sf-input {
  flex: 1;
  min-width: 0;
  border: none;
  outline: none;
  background: transparent;
  font-size: 0.8rem;
  font-family: var(--vp-font-family-base);
  color: var(--vp-c-text-1);
  line-height: 1;
}

.sf-input::placeholder {
  color: var(--vp-c-text-3);
}

.sf-clear {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  border: none;
  background: var(--vp-c-bg-muted);
  border-radius: 50%;
  color: var(--vp-c-text-2);
  cursor: pointer;
  padding: 0;
  margin-left: 4px;
  transition: background 0.1s ease, color 0.1s ease;
}

.sf-clear:hover {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}

.sf-kbd-hint {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-left: 4px;
  font-family: var(--vp-font-family-mono, ui-monospace, monospace);
  font-size: 0.65rem;
  font-weight: 600;
  color: var(--vp-c-text-3);
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-bottom: 2px solid var(--vp-c-divider);
  border-radius: 4px;
  padding: 0 0.3rem;
  line-height: 1.6;
  opacity: 0.7;
}

.sf-status {
  margin-top: 5px;
  padding: 0 2px;
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

.sf-status-count { color: var(--vp-c-brand-1); }
.sf-status-none  { color: var(--vp-c-text-3); }
</style>