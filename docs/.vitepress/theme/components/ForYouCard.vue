<script setup>
/**
 * ForYouCard.vue
 *
 * A single recommendation card. Two variants:
 *   'rich'     — used on the For You page; shows EBA pill, title, section,
 *                topics, excerpt, and a "Because you viewed…" reason chip.
 *   'standard' — used on the homepage trending row; shows EBA pill, title,
 *                section, topics, and an optional view-count indicator.
 *
 * Props:
 *   page    {Object}  — entry from page-catalog.json, optionally augmented
 *                       with _count (view count) and _reason (reason string)
 *   variant {String}  — 'rich' | 'standard'   (default: 'standard')
 */
import { onUnmounted } from 'vue'

const props = defineProps({
  page:    { type: Object, required: true },
  variant: { type: String, default: 'standard' },
})

// ── mousedown flag for ClausePanel interception ───────────────────────────────
// VitePress intercepts <a> clicks in the capture phase, which fires before
// Vue's @click handlers (bubble phase). By the time @click runs, the router
// hook has already bailed. mousedown always fires before click in all phases,
// so the flag is reliably set before VitePress's handler runs.
//
// A 500ms safety timer clears the flag if no click follows the mousedown
// (right-click, drag-release, etc.) so stale flags can't affect later navs.
let _fyFlagTimer = null

function flagOnMousedown() {
  if (typeof window === 'undefined') return
  window.__fyCardPending = props.page.path
  clearTimeout(_fyFlagTimer)
  _fyFlagTimer = setTimeout(() => { window.__fyCardPending = null }, 500)
}

onUnmounted(() => clearTimeout(_fyFlagTimer))

// EBA colours keyed by folder slug — matches HomeCards.vue and SearchModal.vue
const EBA_COLORS = {
  'allied-health':        { color: '#EA580C', bg: '#EA580C1A', label: 'Allied Health' },
  'biomedical-engineers': { color: '#4F46E5', bg: '#4F46E51A', label: 'Biomedical Engineers' },
  'childrens-services':   { color: '#DB2777', bg: '#DB27771A', label: "Children's Services" },
  'doctors-in-training':  { color: '#D97706', bg: '#D977061A', label: 'Doctors in Training' },
  'has-managers-admin-2025-2027': { color: '#3B82F6', bg: '#3B82F61A', label: 'HAS Managers & Admin' },
  'mspp':                 { color: '#059669', bg: '#0596691A', label: 'Med Scientists & Pharm' },
  'medical-specialists':  { color: '#0891B2', bg: '#0891B21A', label: 'Medical Specialists' },
  'mental-health':        { color: '#7C3AED', bg: '#7C3AED1A', label: 'Mental Health' },
  'nurses-midwives':      { color: '#E11D48', bg: '#E11D481A', label: 'Nurses & Midwives' },
}

const TOPIC_LABELS = {
  'allowances':              'Allowances',
  'classification':          'Classification',
  'consultation':            'Consultation',
  'dispute-resolution':      'Disputes',
  'employment-types':        'Employment Types',
  'hours-of-work':           'Hours of Work',
  'leave':                   'Leave',
  'overtime':                'Overtime',
  'penalty-rates':           'Penalty Rates',
  'professional-development': 'Prof. Development',
  'termination':             'Termination',
  'wages':                   'Wages',
  'workload':                'Workload',
}

function ebaInfo(slug) {
  return EBA_COLORS[slug] || { color: '#6b7280', bg: '#6b72801A', label: slug || 'EBA' }
}

function topicLabel(t) {
  return TOPIC_LABELS[t] || t.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}
</script>

<template>
  <a :href="page.path" class="fy-card" :class="`fy-card--${variant}`" @mousedown="flagOnMousedown">

    <!-- EBA pill — colour-coded per EBA -->
    <span
      class="fy-card-pill"
      :style="{
        color: ebaInfo(page.ebaSlug).color,
        backgroundColor: ebaInfo(page.ebaSlug).bg,
      }"
    >{{ ebaInfo(page.ebaSlug).label }}</span>

    <!-- Page title -->
    <p class="fy-card-title">{{ page.title }}</p>

    <!-- Section name (Part / Division) -->
    <p v-if="page.section" class="fy-card-section">{{ page.section }}</p>

    <!-- Topic tags — max 3 to avoid wrapping clutter -->
    <div v-if="page.topics && page.topics.length" class="fy-card-topics">
      <span
        v-for="t in page.topics.slice(0, 3)"
        :key="t"
        class="fy-card-topic"
      >{{ topicLabel(t) }}</span>
    </div>

    <!-- ── Rich variant only ─────────────────────────────────────────────── -->
    <template v-if="variant === 'rich'">

      <!-- Excerpt: first prose paragraph, stripped of markdown -->
      <p v-if="page.excerpt" class="fy-card-excerpt">{{ page.excerpt }}</p>

      <!-- "Because you viewed…" reason chip -->
      <p v-if="page._reason" class="fy-card-reason">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2"
             stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <circle cx="12" cy="12" r="10"/>
          <path d="M12 16v-4"/>
          <path d="M12 8h.01"/>
        </svg>
        {{ page._reason }}
      </p>

    </template>

    <!-- Standard variant: context line -->
    <!-- _count  → flame icon + "N views this week"  (Trending Now row)     -->
    <!-- _contextMsg → italic message         (all other rows)              -->
    <template v-if="variant === 'standard'">
      <p v-if="page._count" class="fy-card-context fy-card-context--count">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z"/>
        </svg>
        {{ page._count.toLocaleString() }} views this week
      </p>
      <p v-else-if="page._contextMsg" class="fy-card-context">{{ page._contextMsg }}</p>
    </template>

  </a>
</template>

<style scoped>
/* ── Card shell ──────────────────────────────────────────────────────────── */
.fy-card {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
  text-decoration: none;
  color: inherit;
  transition: border-color 0.15s, box-shadow 0.15s, transform 0.1s;
  cursor: pointer;
  overflow-wrap: break-word;
}

.fy-card:hover {
  border-color: var(--vp-c-brand-2);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-1px);
  text-decoration: none;
}

.dark .fy-card:hover {
  box-shadow: 0 2px 14px rgba(0, 0, 0, 0.35);
}

/* ── EBA pill ────────────────────────────────────────────────────────────── */
.fy-card-pill {
  display: inline-block;
  padding: 0.14rem 0.45rem;
  border-radius: 4px;
  font-size: 0.67rem;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  width: fit-content;
  flex-shrink: 0;
}

/* ── Title ───────────────────────────────────────────────────────────────── */
.fy-card-title {
  margin: 0;
  font-size: 0.87rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
  line-height: 1.35;
}

/* ── Section ─────────────────────────────────────────────────────────────── */
.fy-card-section {
  margin: 0;
  font-size: 0.74rem;
  color: var(--vp-c-text-2);
}

/* ── Topic tags ──────────────────────────────────────────────────────────── */
.fy-card-topics {
  display: flex;
  flex-wrap: wrap;
  gap: 0.28rem;
  margin-top: 0.1rem;
}

.fy-card-topic {
  padding: 0.1rem 0.38rem;
  border-radius: 4px;
  font-size: 0.64rem;
  font-weight: 500;
  background: var(--vp-c-bg-mute);
  color: var(--vp-c-text-2);
  border: 1px solid var(--vp-c-divider);
}

/* ── Rich: excerpt ───────────────────────────────────────────────────────── */
.fy-card-excerpt {
  margin: 0.2rem 0 0 0;
  font-size: 0.77rem;
  color: var(--vp-c-text-2);
  line-height: 1.5;
  /* Two-line clamp */
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

/* ── Rich: reason chip ───────────────────────────────────────────────────── */
.fy-card-reason {
  display: flex;
  align-items: center;
  gap: 0.28rem;
  margin: 0.15rem 0 0 0;
  font-size: 0.67rem;
  color: var(--vp-c-brand-1);
  font-style: italic;
}

/* ── Standard variant: context line ─────────────────────────────────────── */
/* Base style: italic, muted — used for "Based on your interest in…" etc.    */
.fy-card-context {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  margin: 0.15rem 0 0 0;
  font-size: 0.67rem;
  color: var(--vp-c-text-2);
  font-style: italic;
}

/* Count modifier: flame-orange, not italic — used for "N views this week"   */
.fy-card-context--count {
  color: #EA580C;
  font-style: normal;
}

.dark .fy-card-context--count {
  color: #fb923c;
}

</style>