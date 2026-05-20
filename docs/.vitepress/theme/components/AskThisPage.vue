<template>
  <ClientOnly>
    <button
      v-if="isClausePage"
      class="ask-this-page-btn"
      @click="handleClick"
      :disabled="isHashing"
      :aria-label="`Ask AI about ${clauseLabel}`"
      :title="`Ask AI about ${clauseLabel}`"
    >
      <!-- Animated gradient border: conic-gradient on the button shell,
           inner span sits on the theme background colour to create the
           "border" illusion. Brand gradient:
           purple #4A2A72 → crimson #D21C62 → orange #E15E26               -->
      <span class="ask-btn-inner">
        <span class="ask-btn-sparkle" aria-hidden="true">✨</span>
        <span class="ask-btn-text">Ask AI about this clause</span>
      </span>
    </button>
  </ClientOnly>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue'
import { useData, useRoute } from 'vitepress'

const { page } = useData()
const route    = useRoute()

// ─── Page detection ───────────────────────────────────────────────────────────
// A clause page has at least 4 path segments after the leading slash:
// /ebas/<eba>/<section>/<clause> → split gives length 5 (leading '' + 4 parts)
const isClausePage = computed(() => {
  const parts = (route.path || '').replace(/\/$/, '').replace(/\.html$/, '').split('/')
  return parts.length >= 5 && parts[1] === 'ebas'
})

// ─── Frontmatter helpers ──────────────────────────────────────────────────────
const frontmatter = computed(() => page.value?.frontmatter ?? {})

// Extract leading clause number from title: "33. Increases to Allowances" → "33"
const clauseNumber = computed(() => {
  const title = frontmatter.value.title ?? ''
  const match = title.match(/^(\d+[A-Za-z]?)[\.\s]/)
  return match ? match[1] : null
})

const clauseLabel = computed(() =>
  clauseNumber.value ? `Clause ${clauseNumber.value}` : (frontmatter.value.title ?? 'this clause')
)

const ebaName = computed(() => frontmatter.value.eba ?? '')

// ─── Topic signal extraction ──────────────────────────────────────────────────
// The Worker's scoreAndSelectPaths() needs a topic keyword in the question
// to score a specific clause path rather than falling back to the EBA index
// page (ebas/allied-health.md etc.) which is too thin to fetch successfully,
// producing the "could not retrieve" error.
// We map the frontmatter topics taxonomy slug to the natural-language phrase
// the Worker's topic arrays actually contain.
const topicSignal = computed(() => {
  const topics = frontmatter.value.topics
  if (!topics) return ''
  const first = Array.isArray(topics) ? topics[0] : topics
  if (!first) return ''
  const topicMap = {
    'allowances':               'allowance',
    'classification':           'classification',
    'consultation':             'consultation',
    'dispute-resolution':       'dispute',
    'employment-types':         'employment',
    'hours-of-work':            'hours of work',
    'leave':                    'leave',
    'overtime':                 'overtime',
    'penalty-rates':            'penalty rate',
    'professional-development': 'professional development',
    'termination':              'termination',
    'wages':                    'wages',
    'workload':                 'workload',
  }
  return topicMap[first] ?? first.replace(/-/g, ' ')
})

// ─── Optimised prompt ─────────────────────────────────────────────────────────
// Includes the topic signal so the Worker routes to a specific clause file
// rather than the EBA index page. Two-question sub-structure anchors smaller
// models (Cerebras llama3.1-8b) to concrete, practical output.
const questionPrompt = computed(() => {
  const clause = clauseLabel.value
  const eba    = ebaName.value ? ` of the ${ebaName.value}` : ''
  const topic  = topicSignal.value ? ` regarding ${topicSignal.value}` : ''
  return (
    `What does ${clause}${eba}${topic} say, ` +
    `and what does it mean in practice for employees? ` +
    `Summarise the key entitlements or obligations it creates in plain language.`
  )
})

// ─── Content hash (Option C) ──────────────────────────────────────────────────
// SHA-256(title + eba + pathname) via SubtleCrypto.
// Busts only when the clause title or EBA association changes.
const isHashing   = ref(false)
const contentHash = ref(null)

async function computeContentHash() {
  try {
    const raw     = `${frontmatter.value.title ?? ''}||${ebaName.value}||${route.path ?? ''}||${questionPrompt.value}`
    const encoded = new TextEncoder().encode(raw)
    const hashBuf = await crypto.subtle.digest('SHA-256', encoded)
    contentHash.value = Array.from(new Uint8Array(hashBuf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  } catch {
    contentHash.value = null
  }
}

watch(() => route.path, () => {
  contentHash.value = null
  computeContentHash()
}, { immediate: false })

onMounted(() => computeContentHash())

// ─── Click handler ────────────────────────────────────────────────────────────
function handleClick() {
  if (isHashing.value) return
  window.dispatchEvent(
    new CustomEvent('open-search', {
      detail: {
        tab:         'ask',
        query:       questionPrompt.value,
        contentHash: contentHash.value,
      }
    })
  )
}
</script>

<style scoped>
/*
  Layout: this component renders as a bare <button> with no wrapper div.
  The toolbar row (flex, align-items: center, gap, margin-bottom) is owned
  by the .doc-toolbar div injected in index.js, which also contains CopyButton.
  This keeps both buttons on the same line without coupling the components.
*/

/* ── Button shell — animated gradient border ── */
.ask-this-page-btn {
  position:    relative;
  padding:     1px;          /* Thin animated border                           */
  border:      none;
  border-radius: 8px;
  background: conic-gradient(
    from var(--ask-angle, 0deg),
    #4A2A72  0%,             /* Purple                                         */
    #D21C62  50%,            /* Crimson/magenta                                */
    #4A2A72  100%            /* Back to purple — seamless two-colour loop      */
  );
  cursor:    pointer;
  flex-shrink: 0;
  animation: ask-spin 3s linear infinite;
  transition: filter 0.15s ease, transform 0.15s ease;
}

.ask-this-page-btn:hover:not(:disabled) {
  filter:    brightness(1.1);
  transform: scale(1.015);
}

.ask-this-page-btn:disabled {
  opacity:   0.6;
  cursor:    not-allowed;
  animation: none;
}

.ask-this-page-btn:focus-visible {
  outline:        3px solid var(--vp-c-brand);
  outline-offset: 3px;
}

/* @property enables smooth conic-gradient rotation in Chromium.
   Safari renders a static gradient — still looks fine.                       */
@property --ask-angle {
  syntax:        '<angle>';
  initial-value: 0deg;
  inherits:      false;
}

@keyframes ask-spin {
  to { --ask-angle: 360deg; }
}

@media (prefers-reduced-motion: reduce) {
  .ask-this-page-btn {
    animation: none;
    background: linear-gradient(135deg, #4A2A72, #D21C62);
  }
}

/* ── Inner content — sits on bg to create the border illusion ── */
.ask-btn-inner {
  display:       flex;
  align-items:   center;
  gap:           0.4rem;
  padding:       0.3rem 0.75rem;  /* Compact: matches CopyButton height       */
  border-radius: 6px;             /* 2px less than outer shell                */
  background:    var(--vp-c-bg);
  font-size:     0.8rem;
  font-weight:   600;
  color:         var(--vp-c-text-1);
  white-space:   nowrap;
  transition:    background 0.2s ease;
  line-height:   1;
}

.ask-this-page-btn:hover:not(:disabled) .ask-btn-inner {
  background: var(--vp-c-bg-soft);
}

.ask-btn-sparkle {
  font-size:   0.9rem;
  line-height: 1;
  filter:      grayscale(1);
}

.ask-btn-text {
  letter-spacing: 0.01em;
}
</style>