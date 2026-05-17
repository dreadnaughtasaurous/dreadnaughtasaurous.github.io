<script setup>
import { ref, computed, onMounted } from 'vue'

// ── Constants ────────────────────────────────────────────────────────────────
const ANALYTICS_URL  = 'https://eba-analytics-worker.irresistibl.workers.dev/analytics'
const TOKEN_STORAGE  = 'eba-admin-token'  // sessionStorage key — clears on tab close

// ── EBA display names (folder slug → readable label) ─────────────────────────
const EBA_LABELS = {
  'allied-health':       'Allied Health',
  'biomedical-engineers':'Biomedical Engineers',
  'childrens-services':  "Children's Services",
  'doctors-in-training': 'Doctors in Training',
  'has-managers-admin':  'HAS Managers & Admin',
  'medical-specialists': 'Medical Specialists',
  'mental-health':       'Mental Health',
  'medical-scientists':  'Medical Scientists',
  'nurses-midwives':     'Nurses & Midwives',
}

const EBA_COLORS = {
  'allied-health':        '#EA580C',
  'biomedical-engineers': '#4F46E5',
  'childrens-services':   '#DB2777',
  'doctors-in-training':  '#D97706',
  'has-managers-admin':   '#3B82F6',
  'medical-specialists':  '#0891B2',
  'mental-health':        '#7C3AED',
  'medical-scientists':   '#059669',
  'nurses-midwives':      '#E11D48',
}

const BROWSER_COLORS = {
  Chrome:  '#4285F4',
  Firefox: '#FF6611',
  Safari:  '#006CFF',
  Edge:    '#0078D4',
  Opera:   '#FF1B2D',
  IE:      '#1EBBEE',
  Other:   '#94A3B8',
}

const DEVICE_COLORS = {
  desktop: '#4A2A72',
  mobile:  '#D21C62',
  tablet:  '#0891B2',
}

// ── State ────────────────────────────────────────────────────────────────────
const token      = ref('')
const authed     = ref(false)
const loading    = ref(false)
const error      = ref('')
const data       = ref(null)
const activeTab  = ref('overview')
const fetchedAt  = ref('')

// ── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'search',   label: 'Search' },
  { id: 'pages',    label: 'Pages' },
  { id: 'devices',  label: 'Devices' },
]

// ── Auth ─────────────────────────────────────────────────────────────────────
onMounted(() => {
  const saved = sessionStorage.getItem(TOKEN_STORAGE)
  if (saved) { token.value = saved; fetchData() }
})

async function login() {
  if (!token.value.trim()) return
  sessionStorage.setItem(TOKEN_STORAGE, token.value.trim())
  await fetchData()
}

function logout() {
  sessionStorage.removeItem(TOKEN_STORAGE)
  authed.value = false
  data.value   = null
  token.value  = ''
}

// ── Data fetch ───────────────────────────────────────────────────────────────
async function fetchData() {
  loading.value = true
  error.value   = ''
  try {
    const res = await fetch(ANALYTICS_URL, {
      headers: { Authorization: `Bearer ${token.value.trim()}` }
    })
    if (res.status === 401) {
      error.value = 'Invalid token — check your admin password and try again.'
      sessionStorage.removeItem(TOKEN_STORAGE)
      loading.value = false
      return
    }
    if (!res.ok) throw new Error(`Worker returned ${res.status}`)
    data.value    = await res.json()
    authed.value  = true
    fetchedAt.value = new Date().toLocaleString('en-AU', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    })
  } catch (err) {
    error.value = err.message
  }
  loading.value = false
}

// ── Computed helpers ─────────────────────────────────────────────────────────
const meta             = computed(() => data.value?.meta             || {})
const timeSeries       = computed(() => data.value?.timeSeries       || [])
const top20            = computed(() => data.value?.top20            || [])
const zeroResult       = computed(() => data.value?.zeroResult       || [])
const topPages         = computed(() => data.value?.topPages         || [])
const ebaBreakdown     = computed(() => data.value?.ebaBreakdown     || [])
const browserBreakdown = computed(() => data.value?.browserBreakdown || [])
const deviceBreakdown  = computed(() => data.value?.deviceBreakdown  || [])
const ebaFilterBreakdown = computed(() => data.value?.ebaFilterBreakdown || [])
const topicBreakdown   = computed(() => data.value?.topicBreakdown   || [])

// ── SVG chart helpers ────────────────────────────────────────────────────────

// Bar chart for time series (searches + pageviews per day)
const TIME_W = 700
const TIME_H = 160
const TIME_PAD = { top: 12, right: 8, bottom: 32, left: 36 }

const timeChartBars = computed(() => {
  const series = timeSeries.value
  if (!series.length) return { searches: [], pageviews: [], labels: [], yLines: [] }

  const maxVal = Math.max(...series.map(d => d.searches + d.pageviews), 1)
  const chartW = TIME_W - TIME_PAD.left - TIME_PAD.right
  const chartH = TIME_H - TIME_PAD.top  - TIME_PAD.bottom
  const barW   = Math.floor(chartW / series.length)
  const gap    = Math.max(1, Math.floor(barW * 0.15))
  const bW     = Math.floor((barW - gap) / 2)

  const scaleY = v => chartH - Math.round((v / maxVal) * chartH)

  // Y-axis guide lines (4 lines)
  const yLines = [0.25, 0.5, 0.75, 1].map(f => ({
    y:     Math.round(f * chartH),
    label: Math.round(f * maxVal),
  }))

  // Labels — show every 7th day to avoid crowding
  const labels = series.map((d, i) => ({
    x:    i * barW + Math.floor(barW / 2),
    text: i % 7 === 0 ? d.day.slice(5) : '', // MM-DD
  }))

  const searches  = series.map((d, i) => {
    const h = Math.max(1, chartH - scaleY(d.searches))
    return { x: i * barW + gap, y: scaleY(d.searches), w: bW, h }
  })

  const pageviews = series.map((d, i) => {
    const h = Math.max(1, chartH - scaleY(d.pageviews))
    return { x: i * barW + gap + bW, y: scaleY(d.pageviews), w: bW, h }
  })

  return { searches, pageviews, labels, yLines }
})

// Horizontal bar chart for top pages / browsers
function hBars(items, getValue, getLabel, getColor) {
  if (!items.length) return []
  const max = Math.max(...items.map(getValue), 1)
  return items.map((item, i) => ({
    label: getLabel(item),
    value: getValue(item),
    color: getColor(item),
    pct:   Math.round((getValue(item) / max) * 100),
    i,
  }))
}

const pageBars = computed(() =>
  hBars(topPages.value.slice(0, 10),
    d => d.count,
    d => d.title || d.path,
    () => '#4A2A72'
  )
)

const browserBars = computed(() =>
  hBars(browserBreakdown.value,
    d => d.count,
    d => d.browser,
    d => BROWSER_COLORS[d.browser] || '#94A3B8'
  )
)

const ebaBars = computed(() =>
  hBars(ebaBreakdown.value,
    d => d.count,
    d => EBA_LABELS[d.eba] || d.eba,
    d => EBA_COLORS[d.eba] || '#94A3B8'
  )
)

// Donut chart for device breakdown
const DONUT_R  = 54
const DONUT_CX = 70
const DONUT_CY = 70
const DONUT_STROKE = 28

const donutSegments = computed(() => {
  const items = deviceBreakdown.value
  if (!items.length) return []
  const total = items.reduce((s, d) => s + d.count, 0)
  if (!total) return []

  let angle = -90 // start at top
  return items.map(d => {
    const pct   = d.count / total
    const sweep = pct * 360
    const start = angle
    angle += sweep

    // SVG arc path
    const r2d   = Math.PI / 180
    const x1    = DONUT_CX + DONUT_R * Math.cos(start * r2d)
    const y1    = DONUT_CY + DONUT_R * Math.sin(start * r2d)
    const x2    = DONUT_CX + DONUT_R * Math.cos((start + sweep) * r2d)
    const y2    = DONUT_CY + DONUT_R * Math.sin((start + sweep) * r2d)
    const large = sweep > 180 ? 1 : 0

    return {
      path:    `M ${x1} ${y1} A ${DONUT_R} ${DONUT_R} 0 ${large} 1 ${x2} ${y2}`,
      color:   DEVICE_COLORS[d.device] || '#94A3B8',
      label:   d.device,
      count:   d.count,
      pct:     Math.round(pct * 100),
    }
  })
})

// ── Formatting helpers ───────────────────────────────────────────────────────
function fmtPath(path) {
  // /ebas/allied-health/allowances/33-foo → allied-health › allowances › 33-foo
  const parts = path.split('/').filter(Boolean)
  return parts.length >= 3 ? parts.slice(1).join(' › ') : path
}

function ebaLabel(slug) {
  return EBA_LABELS[slug] || slug
}

function ebaColor(slug) {
  return EBA_COLORS[slug] || '#94A3B8'
}
</script>

<template>
  <div class="ad-wrap">

    <!-- ── LOGIN PROMPT ──────────────────────────────────────────────────── -->
    <div v-if="!authed" class="ad-login">
      <div class="ad-login-card">
        <div class="ad-login-icon" aria-hidden="true">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
        </div>
        <h1 class="ad-login-title">Analytics Dashboard</h1>
        <p class="ad-login-sub">Admin access required. Enter your admin token to continue.</p>
        <div v-if="error" class="ad-error" role="alert">{{ error }}</div>
        <div class="ad-login-row">
          <input
            v-model="token"
            type="password"
            placeholder="Admin token"
            class="ad-token-input"
            @keydown.enter="login"
            autocomplete="current-password"
          />
          <button class="ad-login-btn" @click="login" :disabled="loading">
            <span v-if="loading" class="ad-spinner" aria-hidden="true"></span>
            <span v-else>Unlock</span>
          </button>
        </div>
        <p class="ad-login-hint">Token is stored in sessionStorage only — it clears when you close this tab.</p>
      </div>
    </div>

    <!-- ── DASHBOARD ────────────────────────────────────────────────────── -->
    <div v-else class="ad-dashboard">

      <!-- Header -->
      <div class="ad-header">
        <div>
          <h1 class="ad-title">Analytics Dashboard</h1>
          <p class="ad-subtitle">Privacy-respecting usage data — no IPs, no cookies, 90-day rolling window.</p>
        </div>
        <div class="ad-header-actions">
          <span v-if="fetchedAt" class="ad-freshness">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            {{ fetchedAt }}
          </span>
          <button class="ad-refresh-btn" @click="fetchData" :disabled="loading" title="Refresh data">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>
          </button>
          <button class="ad-logout-btn" @click="logout" title="Sign out">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          </button>
        </div>
      </div>

      <!-- Loading overlay -->
      <div v-if="loading" class="ad-loading">
        <div class="ad-spinner" aria-label="Loading"></div>
        <span>Loading analytics data…</span>
      </div>

      <template v-else>

        <!-- ── KPI STRIP ────────────────────────────────────────────────── -->
        <div class="ad-kpi-strip">
          <div class="ad-kpi" style="--kpi-color:#4A2A72">
            <span class="ad-kpi-val">{{ (meta.totalEntries || 0).toLocaleString() }}</span>
            <span class="ad-kpi-lbl">Total searches</span>
          </div>
          <div class="ad-kpi" style="--kpi-color:#0891B2">
            <span class="ad-kpi-val">{{ (meta.totalSearch || 0).toLocaleString() }}</span>
            <span class="ad-kpi-lbl">Keyword searches</span>
          </div>
          <div class="ad-kpi" style="--kpi-color:#7C3AED">
            <span class="ad-kpi-val">{{ (meta.totalAsk || 0).toLocaleString() }}</span>
            <span class="ad-kpi-lbl">Ask AI queries</span>
          </div>
          <div class="ad-kpi" style="--kpi-color:#D21C62">
            <span class="ad-kpi-val">{{ (meta.totalPageviews || 0).toLocaleString() }}</span>
            <span class="ad-kpi-lbl">Page views</span>
          </div>
          <div class="ad-kpi" style="--kpi-color:#059669">
            <span class="ad-kpi-val">{{ (meta.uniqueSessions || 0).toLocaleString() }}</span>
            <span class="ad-kpi-lbl">Unique sessions</span>
          </div>
          <div class="ad-kpi" style="--kpi-color:#D97706">
            <span class="ad-kpi-val">{{ meta.avgPagesPerSession || '0' }}</span>
            <span class="ad-kpi-lbl">Avg pages / session</span>
          </div>
        </div>

        <!-- ── TABS ─────────────────────────────────────────────────────── -->
        <div class="ad-tabs" role="tablist">
          <button
            v-for="tab in TABS"
            :key="tab.id"
            role="tab"
            :aria-selected="activeTab === tab.id"
            class="ad-tab"
            :class="{ 'ad-tab--active': activeTab === tab.id }"
            @click="activeTab = tab.id"
          >{{ tab.label }}</button>
        </div>

        <!-- ════════════════════════════════════════════════════════════════
             TAB: OVERVIEW
        ════════════════════════════════════════════════════════════════ -->
        <div v-if="activeTab === 'overview'" class="ad-panel">

          <div class="ad-section-hd">
            <h2 class="ad-section-title">Activity — last 30 days</h2>
            <p class="ad-section-desc">Keyword searches and page views per day.</p>
          </div>

          <!-- Time series SVG bar chart -->
          <div class="ad-chart-wrap" v-if="timeSeries.length">
            <svg
              :viewBox="`0 0 ${TIME_W} ${TIME_H}`"
              class="ad-timechart"
              aria-label="Searches and page views per day over the last 30 days"
              role="img"
            >
              <!-- Y-axis guide lines -->
              <g :transform="`translate(${TIME_PAD.left},${TIME_PAD.top})`">
                <line
                  v-for="line in timeChartBars.yLines"
                  :key="line.y"
                  x1="0" :y1="line.y"
                  :x2="TIME_W - TIME_PAD.left - TIME_PAD.right" :y2="line.y"
                  class="ad-chart-guide"
                />
                <text
                  v-for="line in timeChartBars.yLines"
                  :key="`lbl-${line.y}`"
                  :x="-4" :y="line.y + 4"
                  class="ad-chart-axis-lbl"
                  text-anchor="end"
                >{{ line.label }}</text>

                <!-- Search bars -->
                <rect
                  v-for="(bar, i) in timeChartBars.searches"
                  :key="`s${i}`"
                  :x="bar.x" :y="bar.y" :width="bar.w" :height="bar.h"
                  class="ad-bar-search"
                  rx="1"
                />
                <!-- Pageview bars -->
                <rect
                  v-for="(bar, i) in timeChartBars.pageviews"
                  :key="`p${i}`"
                  :x="bar.x" :y="bar.y" :width="bar.w" :height="bar.h"
                  class="ad-bar-pageview"
                  rx="1"
                />
                <!-- X-axis labels -->
                <text
                  v-for="lbl in timeChartBars.labels"
                  :key="`xl${lbl.x}`"
                  :x="lbl.x" :y="TIME_H - TIME_PAD.top - 4"
                  class="ad-chart-axis-lbl"
                  text-anchor="middle"
                >{{ lbl.text }}</text>
              </g>
            </svg>
            <!-- Legend -->
            <div class="ad-chart-legend">
              <span class="ad-legend-item ad-legend-search">Searches</span>
              <span class="ad-legend-item ad-legend-pageview">Page views</span>
            </div>
          </div>
          <div v-else class="ad-empty">No activity data yet.</div>

          <!-- EBA page view breakdown -->
          <div class="ad-section-hd" style="margin-top:2rem">
            <h2 class="ad-section-title">Page views by EBA</h2>
            <p class="ad-section-desc">Which agreements users read most.</p>
          </div>
          <div class="ad-hbars" v-if="ebaBars.length">
            <div v-for="bar in ebaBars" :key="bar.label" class="ad-hbar-row">
              <span class="ad-hbar-label">{{ bar.label }}</span>
              <div class="ad-hbar-track">
                <div class="ad-hbar-fill" :style="{ width: bar.pct + '%', background: bar.color }"></div>
              </div>
              <span class="ad-hbar-val">{{ bar.value }}</span>
            </div>
          </div>
          <div v-else class="ad-empty">No page view data yet.</div>

        </div>

        <!-- ════════════════════════════════════════════════════════════════
             TAB: SEARCH
        ════════════════════════════════════════════════════════════════ -->
        <div v-if="activeTab === 'search'" class="ad-panel">

          <!-- Top 20 queries -->
          <div class="ad-section-hd">
            <h2 class="ad-section-title">Top 20 queries</h2>
            <p class="ad-section-desc">Most frequently searched terms across both tabs.</p>
          </div>
          <div class="ad-table-wrap" v-if="top20.length">
            <table class="ad-table">
              <thead>
                <tr>
                  <th class="col-rank">#</th>
                  <th>Query</th>
                  <th class="col-tab">Tab</th>
                  <th class="col-num">Count</th>
                  <th class="col-num">Zero results</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, i) in top20" :key="row.query + row.tab">
                  <td class="col-rank ad-muted">{{ i + 1 }}</td>
                  <td><code class="ad-query">{{ row.query }}</code></td>
                  <td class="col-tab">
                    <span class="ad-pill" :class="row.tab === 'ask' ? 'ad-pill--ask' : 'ad-pill--search'">
                      {{ row.tab === 'ask' ? 'Ask AI' : 'Search' }}
                    </span>
                  </td>
                  <td class="col-num ad-bold">{{ row.count }}</td>
                  <td class="col-num">
                    <span v-if="row.zeroResultCount > 0" class="ad-zero-badge">{{ row.zeroResultCount }}</span>
                    <span v-else class="ad-muted">—</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="ad-empty">No search queries recorded yet.</div>

          <!-- Zero-result queries -->
          <div class="ad-section-hd" style="margin-top:2rem">
            <h2 class="ad-section-title">Zero-result queries</h2>
            <p class="ad-section-desc">Content gap signals — searches that found nothing.</p>
          </div>
          <div class="ad-table-wrap" v-if="zeroResult.length">
            <table class="ad-table">
              <thead>
                <tr>
                  <th class="col-rank">#</th>
                  <th>Query</th>
                  <th class="col-tab">Tab</th>
                  <th class="col-num">Hits</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, i) in zeroResult" :key="row.query">
                  <td class="col-rank ad-muted">{{ i + 1 }}</td>
                  <td><code class="ad-query">{{ row.query }}</code></td>
                  <td class="col-tab">
                    <span class="ad-pill" :class="row.tab === 'ask' ? 'ad-pill--ask' : 'ad-pill--search'">
                      {{ row.tab === 'ask' ? 'Ask AI' : 'Search' }}
                    </span>
                  </td>
                  <td class="col-num"><span class="ad-zero-badge">{{ row.zeroResultCount }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="ad-empty ad-empty--positive">Every search found results — no gaps detected yet.</div>

          <!-- EBA filter usage -->
          <div class="ad-section-hd" style="margin-top:2rem">
            <h2 class="ad-section-title">EBA filter usage</h2>
            <p class="ad-section-desc">Which EBA filters users apply when searching.</p>
          </div>
          <div class="ad-hbars" v-if="ebaFilterBreakdown.length">
            <div v-for="bar in ebaFilterBreakdown" :key="bar.eba" class="ad-hbar-row">
              <span class="ad-hbar-label">{{ ebaLabel(bar.eba) }}</span>
              <div class="ad-hbar-track">
                <div class="ad-hbar-fill" :style="{ width: Math.round((bar.count / ebaFilterBreakdown[0].count) * 100) + '%', background: ebaColor(bar.eba) }"></div>
              </div>
              <span class="ad-hbar-val">{{ bar.count }}</span>
            </div>
          </div>
          <div v-else class="ad-empty">No EBA filter usage recorded yet.</div>

          <!-- Topic filter usage -->
          <div class="ad-section-hd" style="margin-top:2rem">
            <h2 class="ad-section-title">Topic filter usage</h2>
            <p class="ad-section-desc">Which topic filters users apply when searching.</p>
          </div>
          <div class="ad-hbars" v-if="topicBreakdown.length">
            <div v-for="bar in topicBreakdown" :key="bar.topic" class="ad-hbar-row">
              <span class="ad-hbar-label">{{ bar.topic }}</span>
              <div class="ad-hbar-track">
                <div class="ad-hbar-fill" :style="{ width: Math.round((bar.count / topicBreakdown[0].count) * 100) + '%', background: '#4A2A72' }"></div>
              </div>
              <span class="ad-hbar-val">{{ bar.count }}</span>
            </div>
          </div>
          <div v-else class="ad-empty">No topic filter usage recorded yet.</div>

        </div>

        <!-- ════════════════════════════════════════════════════════════════
             TAB: PAGES
        ════════════════════════════════════════════════════════════════ -->
        <div v-if="activeTab === 'pages'" class="ad-panel">

          <!-- Top 10 pages chart -->
          <div class="ad-section-hd">
            <h2 class="ad-section-title">Top 10 most-viewed pages</h2>
            <p class="ad-section-desc">Clause pages with the highest view counts.</p>
          </div>
          <div class="ad-hbars" v-if="pageBars.length">
            <div v-for="bar in pageBars" :key="bar.label" class="ad-hbar-row">
              <span class="ad-hbar-label ad-hbar-label--path" :title="bar.label">{{ bar.label }}</span>
              <div class="ad-hbar-track">
                <div class="ad-hbar-fill" :style="{ width: bar.pct + '%', background: '#4A2A72' }"></div>
              </div>
              <span class="ad-hbar-val">{{ bar.value }}</span>
            </div>
          </div>
          <div v-else class="ad-empty">No page view data yet.</div>

          <!-- Full top 20 pages table -->
          <div class="ad-section-hd" style="margin-top:2rem">
            <h2 class="ad-section-title">Top 20 pages — full list</h2>
          </div>
          <div class="ad-table-wrap" v-if="topPages.length">
            <table class="ad-table">
              <thead>
                <tr>
                  <th class="col-rank">#</th>
                  <th>Page</th>
                  <th class="col-eba">EBA</th>
                  <th class="col-num">Views</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(page, i) in topPages" :key="page.path">
                  <td class="col-rank ad-muted">{{ i + 1 }}</td>
                  <td>
                    <span class="ad-page-title">{{ page.title || fmtPath(page.path) }}</span>
                    <span class="ad-page-path ad-muted">{{ fmtPath(page.path) }}</span>
                  </td>
                  <td class="col-eba">
                    <span
                      v-if="page.eba"
                      class="ad-eba-pill"
                      :style="{ background: ebaColor(page.eba) + '1A', color: ebaColor(page.eba) }"
                    >{{ ebaLabel(page.eba) }}</span>
                  </td>
                  <td class="col-num ad-bold">{{ page.count }}</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-else class="ad-empty">No page view data yet.</div>

        </div>

        <!-- ════════════════════════════════════════════════════════════════
             TAB: DEVICES
        ════════════════════════════════════════════════════════════════ -->
        <div v-if="activeTab === 'devices'" class="ad-panel">

          <div class="ad-devices-grid">

            <!-- Donut chart — device type -->
            <div class="ad-device-chart-wrap">
              <div class="ad-section-hd">
                <h2 class="ad-section-title">Device type</h2>
              </div>
              <div class="ad-donut-wrap" v-if="donutSegments.length">
                <svg viewBox="0 0 140 140" class="ad-donut" aria-label="Device type breakdown" role="img">
                  <circle :cx="DONUT_CX" :cy="DONUT_CY" :r="DONUT_R"
                    fill="none" stroke="var(--vp-c-divider)" :stroke-width="DONUT_STROKE" />
                  <path
                    v-for="seg in donutSegments"
                    :key="seg.label"
                    :d="seg.path"
                    fill="none"
                    :stroke="seg.color"
                    :stroke-width="DONUT_STROKE"
                    stroke-linecap="butt"
                  />
                </svg>
                <div class="ad-donut-legend">
                  <div v-for="seg in donutSegments" :key="seg.label" class="ad-donut-item">
                    <span class="ad-donut-swatch" :style="{ background: seg.color }"></span>
                    <span class="ad-donut-label">{{ seg.label }}</span>
                    <span class="ad-donut-pct">{{ seg.pct }}%</span>
                  </div>
                </div>
              </div>
              <div v-else class="ad-empty">No device data yet.</div>
            </div>

            <!-- Browser breakdown bars -->
            <div>
              <div class="ad-section-hd">
                <h2 class="ad-section-title">Browser</h2>
              </div>
              <div class="ad-hbars" v-if="browserBars.length">
                <div v-for="bar in browserBars" :key="bar.label" class="ad-hbar-row">
                  <span class="ad-hbar-label">{{ bar.label }}</span>
                  <div class="ad-hbar-track">
                    <div class="ad-hbar-fill" :style="{ width: bar.pct + '%', background: bar.color }"></div>
                  </div>
                  <span class="ad-hbar-val">{{ bar.value }}</span>
                </div>
              </div>
              <div v-else class="ad-empty">No browser data yet.</div>
            </div>

          </div>

          <!-- Combined device + browser table -->
          <div class="ad-section-hd" style="margin-top:2rem">
            <h2 class="ad-section-title">Device × browser breakdown</h2>
            <p class="ad-section-desc">Raw counts across all event types.</p>
          </div>
          <div class="ad-devices-tables">
            <div class="ad-table-wrap">
              <table class="ad-table">
                <thead><tr><th>Browser</th><th class="col-num">Events</th></tr></thead>
                <tbody>
                  <tr v-for="row in browserBreakdown" :key="row.browser">
                    <td>
                      <span class="ad-browser-dot" :style="{ background: BROWSER_COLORS[row.browser] || '#94A3B8' }"></span>
                      {{ row.browser }}
                    </td>
                    <td class="col-num ad-bold">{{ row.count }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div class="ad-table-wrap">
              <table class="ad-table">
                <thead><tr><th>Device</th><th class="col-num">Events</th></tr></thead>
                <tbody>
                  <tr v-for="row in deviceBreakdown" :key="row.device">
                    <td>
                      <span class="ad-browser-dot" :style="{ background: DEVICE_COLORS[row.device] || '#94A3B8' }"></span>
                      {{ row.device }}
                    </td>
                    <td class="col-num ad-bold">{{ row.count }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

        </div>

      </template>
    </div>
  </div>
</template>

<style scoped>
/* ── Outer wrapper ─────────────────────────────────────────────────────────── */
.ad-wrap { padding: 2rem 2.5rem 4rem; max-width: 980px; }

/* ── Login card ────────────────────────────────────────────────────────────── */
.ad-login { display: flex; justify-content: center; padding: 4rem 0; }
.ad-login-card {
  width: 100%; max-width: 420px;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 14px;
  padding: 2.5rem 2rem;
  display: flex; flex-direction: column; align-items: center; gap: 0.75rem;
  text-align: center;
}
.ad-login-icon {
  width: 52px; height: 52px;
  background: var(--vp-c-bg-elv);
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  color: var(--vp-c-brand-1);
  margin-bottom: 0.25rem;
}
.ad-login-title { font-size: 1.25rem; font-weight: 700; color: var(--vp-c-text-1); margin: 0; }
.ad-login-sub   { font-size: 0.85rem; color: var(--vp-c-text-2); margin: 0; }
.ad-login-row   { display: flex; gap: 0.5rem; width: 100%; margin-top: 0.5rem; }
.ad-token-input {
  flex: 1; padding: 0.5rem 0.75rem;
  background: var(--vp-c-bg); border: 1px solid var(--vp-c-divider);
  border-radius: 7px; font-size: 0.9rem; color: var(--vp-c-text-1);
  outline: none;
}
.ad-token-input:focus { border-color: var(--vp-c-brand-1); }
.ad-login-btn {
  padding: 0.5rem 1.1rem;
  background: var(--vp-c-brand-1); color: #fff;
  border: none; border-radius: 7px;
  font-size: 0.875rem; font-weight: 600; cursor: pointer;
  display: flex; align-items: center; gap: 0.4rem;
}
.ad-login-btn:disabled { opacity: 0.6; cursor: not-allowed; }
.ad-login-hint { font-size: 0.75rem; color: var(--vp-c-text-3); margin: 0; }

/* ── Dashboard header ──────────────────────────────────────────────────────── */
.ad-header {
  display: flex; align-items: flex-start; justify-content: space-between;
  flex-wrap: wrap; gap: 1rem; margin-bottom: 1.75rem;
}
.ad-title    { font-size: 1.5rem; font-weight: 700; color: var(--vp-c-text-1); margin: 0 0 0.2rem; }
.ad-subtitle { font-size: 0.85rem; color: var(--vp-c-text-2); margin: 0; }
.ad-header-actions { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
.ad-freshness {
  display: inline-flex; align-items: center; gap: 0.3rem;
  font-size: 0.72rem; color: var(--vp-c-text-3); white-space: nowrap;
}
.ad-refresh-btn, .ad-logout-btn {
  display: flex; align-items: center; justify-content: center;
  width: 30px; height: 30px;
  background: var(--vp-c-bg-soft); border: 1px solid var(--vp-c-divider);
  border-radius: 7px; cursor: pointer; color: var(--vp-c-text-2);
}
.ad-refresh-btn:hover, .ad-logout-btn:hover { background: var(--vp-c-bg-elv); }

/* ── Loading ───────────────────────────────────────────────────────────────── */
.ad-loading {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 3rem 0; color: var(--vp-c-text-2); font-size: 0.9rem;
}

/* ── Spinner ───────────────────────────────────────────────────────────────── */
.ad-spinner {
  display: inline-block; width: 16px; height: 16px;
  border: 2px solid var(--vp-c-divider);
  border-top-color: var(--vp-c-brand-1);
  border-radius: 50%; animation: ad-spin 0.7s linear infinite; flex-shrink: 0;
}
@keyframes ad-spin { to { transform: rotate(360deg); } }

/* ── Error ─────────────────────────────────────────────────────────────────── */
.ad-error {
  width: 100%;
  padding: 0.65rem 0.875rem;
  background: var(--vp-c-danger-soft); border: 1px solid var(--vp-c-danger-2);
  border-radius: 7px; color: var(--vp-c-danger-1); font-size: 0.82rem;
  text-align: left;
}

/* ── KPI strip ─────────────────────────────────────────────────────────────── */
.ad-kpi-strip {
  display: grid; grid-template-columns: repeat(6, 1fr); gap: 0.75rem;
  margin-bottom: 1.75rem;
}
@media (max-width: 900px) { .ad-kpi-strip { grid-template-columns: repeat(3, 1fr); } }
@media (max-width: 540px) { .ad-kpi-strip { grid-template-columns: repeat(2, 1fr); } }

.ad-kpi {
  padding: 1rem 1.1rem;
  background: var(--vp-c-bg-soft); border: 1px solid var(--vp-c-divider);
  border-top: 3px solid var(--kpi-color, var(--vp-c-brand-1));
  border-radius: 10px;
  display: flex; flex-direction: column; gap: 0.2rem;
}
.ad-kpi-val {
  font-size: 1.6rem; font-weight: 700; color: var(--vp-c-text-1);
  line-height: 1; font-variant-numeric: tabular-nums;
}
.ad-kpi-lbl {
  font-size: 0.7rem; color: var(--vp-c-text-3);
  text-transform: uppercase; letter-spacing: 0.04em;
}

/* ── Tabs ──────────────────────────────────────────────────────────────────── */
.ad-tabs {
  display: flex; gap: 0; border-bottom: 1px solid var(--vp-c-divider);
  margin-bottom: 1.75rem;
}
.ad-tab {
  padding: 0.55rem 1.1rem;
  font-size: 0.875rem; font-weight: 500; color: var(--vp-c-text-2);
  background: none; border: none; border-bottom: 2px solid transparent;
  margin-bottom: -1px; cursor: pointer; transition: color 120ms, border-color 120ms;
}
.ad-tab:hover { color: var(--vp-c-text-1); }
.ad-tab--active { color: var(--vp-c-brand-1); border-bottom-color: var(--vp-c-brand-1); }

/* ── Panel ─────────────────────────────────────────────────────────────────── */
.ad-panel { }

/* ── Section headings ──────────────────────────────────────────────────────── */
.ad-section-hd   { margin-bottom: 0.875rem; }
.ad-section-title {
  font-size: 1rem; font-weight: 600; color: var(--vp-c-text-1);
  margin: 0 0 0.15rem; border: none; padding: 0;
}
.ad-section-desc { font-size: 0.78rem; color: var(--vp-c-text-3); margin: 0; }

/* ── Time series chart ─────────────────────────────────────────────────────── */
.ad-chart-wrap { margin-bottom: 0.5rem; }
.ad-timechart  { width: 100%; height: auto; display: block; }
.ad-chart-guide { stroke: var(--vp-c-divider); stroke-width: 1; }
.ad-chart-axis-lbl {
  font-size: 9px; fill: var(--vp-c-text-3);
  font-family: var(--vp-font-family-mono);
}
.ad-bar-search   { fill: #4A2A72; opacity: 0.85; }
.ad-bar-pageview { fill: #D21C62; opacity: 0.85; }

.ad-chart-legend { display: flex; gap: 1.25rem; margin-top: 0.5rem; }
.ad-legend-item {
  display: inline-flex; align-items: center; gap: 0.4rem;
  font-size: 0.75rem; color: var(--vp-c-text-2);
}
.ad-legend-item::before {
  content: ''; display: inline-block;
  width: 10px; height: 10px; border-radius: 2px;
}
.ad-legend-search::before  { background: #4A2A72; }
.ad-legend-pageview::before { background: #D21C62; }

/* ── Horizontal bar rows ───────────────────────────────────────────────────── */
.ad-hbars { display: flex; flex-direction: column; gap: 0.5rem; }
.ad-hbar-row {
  display: grid; grid-template-columns: 160px 1fr 2.5rem;
  align-items: center; gap: 0.65rem;
}
.ad-hbar-label {
  font-size: 0.82rem; color: var(--vp-c-text-1);
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.ad-hbar-label--path { font-size: 0.78rem; }
.ad-hbar-track {
  height: 8px; background: var(--vp-c-bg-elv);
  border-radius: 99px; overflow: hidden;
}
.ad-hbar-fill {
  height: 100%; border-radius: 99px;
  transition: width 400ms cubic-bezier(0.4,0,0.2,1);
}
.ad-hbar-val {
  font-size: 0.78rem; color: var(--vp-c-text-2);
  text-align: right; font-variant-numeric: tabular-nums;
}

/* ── Tables ────────────────────────────────────────────────────────────────── */
.ad-table-wrap {
  overflow-x: auto; border: 1px solid var(--vp-c-divider); border-radius: 10px;
}
.ad-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
.ad-table thead {
  position: sticky; top: 0; background: var(--vp-c-bg-soft); z-index: 1;
}
.ad-table th {
  text-align: left; padding: 0.55rem 0.875rem;
  font-size: 0.7rem; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--vp-c-text-3);
  border-bottom: 1px solid var(--vp-c-divider); white-space: nowrap;
}
.ad-table td {
  padding: 0.55rem 0.875rem; border-bottom: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-1); vertical-align: middle;
}
.ad-table tbody tr:last-child td { border-bottom: none; }
.ad-table tbody tr:hover td { background: var(--vp-c-bg-elv); }

.col-rank { width: 2.5rem; text-align: center; }
.col-tab  { width: 6rem; }
.col-num  { width: 5.5rem; text-align: right; }
.col-eba  { width: 10rem; }

.ad-muted { color: var(--vp-c-text-3); font-size: 0.8rem; }
.ad-bold  { font-weight: 600; font-variant-numeric: tabular-nums; }

.ad-query {
  font-family: var(--vp-font-family-mono); font-size: 0.8rem;
  background: var(--vp-c-bg-elv); padding: 0.12rem 0.4rem; border-radius: 4px;
}

/* ── Pills ─────────────────────────────────────────────────────────────────── */
.ad-pill {
  display: inline-block; padding: 0.12rem 0.5rem; border-radius: 999px;
  font-size: 0.65rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;
}
.ad-pill--search { background: var(--vp-c-brand-soft); color: var(--vp-c-brand-1); }
.ad-pill--ask    { background: #7C3AED1A; color: #7C3AED; }

.ad-eba-pill {
  display: inline-block; padding: 0.12rem 0.5rem; border-radius: 999px;
  font-size: 0.65rem; font-weight: 600; white-space: nowrap;
}

.ad-zero-badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 1.4rem; padding: 0.08rem 0.4rem; border-radius: 999px;
  font-size: 0.7rem; font-weight: 700;
  background: #D977061A; color: #D97706; font-variant-numeric: tabular-nums;
}

/* ── Page cell ─────────────────────────────────────────────────────────────── */
.ad-page-title { display: block; font-size: 0.84rem; color: var(--vp-c-text-1); }
.ad-page-path  { display: block; font-size: 0.72rem; margin-top: 0.1rem; }

/* ── Devices tab ───────────────────────────────────────────────────────────── */
.ad-devices-grid {
  display: grid; grid-template-columns: 200px 1fr; gap: 2rem; align-items: start;
}
@media (max-width: 640px) { .ad-devices-grid { grid-template-columns: 1fr; } }

.ad-donut-wrap { display: flex; flex-direction: column; align-items: center; gap: 1rem; }
.ad-donut      { width: 140px; height: 140px; }

.ad-donut-legend { display: flex; flex-direction: column; gap: 0.4rem; width: 100%; }
.ad-donut-item   { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; }
.ad-donut-swatch { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
.ad-donut-label  { flex: 1; color: var(--vp-c-text-1); text-transform: capitalize; }
.ad-donut-pct    { color: var(--vp-c-text-3); font-variant-numeric: tabular-nums; }

.ad-browser-dot {
  display: inline-block; width: 8px; height: 8px;
  border-radius: 50%; margin-right: 0.4rem; flex-shrink: 0;
}
.ad-devices-tables { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
@media (max-width: 540px) { .ad-devices-tables { grid-template-columns: 1fr; } }

/* ── Empty states ──────────────────────────────────────────────────────────── */
.ad-empty {
  padding: 2.5rem 1.5rem; text-align: center;
  border: 1px solid var(--vp-c-divider); border-radius: 10px;
  background: var(--vp-c-bg-soft); font-size: 0.85rem; color: var(--vp-c-text-3);
}
.ad-empty--positive { color: #059669; background: #0596691A; border-color: #05966940; }
</style>