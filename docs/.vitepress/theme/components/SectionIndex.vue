<script setup>
/**
 * SectionIndex.vue
 * ─────────────────────────────────────────────────────────────────────────────
 * Universal section-level index component. Replaces the manually maintained
 * link list on every EBA section index page (.md files that sit alongside a
 * same-named subfolder).
 *
 * Self-identifying: derives its own data lookup key from the current route
 * path — no props required. Just drop <SectionIndex /> into any section
 * index .md file body.
 *
 * Renders in one of two modes depending on the data entry's `type` field:
 *   "section" — children are leaf clause files → clause row list
 *   "stream"  — children are subsection index pages → subsection card grid
 *               (only occurs in has-managers-admin and mental-health)
 *
 * Data source : docs/generated/section-index-data.js (build-time generated)
 * Colour data : docs/.vitepress/theme/eba-registry.js (EBA_REGISTRY)
 */

import { computed }     from 'vue'
import { useRoute }     from 'vitepress'
import { EBA_REGISTRY } from '../eba-registry.js'
import sectionData      from '../../../generated/section-index-data.js'

const route = useRoute()

// ── Key derivation ────────────────────────────────────────────────────────────
// Strip the /ebas/ prefix and any trailing slash to get the lookup key.
//   /ebas/allied-health/allowances             → allied-health/allowances
//   /ebas/has-managers-admin/common-terms      → has-managers-admin/common-terms
//   /ebas/has-managers-admin/common-terms/allowances
//                                              → has-managers-admin/common-terms/allowances
const key = computed(() =>
  route.path.replace(/^\/ebas\//, '').replace(/\/$/, '')
)

const section = computed(() => sectionData[key.value] ?? null)

// Look up EBA registry entry by slug for colour data
const reg = computed(() =>
  section.value
    ? (EBA_REGISTRY.find(e => e.slug === section.value.ebaSlug) ?? null)
    : null
)

const color = computed(() => reg.value?.color ?? '#6B7280')
const bg    = computed(() => reg.value?.bg    ?? '#6B728018')

// Label computed directly from the route key — independent of the generated
// data file, so it can never be stale. Stream type always gets 'Subsections'.
// Section type uses the folder name to pick a specific label where relevant.
const SECTION_LABELS = { appendices: 'Appendices', schedules: 'Schedules' }

const label = computed(() => {
  if (!section.value) return ''
  if (section.value.type === 'stream') return 'Subsections'
  return SECTION_LABELS[key.value.split('/').pop()] ?? 'Clauses'
})
</script>

<template>
  <div v-if="section" class="si-root">

    <!-- ── Hero strip ─────────────────────────────────────────────────────── -->
    <div class="si-hero" :style="{ borderLeftColor: color }">
      <div class="si-hero-body">
        <p role="heading" aria-level="1" class="si-title">{{ section.title }}</p>
        <p v-if="section.description" class="si-description">{{ section.description }}</p>
        <span
          class="si-eba-pill"
          :style="{ background: bg, color: color }"
        >{{ section.eba }}</span>
      </div>
      <span class="si-count-chip">
        <template v-if="section.type === 'stream'">
          {{ section.childCount }}
          {{ section.childCount === 1 ? 'subsection' : 'subsections' }}
        </template>
        <template v-else>
          {{ section.clauseCount }}
          {{ section.clauseCount === 1 ? 'clause' : 'clauses' }}
        </template>
      </span>
    </div>

    <!-- ── Stream mode: subsection cards ─────────────────────────────────── -->
    <div v-if="section.type === 'stream'" class="si-section">
      <p class="si-label">{{ label }}</p>
      <div class="si-stream-grid">
        <a
          v-for="child in section.children"
          :key="child.path"
          :href="child.path"
          class="si-stream-card"
        >
          <div class="si-stream-card-body">
            <span class="si-stream-title">{{ child.title }}</span>
            <span class="si-stream-count">
              {{ child.clauseCount }} {{ child.clauseCount === 1 ? 'clause' : 'clauses' }}
            </span>
          </div>
          <i class="ti ti-chevron-right si-chevron" aria-hidden="true"></i>
        </a>
      </div>
    </div>

    <!-- ── Section mode: clause rows ─────────────────────────────────────── -->
    <div v-else class="si-section">
      <p class="si-label">{{ label }}</p>
      <div class="si-clause-list">
        <a
          v-for="clause in section.clauses"
          :key="clause.path"
          :href="clause.path"
          class="si-clause-row"
        >
          <!-- Clause number chip — EBA colour tint, sized to match eip-part-icon -->
          <span
            class="si-clause-num"
            :style="{ background: bg, color: color }"
            aria-hidden="true"
          >{{ clause.displayNumber }}</span>

          <!-- Body: title, optional summary, topic tags -->
          <div class="si-clause-body">
            <span class="si-clause-title">{{ clause.title }}</span>
            <span v-if="clause.summary" class="si-clause-summary">{{ clause.summary }}</span>
            <div v-if="clause.topics?.length" class="si-tags">
              <span
                v-for="tag in clause.topics"
                :key="tag"
                class="si-tag"
              >{{ tag }}</span>
            </div>
          </div>

          <i class="ti ti-chevron-right si-chevron" aria-hidden="true"></i>
        </a>
      </div>
    </div>

  </div>
  <!-- Null-safe: renders nothing if this page has no entry in section-index-data.js -->
</template>

<style>
/*
 * Non-scoped block — must override .vp-doc a link styles which VitePress
 * applies globally with high specificity. Scoped rules lose this battle.
 * Prefix si-root scopes the override to this component's DOM only.
 */
.si-root a {
  text-decoration: none !important;
  font-weight:     inherit !important;
  color:           inherit !important;
}

/* .si-root .si-label lives here (non-scoped) rather than in <style scoped>
   because VitePress's .vp-doc p rule has equal or higher specificity than
   a scoped class selector, causing the label to lose visibility.
   .si-root .si-label has specificity (0,2,0,1) — wins cleanly.
   Using <p> matches the eip-label pattern from EBAIndexPage exactly.        */
.si-root .si-description {
  font-size:   13px;
  color:       var(--color-text-secondary);
  line-height: 1.5;
  margin:      0;
  padding:     0;
}

.si-root .si-label {
  font-size:      0.6875rem;
  font-weight:    500;
  color:          var(--color-text-tertiary);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin:         0 0 10px;
  padding-bottom: 6px;
  border-bottom:  1px solid var(--color-border-tertiary);
  display:        block;
  line-height:    1.4;
}
</style>

<style scoped>
/* ── Root ─────────────────────────────────────────────────────────────────── */
/* margin-top creates breathing room between the DocToolbar/breadcrumb and
   the hero strip — without it the two elements sit flush against each other. */
.si-root {
  margin-top: 24px;
}

/* ── Hero strip ───────────────────────────────────────────────────────────── */
/* Styling mirrors eip-hero from EBAIndexPage.vue exactly:
   - 3px solid left border (EBA colour, applied inline)
   - Left corners are square so the accent border reads as a full-height bar
   - Right corners are rounded at border-radius-md (6px)                      */
.si-hero {
  border-left:   3px solid transparent;
  border-top:    1px solid var(--color-border-tertiary);
  border-right:  1px solid var(--color-border-tertiary);
  border-bottom: 1px solid var(--color-border-tertiary);
  border-radius: 0 var(--border-radius-md) var(--border-radius-md) 0;
  padding:       20px 22px;
  display:       flex;
  justify-content: space-between;
  align-items:   flex-start;
  gap:           16px;
  background:    var(--vp-c-bg-soft);
  margin-bottom: 32px;
}

.si-hero-body {
  flex:           1;
  min-width:      0;
  display:        flex;
  flex-direction: column;
  gap:            8px;
}

/* Using <p role="heading"> to avoid a double-H1 in the VitePress DOM,
   since there is no Markdown # heading in the body of a converted section page. */
.si-title {
  font-size:      20px;
  font-weight:    500;
  line-height:    1.25;
  letter-spacing: -0.02em;
  margin:         0;
  padding:        0;
  border:         none;
  color:          var(--color-text-primary);
}

/* align-self: flex-start prevents the pill from stretching to fill the flex
   column's full width. border-radius: wiki-radius-sm (4px) gives a subtly
   rounded badge rather than a fully-pill shape.                               */
.si-eba-pill {
  align-self:     flex-start;
  display:        inline-block;
  font-size:      var(--wiki-text-xs);
  font-weight:    500;
  letter-spacing: 0.01em;
  padding:        3px 10px;
  border-radius:  var(--wiki-radius-sm);
  line-height:    1.6;
}

.si-count-chip {
  flex-shrink:    0;
  align-self:     flex-start;
  font-size:      11px;
  font-weight:    500;
  color:          var(--color-text-tertiary);
  background:     var(--vp-c-bg);
  border:         1px solid var(--color-border-tertiary);
  border-radius:  var(--wiki-radius-pill);
  padding:        4px 12px;
  white-space:    nowrap;
}

/* ── Section wrapper + label ─────────────────────────────────────────────── */
/* Mirrors the eip-section / eip-label pattern from EBAIndexPage. */
.si-section {
  margin-top: 0;
}

/* ── Stream mode: subsection card grid ───────────────────────────────────── */
.si-stream-grid {
  display:               grid;
  grid-template-columns: repeat(2, 1fr);
  gap:                   10px;
}

.si-stream-card {
  display:       flex;
  align-items:   center;
  gap:           12px;
  padding:       15px 16px;
  border:        1px solid var(--color-border-tertiary);
  border-radius: var(--border-radius-md);
  background:    var(--color-background-primary);
  box-shadow:    var(--wiki-shadow-card);
  transition:    box-shadow   0.15s ease,
                 border-color 0.15s ease,
                 transform    0.15s ease;
  cursor:        pointer;
}

.si-stream-card:hover {
  box-shadow:   var(--wiki-shadow-lift);
  border-color: var(--color-border-secondary);
  transform:    translateY(-1px);
}

.si-stream-card-body {
  flex:           1;
  display:        flex;
  flex-direction: column;
  gap:            3px;
}

.si-stream-title {
  font-size:   13px;
  font-weight: 500;
  color:       var(--color-text-primary);
  line-height: 1.35;
}

.si-stream-count {
  font-size:  11px;
  color:      var(--color-text-tertiary);
  margin-top: 1px;
}

/* ── Section mode: clause row list ───────────────────────────────────────── */
/* Mirrors eip-parts-list: no outer container border; each row carries its own
   top/bottom borders, lifts on hover via box-shadow + translateY.            */

.si-clause-row {
  display:       flex;
  align-items:   center;
  gap:           13px;
  padding:       15px 18px;
  border-bottom: 1px solid var(--color-border-tertiary);
  position:      relative;
  background:    var(--color-background-primary);
  transition:    box-shadow 0.15s ease, transform 0.15s ease;
  cursor:        pointer;
}

.si-clause-row:last-child {
  border-bottom: none;
}

/* Lift on hover — identical to eip-part hover treatment */
.si-clause-row:hover {
  box-shadow: var(--wiki-shadow-lift);
  z-index:    1;
  transform:  translateY(-1px);
}

/* Clause number chip — fixed square matching eip-part-icon proportions */
.si-clause-num {
  flex-shrink:          0;
  width:                34px;
  height:               34px;
  display:              flex;
  align-items:          center;
  justify-content:      center;
  font-size:            var(--wiki-text-sm);
  font-weight:          600;
  font-variant-numeric: tabular-nums;
  border-radius:        var(--wiki-radius-md);
  line-height:          1;
}

/* Clause body */
.si-clause-body {
  flex:      1;
  min-width: 0;
}

.si-clause-title {
  font-size:     13px;
  font-weight:   500;
  color:         var(--color-text-primary);
  display:       block;
  line-height:   1.35;
  margin-bottom: 4px;
}

.si-clause-summary {
  font-size:   12px;
  color:       var(--color-text-secondary);
  line-height: 1.5;
  display:     block;
  margin:      0 0 4px;
}

/* Topic tags */
.si-tags {
  display:    flex;
  flex-wrap:  wrap;
  gap:        5px;
  margin-top: 2px;
}

.si-tag {
  font-size:     var(--wiki-text-xs);
  font-weight:   500;
  color:         var(--color-text-tertiary);
  background:    var(--vp-c-bg-soft);
  border:        1px solid var(--color-border-tertiary);
  border-radius: var(--wiki-radius-sm);
  padding:       1px 7px;
  line-height:   1.6;
}

/* ── Chevron ──────────────────────────────────────────────────────────────── */
/* Clause rows: hidden by default, revealed on hover — mirrors eip-chevron.
   Stream cards: always visible (1), still slides on hover.                   */
.si-chevron {
  flex-shrink: 0;
  font-size:   13px;
  color:       var(--color-text-tertiary);
  transition:  opacity 0.15s ease, transform 0.15s ease;
}

/* Stream card chevron: always visible */
.si-stream-card .si-chevron {
  opacity: 1;
}

.si-stream-card:hover .si-chevron {
  transform: translateX(2px);
}

/* Clause row chevron: hidden until hover */
.si-clause-row .si-chevron {
  opacity: 0;
}

.si-clause-row:hover .si-chevron {
  opacity:   1;
  transform: translateX(2px);
}

/* ── Mobile ───────────────────────────────────────────────────────────────── */
@media (max-width: 640px) {
  .si-hero {
    flex-direction: column;
    gap:            10px;
  }

  .si-count-chip {
    align-self: flex-start;
  }

  .si-stream-grid {
    grid-template-columns: 1fr;
  }

  /* On touch devices hover never fires — show the clause chevron at low opacity
     so the navigation affordance is still visible. Mirrors eip mobile treatment. */
  .si-clause-row .si-chevron {
    opacity:   0.4;
    transform: none !important;
  }
}
</style>