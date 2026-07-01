<template>
  <ClientOnly>
    <Teleport to="body">
      <div
        v-if="tip.visible"
        class="gloss-tooltip"
        :style="tipStyle"
        role="tooltip"
        :id="`gloss-tt-${uid}`"
        @mouseenter="onTipEnter"
        @mouseleave="onTipLeave"
      >
        <div class="gloss-tt-term">{{ tip.term }}</div>
        <p class="gloss-tt-def">{{ tip.def }}</p>
        <a
          v-if="defsHref"
          :href="defsHref"
          class="gloss-tt-link"
        >View full definition →</a>
      </div>
    </Teleport>
  </ClientOnly>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vitepress'

const route = useRoute()

// Unique ID so aria-describedby is scoped to this instance
const uid = Math.random().toString(36).slice(2, 8)

// ── Tooltip reactive state ────────────────────────────────────────────────────
const tip = ref({ visible: false, term: '', def: '', x: 0, y: 0, above: true })
let hideTimer = null

// ── EBA registry ──────────────────────────────────────────────────────────────
// Keys are the EBA folder segment that appears after /ebas/ in the URL.
// caseInsensitive: true → uses /gi regex flag (for Modern Awards with lowercase terms).
// defsPage: null → "View full definition" link is hidden for that EBA.
const EBA_META = {
  'allied-health': {
    file:     '/glossary/allied-health.json',
    name:     'Allied Health Professionals 2021–2026',
    defsPage: '/ebas/allied-health/preliminary/4-definitions',
  },
  'biomedical-engineers': {
    file:     '/glossary/biomedical-engineers.json',
    name:     'Biomedical Engineers 2025–2028',
    defsPage: '/ebas/biomedical-engineers/preliminary/4-definitions',
  },
  'childrens-services': {
    file:            '/glossary/childrens-services.json',
    name:            "Children's Services Award 2010",
    defsPage:        '/ebas/childrens-services/application-operation/3-definitions-and-interpretation',
    caseInsensitive: true,  // Modern Award — terms are lowercase throughout
  },
  'doctors-in-training': {
    file:     '/glossary/doctors-in-training.json',
    name:     'Doctors in Training 2022–2026',
    defsPage: '/ebas/doctors-in-training/preliminary/3-definitions',
  },
  'has-managers-admin-2021-2025': {
    file:     '/glossary/has-managers-admin.json',
    name:     'Health & Allied Services, Managers & Admin 2021–2025 (Archived)',
    defsPage: '/ebas/archive/has-managers-admin-2021-2025/common-terms/preliminary/6-definitions',
  },
  'has-managers-admin-2025-2027': {
    file:     '/glossary/has-managers-admin-2025-2027.json',
    name:     'Health & Allied Services, Managers & Admin 2025–2027',
    defsPage: '/ebas/has-managers-admin-2025-2027/common-terms/preliminary/6-definitions',
  },
  'mspp': {
    file:     '/glossary/mspp.json',
    name:     'Medical Scientists, Pharmacists & Psychologists 2021–2025',
    // ⚠ Verify this path against your actual sidebar before deploying
    defsPage: '/ebas/mspp/operation/9-definitions',
  },
  'medical-specialists': {
    file:     '/glossary/medical-specialists.json',
    name:     'Medical Specialists 2022–2026',
    defsPage: '/ebas/medical-specialists/preliminary/3-definitions',
  },
  'mental-health': {
    file:     '/glossary/mental-health.json',
    name:     'Mental Health Services 2024–2028',
    defsPage: '/ebas/mental-health/common-terms/preliminary/9-definitions',
  },
  'nurses-midwives': {
    file:     '/glossary/nurses-midwives.json',
    name:     'Nurses and Midwives 2024–2028',
    defsPage: '/ebas/nurses-midwives/preliminary/4-definitions',
  },
}

// Per-EBA fetched glossary cache: { [eba]: Record<string, string> | null }
const cache = {}
let currentEba = null

// ── Computed ──────────────────────────────────────────────────────────────────
const defsHref = computed(() => EBA_META[currentEba]?.defsPage ?? null)

const tipStyle = computed(() => ({
  position:  'fixed',
  left:      `${tip.value.x}px`,
  top:       `${tip.value.y}px`,
  transform: tip.value.above
    ? 'translateY(calc(-100% - 10px))'
    : 'translateY(10px)',
}))

// ── Glossary loading ───────────────────────────────────────────────────────────
async function loadGlossary(eba) {
  // Return cached result (including null for a failed fetch)
  if (Object.prototype.hasOwnProperty.call(cache, eba)) return cache[eba]
  const meta = EBA_META[eba]
  if (!meta) { cache[eba] = null; return null }
  try {
    const res = await fetch(meta.file)
    if (!res.ok) { cache[eba] = null; return null }
    cache[eba] = await res.json()
    return cache[eba]
  } catch {
    cache[eba] = null
    return null
  }
}

// ── URL helpers ────────────────────────────────────────────────────────────────
function ebaFromPath(path) {
  const parts = path.replace(/\.html$/, '').replace(/\/$/, '').split('/')
  const idx   = parts.indexOf('ebas')
  if (idx === -1) return null
  // Archived agreements live at /ebas/archive/<slug>/... — the real slug is
  // one segment further in than for a live agreement at /ebas/<slug>/...
  if (parts[idx + 1] === 'archive') return parts[idx + 2] ?? null
  return parts[idx + 1] ?? null
}

// Returns true on an EBA's own definitions page — the walker is suppressed there
// to avoid wrapping every term inside the very list that defines them.
function isDefsPage(path) {
  const clean = path.replace(/\.html$/, '').replace(/\/$/, '')
  return /\/\d+-(definitions(-and-interpretation)?)$/.test(clean)
}

// ── DOM walking ───────────────────────────────────────────────────────────────
// Tags whose subtree the walker must not enter
const SKIP_TAGS = new Set([
  'A', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'CODE', 'PRE', 'SCRIPT', 'STYLE', 'BUTTON', 'TEXTAREA', 'INPUT',
])

// Class substrings that also signal "skip this subtree"
const SKIP_CLASSES = new Set([
  'gloss-term', 'pagefind-synonyms', 'vp-code',
  'line-numbers', 'custom-block-title',
])

function shouldSkip(node, root) {
  let el = node.nodeType === Node.TEXT_NODE ? node.parentElement : node
  while (el && el !== root) {
    if (SKIP_TAGS.has(el.tagName)) return true
    if (el.classList) {
      for (const cls of SKIP_CLASSES) {
        if (el.classList.contains(cls)) return true
      }
    }
    el = el.parentElement
  }
  return false
}

function buildPattern(terms, caseInsensitive) {
  // Longest terms first so "Immediate Family" beats "Family" etc.
  const escaped = [...terms]
    .sort((a, b) => b.length - a.length)
    .map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const flags = caseInsensitive ? 'gi' : 'g'
  return new RegExp(`\\b(${escaped.join('|')})\\b`, flags)
}

function wrapTextNode(textNode, pattern, glossary) {
  const text = textNode.textContent
  pattern.lastIndex = 0
  if (!pattern.test(text)) return
  pattern.lastIndex = 0

  const frag = document.createDocumentFragment()
  let lastIdx = 0
  let m

  while ((m = pattern.exec(text)) !== null) {
    // Text before this match
    if (m.index > lastIdx) {
      frag.appendChild(document.createTextNode(text.slice(lastIdx, m.index)))
    }

    // Find the canonical key (exact match first, then case-insensitive fallback)
    const canonical =
      Object.keys(glossary).find(k => k === m[0]) ??
      Object.keys(glossary).find(k => k.toLowerCase() === m[0].toLowerCase()) ??
      m[0]

    const span = document.createElement('span')
    span.className = 'gloss-term'
    span.tabIndex  = 0
    span.setAttribute('role', 'button')
    span.setAttribute('aria-describedby', `gloss-tt-${uid}`)
    span.dataset.gt  = canonical   // lookup key into glossary
    span.textContent = m[0]        // preserve original text casing
    frag.appendChild(span)

    lastIdx = m.index + m[0].length
  }

  // Any trailing text after the last match
  if (lastIdx < text.length) {
    frag.appendChild(document.createTextNode(text.slice(lastIdx)))
  }

  textNode.parentNode.replaceChild(frag, textNode)
}

function walkDoc(root, glossary, caseInsensitive) {
  const terms = Object.keys(glossary)
  if (!terms.length) return

  const pattern = buildPattern(terms, caseInsensitive)
  const walker  = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)

  // Collect all candidate text nodes before modifying the DOM —
  // modifying while walking can invalidate the walker's position.
  const nodes = []
  let n
  while ((n = walker.nextNode())) {
    if (n.textContent.trim() && !shouldSkip(n, root)) {
      nodes.push(n)
    }
  }

  // Process in reverse so earlier replacements don't shift sibling indices
  for (let i = nodes.length - 1; i >= 0; i--) {
    pattern.lastIndex = 0
    wrapTextNode(nodes[i], pattern, glossary)
  }
}

function removeSpans(root) {
  if (!root) return
  root.querySelectorAll('span.gloss-term').forEach(s => {
    s.replaceWith(document.createTextNode(s.textContent))
  })
  // Merge adjacent text nodes left by the replacements
  root.normalize()
}

// ── Main glossary application ─────────────────────────────────────────────────
async function applyGlossary(path) {
  const eba = ebaFromPath(path)

  // Non-EBA page, or the definitions page itself — clear any spans and bail
  if (!eba || !EBA_META[eba] || isDefsPage(path)) {
    removeSpans(document.querySelector('.vp-doc'))
    currentEba = null
    return
  }

  currentEba = eba
  const glossary = await loadGlossary(eba)
  if (!glossary || !Object.keys(glossary).length) return

  // Wait 100 ms for VitePress to finish replacing .vp-doc > div content.
  // This matches the pattern used by ClausePanel and other route-sensitive
  // components in this project.
  await new Promise(r => setTimeout(r, 100))

  const root = document.querySelector('.vp-doc')
  if (!root) return

  removeSpans(root)   // idempotent cleanup before re-walking
  walkDoc(root, glossary, !!EBA_META[eba].caseInsensitive)
}

// ── Tooltip positioning ───────────────────────────────────────────────────────
function showTip(el) {
  if (!currentEba || !cache[currentEba]) return
  const term = el.dataset.gt
  const def  = cache[currentEba][term]
  if (!def) return

  const r      = el.getBoundingClientRect()
  const mid    = r.left + r.width / 2
  // Centre the 300px card on the term, clamped to viewport
  const clampX = Math.max(8, Math.min(mid - 150, window.innerWidth - 308))

  tip.value = {
    visible: true,
    term,
    def,
    x:     clampX,
    y:     r.top > 220 ? r.top : r.bottom,
    above: r.top > 220,
  }
}

function hideTip() {
  tip.value = { ...tip.value, visible: false }
}

function scheduleHide() {
  clearTimeout(hideTimer)
  hideTimer = setTimeout(hideTip, 150)
}

function cancelHide() {
  clearTimeout(hideTimer)
}

// ── Tooltip hover bridge (allows mouse to move from term into card) ────────────
function onTipEnter() { cancelHide() }
function onTipLeave() { scheduleHide() }

// ── Event delegation ──────────────────────────────────────────────────────────
function onMouseOver(e) {
  const el = e.target.closest?.('span.gloss-term')
  if (!el) return
  cancelHide()
  showTip(el)
}

function onMouseOut(e) {
  if (e.target.closest?.('span.gloss-term')) scheduleHide()
}

function onTouch(e) {
  const el = e.target.closest?.('span.gloss-term')
  if (!el) {
    // Tap outside the term and outside the tooltip → dismiss
    if (!e.target.closest?.('.gloss-tooltip')) hideTip()
    return
  }
  // Prevent the touch from also firing a click, which could navigate
  e.preventDefault()
  if (tip.value.visible && tip.value.term === el.dataset.gt) {
    hideTip()
  } else {
    showTip(el)
  }
}

function onKeyDown(e) {
  const el = e.target.closest?.('span.gloss-term')
  if (el) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      tip.value.visible ? hideTip() : showTip(el)
    }
    if (e.key === 'Escape') hideTip()
  } else if (e.key === 'Escape' && tip.value.visible) {
    hideTip()
  }
}

// ── Lifecycle ─────────────────────────────────────────────────────────────────
onMounted(() => {
  document.addEventListener('mouseover',  onMouseOver)
  document.addEventListener('mouseout',   onMouseOut)
  document.addEventListener('touchstart', onTouch, { passive: false })
  document.addEventListener('keydown',    onKeyDown)
  applyGlossary(route.path)
})

onUnmounted(() => {
  document.removeEventListener('mouseover',  onMouseOver)
  document.removeEventListener('mouseout',   onMouseOut)
  document.removeEventListener('touchstart', onTouch)
  document.removeEventListener('keydown',    onKeyDown)
  clearTimeout(hideTimer)
  removeSpans(document.querySelector('.vp-doc'))
})

watch(() => route.path, path => {
  hideTip()
  applyGlossary(path)
})
</script>