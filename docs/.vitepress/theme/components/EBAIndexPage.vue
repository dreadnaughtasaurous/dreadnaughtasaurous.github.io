<script setup>
import { computed } from 'vue'
import { useData }  from 'vitepress'
import { EBA_REGISTRY, getEBAStatus } from '../eba-registry.js'
import { EBA_INDEX_DATA }             from '../eba-index-data.js'

const { frontmatter } = useData()

// Look up registry entry by matching frontmatter.eba → entry.name
const reg = computed(() =>
  EBA_REGISTRY.find(e => e.name === frontmatter.value.eba) ?? null
)

// Look up content data by slug
const data = computed(() =>
  reg.value ? (EBA_INDEX_DATA[reg.value.slug] ?? null) : null
)

const status = computed(() =>
  reg.value ? getEBAStatus(reg.value) : null
)

const statusLabel = computed(() => ({
  'current':       'Active',
  'expiring':      'Expiring soon',
  'renegotiation': 'Under renegotiation',
  'modern-award':  'Modern Award',
  'superseded':    'Superseded',
}[status.value] ?? ''))

const expiryWarn = computed(() =>
  status.value === 'expiring' || status.value === 'renegotiation'
)

function formatDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso + 'T00:00:00')
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

// Dispatches open-search with the EBA pre-filtered — SearchModal listens for this.
function openSearch() {
  if (typeof window === 'undefined' || !reg.value) return
  window.dispatchEvent(new CustomEvent('open-search', { detail: { eba: reg.value.name } }))
}
</script>

<template>
  <div v-if="reg && data" class="eip-root">

    <!-- ── Hero strip ──────────────────────────────────────────────────── -->
    <div class="eip-hero" :style="{ borderLeftColor: reg.color }">
      <div class="eip-hero-body">
        <p role="heading" aria-level="1" class="eip-title">{{ reg.name }}</p>
        <p class="eip-subtitle">
          {{ data.coverageClassifications.join(' · ') }} · {{ data.agreementType }}
        </p>
      </div>
      <div class="eip-hero-actions">
        <span
          class="eip-badge"
          :class="`eip-badge--${status}`"
          :style="status === 'renegotiation' ? { background: reg.bg, color: reg.color } : {}"
        >{{ statusLabel }}</span>
        <a
          v-if="reg.pdfPath"
          :href="reg.pdfPath"
          :target="reg.pdfExternal ? '_blank' : '_blank'"
          rel="noopener noreferrer"
          class="eip-pdf-btn"
          :style="{ color: reg.color, borderColor: reg.color + '55', '--eip-eba-color': reg.color }"
        >
          <i class="ti ti-file-download" aria-hidden="true"></i> Full Agreement PDF
        </a>
      </div>
    </div>

    <!-- ── Facts row ───────────────────────────────────────────────────── -->
    <div class="eip-facts">
      <div class="eip-fact">
        <div class="eip-fact-label">Commenced</div>
        <div class="eip-fact-value">{{ formatDate(data.commencement) }}</div>
      </div>
      <div class="eip-fact">
        <div class="eip-fact-label">Nominal expiry</div>
        <div class="eip-fact-value" :class="{ 'eip-fact-warn': expiryWarn }">
          {{ reg.nominalExpiry ? formatDate(reg.nominalExpiry) : 'No expiry' }}
        </div>
      </div>
      <div class="eip-fact">
        <div class="eip-fact-label">Agreement type</div>
        <div class="eip-fact-value eip-fact-sm">{{ data.agreementType }}</div>
      </div>
    </div>

    <!-- ── Search CTA ──────────────────────────────────────────────────── -->
    <button
      class="eip-search-cta"
      :aria-label="`Search within the ${reg.shortName} EBA`"
      @click="openSearch"
    >
      <i class="ti ti-search eip-search-icon" aria-hidden="true"></i>
      <span class="eip-search-text">Search within this EBA…</span>
      <kbd class="eip-kbd">/</kbd>
    </button>

    <!-- ── Common lookups (Concept B) ─────────────────────────────────── -->
    <div v-if="data.quickAccess?.length" class="eip-section">
      <p class="eip-label">Common lookups</p>
      <div class="eip-quick-grid" :style="{ background: reg.color + '0d' }">
        <a
          v-for="item in data.quickAccess"
          :key="item.path"
          :href="item.path"
          class="eip-quick-card"
        >
          <span class="eip-quick-icon-wrap" :style="{ background: reg.color + '26' }">
            <i class="ti" :class="item.icon" :style="{ color: reg.color }" aria-hidden="true"></i>
          </span>
          <div>
            <div class="eip-quick-name">{{ item.label }}</div>
            <div class="eip-quick-sub">{{ item.sub }}</div>
          </div>
        </a>
      </div>
    </div>

    <!-- ── Parts list (Concept A) ──────────────────────────────────────── -->
    <div v-if="data.parts?.length" class="eip-section">
      <p class="eip-label">Parts of this agreement</p>
      <div class="eip-parts-list">
        <a
          v-for="part in data.parts"
          :key="part.path"
          :href="part.path"
          class="eip-part"
        >
          <div class="eip-part-icon" :style="part.highlight ? { background: reg.color + '1a', borderColor: reg.color + '44' } : {}">
            <i class="ti" :class="part.icon" :style="part.highlight ? { color: reg.color } : {}" aria-hidden="true"></i>
          </div>
          <div class="eip-part-body">
            <span class="eip-part-name">{{ part.label }} — {{ part.title }}</span>
            <span class="eip-part-desc">{{ part.description }}</span>
          </div>
          <i class="ti ti-chevron-right eip-chevron" aria-hidden="true"></i>
        </a>
      </div>
    </div>

    <!-- ── Coverage callout (Concept C) ───────────────────────────────── -->
    <div v-if="data.coverageClassifications?.length" class="eip-section">
      <div class="eip-coverage">
        <div class="eip-cov-header">
          <span class="eip-label" style="margin-bottom:0">Who is covered</span>
          <a
            v-if="data.coverageAppendix"
            :href="data.coverageAppendix"
            class="eip-cov-link"
            :style="{ color: reg.color }"
          >See full employer list →</a>
        </div>
        <div class="eip-cov-chips">
          <span
            v-for="cls in data.coverageClassifications"
            :key="cls"
            class="eip-chip"
            :style="{ background: reg.bg, color: reg.color }"
          >{{ cls }}</span>
          <span v-if="data.coverageDesc" class="eip-chip eip-chip-muted">{{ data.coverageDesc }}</span>
        </div>
        <div class="eip-cov-footer">
          <span v-if="data.employerRep" class="eip-rep">Employer rep: <strong>{{ data.employerRep }}</strong></span>
          <span v-if="data.employeeRep" class="eip-rep">Employee rep: <strong>{{ data.employeeRep }}</strong></span>
          <span class="eip-rep">FWC ref: <strong>{{ data.fwcRef }}</strong><template v-if="data.fwcDecision || data.fwcOdn"> ({{ [data.fwcDecision, data.fwcOdn ? `ODN ${data.fwcOdn}` : null].filter(Boolean).join(', ') }})</template></span>
        </div>
      </div>
    </div>

  </div>

  <!-- Fallback shown if frontmatter.eba doesn't match any registry entry -->
  <p v-else class="eip-fallback">
    EBA index data not found for "<code>{{ frontmatter.eba }}</code>".
    Check that <code>eba:</code> in this page's frontmatter exactly matches a
    <code>name</code> value in <code>eba-registry.js</code> and that the slug
    has an entry in <code>eba-index-data.js</code>.
  </p>
</template>

<style>
/* Non-scoped global reset — beats .vp-doc a via cascade order (injected after theme bundle).
   Scoped !important was losing because VitePress defers its theme CSS load. */
.eip-root a {
  text-decoration: none !important;
  font-weight: inherit !important;
}
.eip-root a.eip-part,
.eip-root a.eip-quick-card {
  color: inherit !important;
}
</style>

<style scoped>
.eip-root { padding: 1rem 0 3rem; }

/* ── Hero ─────────────────────────────────────────────────────────────────── */
.eip-hero {
  border-left: 3px solid transparent;
  border-top: 0.5px solid var(--color-border-tertiary);
  border-right: 0.5px solid var(--color-border-tertiary);
  border-bottom: 0.5px solid var(--color-border-tertiary);
  border-radius: 0 var(--border-radius-md) var(--border-radius-md) 0;
  padding: 20px 22px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  background: var(--vp-c-bg-soft);
}
.eip-hero-body { flex: 1; min-width: 0; }
.eip-title {
  font-size: 20px;
  font-weight: 500;
  line-height: 1.25;
  letter-spacing: -0.02em;
  margin: 0 0 8px;
  color: var(--color-text-primary);
}
.eip-subtitle {
  font-size: 13px;
  color: var(--color-text-secondary);
  line-height: 1.5;
  margin: 0;
}
.eip-hero-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 9px;
  flex-shrink: 0;
}
.eip-badge {
  font-size: 11px;
  font-weight: 500;
  border-radius: var(--wiki-radius-pill);
  padding: 4px 12px;
  white-space: nowrap;
  letter-spacing: 0.01em;
}
.eip-badge--current       { background: var(--color-background-success); color: var(--color-text-success); }
.eip-badge--expiring      { background: var(--color-background-warning); color: var(--color-text-warning); }
.eip-badge--renegotiation { background: var(--color-background-danger);  color: var(--color-text-danger); }
.eip-badge--modern-award  { background: var(--color-background-info);    color: var(--color-text-info); }
.eip-badge--superseded    { background: var(--color-background-secondary); color: var(--color-text-secondary); }

/* PDF button — fills solid on hover via --eip-eba-color CSS custom property   */
/* set in the template :style binding so it adapts per-EBA.                    */
.eip-pdf-btn {
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid;
  border-radius: var(--border-radius-md);
  padding: 6px 13px;
  background: transparent;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.2s ease, color 0.2s ease, border-color 0.2s ease;
}
.eip-pdf-btn:hover {
  background: var(--eip-eba-color) !important;
  color: #fff !important;
  border-color: var(--eip-eba-color) !important;
}
.eip-pdf-btn .ti { font-size: 14px; }

/* ── Facts ────────────────────────────────────────────────────────────────── */
.eip-facts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-top: 16px;
}
.eip-fact {
  background: var(--vp-c-bg-soft);
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: 2px;
  padding: 13px 16px;
}
.eip-fact-label {
  font-size: var(--wiki-text-xs);
  font-weight: 500;
  color: var(--color-text-tertiary);
  letter-spacing: 0.09em;
  text-transform: uppercase;
  margin-bottom: 7px;
}
.eip-fact-value {
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
  line-height: 1.3;
}
.eip-fact-warn { color: var(--color-text-warning); }
.eip-fact-sm   { font-size: 12px; line-height: 1.45; }

/* ── Search CTA ───────────────────────────────────────────────────────────── */
.eip-search-cta {
  margin-top: 20px;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  border: 1px solid var(--color-border-tertiary);
  border-radius: var(--wiki-radius-pill);
  padding: 11px 20px;
  background: var(--color-background-primary);
  cursor: pointer;
  text-align: left;
  color: inherit;
  box-shadow: 0 1px 4px rgba(0,0,0,0.06), 0 4px 12px rgba(0,0,0,0.05);
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}
.eip-search-cta:hover {
  border-color: var(--color-border-secondary);
  box-shadow: 0 2px 8px rgba(0,0,0,0.08), 0 6px 20px rgba(0,0,0,0.07);
}
.eip-search-icon { font-size: 15px; color: var(--color-text-tertiary); flex-shrink: 0; }
.eip-search-text { font-size: 13px; color: var(--color-text-tertiary); flex: 1; }
.eip-kbd {
  font-size: 11px;
  color: var(--color-text-tertiary);
  border: 0.5px solid var(--color-border-secondary);
  border-radius: 4px;
  padding: 2px 8px;
  font-family: var(--font-mono);
  background: var(--color-background-secondary);
}

/* ── Sections ─────────────────────────────────────────────────────────────── */
.eip-section { margin-top: 32px; }
.eip-label {
  font-size: var(--wiki-text-xs);
  font-weight: 500;
  color: var(--color-text-tertiary);
  letter-spacing: 0.08em;
  text-transform: uppercase;
  margin-bottom: 10px;
  padding-bottom: 6px;
  border-bottom: 1px solid var(--color-border-tertiary);
  display: block;
}

/* ── Quick access ─────────────────────────────────────────────────────────── */
/* Container background is set inline via :style="{ background: reg.color + '0d' }" */
.eip-quick-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  padding: 10px;
  border-radius: var(--border-radius-lg);
}
.eip-quick-card {
  background: var(--color-background-primary);
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: var(--border-radius-md);
  padding: 15px 16px;
  display: flex;
  align-items: center;
  gap: 13px;
  transition: border-color 0.15s ease, box-shadow 0.15s ease, transform 0.15s ease;
}
.eip-quick-card:hover {
  border-color: var(--color-border-secondary);
  box-shadow:   var(--wiki-shadow-lift);
  transform:    translateY(-1px);
}
.eip-quick-icon-wrap {
  width: 38px;
  height: 38px;
  border-radius: var(--wiki-radius-lg);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.eip-quick-icon-wrap i {
  font-size: 20px;
  line-height: 1;
  display: block;
}
.eip-quick-name {
  font-size: 13px;
  font-weight: 600;
  color: var(--color-text-primary);
  line-height: 1.3;
}
.eip-quick-sub {
  font-size: 11px;
  color: var(--color-text-secondary);
  margin-top: 3px;
}

/* ── Parts list ───────────────────────────────────────────────────────────── */
/* No container border — parts sit directly on the page background.           */
/* Shadow on hover creates a lift effect; z-index brings it above neighbours. */
.eip-part {
  display: flex;
  align-items: center;
  gap: 13px;
  padding: 15px 18px;
  border-bottom: 0.5px solid var(--color-border-tertiary);
  position: relative;
  background: var(--color-background-primary);
  transition: box-shadow 0.15s ease, transform 0.15s ease;
}
.eip-part:first-child { border-top: 0.5px solid var(--color-border-tertiary); }
.eip-part:hover {
  box-shadow: var(--wiki-shadow-lift);
  z-index:    1;
  transform:  translateY(-1px);
}
.eip-part:hover .eip-chevron {
  opacity: 1;
  transform: translateX(2px);
}
.eip-part-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: var(--vp-c-bg-soft);
  border: 0.5px solid var(--color-border-tertiary);
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  color: var(--vp-c-text-2);
}
.eip-part-icon i {
  font-size: 15px;
  line-height: 1;
  display: block;
}
.eip-part-body { flex: 1; min-width: 0; }
.eip-part-name {
  font-size: 13px;
  font-weight: 500;
  display: block;
  margin-bottom: 4px;
  line-height: 1.35;
  /* colour applied inline via :style="{ color: reg.color }" */
}
.eip-part-desc {
  font-size: 12px;
  color: var(--vp-c-text-1);
  line-height: 1.5;
  display: block;
}
.eip-chevron {
  font-size: 13px;
  color: var(--color-text-tertiary);
  flex-shrink: 0;
  opacity: 0;
  transition: opacity 0.15s ease, transform 0.15s ease;
}

/* ── Coverage ─────────────────────────────────────────────────────────────── */
.eip-coverage {
  border: 0.5px solid var(--color-border-tertiary);
  border-radius: var(--border-radius-md);
  overflow: hidden;
  background: var(--vp-c-bg-soft);
}
.eip-cov-header {
  padding: 12px 18px;
  border-bottom: 0.5px solid var(--color-border-tertiary);
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.eip-cov-link {
  font-size: 12px;
  font-weight: 500;
  transition: opacity 0.15s ease;
}
.eip-cov-link:hover { opacity: 0.65; }
.eip-cov-chips {
  padding: 13px 18px;
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  border-bottom: 0.5px solid var(--color-border-tertiary);
}
.eip-chip {
  font-size: 12px;
  font-weight: 500;
  border-radius: var(--wiki-radius-pill);
  padding: 4px 13px;
}
.eip-chip-muted {
  font-weight: 400;
  background: var(--color-background-primary);
  color: var(--color-text-secondary);
  border: 0.5px solid var(--color-border-tertiary);
}
.eip-cov-footer {
  padding: 14px 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.eip-rep { font-size: 12px; color: var(--color-text-secondary); line-height: 1.5; }
.eip-rep strong { font-weight: 500; color: var(--color-text-primary); }

/* ── Fallback ─────────────────────────────────────────────────────────────── */
.eip-fallback { font-size: 13px; color: var(--color-text-secondary); }

/* ── Mobile ───────────────────────────────────────────────────────────────── */
@media (max-width: 640px) {
  .eip-hero { flex-direction: column; }
  .eip-hero-actions { flex-direction: row; align-items: center; }
  .eip-facts { grid-template-columns: 1fr 1fr; }
  .eip-quick-grid { grid-template-columns: 1fr; }
  .eip-chevron { opacity: 0.4; transform: none !important; }
}
</style>