<template>
  <ClientOnly>
    <button
      v-if="isClausePage"
      class="ask-this-page-btn"
      @click="handleClick"
      aria-label="Ask about this page"
      title="Ask about this page"
    >
      <!-- Animated gradient border; inner span sits on bg to create the border illusion -->
      <span class="ask-btn-inner">
        <span class="ask-btn-sparkle" aria-hidden="true">✨</span>
        <span class="ask-btn-text">Ask about this page</span>
      </span>
    </button>
  </ClientOnly>
</template>

<script setup>
import { computed } from 'vue'
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

// ─── Label shown in aria-label and title ──────────────────────────────────────
const clauseLabel = computed(() => {
  const title = page.value?.frontmatter?.title ?? ''
  const match = title.match(/^(\d+[A-Za-z]?)[.\s]/)
  return match ? `Clause ${match[1]}` : (title || 'this clause')
})

// ─── Click handler ────────────────────────────────────────────────────────────
// Dispatches 'open-ask-panel' so AskPanel.vue opens with this page as context.
// The panel will scope its answers to this clause page specifically.
function handleClick() {
  window.dispatchEvent(
    new CustomEvent('open-ask-panel', {
      detail: {
        scope:     'page',
        pageUrl:   route.path,
        pageTitle: page.value?.frontmatter?.title ?? '',
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
  position:      relative;
  padding:       1px;
  border:        none;
  border-radius: 8px;
  background: conic-gradient(
    from var(--ask-angle, 0deg),
    #4A2A72  0%,
    #D21C62  50%,
    #4A2A72  100%
  );
  cursor:      pointer;
  flex-shrink: 0;
  animation:   ask-spin 3s linear infinite;
  transition:  filter 0.15s ease, transform 0.15s ease;
}
.ask-this-page-btn:hover {
  filter:    brightness(1.1);
  transform: scale(1.015);
}
.ask-this-page-btn:focus-visible {
  outline:        3px solid var(--vp-c-brand);
  outline-offset: 3px;
}

@property --ask-angle {
  syntax:        '<angle>';
  initial-value: 0deg;
  inherits:      false;
}
@keyframes ask-spin { to { --ask-angle: 360deg; } }

@media (prefers-reduced-motion: reduce) {
  .ask-this-page-btn {
    animation:  none;
    background: linear-gradient(135deg, #4A2A72, #D21C62);
  }
}

/* ── Inner content — sits on bg to create border illusion ── */
.ask-btn-inner {
  display:       flex;
  align-items:   center;
  gap:           0.4rem;
  padding:       0.3rem 0.75rem;
  border-radius: 6px;
  background:    var(--vp-c-bg);
  font-size:     0.8rem;
  font-weight:   600;
  color:         var(--vp-c-text-1);
  white-space:   nowrap;
  transition:    background 0.2s ease;
  line-height:   1;
}
.ask-this-page-btn:hover .ask-btn-inner { background: var(--vp-c-bg-soft); }

.ask-btn-sparkle { font-size: 0.9rem; line-height: 1; filter: grayscale(1); }
.ask-btn-text    { letter-spacing: 0.01em; }
</style>
