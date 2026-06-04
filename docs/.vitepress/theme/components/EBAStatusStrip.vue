<script setup>
import { computed } from 'vue'
import { EBA_REGISTRY, getEBAStatus } from '../eba-registry.js'

const STATUS_META = {
  'current':       { label: 'Current',            color: '#059669', bg: '#05966918' },
  'expiring':      { label: 'Expiring Soon',       color: '#D97706', bg: '#D9770618' },
  'renegotiation': { label: 'Under Renegotiation', color: '#3B82F6', bg: '#3B82F618' },
  'superseded':    { label: 'Superseded',           color: '#6B7280', bg: '#6B728018' },
  'modern-award':  { label: 'Modern Award',         color: '#7C3AED', bg: '#7C3AED18' },
}

// Most urgent statuses float to the top
const SORT_ORDER = ['renegotiation', 'expiring', 'current', 'modern-award', 'superseded']

const rows = computed(() =>
  EBA_REGISTRY
    .filter(e => !e.archived)
    .map(e => ({ ...e, status: getEBAStatus(e) }))
    .sort((a, b) => SORT_ORDER.indexOf(a.status) - SORT_ORDER.indexOf(b.status))
)

function formatExpiry(e) {
  if (e.isModernAward) return 'FWC reviewed'
  return new Date(e.nominalExpiry).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function daysContext(e) {
  if (e.isModernAward || !e.nominalExpiry) return null
  const days = Math.floor((new Date(e.nominalExpiry) - new Date()) / 86_400_000)
  const abs  = Math.abs(days)
  const mo   = Math.floor(abs / 30)
  if (days >= 0) return mo >= 2 ? `${mo} months remaining` : `${abs} days remaining`
  return mo >= 2 ? `${mo} months past expiry` : `${abs} days past expiry`
}
</script>

<template>
  <div class="eba-status-strip">
    <div class="ess-header">
      <span class="ess-title">Agreement Status</span>
      <span class="ess-subtitle">Updates automatically · status reflects today's date</span>
    </div>

    <div class="ess-table-wrap">
      <table class="ess-table">
        <thead>
          <tr>
            <th>Agreement</th>
            <th>Nominal Expiry</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="row in rows" :key="row.slug">
            <td>
              <a :href="row.status === 'superseded' ? `/ebas/archived/${row.slug}/` : row.indexPath"
                 class="ess-eba-link">
                <span class="ess-dot" :style="{ background: row.color }"></span>
                {{ row.shortName }}
              </a>
            </td>
            <td class="ess-expiry">
              <span>{{ formatExpiry(row) }}</span>
              <span v-if="daysContext(row)" class="ess-days">{{ daysContext(row) }}</span>
            </td>
            <td>
              <span class="ess-status-text"
                    :style="{ color: STATUS_META[row.status].color }">
                {{ STATUS_META[row.status].label }}
              </span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <p class="ess-note">
      Agreements operating past their nominal expiry remain legally in effect under
      the <em>Fair Work Act 2009</em> (s.58) until a replacement is ratified.
    </p>
  </div>
</template>

<style scoped>
.eba-status-strip {
  margin: 1.5rem 0 2rem;
}

.ess-header {
  display: flex;
  align-items: baseline;
  gap: 0.75rem;
  padding: 0 0 0.6rem 0;
}

.ess-title {
  font-size: 0.8rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--vp-c-text-1);
}

.ess-subtitle {
  font-size: 0.72rem;
  color: var(--vp-c-text-3);
}

.ess-table-wrap {
  overflow: auto;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  box-shadow: 0 4px 16px rgba(0,0,0,0.06);
}
.dark .ess-table-wrap {
  box-shadow: 0 4px 20px rgba(0,0,0,0.25);
}

.ess-table {
  width: 100% !important;
  border-collapse: collapse !important;
  font-size: 0.875rem;
  margin: 0 !important;
  display: table !important;
}

.ess-table thead tr {
  border-bottom: 1px solid var(--vp-c-divider);
}

.ess-table th {
  padding: 0.35rem 1rem;
  text-align: left;
  font-size: 0.72rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--vp-c-text-3);
  background: var(--vp-c-bg-soft);
}

.ess-table td {
  padding: 0.4rem 1rem;
  border-bottom: 1px solid var(--vp-c-divider);
  vertical-align: middle;
}

.ess-table tbody tr:last-child td {
  border-bottom: none;
}

.ess-table tbody tr:hover td {
  background: var(--vp-c-bg-soft);
}

.ess-eba-link {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 500;
  color: var(--vp-c-text-1);
  text-decoration: none;
}
.ess-eba-link:hover { color: var(--vp-c-brand-1); }

.ess-dot {
  flex-shrink: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.ess-expiry {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 0.5rem;
  color: var(--vp-c-text-2);
}

.ess-days {
  font-size: 0.75rem;
  color: var(--vp-c-text-3);
}

.ess-status-text {
  font-size: 0.8rem;
  font-weight: 600;
}

.ess-note {
  margin: 0;
  padding: 0.5rem 0 0;
  font-size: 0.75rem;
  line-height: 1.4;
  color: var(--vp-c-text-3);
}
</style>