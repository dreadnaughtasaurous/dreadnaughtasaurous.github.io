---
title: Search Analytics
layout: page
---

<script setup>
import { ref, onMounted } from 'vue'

const ANALYTICS_URL = 'https://eba-analytics-worker.irresistibl.workers.dev/analytics'
const ADMIN_TOKEN   = 'JaJ/_1VE[,f%:mCQlXW;wn$]>B6@%F^|'

const loading   = ref(true)
const error     = ref('')
const meta      = ref(null)
const top20     = ref([])
const zeroResult = ref([])

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
  } catch (err) {
    error.value = err.message
  }
  loading.value = false
})
</script>

# Search Analytics

<div v-if="loading" class="analytics-loading">Loading analytics data…</div>
<div v-else-if="error" class="analytics-error">⚠️ Could not load analytics: {{ error }}</div>
<template v-else>

<div class="analytics-meta">
  <div class="meta-card">
    <span class="meta-value">{{ meta.totalEntries }}</span>
    <span class="meta-label">Total searches</span>
  </div>
  <div class="meta-card">
    <span class="meta-value">{{ meta.totalSearch }}</span>
    <span class="meta-label">Keyword searches</span>
  </div>
  <div class="meta-card">
    <span class="meta-value">{{ meta.totalAsk }}</span>
    <span class="meta-label">Ask AI queries</span>
  </div>
</div>

## Top 20 Queries

<table class="analytics-table">
  <thead>
    <tr><th>#</th><th>Query</th><th>Tab</th><th>Count</th><th>Zero-result hits</th></tr>
  </thead>
  <tbody>
    <tr v-for="(row, i) in top20" :key="row.query">
      <td>{{ i + 1 }}</td>
      <td><code>{{ row.query }}</code></td>
      <td><span class="tab-pill" :class="row.tab">{{ row.tab === 'ask' ? 'Ask AI' : 'Search' }}</span></td>
      <td>{{ row.count }}</td>
      <td>{{ row.zeroResultCount > 0 ? row.zeroResultCount : '—' }}</td>
    </tr>
  </tbody>
</table>

## Zero-Result Queries

These are the most actionable content gap signals — queries users ran that returned no results.

<table class="analytics-table">
  <thead>
    <tr><th>#</th><th>Query</th><th>Tab</th><th>Zero-result hits</th></tr>
  </thead>
  <tbody>
    <tr v-for="(row, i) in zeroResult" :key="row.query">
      <td>{{ i + 1 }}</td>
      <td><code>{{ row.query }}</code></td>
      <td><span class="tab-pill" :class="row.tab">{{ row.tab === 'ask' ? 'Ask AI' : 'Search' }}</span></td>
      <td>{{ row.zeroResultCount }}</td>
    </tr>
    <tr v-if="zeroResult.length === 0">
      <td colspan="4" style="text-align:center;color:var(--vp-c-text-3)">No zero-result queries recorded yet.</td>
    </tr>
  </tbody>
</table>

</template>

<style scoped>
.analytics-loading, .analytics-error {
  padding: 2rem; text-align: center; color: var(--vp-c-text-2);
}
.analytics-error { color: var(--vp-c-danger-1); }
.analytics-meta {
  display: flex; gap: 1rem; flex-wrap: wrap; margin: 1.5rem 0;
}
.meta-card {
  flex: 1; min-width: 140px; padding: 1.25rem 1.5rem;
  background: var(--vp-c-bg-soft); border: 1px solid var(--vp-c-divider);
  border-radius: 10px; display: flex; flex-direction: column; gap: 0.25rem;
}
.meta-value { font-size: 2rem; font-weight: 700; color: var(--vp-c-brand-1); line-height: 1; }
.meta-label { font-size: 0.8rem; color: var(--vp-c-text-3); }
.analytics-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; margin: 1rem 0 2rem; }
.analytics-table th {
  text-align: left; padding: 0.5rem 0.75rem;
  font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em;
  color: var(--vp-c-text-3); border-bottom: 2px solid var(--vp-c-divider);
}
.analytics-table td { padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--vp-c-divider); color: var(--vp-c-text-1); }
.analytics-table tr:last-child td { border-bottom: none; }
.tab-pill {
  display: inline-block; padding: 0.1rem 0.5rem; border-radius: 999px;
  font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em;
}
.tab-pill.search { background: var(--vp-c-brand-soft); color: var(--vp-c-brand-1); }
.tab-pill.ask     { background: #7C3AED1A; color: #7C3AED; }
</style>