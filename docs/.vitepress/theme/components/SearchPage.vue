<template>
  <div class="search-page">
    <div class="search-page-shell">

      <header class="search-page-header">
        <h1>Search the wiki</h1>
        <p class="search-page-intro">
          Search clauses directly with Pagefind, or ask the wiki a question with AI.
        </p>
      </header>

      <div class="search-surface">

        <!-- Input row -->
        <div class="search-header">
          <svg class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input
            ref="inputRef"
            v-model="query"
            type="search"
            :placeholder="activeTab === 'search' ? 'Search all clauses...' : 'Ask a question about your EBA...'"
            class="search-input"
            autocomplete="off"
            @input="activeTab === 'search' ? debouncedSearch() : null"
            @keydown.enter="activeTab === 'ask' ? submitAsk() : null"
            @keydown.down.prevent="focusResult(0)"
          />
        </div>

        <!-- Tab bar -->
        <div class="search-tab-bar">
          <button class="search-tab" :class="{ active: activeTab === 'search' }" @click="switchTab('search')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            Search
          </button>
          <button class="search-tab" :class="{ active: activeTab === 'ask' }" @click="switchTab('ask')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
              <path d="M10.9395 2.29297C10.752 1.90234 10.2441 1.90234 10.0566 2.29297L8.40039 5.74609L4.59277 6.30469C4.16602 6.36719 3.99414 6.89453 4.30371 7.19531L7.05859 9.87891L6.40332 13.6699C6.33008 14.0957 6.7793 14.418 7.15527 14.2207L10.498 12.4805L13.8408 14.2207C14.2168 14.418 14.666 14.0957 14.5928 13.6699L13.9375 9.87891L16.6924 7.19531C17.002 6.89453 16.8301 6.36719 16.4033 6.30469L12.5957 5.74609L10.9395 2.29297Z"/>
              <path d="M19.5 13C19.2239 13 19 13.2239 19 13.5C19 14.8807 17.8807 16 16.5 16C16.2239 16 16 16.2239 16 16.5C16 16.7761 16.2239 17 16.5 17C17.8807 17 19 18.1193 19 19.5C19 19.7761 19.2239 20 19.5 20C19.7761 20 20 19.7761 20 19.5C20 18.1193 21.1193 17 22.5 17C22.7761 17 23 16.7761 23 16.5C23 16.2239 22.7761 16 22.5 16C21.1193 16 20 14.8807 20 13.5C20 13.2239 19.7761 13 19.5 13Z"/>
              <path d="M4.5 15C4.22386 15 4 15.2239 4 15.5C4 16.3284 3.32843 17 2.5 17C2.22386 17 2 17.2239 2 17.5C2 17.7761 2.22386 18 2.5 18C3.32843 18 4 18.6716 4 19.5C4 19.7761 4.22386 20 4.5 20C4.77614 20 5 19.7761 5 19.5C5 18.6716 5.67157 18 6.5 18C6.77614 18 7 17.7761 7 17.5C7 17.2239 6.77614 17 6.5 17C5.67157 17 5 16.3284 5 15.5C5 15.2239 4.77614 15 4.5 15Z"/>
            </svg>
            Ask AI
            <span class="tab-badge">Beta</span>
          </button>
        </div>

        <!-- ── SEARCH TAB ── -->
        <template v-if="activeTab === 'search'">
          <div class="search-filters">
            <div class="filter-group">
              <label for="sp-eba-filter">EBA</label>
              <select id="sp-eba-filter" v-model="selectedEba" @change="doSearch">
                <option value="">All EBAs</option>
                <option v-for="eba in ebaList" :key="eba" :value="eba">{{ eba }}</option>
              </select>
            </div>
            <div class="filter-group">
              <label for="sp-topic-filter">Topic</label>
              <select id="sp-topic-filter" v-model="selectedTopic" @change="doSearch">
                <option value="">All Topics</option>
                <option v-for="topic in topicList" :key="topic" :value="topic">{{ topic }}</option>
              </select>
            </div>
            <button v-if="selectedEba || selectedTopic" class="clear-btn" @click="clearFilters">
              Clear filters
            </button>
          </div>

          <div class="search-body" ref="resultsContainerRef">

            <!-- Loading -->
            <div v-if="loading" class="search-status">
              <span class="loading-dots">Searching<span>.</span><span>.</span><span>.</span></span>
            </div>

            <!-- No results + optional fuzzy fallback -->
            <div v-else-if="query.length > 1 && results.length === 0 && !fuzzyLoading" class="search-status">
              <p>No results for <strong>{{ query }}</strong><span v-if="selectedEba || selectedTopic"> with current filters</span>.</p>
              <p v-if="fuzzyResults.length > 0" class="fuzzy-suggestion">
                Showing results for <strong>{{ fuzzyQuery }}</strong> instead:
              </p>
              <div v-if="fuzzyResults.length > 0" class="search-results fuzzy-results">
                <a
                  v-for="(result, index) in fuzzyResults"
                  :key="result.url"
                  :href="result.url"
                  class="result-card"
                  :data-result-index="index"
                  @click="handleResultClick(result)"
                  @keydown.up.prevent="focusResult(index - 1)"
                  @keydown.down.prevent="focusResult(index + 1)"
                  @mouseenter="setPreview(result, $event)"
                  @mouseleave="clearPreview"
                  @focus="setPreview(result, $event)"
                  @blur="clearPreview"
                >
                  <div class="result-top">
                    <span class="result-title">{{ result.meta?.title || result.url }}</span>
                    <span v-if="result.filters?.eba?.[0]" class="result-eba" :style="ebaStyle(result.filters.eba[0])">
                      {{ result.filters.eba[0] }}
                    </span>
                  </div>
                  <div v-if="result.meta?.section || result.meta?.clause" class="result-breadcrumb">
                    <span v-if="result.meta?.section">{{ result.meta.section }}</span>
                    <span v-if="result.meta?.section && result.meta?.clause" class="breadcrumb-sep">›</span>
                    <span v-if="result.meta?.clause" class="breadcrumb-clause">{{ result.meta.clause }}</span>
                  </div>
                  <p v-if="result.excerpt" class="result-excerpt" v-html="cleanExcerpt(result.excerpt)"></p>
                </a>
              </div>
              <p v-if="fuzzyResults.length === 0" class="no-results-tip">
                Try the <button class="inline-tab-link" @click="switchTab('ask')">Ask AI tab</button>
                to get a direct answer to your question.
              </p>
            </div>

            <!-- Quick Access (no query, no filters) -->
            <div v-else-if="query.length <= 1 && !selectedEba && !selectedTopic" class="quick-access">
              <div v-if="recentSearches.length > 0" class="qa-section">
                <div class="qa-section-header">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
                  </svg>
                  Recent searches
                  <button class="qa-clear-recent" @click="clearRecentSearches" aria-label="Clear recent searches">Clear</button>
                </div>
                <div class="qa-chips">
                  <button v-for="recent in recentSearches" :key="recent" class="qa-chip qa-chip-recent" @click="useRecentSearch(recent)">
                    {{ recent }}
                  </button>
                </div>
              </div>
              <div class="qa-section">
                <div class="qa-section-header">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                       stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
                  </svg>
                  Quick access
                </div>
                <div class="qa-shortcuts">
                  <button v-for="shortcut in quickAccessShortcuts" :key="shortcut.label" class="qa-shortcut" @click="fireShortcut(shortcut)">
                    <span class="qa-shortcut-icon" aria-hidden="true">{{ shortcut.icon }}</span>
                    <span class="qa-shortcut-label">{{ shortcut.label }}</span>
                    <svg class="qa-shortcut-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none"
                         stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                      <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                    </svg>
                  </button>
                </div>
              </div>
              <p class="search-hint-small">Type to search across all 1,275 clauses · Use filters to narrow by EBA or topic</p>
            </div>

            <!-- Normal results list -->
            <div v-else-if="results.length > 0" class="search-results">
              <p class="result-count">{{ results.length }} result{{ results.length === 1 ? '' : 's' }}</p>
              <a
                v-for="(result, index) in results"
                :key="result.url"
                :href="result.url"
                class="result-card"
                :class="{ 'result-card-previewing': previewResult?.url === result.url }"
                :data-result-index="index"
                @click="handleResultClick(result)"
                @keydown.up.prevent="focusResult(index - 1)"
                @keydown.down.prevent="focusResult(index + 1)"
                @mouseenter="setPreview(result, $event)"
                @mouseleave="clearPreview"
                @focus="setPreview(result, $event)"
                @blur="clearPreview"
              >
                <div class="result-top">
                  <span class="result-title">{{ result.meta?.title || result.url }}</span>
                  <span v-if="result.filters?.eba?.[0]" class="result-eba" :style="ebaStyle(result.filters.eba[0])">
                    {{ result.filters.eba[0] }}
                  </span>
                </div>
                <div v-if="result.meta?.section || result.meta?.clause" class="result-breadcrumb">
                  <span v-if="result.meta?.section">{{ result.meta.section }}</span>
                  <span v-if="result.meta?.section && result.meta?.clause" class="breadcrumb-sep">›</span>
                  <span v-if="result.meta?.clause" class="breadcrumb-clause">{{ result.meta.clause }}</span>
                </div>
                <div v-if="result.excerpt" class="result-excerpt" v-html="cleanExcerpt(result.excerpt)"></div>
                <div v-if="result.filters?.topics?.length" class="result-topics">
                  <span v-for="t in result.filters.topics" :key="t" class="result-tag">{{ t }}</span>
                </div>
              </a>
            </div>

          </div>
        </template>

        <!-- ── ASK AI TAB ── -->
        <template v-else-if="activeTab === 'ask'">
          <div class="search-body ask-body">
            <div v-if="!aiConfigured" class="ai-not-configured">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                   stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/>
              </svg>
              <p><strong>AI Search not yet configured</strong></p>
              <p>The AI search feature requires a Cloudflare Worker to be set up. The Pagefind keyword search is fully operational in the meantime.</p>
            </div>
            <template v-else>
              <div class="ask-input-row">
                <button class="ask-btn" :disabled="aiLoading || query.trim().length < 5" @click="submitAsk">
                  <svg v-if="!aiLoading" width="14" height="14" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                  </svg>
                  <span v-if="aiLoading" class="loading-dots">Thinking<span>.</span><span>.</span><span>.</span></span>
                  <span v-else>Ask</span>
                </button>
              </div>
              <div v-if="aiLoading" class="ai-loading">
                <span class="loading-dots">Reading EBA content<span>.</span><span>.</span><span>.</span></span>
              </div>
              <div v-else-if="aiError" class="ai-error">
                <strong>Something went wrong.</strong> {{ aiError }}
              </div>
              <div v-else-if="aiAnswer" class="ai-answer">
                <div class="ai-answer-body" v-html="aiAnswer"></div>
                <div v-if="aiSources.length" class="ai-sources">
                  <p class="ai-sources-label">Sources used:</p>
                  <a v-for="src in aiSources" :key="src.url" :href="src.url" class="ai-source-link">{{ src.title }}</a>
                </div>
                <p class="ai-disclaimer">⚠️ AI answers are generated from wiki content only. Always verify against the full EBA text before acting on this information.</p>
              </div>
            </template>
            <div class="ask-hint" v-if="!aiAnswer && !aiLoading">
              <p>{{ aiConfigured ? 'Try asking — specify the EBA and employee type for best results:' : "Example questions you'll be able to ask — specify the EBA and employee type for best results:" }}</p>
              <ul class="ask-examples">
                <li @click="aiConfigured ? useExample('Is a full-time employee under the Nurses and Midwives EBA entitled to overtime pay on a public holiday?') : null" :class="{ 'ask-example-preview': !aiConfigured }">Is a full-time employee under the <strong>Nurses &amp; Midwives EBA</strong> entitled to overtime pay on a public holiday?</li>
                <li @click="aiConfigured ? useExample('How much notice is required before changing the roster of a part-time nurse under the Nurses and Midwives EBA?') : null" :class="{ 'ask-example-preview': !aiConfigured }">How much notice is required before changing the roster of a part-time nurse under the <strong>Nurses &amp; Midwives EBA</strong>?</li>
                <li @click="aiConfigured ? useExample('What is the recall allowance for a Grade 3 Allied Health employee under the Allied Health EBA?') : null" :class="{ 'ask-example-preview': !aiConfigured }">What is the recall allowance for a Grade 3 employee under the <strong>Allied Health EBA</strong>?</li>
                <li @click="aiConfigured ? useExample('What overtime rates apply to a resident medical officer under the Doctors in Training EBA after 10 hours on a weekday shift?') : null" :class="{ 'ask-example-preview': !aiConfigured }">What overtime rates apply to a resident medical officer under the <strong>Doctors in Training EBA</strong> after 10 hours on a weekday shift?</li>
                <li @click="aiConfigured ? useExample('Is a full-time administration officer under the HAS Managers and Admin EBA entitled to a meal allowance for overtime?') : null" :class="{ 'ask-example-preview': !aiConfigured }">Is a full-time administration officer under the <strong>HAS Managers &amp; Admin EBA</strong> entitled to a meal allowance for overtime?</li>
              </ul>
            </div>
          </div>
        </template>

      </div>
    </div>
  </div>

  <!-- Floating preview pane — Teleported to body, fixed position, follows mouse vertically -->
  <Teleport to="body">
    <Transition name="preview">
      <div
        v-if="previewResult && previewVisible"
        class="floating-preview"
        :style="previewStyle"
        aria-live="polite"
        role="complementary"
        aria-label="Result preview"
        @mouseenter="keepPreview"
        @mouseleave="clearPreview"
      >
        <div class="preview-header">
          <span class="preview-title">{{ previewResult.meta?.title || previewResult.url }}</span>
          <span
            v-if="previewResult.filters?.eba?.[0]"
            class="result-eba preview-eba"
            :style="ebaStyle(previewResult.filters.eba[0])"
          >{{ previewResult.filters.eba[0] }}</span>
        </div>
        <div v-if="previewResult.meta?.section || previewResult.meta?.clause" class="preview-breadcrumb">
          <span v-if="previewResult.meta?.section">{{ previewResult.meta.section }}</span>
          <span v-if="previewResult.meta?.section && previewResult.meta?.clause" class="breadcrumb-sep">›</span>
          <span v-if="previewResult.meta?.clause" class="breadcrumb-clause">{{ previewResult.meta.clause }}</span>
        </div>
        <div v-if="previewResult.excerpt" class="preview-excerpt" v-html="cleanExcerpt(previewResult.excerpt)"></div>
        <div v-if="previewResult.filters?.topics?.length" class="preview-topics">
          <span v-for="t in previewResult.filters.topics" :key="t" class="result-tag">{{ t }}</span>
        </div>
        <a :href="previewResult.url" class="preview-open-link" @click="handleResultClick(previewResult)">
          Open page
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
          </svg>
        </a>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, nextTick, onMounted, onUnmounted } from 'vue'

// ─── AI Worker URL ────────────────────────────────────────────────────────────
const AI_WORKER_URL = 'https://eba-ask-worker.irresistibl.workers.dev'
const aiConfigured  = AI_WORKER_URL.length > 0

// ─── sessionStorage keys ─────────────────────────────────────────────────────
const SESSION_RECENT_KEY = 'eba-search-recent'

// ─── Core state ──────────────────────────────────────────────────────────────
const activeTab           = ref('search')
const query               = ref('')
const selectedEba         = ref('')
const selectedTopic       = ref('')
const results             = ref([])
const loading             = ref(false)
const inputRef            = ref(null)
const resultsContainerRef = ref(null)

// ─── Floating preview state ───────────────────────────────────────────────────
const previewResult  = ref(null)
const previewVisible = ref(false)
const previewStyle   = ref({})
let previewHideTimer = null
let previewKeep      = false

// ─── Fuzzy fallback ───────────────────────────────────────────────────────────
const fuzzyResults  = ref([])
const fuzzyQuery    = ref('')
const fuzzyLoading  = ref(false)

// ─── Recent searches ──────────────────────────────────────────────────────────
const recentSearches = ref([])

// ─── AI state ────────────────────────────────────────────────────────────────
const aiLoading = ref(false)
const aiAnswer  = ref('')
const aiSources = ref([])
const aiError   = ref('')

let searchTimer = null
let pagefind    = null

// ─── Quick Access shortcuts (identical to modal) ──────────────────────────────
const quickAccessShortcuts = [
  { icon: '⏱️', label: 'Overtime & Penalty Rates', topic: 'overtime',    query: '' },
  { icon: '📅', label: 'Leave Entitlements',        topic: 'leave',       query: '' },
  { icon: '💵', label: 'Wage Rates',                topic: 'wages',       query: '' },
  { icon: '💰', label: 'Allowances',                topic: 'allowances',  query: '' },
  { icon: '📋', label: 'Termination & Redundancy',  topic: 'termination', query: '' },
]

// ─── EBA colour map (identical to modal) ─────────────────────────────────────
const ebaColors = {
  'Allied Health Professionals 2021-2026':       { color: '#EA580C', bg: '#EA580C1A' },
  'Biomedical Engineers 2025-2028':              { color: '#4F46E5', bg: '#4F46E51A' },
  "Children's Services Award 2010":              { color: '#DB2777', bg: '#DB27771A' },
  'Doctors in Training 2022-2026':               { color: '#D97706', bg: '#D977061A' },
  'Health Allied & Managers Admin 2021-2025':    { color: '#3B82F6', bg: '#3B82F61A' },
  'Medical Specialists 2022-2026':               { color: '#0891B2', bg: '#0891B21A' },
  'Mental Health Services 2024-2028':            { color: '#7C3AED', bg: '#7C3AED1A' },
  'Medical Scientists, Pharm & Psych 2021-2025': { color: '#059669', bg: '#0596691A' },
  'Nurses and Midwives 2024-2028':               { color: '#E11D48', bg: '#E11D481A' },
}

function ebaStyle(ebaName) {
  const c = ebaColors[ebaName]
  if (!c) return {}
  return { color: c.color, backgroundColor: c.bg, borderColor: c.color + '40' }
}

// ─── EBA list ─────────────────────────────────────────────────────────────────
const ebaList = [
  'Allied Health Professionals 2021-2026',
  'Biomedical Engineers 2025-2028',
  "Children's Services Award 2010",
  'Doctors in Training 2022-2026',
  'Health Allied & Managers Admin 2021-2025',
  'Medical Specialists 2022-2026',
  'Mental Health Services 2024-2028',
  'Medical Scientists, Pharm & Psych 2021-2025',
  'Nurses and Midwives 2024-2028',
]

// ─── Topic list ────────────────────────────────────────────────────────────────
const topicList = [
  'accident-pay','accommodation','allowances','annual-leave','appendices',
  'apprentices','breaks','cash-payments','casual-conversion','ceremonial-leave',
  'childcare','classification','consultation','definitions','delegates',
  'discipline','discrimination','disputes','education-pd','employment',
  'flexible-work','gender-affirmation-leave','gendered-violence','governance',
  'higher-duties','higher-qualifications','hours','hourly-rates','leave',
  'long-service-leave','meal','meal-allowance','ohs','on-call','overtime',
  'parental-leave','pay-rates','penalty-rates','personal-leave','preliminary',
  'professional-development','public-holidays','purchased-leave','redundancy',
  'remuneration','right-to-disconnect','rosters','salary','salary-packaging',
  'schedules','shift-allowances','shift-work','staffing','study-leave',
  'superannuation','termination','top-of-band','training','travel',
  'uniforms','union-matters','wages','workers-comp','workload',
]

// ─── Floating preview pane (same logic as modal's setPreview) ─────────────────
// On the full page the "anchor" is the results list container, not a modal box.
// We read the results list bounding rect and position the preview to its right.
function setPreview(result, event) {
  clearTimeout(previewHideTimer)
  previewKeep = false

  if (window.innerWidth < 1100) return

  const container = resultsContainerRef.value?.getBoundingClientRect()
  if (!container) return

  const left  = container.right + 16
  const right = window.innerWidth - left
  if (right < 240) return

  const card  = event?.currentTarget?.getBoundingClientRect?.() ?? null
  const top   = card ? Math.min(card.top, window.innerHeight - 360) : container.top
  const width = Math.min(300, right - 16)

  previewStyle.value = {
    left:      `${left}px`,
    top:       `${Math.max(80, top)}px`,
    width:     `${width}px`,
    maxHeight: `${window.innerHeight - Math.max(80, top) - 24}px`,
  }
  previewResult.value  = result
  previewVisible.value = true
}

function clearPreview() {
  if (previewKeep) return
  previewHideTimer = setTimeout(() => {
    if (!previewKeep) {
      previewVisible.value = false
      previewResult.value  = null
    }
  }, 120)
}

function keepPreview() {
  previewKeep = true
  clearTimeout(previewHideTimer)
}

// ─── Keyboard navigation ──────────────────────────────────────────────────────
function focusResult(index) {
  nextTick(() => {
    const cards = resultsContainerRef.value?.querySelectorAll('.result-card')
    if (!cards) return
    const target = cards[Math.max(0, Math.min(index, cards.length - 1))]
    target?.focus()
  })
}

// ─── Markdown → HTML (identical to modal) ────────────────────────────────────
function renderMarkdown(md) {
  if (!md) return ''
  md = md.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  md = md.replace(/^(BLUF|Detail|Branches|Branch|Sources?|Update):\s*/gm, '**$1:** ')
  md = md.replace(/(?<!\*)\b(\d+(?:\.\d+)?%)\b(?!\*)/g, '**$1**')
  md = md.replace(/(?<!\*)\b(\$\d+(?:\.\d+)?)\b(?!\*)/g, '**$1**')
  md = md.replace(/^(\*\*(?:BLUF|Detail|Branches|Branch|Sources?|Update):\*\*)\n\n/gm, '$1\n')
  md = md.replace(/\n{3,}/g, '\n\n')
  let html = md.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  html = html.replace(/^[-*]{3,}\s*$/gm, '<hr>')
  html = html.replace(/^### (.+)$/gm, '<h4>$1</h4>')
  html = html.replace(/^## (.+)$/gm,  '<h3>$1</h3>')
  html = html.replace(/^# (.+)$/gm,   '<h2>$1</h2>')
  html = html.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*([^*\n]+)\*/g,     '<em>$1</em>')
  html = html.replace(/`([^`\n]+)`/g, '<code>$1</code>')
  html = html.replace(/^&gt;\s?(.+)$/gm, '<blockquote>$1</blockquote>')
  const sectionLabelRe = /^<strong>(BLUF|Detail|Branches|Branch|Sources?|Update):<\/strong>\s*$/
  const lines = html.split('\n')
  const out   = []
  let inOl = false, inUl = false
  for (let i = 0; i < lines.length; i++) {
    const line    = lines[i]
    const olMatch = line.match(/^(\d+)\.\s+(.+)/)
    const ulMatch = line.match(/^[-*+]\s+(.+)/)
    if (olMatch) {
      if (inUl) { out.push('</ul>'); inUl = false }
      if (!inOl) { out.push('<ol>'); inOl = true }
      out.push(`<li>${olMatch[2]}</li>`)
    } else if (ulMatch) {
      if (inOl) { out.push('</ol>'); inOl = false }
      if (!inUl) { out.push('<ul>'); inUl = true }
      out.push(`<li>${ulMatch[1]}</li>`)
    } else {
      if (inOl) { out.push('</ol>'); inOl = false }
      if (inUl) { out.push('</ul>'); inUl = false }
      const nextLine   = lines[i + 1] || ''
      const nextIsList = /^[-*+\d]/.test(nextLine.trim())
      if (sectionLabelRe.test(line.trim()) && nextIsList) {
        out.push(`<p class="ai-section">${line.trim()}</p>`)
      } else {
        out.push(line)
      }
    }
  }
  if (inOl) out.push('</ol>')
  if (inUl) out.push('</ul>')
  html = out.join('\n')
  const blockTags   = /^<(h[2-6]|ul|ol|blockquote|hr|pre|div|p\s)/
  const sectionOpen = /^<strong>(BLUF|Detail|Branches|Branch|Sources?|Update):/
  html = html.split(/\n{2,}/).map(chunk => {
    const trimmed = chunk.trim()
    if (!trimmed) return ''
    if (blockTags.test(trimmed)) return trimmed
    const cls = sectionOpen.test(trimmed) ? ' class="ai-section"' : ''
    return `<p${cls}>${trimmed.replace(/\n/g, '<br>')}</p>`
  }).filter(Boolean).join('\n')
  html = html.replace(/<\/ol>\n<ol>/g, '').replace(/<\/ul>\n<ul>/g, '')
  return html
}

// ─── Excerpt cleaner (identical to modal) ────────────────────────────────────
function cleanExcerpt(raw) {
  if (!raw) return ''
  let text = raw.replace(/<(?!\/?mark\b)[^>]+>/gi, '')
  text = text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
             .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ')
  text = text.replace(/^[\s\w\-]+?(?=[A-Z]|<mark>[A-Z])/, match => /^[\s\da-z\-]+$/.test(match) ? '' : match)
  text = text.replace(/#{1,6}\s+/g, '').replace(/\*\*([^*]+)\*\*/g, '$1')
             .replace(/\*([^*]+)\*/g, '$1').replace(/`([^`]+)`/g, '$1')
             .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/^[-*+]\s+/gm, '').replace(/^>\s*/gm, '')
  text = text.replace(/\s+/g, ' ').trim()
  if (text.length > 300) text = text.slice(0, 300).replace(/\s\S*$/, '') + '…'
  return text
}

// ─── Search ───────────────────────────────────────────────────────────────────
function debouncedSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(doSearch, 200)
}

async function doSearch() {
  fuzzyResults.value = []
  fuzzyQuery.value   = ''
  if (!pagefind || (query.value.length < 2 && !selectedEba.value && !selectedTopic.value)) {
    results.value = []
    return
  }
  loading.value = true
  const filters = {}
  if (selectedEba.value)   filters.eba    = selectedEba.value
  if (selectedTopic.value) filters.topics = selectedTopic.value
  try {
    const search = await pagefind.search(query.value || null, { filters })
    let exactIds = new Set()
    if (query.value.trim().includes(' ')) {
      try {
        const exactSearch = await pagefind.search(`"${query.value.trim()}"`, { filters })
        const exactData   = await Promise.all(exactSearch.results.slice(0, 5).map(r => r.data()))
        exactIds = new Set(exactData.map(r => r.url))
      } catch { /* exact phrase search optional */ }
    }
    const allResults = await Promise.all(search.results.slice(0, 25).map(r => r.data()))
    const isFilterOnly = !query.value.trim() && (selectedTopic.value || selectedEba.value)
    if (isFilterOnly && selectedTopic.value) {
      const topic = selectedTopic.value.toLowerCase().replace(/-/g, ' ')
      const score = r => {
        let s = 0
        if ((r.meta?.title   || '').toLowerCase().includes(topic)) s += 3
        if ((r.meta?.clause  || '').toLowerCase().includes(topic)) s += 2
        if ((r.meta?.section || '').toLowerCase().includes(topic)) s += 1
        return s
      }
      allResults.sort((a, b) => score(b) - score(a))
    }
    results.value = [
      ...allResults.filter(r => exactIds.has(r.url)),
      ...allResults.filter(r => !exactIds.has(r.url)),
    ]
    if (results.value.length === 0 && query.value.trim().length > 3) {
      await runFuzzyFallback(query.value.trim(), filters)
    }
  } catch {
    results.value = []
  }
  loading.value = false
}

async function runFuzzyFallback(originalQuery, filters) {
  if (!pagefind) return
  fuzzyLoading.value = true
  const words    = originalQuery.split(' ')
  const lastWord = words[words.length - 1]
  for (let len = lastWord.length - 1; len >= 3; len--) {
    const stem      = lastWord.slice(0, len)
    const candidate = [...words.slice(0, -1), stem].join(' ')
    try {
      const search = await pagefind.search(candidate, { filters })
      if (search.results.length > 0) {
        const data = await Promise.all(search.results.slice(0, 8).map(r => r.data()))
        fuzzyResults.value = data
        fuzzyQuery.value   = candidate
        break
      }
    } catch { break }
  }
  fuzzyLoading.value = false
}

function clearFilters() {
  selectedEba.value   = ''
  selectedTopic.value = ''
  doSearch()
}

function fireShortcut(shortcut) {
  selectedTopic.value = shortcut.topic
  query.value         = shortcut.query
  doSearch()
}

function handleResultClick(result) {
  addToRecentSearches(query.value)
  previewVisible.value = false
  previewResult.value  = null
}

// ─── Recent searches ──────────────────────────────────────────────────────────
function addToRecentSearches(term) {
  if (!term || term.trim().length < 3) return
  try {
    const trimmed = term.trim()
    const updated = [trimmed, ...recentSearches.value.filter(r => r !== trimmed)].slice(0, 5)
    recentSearches.value = updated
    sessionStorage.setItem(SESSION_RECENT_KEY, JSON.stringify(updated))
  } catch { /* silently ignore */ }
}

function clearRecentSearches() {
  recentSearches.value = []
  try { sessionStorage.removeItem(SESSION_RECENT_KEY) } catch { /* ignore */ }
}

function useRecentSearch(term) {
  query.value = term
  doSearch()
  nextTick(() => inputRef.value?.focus())
}

// ─── Ask AI ───────────────────────────────────────────────────────────────────
function useExample(text) {
  query.value = text
  nextTick(() => inputRef.value?.focus())
}

async function submitAsk() {
  if (!aiConfigured || query.value.trim().length < 5 || aiLoading.value) return
  aiLoading.value = true
  aiAnswer.value  = ''
  aiSources.value = []
  aiError.value   = ''
  try {
    const res = await fetch(AI_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: query.value.trim() }),
    })
    if (!res.ok) throw new Error(`Worker returned ${res.status}`)
    const data = await res.json()
    aiAnswer.value = renderMarkdown(data.answer ?? 'No answer returned.')
    aiSources.value = (data.sources ?? []).map(url => {
      const segment = url.split('/').pop().replace('.html', '')
      const match   = segment.match(/^(\d+[a-z]?)-(.+)$/)
      const title   = match
        ? `Clause ${match[1]}: ${match[2].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`
        : segment.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      return { url, title }
    })
  } catch (err) {
    aiError.value = err.message ?? 'Unknown error. Please try again.'
  }
  aiLoading.value = false
}

function switchTab(tab) {
  activeTab.value    = tab
  results.value      = []
  fuzzyResults.value = []
  aiAnswer.value     = ''
  aiSources.value    = []
  aiError.value      = ''
  nextTick(() => inputRef.value?.focus())
}

// ─── Mount ────────────────────────────────────────────────────────────────────
onMounted(async () => {
  try {
    const savedRecent = sessionStorage.getItem(SESSION_RECENT_KEY)
    if (savedRecent) recentSearches.value = JSON.parse(savedRecent)
  } catch { /* silently ignore */ }

  try {
    const importPath = '/pagefind/pagefind.js'
    pagefind = await new Function('path', 'return import(path)')(importPath)
    await pagefind.init()
    await pagefind.options({
      ranking: {
        pageLength:     0.4,
        termFrequency:  0.8,
        termSimilarity: 1.2,
        termSaturation: 1.6,
      }
    })
  } catch {
    console.warn('Pagefind not available — run npm run docs:index first.')
  }

  nextTick(() => inputRef.value?.focus())
})

onUnmounted(() => {
  clearTimeout(previewHideTimer)
  clearTimeout(searchTimer)
})
</script>

<style scoped>
/* ── Page shell ── */
.search-page { width: 100%; padding: 1.25rem 0 3rem; }
.search-page-shell { max-width: 1400px; margin: 0 auto; }
.search-page-header { margin-bottom: 1rem; }
.search-page-header h1 { margin: 0; font-size: clamp(1.75rem, 2.4vw, 2.5rem); line-height: 1.1; }
.search-page-intro { margin: 0.65rem 0 0; color: var(--vp-c-text-2); max-width: 56rem; }

/* ── Surface ── */
.search-surface {
  border: 1px solid var(--vp-c-divider); border-radius: 16px;
  background: var(--vp-c-bg); box-shadow: 0 18px 40px oklch(0 0 0 / 0.08);
  overflow: hidden;
}

/* ── Search header ── */
.search-header {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.875rem 1rem; border-bottom: 1px solid var(--vp-c-divider);
}
.search-icon { flex-shrink: 0; color: var(--vp-c-text-3); }
.search-input {
  flex: 1; border: none; background: transparent;
  font-size: 1rem; color: var(--vp-c-text-1); outline: none;
}
.search-input::placeholder { color: var(--vp-c-text-3); }

/* ── Tab bar ── */
.search-tab-bar {
  display: flex; border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft); padding: 0 1rem; gap: 0;
}
.search-tab {
  display: flex; align-items: center; gap: 0.35rem;
  padding: 0.55rem 0.85rem; font-size: 0.8rem; font-weight: 500;
  color: var(--vp-c-text-2); border: none; background: none; cursor: pointer;
  border-bottom: 2px solid transparent; margin-bottom: -1px;
  transition: color 0.15s, border-color 0.15s;
}
.search-tab:hover { color: var(--vp-c-text-1); }
.search-tab.active { color: var(--vp-c-brand-1); border-bottom-color: var(--vp-c-brand-1); font-weight: 600; }
.tab-badge {
  font-size: 0.62rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.04em;
  background: var(--vp-c-brand-soft); color: var(--vp-c-brand-1);
  padding: 0.05rem 0.35rem; border-radius: 999px;
}

/* ── Filters ── */
.search-filters {
  display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: flex-end;
  padding: 0.75rem 1rem; border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
}
.filter-group { display: flex; flex-direction: column; gap: 0.2rem; flex: 1; min-width: 160px; }
.filter-group label {
  font-size: 0.7rem; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--vp-c-text-3);
}
.filter-group select {
  padding: 0.35rem 0.6rem; font-size: 0.8rem;
  border: 1px solid var(--vp-c-divider); border-radius: 6px;
  background: var(--vp-c-bg); color: var(--vp-c-text-1);
}
.clear-btn {
  padding: 0.35rem 0.75rem; font-size: 0.8rem; border-radius: 6px;
  border: 1px solid var(--vp-c-divider); background: var(--vp-c-bg);
  color: var(--vp-c-text-2); cursor: pointer; align-self: flex-end;
}
.clear-btn:hover { background: var(--vp-c-bg-muted); }

/* ── Body ── */
.search-body { flex: 1; overflow-y: auto; padding: 0.75rem 1rem; }
.search-status { text-align: center; color: var(--vp-c-text-2); padding: 2rem 0; }
.no-results-tip { font-size: 0.82rem; margin-top: 0.5rem; color: var(--vp-c-text-3); }
.inline-tab-link {
  background: none; border: none; padding: 0;
  color: var(--vp-c-brand-1); font-size: inherit; cursor: pointer; text-decoration: underline;
}

/* ── Fuzzy suggestion ── */
.fuzzy-suggestion { font-size: 0.82rem; color: var(--vp-c-text-3); margin-top: 0.75rem; margin-bottom: 0.5rem; }
.fuzzy-results { opacity: 0.92; }

/* ── Quick Access ── */
.quick-access { padding: 0.25rem 0; }
.qa-section { margin-bottom: 1.25rem; }
.qa-section-header {
  display: flex; align-items: center; gap: 0.4rem;
  font-size: 0.7rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.07em; color: var(--vp-c-text-3); margin-bottom: 0.6rem;
}
.qa-clear-recent {
  margin-left: auto; background: none; border: none;
  font-size: 0.7rem; color: var(--vp-c-text-3); cursor: pointer;
  text-decoration: underline; text-transform: none; letter-spacing: 0; font-weight: 400;
}
.qa-clear-recent:hover { color: var(--vp-c-text-2); }
.qa-chips { display: flex; flex-wrap: wrap; gap: 0.4rem; }
.qa-chip {
  padding: 0.25rem 0.65rem; border-radius: 999px;
  border: 1px solid var(--vp-c-divider); background: var(--vp-c-bg-soft);
  font-size: 0.78rem; color: var(--vp-c-text-2); cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.qa-chip:hover { border-color: var(--vp-c-brand); color: var(--vp-c-brand-1); }
.qa-shortcuts { display: flex; flex-direction: column; gap: 0.35rem; }
.qa-shortcut {
  display: flex; align-items: center; gap: 0.6rem;
  padding: 0.6rem 0.85rem; border-radius: 8px;
  border: 1px solid var(--vp-c-divider); background: var(--vp-c-bg-soft);
  cursor: pointer; transition: border-color 0.15s, background 0.15s; text-align: left;
}
.qa-shortcut:hover { border-color: var(--vp-c-brand); background: var(--vp-c-bg-elv); }
.qa-shortcut-icon { font-size: 1rem; flex-shrink: 0; }
.qa-shortcut-label { flex: 1; font-size: 0.875rem; font-weight: 500; color: var(--vp-c-text-1); }
.qa-shortcut-arrow { flex-shrink: 0; color: var(--vp-c-text-3); transition: transform 0.15s; }
.qa-shortcut:hover .qa-shortcut-arrow { transform: translateX(3px); color: var(--vp-c-brand); }
.search-hint-small { font-size: 0.75rem; color: var(--vp-c-text-3); text-align: center; margin-top: 0.5rem; }

/* ── Result cards ── */
.result-count { font-size: 0.8rem; color: var(--vp-c-text-3); margin-bottom: 0.75rem; }
.result-card {
  display: block; text-decoration: none;
  padding: 0.75rem; margin-bottom: 0.5rem;
  border-radius: 8px; border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  transition: border-color 0.15s, background 0.15s; outline: none;
}
.result-card:hover,
.result-card:focus-visible,
.result-card-previewing {
  border-color: var(--vp-c-brand); background: var(--vp-c-bg-elv);
  box-shadow: 0 0 0 2px var(--vp-c-brand-soft);
}
.result-top { display: flex; align-items: baseline; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.25rem; }
.result-title { font-weight: 600; color: var(--vp-c-brand); font-size: 0.925rem; }
.result-eba {
  font-size: 0.7rem; padding: 0.1rem 0.55rem; border-radius: 999px;
  border: 1px solid transparent; white-space: nowrap; font-weight: 500;
}
.result-breadcrumb {
  display: flex; align-items: center; gap: 0.3rem;
  font-size: 0.72rem; color: var(--vp-c-text-3); margin-bottom: 0.3rem;
}
.breadcrumb-sep { color: var(--vp-c-text-3); opacity: 0.5; }
.breadcrumb-clause { font-weight: 600; color: var(--vp-c-text-2); }
.result-excerpt {
  font-size: 0.825rem; color: var(--vp-c-text-2);
  line-height: 1.65; margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.result-excerpt :deep(mark),
.preview-excerpt :deep(mark) {
  background: oklch(0.88 0.1 75 / 0.45);
  color: inherit; border-radius: 2px; padding: 0 2px;
}
.result-topics { display: flex; gap: 0.35rem; flex-wrap: wrap; margin-top: 0.4rem; }
.result-tag {
  font-size: 0.7rem; background: var(--vp-c-bg-muted);
  color: var(--vp-c-text-3); padding: 0.1rem 0.4rem; border-radius: 999px;
}

/* ── Floating preview pane (fixed position, Teleported to body) ── */
.floating-preview {
  position: fixed;
  z-index: 10000;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-brand);
  border-radius: 10px;
  box-shadow: 0 8px 32px oklch(0 0 0 / 0.22);
  padding: 1rem;
  display: flex; flex-direction: column; gap: 0.5rem;
  overflow-y: auto;
  pointer-events: auto;
}
.preview-header { display: flex; flex-direction: column; gap: 0.35rem; }
.preview-title { font-size: 0.9rem; font-weight: 700; color: var(--vp-c-brand); line-height: 1.3; }
.preview-eba { align-self: flex-start; }
.preview-breadcrumb {
  display: flex; align-items: center; gap: 0.3rem;
  font-size: 0.7rem; color: var(--vp-c-text-3);
}
.preview-excerpt { font-size: 0.8rem; color: var(--vp-c-text-2); line-height: 1.65; }
.preview-topics { display: flex; gap: 0.3rem; flex-wrap: wrap; }
.preview-open-link {
  display: inline-flex; align-items: center; gap: 0.3rem;
  font-size: 0.78rem; font-weight: 600; color: var(--vp-c-brand-1);
  text-decoration: none; margin-top: 0.25rem; align-self: flex-start;
}
.preview-open-link:hover { text-decoration: underline; }
.preview-enter-active, .preview-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.preview-enter-from, .preview-leave-to { opacity: 0; transform: translateX(8px); }

/* ── Ask AI tab ── */
.ask-body { display: flex; flex-direction: column; gap: 1rem; }
.ask-input-row { display: flex; justify-content: flex-end; padding-top: 0.25rem; }
.ask-btn {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.45rem 1.1rem; background: var(--vp-c-brand-1); color: #fff;
  border: none; border-radius: 6px; font-size: 0.85rem; font-weight: 600;
  cursor: pointer; transition: background 0.15s;
}
.ask-btn:hover:not(:disabled) { background: var(--vp-c-brand-2); }
.ask-btn:disabled { opacity: 0.45; cursor: not-allowed; }
.ai-not-configured {
  text-align: center; color: var(--vp-c-text-2); padding: 2.5rem 1rem;
  display: flex; flex-direction: column; align-items: center; gap: 0.6rem;
}
.ai-not-configured svg { color: var(--vp-c-text-3); }
.ai-not-configured p { margin: 0; font-size: 0.875rem; }
.ai-not-configured strong { color: var(--vp-c-text-1); }
.ai-loading { text-align: center; color: var(--vp-c-text-2); padding: 2rem 0; font-size: 0.875rem; }
.ai-error { padding: 1rem; border-radius: 8px; background: var(--vp-c-danger-soft); color: var(--vp-c-danger-1); font-size: 0.875rem; }
.ai-answer { display: flex; flex-direction: column; gap: 0.75rem; }
.ai-answer-body { font-size: 0.9rem; line-height: 1.7; color: var(--vp-c-text-1); }
.ai-answer-body h2, .ai-answer-body h3, .ai-answer-body h4 {
  font-size: 0.85rem; font-weight: 700; color: var(--vp-c-text-1);
  margin: 1rem 0 0.25rem; text-transform: uppercase; letter-spacing: 0.04em;
}
.ai-answer-body p { margin: 0 0 0.5rem; }
.ai-answer-body p:last-child { margin-bottom: 0; }
.ai-answer-body p.ai-section {
  margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid var(--vp-c-divider);
}
.ai-answer-body p.ai-section:first-child { margin-top: 0; padding-top: 0; border-top: none; }
.ai-answer-body strong { font-weight: 650; color: var(--vp-c-text-1); }
.ai-answer-body em { font-style: italic; color: var(--vp-c-text-2); }
.ai-answer-body code {
  font-family: var(--vp-font-family-mono, monospace); font-size: 0.8rem;
  background: var(--vp-c-bg-soft); border: 1px solid var(--vp-c-divider);
  border-radius: 4px; padding: 0.1em 0.35em;
}
.ai-answer-body ol, .ai-answer-body ul { margin: 0.4rem 0 0.65rem 1.25rem; padding: 0; }
.ai-answer-body li { margin-bottom: 0.3rem; line-height: 1.6; }
.ai-answer-body blockquote {
  margin: 0.65rem 0; padding: 0.5rem 0.75rem;
  border-left: 3px solid var(--vp-c-brand); background: var(--vp-c-bg-soft);
  border-radius: 0 6px 6px 0; font-size: 0.875rem; color: var(--vp-c-text-2);
}
.ai-answer-body hr { border: none; border-top: 1px solid var(--vp-c-divider); margin: 0.75rem 0; }
.ai-sources { display: flex; flex-direction: column; gap: 0.3rem; }
.ai-sources-label {
  font-size: 0.72rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--vp-c-text-3); margin: 0;
}
.ai-source-link {
  font-size: 0.82rem; color: var(--vp-c-brand-1);
  text-decoration: underline; text-underline-offset: 2px;
}
.ai-source-link:hover { color: var(--vp-c-brand-2); }
.ai-disclaimer { font-size: 0.75rem; color: var(--vp-c-text-3); margin: 0; line-height: 1.5; }
.ask-hint { color: var(--vp-c-text-2); font-size: 0.875rem; }
.ask-hint p { margin: 0 0 0.6rem; }
.ask-examples {
  list-style: none; padding: 0; margin: 0;
  display: flex; flex-direction: column; gap: 0.4rem;
}
.ask-examples li {
  padding: 0.6rem 0.85rem; background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider); border-radius: 6px; cursor: pointer;
  transition: border-color 0.15s, background 0.15s; color: var(--vp-c-brand-1); font-style: italic;
}
.ask-examples li:hover { border-color: var(--vp-c-brand-1); background: var(--vp-c-bg-elv); }
.ask-example-preview { cursor: default; opacity: 0.6; }
.ask-example-preview:hover { border-color: var(--vp-c-divider) !important; background: var(--vp-c-bg-soft) !important; }

/* ── Loading dots ── */
.loading-dots span { animation: blink 1.2s infinite; }
.loading-dots span:nth-child(2) { animation-delay: 0.2s; }
.loading-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes blink { 0%, 80%, 100% { opacity: 0; } 40% { opacity: 1; } }

/* ── Responsive ── */
@media (max-width: 768px) {
  .search-page { padding: 0.5rem 0 2rem; }
  .search-page-header h1 { font-size: 1.7rem; }
}
</style>