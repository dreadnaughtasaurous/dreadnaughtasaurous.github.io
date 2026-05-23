<script setup>
/**
 * LegislationPanel.vue
 *
 * Automatically detects external legislation links already present in the
 * rendered .vp-doc body and surfaces them as a "Referenced Legislation"
 * panel below the Related Clauses panel.
 *
 * Zero frontmatter maintenance required — the panel's data source is the
 * inline links inserted by link-legislation.mjs. If a clause page references
 * no legislation, the panel does not render.
 *
 * Implementation notes:
 *   - Uses <Teleport to=".vp-doc > div"> like RelatedClauses, with the same
 *     active/watch pattern to survive VitePress SPA navigation.
 *   - DOM scan runs inside requestAnimationFrame after the 50ms timeout,
 *     giving VitePress time to finish rendering the new page's content.
 *   - Deduplicates by href — multiple inline links to the same URL produce
 *     one entry in the panel.
 *   - Only renders on clause pages (path segments >= 5, starts with /ebas/).
 *   - Wrapped in <ClientOnly> — document is not available during SSR build.
 *   - CSS order: 3 — sits below RelatedClauses (order: 2) and above the
 *     changelog H2 (order: 98).
 *
 * Legislation domains scanned:
 *   legislation.gov.au, legislation.vic.gov.au, fairwork.gov.au,
 *   awards.fairwork.gov.au, health.vic.gov.au/mental-health
 */
import { ref, watch, computed } from 'vue'
import { useRoute } from 'vitepress'

const route = useRoute()

const currentUrl = computed(() =>
  route.path
    .replace(/\.html$/, '')
    .replace(/\/$/, '')
)

const isClausePage = computed(() =>
  currentUrl.value.startsWith('/ebas/') &&
  currentUrl.value.split('/').length >= 5
)

// The list of { href, label } objects found in the page body.
const legislationLinks = ref([])

// Controls Teleport mounting — same pattern as RelatedClauses.vue.
const active = ref(false)

// Domains that identify legislation links. Checked against anchor href.
const LEGISLATION_DOMAINS = [
  'legislation.gov.au',
  'legislation.vic.gov.au',
  'fairwork.gov.au',
  'awards.fairwork.gov.au',
  'health.vic.gov.au/mental-health',
  'fwc.gov.au',
]

function isLegislationHref(href) {
  return LEGISLATION_DOMAINS.some(domain => href.includes(domain))
}

// Shorten long link labels for display in the panel.
// Strips trailing "(Cth)" and "(Vic)" suffixes since the panel has limited
// horizontal space and the jurisdiction is implied by context.
function displayLabel(text) {
  if (!text) return ''
  // Cap at 72 chars
  const trimmed = text.length > 72 ? text.slice(0, 69) + '…' : text
  return trimmed
}

// Scan .vp-doc for external legislation links, deduplicate by href.
function scanLegislationLinks() {
  legislationLinks.value = []

  if (!isClausePage.value) return

  const docEl = document.querySelector('.vp-doc')
  if (!docEl) return

  const seen = new Set()
  const found = []

  // Query all <a> tags whose href points to a legislation domain.
  const anchors = docEl.querySelectorAll('a[href]')
  for (const anchor of anchors) {
    const href = anchor.getAttribute('href') || ''
    if (!isLegislationHref(href)) continue
    if (seen.has(href)) continue

    seen.add(href)
    found.push({
      href,
      label: displayLabel(anchor.textContent.trim()),
    })
  }

  legislationLinks.value = found
}

watch(
  () => route.path,
  () => {
    active.value = false
    legislationLinks.value = []
    setTimeout(() => {
      active.value = true
      // requestAnimationFrame ensures the DOM has been painted before we scan.
      // Guard: requestAnimationFrame is browser-only — not available during
      // VitePress SSR (Node.js). The typeof check prevents the build failing.
      if (typeof window !== 'undefined') {
        requestAnimationFrame(() => {
          scanLegislationLinks()
        })
      }
    }, 50)
  },
  { immediate: true }
)

// Map a legislation href to a short jurisdiction badge label.
// Used to show a small "Vic" or "Cth" badge on each card.
function jurisdictionBadge(href) {
  if (href.includes('legislation.vic.gov.au')) return 'Vic'
  if (href.includes('health.vic.gov.au'))      return 'Vic'
  if (href.includes('legislation.gov.au'))     return 'Cth'
  if (href.includes('fairwork.gov.au'))        return 'Cth'
  if (href.includes('fwc.gov.au'))             return 'Cth'
  return ''
}
</script>

<template>
  <ClientOnly>
    <Teleport
      v-if="active && isClausePage && legislationLinks.length > 0"
      to=".vp-doc > div"
    >
      <div class="legislation-panel">

        <!-- ── Header ──────────────────────────────────────────────────────── -->
        <div class="legislation-header">
          <!-- Scale / justice icon -->
          <svg class="legislation-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M10 2v16M10 2l-3 4M10 2l3 4" stroke="currentColor" stroke-width="1.5"
                  stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M4 6l-2 5h4L4 6z" stroke="currentColor" stroke-width="1.5"
                  stroke-linejoin="round"/>
            <path d="M16 6l-2 5h4l-2-5z" stroke="currentColor" stroke-width="1.5"
                  stroke-linejoin="round"/>
            <path d="M3 18h14" stroke="currentColor" stroke-width="1.5"
                  stroke-linecap="round"/>
          </svg>
          <span>Referenced Legislation</span>
        </div>

        <!-- ── Link list ───────────────────────────────────────────────────── -->
        <ul class="legislation-list" role="list">
          <li
            v-for="item in legislationLinks"
            :key="item.href"
            class="legislation-item"
          >
            <a
              :href="item.href"
              class="legislation-link"
              target="_blank"
              rel="noopener noreferrer"
            >
              <!-- Left: label text -->
              <span class="legislation-link-label">{{ item.label }}</span>

              <!-- Right: jurisdiction badge + external arrow -->
              <span class="legislation-link-right">
                <span
                  v-if="jurisdictionBadge(item.href)"
                  class="legislation-badge"
                >{{ jurisdictionBadge(item.href) }}</span>
                <!-- External link icon -->
                <svg viewBox="0 0 14 14" fill="none" aria-hidden="true"
                     class="legislation-external-icon">
                  <path d="M2 12L12 2M12 2H7M12 2v5"
                        stroke="currentColor" stroke-width="1.5"
                        stroke-linecap="round" stroke-linejoin="round"/>
                </svg>
              </span>
            </a>
          </li>
        </ul>

        <!-- ── Footer note ─────────────────────────────────────────────────── -->
        <p class="legislation-footer-note">
          Links open on the relevant legislation website. Always verify currency
          before acting on legislative references.
        </p>

      </div>
    </Teleport>
  </ClientOnly>
</template>

<style scoped>
/* ── Panel container ──────────────────────────────────────────────────────── */
.legislation-panel {
  margin-top: 32px;
  padding-top: 28px;
  border-top: 1px solid var(--vp-c-divider);
}

/* ── Header ───────────────────────────────────────────────────────────────── */
.legislation-header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--vp-c-text-2);
}

.legislation-icon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--vp-c-text-2);
}

/* ── List ─────────────────────────────────────────────────────────────────── */
.legislation-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}

/* ── Individual item ──────────────────────────────────────────────────────── */
.legislation-item {
  margin: 0;
  padding: 0;
}

/* ── Link card ────────────────────────────────────────────────────────────── */
.legislation-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  text-decoration: none;
  color: var(--vp-c-text-1);
  font-size: 13px;
  font-weight: 500;
  line-height: 1.45;
  transition: border-color 0.15s ease, background 0.15s ease, color 0.15s ease;
}

.legislation-link:hover {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  text-decoration: none;
}

.legislation-link-label {
  flex: 1;
  min-width: 0;
}

/* Right-side grouping: badge + arrow icon */
.legislation-link-right {
  display: flex;
  align-items: center;
  gap: 7px;
  flex-shrink: 0;
}

/* ── Jurisdiction badge ───────────────────────────────────────────────────── */
.legislation-badge {
  display: inline-block;
  padding: 1px 7px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.04em;
  background: var(--vp-c-default-soft);
  color: var(--vp-c-text-2);
  white-space: nowrap;
  transition: background 0.15s ease, color 0.15s ease;
}

.legislation-link:hover .legislation-badge {
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}

/* ── External link arrow icon ─────────────────────────────────────────────── */
.legislation-external-icon {
  width: 13px;
  height: 13px;
  opacity: 0.4;
  transition: opacity 0.15s ease, transform 0.15s ease;
  flex-shrink: 0;
}

.legislation-link:hover .legislation-external-icon {
  opacity: 1;
  transform: translate(1px, -1px);
}

/* ── Footer note ──────────────────────────────────────────────────────────── */
.legislation-footer-note {
  margin: 12px 0 0 0;
  font-size: 11.5px;
  color: var(--vp-c-text-3);
  line-height: 1.5;
}
</style>
