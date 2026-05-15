---
title: Search Analytics
layout: page
---

<script setup>
import { ref, onMounted } from 'vue'

const ANALYTICS_URL = 'https://eba-analytics-worker.irresistibl.workers.dev/analytics'
const ADMIN_TOKEN   = 'JaJ/_1VE[,f%:mCQlXW;wn$]>B6@%F^|'

const loading    = ref(true)
const error      = ref('')
const meta       = ref(null)
const top20      = ref([])
const zeroResult = ref([])
const fetchedAt  = ref('')

onMounted(async () => {
  try {
    const res = await fetch(ANALYTICS_URL, {
      headers: { Authorization: `Bearer ${ADMIN_TOKEN}` }
    })
    if (!res.ok) throw new Error(`Worker returned ${res.status}`)
    const data = await res.json()
    meta.value       = data.meta
    top20.value      = data.top20
    zeroResult.value = data.zeroResult
    fetchedAt.value  = new Date().toLocaleString('en-AU', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  } catch (err) {
    error.value = err.message
  }
  loading.value = false
})
</script>

<div class="analytics-dashboard">

<div class="analytics-page-header">
  <div>
    <h1 class="analytics-title">Search Analytics</h1>
    <p class="analytics-subtitle">Anonymous query data collected from the wiki's search and Ask AI features.</p>
  </div>
  <span v-if="fetchedAt" class="analytics-freshness">
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
    Refreshed {{ fetchedAt }}
  </span>
</div>

<div v-if="loading" class="analytics-loading">
  <div class="loading-spinner" aria-label="Loading analytics data"></div>
  <span>Loading analytics data…</span>
</div>

<div v-else-if="error" class="analytics-error" role="alert">
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
  Could not load analytics: {{ error }}
</div>

<template v-else>

<!-- ─── KPI CARDS ──────────────────────────────────────────────── -->
<div class="kpi-grid">
  <div class="kpi-card kpi-total">
    <div class="kpi-icon" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    </div>
    <div class="kpi-body">
      <span class="kpi-value">{{ meta.totalEntries.toLocaleString() }}</span>
      <span class="kpi-label">Total searches</span>
    </div>
  </div>
  <div class="kpi-card kpi-keyword">
    <div class="kpi-icon" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>
    </div>
    <div class="kpi-body">
      <span class="kpi-value">{{ meta.totalSearch.toLocaleString() }}</span>
      <span class="kpi-label">Keyword searches</span>
    </div>
  </div>
  <div class="kpi-card kpi-ask">
    <div class="kpi-icon" aria-hidden="true">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
    </div>
    <div class="kpi-body">
      <span class="kpi-value">{{ meta.totalAsk.toLocaleString() }}</span>
      <span class="kpi-label">Ask AI queries</span>
    </div>
  </div>
</div>

<!-- ─── TOP 20 QUERIES ─────────────────────────────────────────── -->
<div class="analytics-section">
  <div class="section-header">
    <div>
      <h2 class="section-title">Top 20 Queries</h2>
      <p class="section-desc">The most frequently searched terms across both search tabs.</p>
    </div>
  </div>

  <div class="table-wrap" v-if="top20.length > 0">
    <table class="analytics-table">
      <thead>
        <tr>
          <th class="col-rank">#</th>
          <th>Query</th>
          <th class="col-tab">Tab</th>
          <th class="col-count">Count</th>
          <th class="col-zero">Zero-result hits</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in top20" :key="row.query">
          <td class="col-rank rank-num">{{ i + 1 }}</td>
          <td><code class="query-text">{{ row.query }}</code></td>
          <td class="col-tab">
            <span class="tab-pill" :class="row.tab">{{ row.tab === 'ask' ? 'Ask AI' : 'Search' }}</span>
          </td>
          <td class="col-count count-num">{{ row.count }}</td>
          <td class="col-zero">
            <span v-if="row.zeroResultCount > 0" class="zero-badge">{{ row.zeroResultCount }}</span>
            <span v-else class="zero-none">—</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <div v-else class="empty-state">
    <div class="empty-icon" aria-hidden="true">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
    </div>
    <p class="empty-title">No queries recorded yet</p>
    <p class="empty-body">Search activity will appear here once users start using the wiki's search features.</p>
  </div>
</div>

<!-- ─── ZERO-RESULT QUERIES ────────────────────────────────────── -->
<div class="analytics-section">
  <div class="section-header">
    <div>
      <h2 class="section-title">Zero-Result Queries</h2>
      <p class="section-desc">The most actionable content gap signals — queries users ran that returned no results.</p>
    </div>
  </div>

  <div class="table-wrap" v-if="zeroResult.length > 0">
    <table class="analytics-table">
      <thead>
        <tr>
          <th class="col-rank">#</th>
          <th>Query</th>
          <th class="col-tab">Tab</th>
          <th class="col-zero">Zero-result hits</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(row, i) in zeroResult" :key="row.query">
          <td class="col-rank rank-num">{{ i + 1 }}</td>
          <td><code class="query-text">{{ row.query }}</code></td>
          <td class="col-tab">
            <span class="tab-pill" :class="row.tab">{{ row.tab === 'ask' ? 'Ask AI' : 'Search' }}</span>
          </td>
          <td class="col-zero">
            <span class="zero-badge">{{ row.zeroResultCount }}</span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <div v-else class="empty-state empty-state--positive">
    <div class="empty-icon" aria-hidden="true">
      <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
    </div>
    <p class="empty-title">No zero-result queries yet</p>
    <p class="empty-body">Great news — every search is finding relevant content. This section will surface gaps as they emerge.</p>
  </div>
</div>

</template>
</div>

<style scoped>
/* ─────────────────────────────────────────────
   OUTER WRAPPER — fixes flush-to-sidebar issue
───────────────────────────────────────────── */
.analytics-dashboard {
  padding: 2rem 2.5rem 3rem;
  max-width: 960px;
}

/* ─────────────────────────────────────────────
   PAGE HEADER
───────────────────────────────────────────── */
.analytics-page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  flex-wrap: wrap;
  margin-bottom: 2rem;
}
.analytics-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--vp-c-text-1);
  margin: 0 0 0.25rem;
  line-height: 1.2;
}
.analytics-subtitle {
  font-size: 0.875rem;
  color: var(--vp-c-text-2);
  margin: 0;
}
.analytics-freshness {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.75rem;
  color: var(--vp-c-text-3);
  white-space: nowrap;
  padding-top: 0.25rem;
}

/* ─────────────────────────────────────────────
   LOADING / ERROR
───────────────────────────────────────────── */
.analytics-loading {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 3rem 0;
  color: var(--vp-c-text-2);
  font-size: 0.9rem;
}
.loading-spinner {
  width: 18px;
  height: 18px;
  border: 2px solid var(--vp-c-divider);
  border-top-color: var(--vp-c-brand-1);
  border-radius: 50%;
  animation: spin 0.7s linear infinite;
  flex-shrink: 0;
}
@keyframes spin { to { transform: rotate(360deg); } }

.analytics-error {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1rem;
  background: var(--vp-c-danger-soft);
  border: 1px solid var(--vp-c-danger-2);
  border-radius: 8px;
  color: var(--vp-c-danger-1);
  font-size: 0.875rem;
  margin-bottom: 1.5rem;
}

/* ─────────────────────────────────────────────
   KPI CARDS
───────────────────────────────────────────── */
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 2.5rem;
}
@media (max-width: 640px) {
  .kpi-grid { grid-template-columns: 1fr; }
}
.kpi-card {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1.25rem 1.5rem;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  border-left-width: 3px;
}
.kpi-total   { border-left-color: var(--vp-c-brand-1); }
.kpi-keyword { border-left-color: #0891B2; }
.kpi-ask     { border-left-color: #7C3AED; }

.kpi-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  background: var(--vp-c-bg-elv);
  flex-shrink: 0;
  color: var(--vp-c-text-2);
}
.kpi-total   .kpi-icon { color: var(--vp-c-brand-1); }
.kpi-keyword .kpi-icon { color: #0891B2; }
.kpi-ask     .kpi-icon { color: #7C3AED; }

.kpi-body {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.kpi-value {
  font-size: 1.875rem;
  font-weight: 700;
  color: var(--vp-c-text-1);
  line-height: 1;
  font-variant-numeric: tabular-nums;
}
.kpi-label {
  font-size: 0.78rem;
  color: var(--vp-c-text-3);
  text-transform: uppercase;
  letter-spacing: 0.04em;
}

/* ─────────────────────────────────────────────
   SECTION
───────────────────────────────────────────── */
.analytics-section {
  margin-bottom: 2.5rem;
}
.section-header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin-bottom: 1rem;
  gap: 1rem;
}
.section-title {
  font-size: 1.05rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
  margin: 0 0 0.2rem;
  border: none;
  padding: 0;
}
.section-desc {
  font-size: 0.8rem;
  color: var(--vp-c-text-3);
  margin: 0;
}

/* ─────────────────────────────────────────────
   TABLE
───────────────────────────────────────────── */
.table-wrap {
  overflow-x: auto;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
}
.analytics-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.875rem;
}
.analytics-table thead {
  position: sticky;
  top: 0;
  background: var(--vp-c-bg-soft);
  z-index: 1;
}
.analytics-table th {
  text-align: left;
  padding: 0.625rem 0.875rem;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vp-c-text-3);
  border-bottom: 1px solid var(--vp-c-divider);
  white-space: nowrap;
}
.analytics-table td {
  padding: 0.625rem 0.875rem;
  border-bottom: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-1);
  vertical-align: middle;
}
.analytics-table tbody tr:last-child td { border-bottom: none; }
.analytics-table tbody tr:hover td {
  background: var(--vp-c-bg-elv);
  transition: background 120ms ease;
}
.col-rank  { width: 2.5rem; text-align: center; }
.col-tab   { width: 6rem; }
.col-count { width: 5rem; text-align: right; }
.col-zero  { width: 8rem; text-align: right; }

.rank-num {
  color: var(--vp-c-text-3);
  font-size: 0.8rem;
  text-align: center;
  font-variant-numeric: tabular-nums;
}
.count-num {
  text-align: right;
  font-variant-numeric: tabular-nums;
  font-weight: 600;
  color: var(--vp-c-text-1);
}
.query-text {
  font-family: var(--vp-font-family-mono);
  font-size: 0.82rem;
  background: var(--vp-c-bg-elv);
  padding: 0.15rem 0.45rem;
  border-radius: 4px;
  color: var(--vp-c-text-1);
}

/* ─────────────────────────────────────────────
   PILLS & BADGES
───────────────────────────────────────────── */
.tab-pill {
  display: inline-block;
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  white-space: nowrap;
}
.tab-pill.search { background: var(--vp-c-brand-soft); color: var(--vp-c-brand-1); }
.tab-pill.ask    { background: #7C3AED1A; color: #7C3AED; }

.zero-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.4rem;
  padding: 0.1rem 0.45rem;
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 700;
  background: #D977061A;
  color: #D97706;
  font-variant-numeric: tabular-nums;
}
.zero-none {
  color: var(--vp-c-text-3);
  font-size: 0.85rem;
}

/* ─────────────────────────────────────────────
   EMPTY STATES
───────────────────────────────────────────── */
.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  padding: 3rem 2rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
  gap: 0.5rem;
}
.empty-icon {
  width: 52px;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 12px;
  background: var(--vp-c-bg-elv);
  color: var(--vp-c-text-3);
  margin-bottom: 0.5rem;
}
.empty-state--positive .empty-icon {
  background: #0596691A;
  color: #059669;
}
.empty-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
  margin: 0;
}
.empty-body {
  font-size: 0.82rem;
  color: var(--vp-c-text-3);
  max-width: 38ch;
  margin: 0;
  line-height: 1.55;
}
</style>