<script setup>
/**
 * RelatedClauses.vue
 *
 * Renders a "Related Clauses" panel inside .vp-doc > div using <Teleport>,
 * appearing after clause content but before the changelog plugin.
 *
 * Uses a static CSS selector string as the Teleport target (not a dynamic
 * ref) — this is the only approach that works reliably across VitePress SPA
 * navigation in both dev and production builds.
 *
 * Wrapped in <ClientOnly> to prevent SSR build failure (document is not
 * defined during static rendering).
 */
import { computed, ref, watch } from 'vue'
import { useData, useRoute } from 'vitepress'
import relatedData from '../../../generated/related-clauses.json'

const route    = useRoute()
const { page } = useData()

// Strip .html suffix and trailing slash to match JSON keys written by the script.
const currentUrl = computed(() =>
  route.path
    .replace(/\.html$/, '')
    .replace(/\/$/, '')
)

// Clause pages live exactly 4 segments deep after the leading slash:
// /ebas/<eba-folder>/<section-folder>/<clause-slug> → split length 5
const isClausePage = computed(() =>
  currentUrl.value.startsWith('/ebas/') &&
  currentUrl.value.split('/').length >= 5
)

const related = computed(() => relatedData[currentUrl.value] ?? [])

// Controls whether the panel is rendered at all.
// Reset to false on route change, then re-enabled after a tick so the
// Teleport always mounts fresh into the new page's .vp-doc > div element.
const active        = ref(false)

// Tooltip state
const activeTooltip = ref(null)
function showTooltip(idx) { activeTooltip.value = idx }
function hideTooltip()    { activeTooltip.value = null }

// On every route change (including first load via immediate: true),
// briefly deactivate then reactivate the panel so Teleport re-mounts
// into the freshly rendered .vp-doc > div of the new page.
watch(
  () => route.path,
  () => {
    active.value = false
    activeTooltip.value = null
    setTimeout(() => {
      active.value = true
    }, 50)
  },
  { immediate: true }
)

// Truncate long titles cleanly
function displayTitle(title) {
  return title.length > 72 ? title.slice(0, 69) + '…' : title
}

// Opens SearchModal pre-filtered to this page's EBA and first topic tag
function seeAllRelated() {
  const fm         = page.value?.frontmatter ?? {}
  const ebaName    = fm.eba    ?? ''
  const firstTopic = Array.isArray(fm.topics) ? fm.topics[0] : (fm.topics ?? '')

  window.dispatchEvent(
    new CustomEvent('open-search', {
      detail: { eba: ebaName, topic: firstTopic }
    })
  )
}
</script>

<template>
  <ClientOnly>
    <Teleport
      v-if="active && isClausePage && related.length > 0"
      to=".vp-doc > div"
    >
      <div class="related-clauses-panel">
        <div class="related-clauses-header">
          <svg class="related-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M7 3H5a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V5a2 2 0 00-2-2h-2"
                  stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
            <rect x="7" y="1" width="6" height="4" rx="1"
                  stroke="currentColor" stroke-width="1.5"/>
            <path d="M7 9h6M7 12h4" stroke="currentColor" stroke-width="1.5"
                  stroke-linecap="round"/>
          </svg>
          <span>Related Clauses</span>
        </div>

        <div class="related-clauses-grid">
          <div
            v-for="(item, idx) in related"
            :key="item.url"
            class="related-card-wrapper"
            @mouseenter="showTooltip(idx)"
            @mouseleave="hideTooltip()"
            @focusin="showTooltip(idx)"
            @focusout="hideTooltip()"
          >
            <a :href="item.url" class="related-card">
              <span class="related-card-title">{{ displayTitle(item.title) }}</span>
              <svg class="related-card-arrow" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.5"
                      stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </a>

            <Transition name="tooltip">
              <div
                v-if="activeTooltip === idx && item.excerpt"
                class="related-tooltip"
                role="tooltip"
              >
                <p class="related-tooltip-text">{{ item.excerpt }}</p>
              </div>
            </Transition>
          </div>
        </div>

        <div class="related-clauses-footer">
          <button class="related-see-all" @click="seeAllRelated" type="button">
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" width="14" height="14">
              <circle cx="7" cy="7" r="5" stroke="currentColor" stroke-width="1.5"/>
              <path d="M11 11l3 3" stroke="currentColor" stroke-width="1.5"
                    stroke-linecap="round"/>
            </svg>
            See all related pages
          </button>
        </div>
      </div>
    </Teleport>
  </ClientOnly>
</template>

<style scoped>
/* ── Panel container ──────────────────────────────────────────────────────── */
.related-clauses-panel {
  margin-top: 48px;
  padding-top: 32px;
  border-top: 1px solid var(--vp-c-divider);
}

/* ── Header ───────────────────────────────────────────────────────────────── */
.related-clauses-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 16px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--vp-c-text-2);
}

.related-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--vp-c-text-2);
}

/* ── Grid ─────────────────────────────────────────────────────────────────── */
.related-clauses-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 10px;
}

@media (max-width: 640px) {
  .related-clauses-grid {
    grid-template-columns: 1fr;
  }
}

/* ── Card wrapper (needed for tooltip positioning) ────────────────────────── */
.related-card-wrapper {
  position: relative;
}

/* ── Card ─────────────────────────────────────────────────────────────────── */
.related-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 11px 14px;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  text-decoration: none;
  color: var(--vp-c-text-1);
  font-size: 13.5px;
  font-weight: 500;
  line-height: 1.4;
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
}

.related-card:hover {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  text-decoration: none;
}

.related-card-title {
  flex: 1;
  min-width: 0;
}

.related-card-arrow {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  opacity: 0.45;
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.related-card:hover .related-card-arrow {
  opacity: 1;
  transform: translateX(2px);
}

/* ── Tooltip ──────────────────────────────────────────────────────────────── */
.related-tooltip {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  right: 0;
  z-index: 50;
  padding: 12px 14px;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-elv);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  pointer-events: none;
}

.dark .related-tooltip {
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.4);
}

.related-tooltip-text {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--vp-c-text-2);
}

/* ── Tooltip transition ───────────────────────────────────────────────────── */
.tooltip-enter-active,
.tooltip-leave-active {
  transition: opacity 0.12s ease, transform 0.12s ease;
}

.tooltip-enter-from,
.tooltip-leave-to {
  opacity: 0;
  transform: translateY(4px);
}

/* ── Footer ───────────────────────────────────────────────────────────────── */
.related-clauses-footer {
  margin-top: 14px;
  display: flex;
  justify-content: flex-end;
}

.related-see-all {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12.5px;
  font-weight: 500;
  color: var(--vp-c-text-2);
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 0;
  transition: color 0.15s ease;
}

.related-see-all:hover {
  color: var(--vp-c-brand-1);
}
</style>