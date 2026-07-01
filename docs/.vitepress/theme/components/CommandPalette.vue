<script setup>
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vitepress'

const route  = useRoute()
const router = useRouter()

// ── State ──────────────────────────────────────────────────────────────────
const open     = ref(false)
const query    = ref('')
const selected = ref(0)
const inputRef = ref(null)
const listRef  = ref(null)

// ── Constants ──────────────────────────────────────────────────────────────
const RECENT_KEY = 'eba-cmd-recent'
const MAX_RECENT = 5

const EBA_LIST = [
  { label: 'Allied Health Professionals 2021–2026',                     slug: 'allied-health',        filter: 'Allied Health Professionals 2021-2026'       },
  { label: 'Biomedical Engineers 2025–2028',                            slug: 'biomedical-engineers',  filter: 'Biomedical Engineers 2025-2028'              },
  { label: "Children's Services Award 2010",                            slug: 'childrens-services',    filter: "Children's Services Award 2010"              },
  { label: 'Doctors in Training 2022–2026',                             slug: 'doctors-in-training',   filter: 'Doctors in Training 2022-2026'               },
  { label: 'Health Allied Services, Managers & Admin 2025–2027',        slug: 'has-managers-admin',              filter: 'Health Allied & Managers Admin 2025-2027' },
  { label: 'Health Allied Services, Managers & Admin 2021–2025 (Archived)', slug: 'has-managers-admin-2021-2025', filter: 'Health Allied & Managers Admin 2021-2025' },
  { label: 'Medical Scientists, Pharmacists & Psychologists 2021–2025', slug: 'medical-scientists',    filter: 'Medical Scientists, Pharm & Psych 2021-2025' },
  { label: 'Medical Specialists 2022–2026',                             slug: 'medical-specialists',   filter: 'Medical Specialists 2022-2026'               },
  { label: 'Mental Health Services 2024–2028',                          slug: 'mental-health',         filter: 'Mental Health Services 2024-2028'            },
  { label: 'Nurses and Midwives 2024–2028',                             slug: 'nurses-midwives',       filter: 'Nurses and Midwives 2024-2028'               },
]

// ── Route helpers ──────────────────────────────────────────────────────────
// Clause pages: /ebas/<eba>/<section>/<clause> (parts.length >= 5)
// Used to conditionally show the "Ask AI about this page" command.
const isClausePage = computed(() => {
  const p = route.path.replace(/\.html$/, '').replace(/\/$/, '').split('/').filter(Boolean)
  return p.length >= 5 && p[0] === 'ebas'
})

// ── localStorage helpers ──────────────────────────────────────────────────
function loadRecent() {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]') } catch { return [] }
}
function saveRecent(id) {
  const r = [id, ...loadRecent().filter(x => x !== id)].slice(0, MAX_RECENT)
  localStorage.setItem(RECENT_KEY, JSON.stringify(r))
}

// ── Event / action helpers ─────────────────────────────────────────────────
function emit(event, detail = {}) {
  window.dispatchEvent(new CustomEvent(event, { detail }))
}
function openSearch(tab = 'search', extra = {}) {
  emit('open-search', { tab, ...extra })
}

function toggleFontSize() {
  const cur  = document.documentElement.getAttribute('data-font-size') || 'normal'
  const next = cur === 'normal' ? 'large' : cur === 'large' ? 'xl' : 'normal'
  document.documentElement.setAttribute('data-font-size', next)
  localStorage.setItem('eba-font-size', next)
}

function toggleDarkMode() {
  const dark = document.documentElement.classList.contains('dark')
  document.documentElement.classList.toggle('dark', !dark)
  localStorage.setItem('vitepress-theme-appearance', dark ? 'light' : 'dark')
}

// ── Command definitions ────────────────────────────────────────────────────
const allCommands = computed(() => {
  const cmds = []

  // Only visible when on a clause page — uses the AskThisPage button directly
  // so the full questionPrompt + contentHash flow fires as normal.
  if (isClausePage.value) {
    cmds.push({
      id: 'ask-this-page', label: 'Ask AI about this page', cat: 'AI', icon: '✦',
      action: () => {
        const btn = document.querySelector('[data-tour="ask-this-page-btn"]')
        btn ? btn.click() : openSearch('ask')
      },
    })
  }

  cmds.push(
    { id: 'open-ask-ai',         label: 'Open Ask AI',         cat: 'AI',            icon: '✦',  action: () => openSearch('ask')                     },
    { id: 'open-search',         label: 'Open Search',         cat: 'Navigation',    icon: '⌕',  kbd: 'Ctrl+K', action: () => openSearch('search')    },
    { id: 'go-pay-rates',        label: 'Go to Pay Rates',     cat: 'Navigation',    icon: '⌕',  action: () => router.go('/pay-rates/')                },
    { id: 'open-keyboard-help',  label: 'Open keyboard help',  cat: 'Help',          icon: '⌨',  kbd: '?',      action: () => emit('open-keyboard-help') },
    { id: 'toggle-reading-mode', label: 'Toggle reading mode', cat: 'Accessibility', icon: '◧',  kbd: 'R',      action: () => emit('toggle-reading-mode') },
    { id: 'toggle-font-size',    label: 'Toggle font size',    cat: 'Accessibility', icon: 'A⁺', action: toggleFontSize                               },
    { id: 'toggle-dark-mode',    label: 'Toggle dark mode',    cat: 'Accessibility', icon: '◑',  action: toggleDarkMode                               },
  )

  for (const e of EBA_LIST) {
    cmds.push({
      id: `search-${e.slug}`,
      label: `Search in ${e.label}`,
      cat: 'EBA', icon: '⌕',
      action: () => openSearch('search', { eba: e.filter }),
    })
    cmds.push({
      id: `browse-${e.slug}`,
      label: `Browse ${e.label}`,
      cat: 'EBA', icon: '⌕',
      action: () => router.go(`/ebas/${e.slug}/`),
    })
  }

  return cmds
})

// ── Filtered + recent-first list ──────────────────────────────────────────
const filteredCommands = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) {
    const recent     = loadRecent()
    const recentSet  = new Set(recent)
    const recentCmds = recent.map(id => allCommands.value.find(c => c.id === id)).filter(Boolean)
    const rest       = allCommands.value.filter(c => !recentSet.has(c.id))
    return [...recentCmds, ...rest].slice(0, 14)
  }
  return allCommands.value.filter(c =>
    c.label.toLowerCase().includes(q) || c.cat.toLowerCase().includes(q)
  )
})

// Reactive recent set — drives "recent" pill in the template.
// Recomputed whenever filteredCommands changes (i.e. on open and on query change).
const recentSet = computed(() => new Set(loadRecent()))

// ── Palette control ────────────────────────────────────────────────────────
function openPalette() { open.value = true }

function closePalette() {
  open.value     = false
  query.value    = ''
  selected.value = 0
}

function run(cmd) {
  if (!cmd) return
  saveRecent(cmd.id)
  closePalette()
  nextTick(() => cmd.action())
}

// ── Global keyboard trigger ────────────────────────────────────────────────
// Desktop-only: skip entirely on viewports < 900px (matches the existing
// 900px breakpoint used by ClausePanel, AskThisPage, and the preview pane).
// isTyping() mirrors the guard in KeyboardHelp.vue and also checks for focus
// inside SearchModal so typing '>' in a search query doesn't open the palette.
function isTyping() {
  const tag = document.activeElement?.tagName?.toLowerCase()
  return ['input', 'textarea', 'select'].includes(tag) ||
    !!document.activeElement?.isContentEditable ||
    !!document.activeElement?.closest('.search-modal')
}

function onGlobalKey(e) {
  if (window.innerWidth < 900) return
  if (e.key === '>' && !e.ctrlKey && !e.altKey && !e.metaKey && !open.value && !isTyping()) {
    e.preventDefault()
    openPalette()
    return
  }
  if (e.key === 'Escape' && open.value) {
    e.preventDefault()
    closePalette()
  }
}

// ── Within-palette keyboard navigation ────────────────────────────────────
function onPaletteKey(e) {
  if      (e.key === 'ArrowDown') { e.preventDefault(); selected.value = Math.min(selected.value + 1, filteredCommands.value.length - 1) }
  else if (e.key === 'ArrowUp')   { e.preventDefault(); selected.value = Math.max(selected.value - 1, 0) }
  else if (e.key === 'Enter')     { e.preventDefault(); run(filteredCommands.value[selected.value]) }
  else if (e.key === 'Escape')    { e.preventDefault(); closePalette() }
}

// ── Watchers ──────────────────────────────────────────────────────────────
watch(query, () => { selected.value = 0 })

watch(selected, idx => {
  nextTick(() => listRef.value?.children[idx]?.scrollIntoView({ block: 'nearest' }))
})

watch(open, val => {
  if (val) nextTick(() => inputRef.value?.focus())
})

// ── Lifecycle ─────────────────────────────────────────────────────────────
onMounted(()   => window.addEventListener('keydown', onGlobalKey))
onUnmounted(() => window.removeEventListener('keydown', onGlobalKey))
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="cp-backdrop"
      role="presentation"
      @click.self="closePalette"
      @keydown="onPaletteKey"
    >
      <div class="cp-panel" role="dialog" aria-label="Command palette" aria-modal="true">

        <!-- Input row -->
        <div class="cp-input-row">
          <span class="cp-prompt" aria-hidden="true">›</span>
          <input
            ref="inputRef"
            v-model="query"
            class="cp-input"
            placeholder="Type a command…"
            aria-label="Command search"
            autocomplete="off"
            spellcheck="false"
          />
          <kbd class="cp-esc" @click="closePalette">Esc</kbd>
        </div>

        <!-- Results -->
        <ul ref="listRef" class="cp-list" role="listbox">

          <!-- Contextual hint row — not a selectable item -->
          <li v-if="!query && filteredCommands.length" class="cp-hint" aria-hidden="true">
            {{ recentSet.size ? 'Recently used · type to search all' : 'All commands · type to filter' }}
          </li>

          <li
            v-for="(cmd, i) in filteredCommands"
            :key="cmd.id"
            class="cp-item"
            :class="{ 'cp-item--active': i === selected }"
            role="option"
            :aria-selected="i === selected"
            @click="run(cmd)"
            @mouseenter="selected = i"
          >
            <span class="cp-icon" aria-hidden="true">{{ cmd.icon }}</span>
            <span class="cp-label">{{ cmd.label }}</span>
            <span class="cp-spacer" />
            <span v-if="recentSet.has(cmd.id) && !query" class="cp-pill cp-pill--recent">recent</span>
            <span class="cp-pill cp-pill--cat">{{ cmd.cat }}</span>
            <kbd v-if="cmd.kbd" class="cp-kbd">{{ cmd.kbd }}</kbd>
          </li>

          <li v-if="filteredCommands.length === 0" class="cp-empty">
            No commands match "<strong>{{ query }}</strong>"
          </li>

        </ul>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
/* ── Backdrop ─────────────────────────────────────────────────────────── */
.cp-backdrop {
  position: fixed; inset: 0; z-index: 10005;
  background: oklch(0 0 0 / 0.48);
  display: flex; align-items: flex-start; justify-content: center;
  padding-top: 14vh;
}

/* ── Panel ────────────────────────────────────────────────────────────── */
.cp-panel {
  width: min(600px, calc(100vw - 2rem));
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  box-shadow: 0 20px 60px oklch(0 0 0 / 0.28);
  overflow: hidden;
}

/* ── Input row ────────────────────────────────────────────────────────── */
.cp-input-row {
  display: flex; align-items: center; gap: 10px;
  padding: 11px 14px;
  border-bottom: 1px solid var(--vp-c-divider);
}
.cp-prompt {
  font-size: 1.1rem; font-weight: 700; line-height: 1;
  color: var(--vp-c-brand-1); user-select: none;
}
.cp-input {
  flex: 1; background: transparent; border: none; outline: none;
  font-size: 0.925rem; color: var(--vp-c-text-1);
  caret-color: var(--vp-c-brand-1);
}
.cp-esc {
  font-size: 0.68rem; padding: 2px 6px; cursor: pointer; user-select: none;
  border: 1px solid var(--vp-c-divider); border-bottom: 2px solid var(--vp-c-divider);
  border-radius: 4px; color: var(--vp-c-text-3);
  font-family: var(--vp-font-family-mono, ui-monospace, monospace);
}

/* ── List ─────────────────────────────────────────────────────────────── */
.cp-list {
  list-style: none; margin: 0; padding: 4px 0;
  max-height: 390px; overflow-y: auto; scrollbar-width: thin;
}
.cp-hint {
  padding: 6px 14px 3px;
  font-size: 0.67rem; color: var(--vp-c-text-3);
  text-transform: uppercase; letter-spacing: 0.06em;
  list-style: none;
}

/* ── Item ─────────────────────────────────────────────────────────────── */
.cp-item {
  display: flex; align-items: center; gap: 9px;
  padding: 8px 14px; cursor: pointer; list-style: none;
  transition: background 0.07s;
}
.cp-item--active { background: var(--vp-c-default-soft); }
.cp-icon  { width: 14px; text-align: center; font-size: 0.78rem; color: var(--vp-c-text-3); flex-shrink: 0; }
.cp-label { font-size: 0.875rem; color: var(--vp-c-text-1); }
.cp-spacer { flex: 1; min-width: 8px; }

/* ── Pills ────────────────────────────────────────────────────────────── */
.cp-pill {
  font-size: 0.64rem; padding: 1px 5px; border-radius: 3px;
  white-space: nowrap; flex-shrink: 0; line-height: 1.7;
}
.cp-pill--cat    { background: var(--vp-c-default-soft); color: var(--vp-c-text-3); }
.cp-pill--recent { background: #4A2A7215; color: #4A2A72; margin-right: 2px; }
.dark .cp-pill--recent { background: #c084fc15; color: #c084fc; }

/* ── Kbd hint ─────────────────────────────────────────────────────────── */
.cp-kbd {
  font-size: 0.64rem; padding: 2px 5px; flex-shrink: 0;
  border: 1px solid var(--vp-c-divider); border-bottom: 2px solid var(--vp-c-divider);
  border-radius: 4px; color: var(--vp-c-text-3);
  font-family: var(--vp-font-family-mono, ui-monospace, monospace);
}

/* ── Empty state ──────────────────────────────────────────────────────── */
.cp-empty {
  padding: 22px 14px; text-align: center;
  font-size: 0.84rem; color: var(--vp-c-text-3);
  list-style: none;
}
</style>