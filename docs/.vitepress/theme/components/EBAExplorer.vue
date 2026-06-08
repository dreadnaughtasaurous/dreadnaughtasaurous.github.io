<script setup>
import { ref, onMounted } from 'vue'
import { EBA_REGISTRY, getEBAStatus } from '../eba-registry.js'

const TOPICS = [
  { label: 'Wages',                    topic: 'wages' },
  { label: 'Overtime',                 topic: 'overtime' },
  { label: 'Penalty Rates',            topic: 'penalty-rates' },
  { label: 'Leave',                    topic: 'leave' },
  { label: 'Allowances',               topic: 'allowances' },
  { label: 'Hours of Work',            topic: 'hours-of-work' },
  { label: 'Classification',           topic: 'classification' },
  { label: 'Employment Types',         topic: 'employment-types' },
  { label: 'Consultation',             topic: 'consultation' },
  { label: 'Dispute Resolution',       topic: 'dispute-resolution' },
  { label: 'Termination',              topic: 'termination' },
  { label: 'Professional Development', topic: 'professional-development' },
  { label: 'Workload',                 topic: 'workload' },
]

const STATUS_LABEL = {
  'current':       'Current',
  'expiring':      'Expiring Soon',
  'renegotiation': 'Under Renegotiation',
  'superseded':    'Superseded',
  'modern-award':  'Modern Award',
}
const STATUS_COLOR = {
  'current':       '#059669',
  'expiring':      '#D97706',
  'renegotiation': '#3B82F6',
  'superseded':    '#6B7280',
  'modern-award':  '#7C3AED',
}

const ebas   = EBA_REGISTRY.filter(e => !e.archived)
const active = ref(ebas[0])

const counts        = ref({})
const countsLoading = ref(true)
onMounted(async () => {
  try {
    const r = await fetch('/clause-counts.json')
    if (r.ok) counts.value = await r.json()
  } catch {}
  countsLoading.value = false
})

function topicCount(topic) {
  return counts.value[active.value.slug]?.[topic] ?? null
}
function totalCount() {
  return counts.value[active.value.slug]?._total ?? null
}

function openTopic(topic) {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('open-search', {
    detail: { eba: active.value.name, topic }
  }))
}
</script>

<template>
  <div class="eba-explorer">

    <!-- Left: EBA list -->
    <nav class="ee-list" aria-label="Select agreement">
      <button
        v-for="e in ebas" :key="e.slug"
        class="ee-list-item"
        :class="{ 'ee-list-item--active': active.slug === e.slug }"
        :style="active.slug === e.slug ? { borderLeftColor: e.color } : {}"
        @click="active = e"
      >
        <span class="ee-dot" :style="{ background: e.color }"></span>
        {{ e.shortName }}
      </button>
    </nav>

    <!-- Right: topic grid -->
    <div class="ee-panel">

      <!-- Panel header -->
      <div class="ee-panel-head">
        <div class="ee-panel-title">
          <span class="ee-panel-dot" :style="{ background: active.color }"></span>
          <span>{{ active.name }}</span>
        </div>
        <span class="ee-status-text"
              :style="{ color: STATUS_COLOR[getEBAStatus(active)] }">
          {{ STATUS_LABEL[getEBAStatus(active)] }}
        </span>
      </div>

      <!-- Topic pills -->
      <div class="ee-pills">
        <button
          v-for="t in TOPICS" :key="t.topic"
          class="ee-pill"
          @click="openTopic(t.topic)"
        >
          {{ t.label }}
          <span v-if="countsLoading" class="ee-skeleton ee-skel-count" aria-hidden="true"></span>
          <span v-else-if="topicCount(t.topic)" class="ee-pill-count">
            {{ topicCount(t.topic) }}
          </span>
        </button>
      </div>

      <!-- Stats strip -->
      <div v-if="countsLoading || totalCount()" class="ee-stats">
        <template v-if="countsLoading">
          <span class="ee-skeleton ee-skel-stats-line" aria-hidden="true"></span>
        </template>
        <template v-else>
          <span>{{ totalCount() }} clauses in this agreement</span>
          <span class="ee-stats-hint">Select a topic to filter search results</span>
        </template>
      </div>

      <!-- Footer links -->
      <div class="ee-footer">
        <a :href="active.indexPath" class="ee-footer-link">Browse all clauses →</a>
        <a :href="active.pdfPath"
           :target="active.pdfExternal ? '_blank' : undefined"
           :rel="active.pdfExternal ? 'noopener noreferrer' : undefined"
           class="ee-footer-link">
          {{ active.pdfExternal ? 'View on Fair Work Commission ↗' : 'Download Full Agreement PDF ↓' }}
        </a>
      </div>

    </div>
  </div>
</template>

<style scoped>
.eba-explorer {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 0.75rem;
  margin: 1.5rem 0;
  align-items: stretch;
}

/* ── Left list ───────────────────────────────────────────────────── */
.ee-list {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  background: var(--vp-c-bg-soft);
  border-radius: 10px;
  padding: 0.35rem;
  overflow-y: auto;
}

.ee-list-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 0.75rem;
  border: none;
  border-left: 3px solid transparent;
  border-radius: 7px;
  background: transparent;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--vp-c-text-2);
  text-align: left;
  cursor: pointer;
  transition: background 0.12s, color 0.12s, box-shadow 0.12s;
}
.ee-list-item:hover { background: var(--vp-c-bg-mute); color: var(--vp-c-text-1); }
.ee-list-item--active {
  background: var(--vp-c-bg);
  color: var(--vp-c-text-1);
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
}
.dark .ee-list-item--active {
  box-shadow: 0 1px 6px rgba(0,0,0,0.3);
}

.ee-dot {
  flex-shrink: 0;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

/* ── Right panel ─────────────────────────────────────────────────── */
.ee-panel {
  display: flex;
  flex-direction: column;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 4px 16px rgba(0,0,0,0.06);
}
.dark .ee-panel {
  box-shadow: 0 4px 20px rgba(0,0,0,0.25);
}

.ee-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.7rem 1rem;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  gap: 0.75rem;
}

.ee-panel-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
}

.ee-panel-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.ee-status-text {
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}

/* ── Topic pills ─────────────────────────────────────────────────── */
.ee-pills {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  padding: 0.9rem;
  flex: 1;
  align-content: flex-start;
}

.ee-pill {
  padding: 0.3rem 0.75rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 20px;
  background: var(--vp-c-bg-soft);
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--vp-c-text-2);
  cursor: pointer;
  transition: border-color 0.12s, color 0.12s;
  white-space: nowrap;
}
.ee-pill:hover {
  border-color: v-bind('active.color');
  color: v-bind('active.color');
}

.ee-pill-count {
  margin-left: 0.25rem;
  font-size: 0.7rem;
  font-weight: 600;
  opacity: 0.55;
}

.ee-stats {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.55rem 0.9rem;
  border-top: 1px solid var(--vp-c-divider);
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--vp-c-text-2);
}

.ee-stats-hint {
  font-size: 0.73rem;
  color: var(--vp-c-text-3);
  font-weight: 400;
}

/* ── Footer ──────────────────────────────────────────────────────── */
.ee-footer {
  display: flex;
  gap: 1.25rem;
  padding: 0.6rem 1rem;
  border-top: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
}

.ee-footer-link {
  font-size: 0.78rem;
  font-weight: 500;
  color: var(--vp-c-brand-1);
  text-decoration: none;
}
.ee-footer-link:hover { text-decoration: underline; }

/* ── Skeleton ────────────────────────────────────────────────────── */
.ee-skeleton {
  display: inline-block;
  border-radius: 999px;
  background: linear-gradient(
    90deg,
    var(--vp-c-bg-soft) 25%,
    var(--vp-c-bg-mute) 50%,
    var(--vp-c-bg-soft) 75%
  );
  background-size: 200% 100%;
  animation: ee-shimmer 1.5s ease-in-out infinite;
}
.ee-skel-count      { width: 28px; height: 14px; vertical-align: middle; margin-left: 0.25rem; }
.ee-skel-stats-line { width: 180px; height: 14px; border-radius: 5px; }
@keyframes ee-shimmer {
  0%   { background-position:  200% 0; }
  100% { background-position: -200% 0; }
}

/* ── Mobile: stack vertically ────────────────────────────────────── */
@media (max-width: 640px) {
  .eba-explorer {
    grid-template-columns: 1fr;
  }
  .ee-list {
    flex-direction: row;
    overflow-x: auto;
    overflow-y: hidden;
    border-right: none;
    border-bottom: 1px solid var(--vp-c-divider);
  }
  .ee-list-item {
    flex-shrink: 0;
    border-bottom: none;
    border-left: none;
    border-bottom: 3px solid transparent;
  }
  .ee-list-item--active {
    border-left-color: transparent !important;
    border-bottom-color: v-bind('active.color');
  }
  .ee-pills { padding: 0.65rem; }
}
</style>