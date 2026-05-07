<template>
  <!-- Trigger button for navbar -->
  <button class="search-trigger" @click="open = true" aria-label="Search">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
    <span class="search-trigger-text">Search</span>
    <span class="search-trigger-kbd"><kbd>Ctrl+K</kbd></span>
  </button>

  <!-- Modal overlay -->
  <Teleport to="body">
    <Transition name="modal">
      <div v-if="open" class="search-overlay" @click.self="close" role="dialog"
           aria-modal="true" aria-label="Search wiki">
        <div class="search-modal">

          <!-- Search input row -->
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
              @input="activeTab === 'search' ? doSearch() : null"
              @keydown.enter="activeTab === 'ask' ? submitAsk() : null"
              autocomplete="off"
            />
            <button class="close-btn" @click="close" aria-label="Close search">
              <kbd>Esc</kbd>
            </button>
          </div>

          <!-- Tab bar -->
          <div class="search-tab-bar">
            <button
              class="search-tab"
              :class="{ active: activeTab === 'search' }"
              @click="switchTab('search')"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              Search
            </button>
            <button
              class="search-tab"
              :class="{ active: activeTab === 'ask' }"
              @click="switchTab('ask')"
            >
              <!-- Sparks icon -->
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                <path d="M10.9395 2.29297C10.752 1.90234 10.2441 1.90234 10.0566 2.29297L8.40039 5.74609L4.59277 6.30469C4.16602 6.36719 3.99414 6.89453 4.30371 7.19531L7.05859 9.87891L6.40332 13.6699C6.33008 14.0957 6.7793 14.418 7.15527 14.2207L10.498 12.4805L13.8408 14.2207C14.2168 14.418 14.666 14.0957 14.5928 13.6699L13.9375 9.87891L16.6924 7.19531C17.002 6.89453 16.8301 6.36719 16.4033 6.30469L12.5957 5.74609L10.9395 2.29297Z"/>
                <path d="M19.5 13C19.2239 13 19 13.2239 19 13.5C19 14.8807 17.8807 16 16.5 16C16.2239 16 16 16.2239 16 16.5C16 16.7761 16.2239 17 16.5 17C17.8807 17 19 18.1193 19 19.5C19 19.7761 19.2239 20 19.5 20C19.7761 20 20 19.7761 20 19.5C20 18.1193 21.1193 17 22.5 17C22.7761 17 23 16.7761 23 16.5C23 16.2239 22.7761 16 22.5 16C21.1193 16 20 14.8807 20 13.5C20 13.2239 19.7761 13 19.5 13Z"/>
                <path d="M4.5 15C4.22386 15 4 15.2239 4 15.5C4 16.3284 3.32843 17 2.5 17C2.22386 17 2 17.2239 2 17.5C2 17.7761 2.22386 18 2.5 18C3.32843 18 4 18.6716 4 19.5C4 19.7761 4.22386 20 4.5 20C4.77614 20 5 19.7761 5 19.5C5 18.6716 5.67157 18 6.5 18C6.77614 18 7 17.7761 7 17.5C7 17.2239 6.77614 17 6.5 17C5.67157 17 5 16.3284 5 15.5C5 15.2239 4.77614 15 4.5 15Z"/>
              </svg>
              Ask AI
              <span class="tab-badge">Beta</span>
            </button>
          </div>

          <!-- SEARCH TAB -->
          <template v-if="activeTab === 'search'">
            <!-- Filters row -->
            <div class="search-filters">
              <div class="filter-group">
                <label for="eba-filter">EBA</label>
                <select id="eba-filter" v-model="selectedEba" @change="doSearch">
                  <option value="">All EBAs</option>
                  <option v-for="eba in ebaList" :key="eba" :value="eba">{{ eba }}</option>
                </select>
              </div>
              <div class="filter-group">
                <label for="topic-filter">Topic</label>
                <select id="topic-filter" v-model="selectedTopic" @change="doSearch">
                  <option value="">All Topics</option>
                  <option v-for="topic in topicList" :key="topic" :value="topic">{{ topic }}</option>
                </select>
              </div>
              <button v-if="selectedEba || selectedTopic" class="clear-btn" @click="clearFilters">
                Clear filters
              </button>
            </div>

            <!-- Results -->
            <div class="search-body">
              <div v-if="loading" class="search-status">
                <span class="loading-dots">Searching<span>.</span><span>.</span><span>.</span></span>
              </div>

              <div v-else-if="query.length > 1 && results.length === 0" class="search-status">
                <p>No results for <strong>{{ query }}</strong><span v-if="selectedEba || selectedTopic"> with current filters</span>.</p>
                <p class="no-results-tip">
                  Try the
                  <button class="inline-tab-link" @click="switchTab('ask')">Ask AI tab</button>
                  to get a direct answer to your question.
                </p>
              </div>

              <div v-else-if="query.length <= 1 && !selectedEba && !selectedTopic" class="search-hint">
                <p>Type to search across all 1,275 clauses.</p>
                <p class="hint-tip">Tip: use filters to narrow by EBA or topic first.</p>
              </div>

              <div v-else-if="results.length > 0" class="search-results">
                <p class="result-count">{{ results.length }} result{{ results.length === 1 ? '' : 's' }}</p>
                <a
                  v-for="result in results"
                  :key="result.url"
                  :href="result.url"
                  class="result-card"
                  @click="close"
                >
                  <div class="result-top">
                    <span class="result-title">{{ result.meta?.title || result.url }}</span>
                    <span
                      v-if="result.filters?.eba?.[0]"
                      class="result-eba"
                      :style="ebaStyle(result.filters.eba[0])"
                    >
                      {{ result.filters.eba[0] }}
                    </span>
                  </div>
                  <p v-if="result.excerpt" class="result-excerpt" v-html="result.excerpt"></p>
                  <div v-if="result.filters?.topics?.length" class="result-topics">
                    <span v-for="t in result.filters.topics" :key="t" class="result-tag">{{ t }}</span>
                  </div>
                </a>
              </div>
            </div>
          </template>

          <!-- ASK AI TAB -->
          <template v-else-if="activeTab === 'ask'">
            <div class="search-body ask-body">

              <!-- Not yet configured notice -->
              <div v-if="!aiConfigured" class="ai-not-configured">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
                <p><strong>AI Search not yet configured</strong></p>
                <p>The AI search feature requires a Cloudflare Worker to be set up. The Pagefind keyword search is fully operational in the meantime.</p>
              </div>

              <!-- AI is configured — show submit button, loading, error, answer -->
              <template v-else>
                <div class="ask-input-row">
                  <button
                    class="ask-btn"
                    :disabled="aiLoading || query.trim().length < 5"
                    @click="submitAsk"
                  >
                    <svg v-if="!aiLoading" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
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
                    <a
                      v-for="src in aiSources"
                      :key="src.url"
                      :href="src.url"
                      class="ai-source-link"
                      @click="close"
                    >{{ src.title }}</a>
                  </div>
                  <p class="ai-disclaimer">
                    ⚠️ AI answers are generated from wiki content only. Always verify against the full EBA text before acting on this information.
                  </p>
                </div>
              </template>

              <!-- Example questions — always visible regardless of configuration state -->
              <div class="ask-hint" v-if="!aiAnswer && !aiLoading">
                <p>{{ aiConfigured ? 'Try asking — specify the EBA and employee type for best results:' : 'Example questions you\'ll be able to ask — specify the EBA and employee type for best results:' }}</p>
                <ul class="ask-examples">
                  <li
                    @click="aiConfigured ? useExample('Is a full-time employee under the Nurses and Midwives EBA entitled to overtime pay on a public holiday?') : null"
                    :class="{ 'ask-example-preview': !aiConfigured }"
                  >
                    Is a full-time employee under the <strong>Nurses &amp; Midwives EBA</strong> entitled to overtime pay on a public holiday?
                  </li>
                  <li
                    @click="aiConfigured ? useExample('How much notice is required before changing the roster of a part-time nurse under the Nurses and Midwives EBA?') : null"
                    :class="{ 'ask-example-preview': !aiConfigured }"
                  >
                    How much notice is required before changing the roster of a part-time nurse under the <strong>Nurses &amp; Midwives EBA</strong>?
                  </li>
                  <li
                    @click="aiConfigured ? useExample('What is the recall allowance for a Grade 3 Allied Health employee under the Allied Health EBA?') : null"
                    :class="{ 'ask-example-preview': !aiConfigured }"
                  >
                    What is the recall allowance for a Grade 3 employee under the <strong>Allied Health EBA</strong>?
                  </li>
                  <li
                    @click="aiConfigured ? useExample('What overtime rates apply to a resident medical officer under the Doctors in Training EBA after 10 hours on a weekday shift?') : null"
                    :class="{ 'ask-example-preview': !aiConfigured }"
                  >
                    What overtime rates apply to a resident medical officer under the <strong>Doctors in Training EBA</strong> after 10 hours on a weekday shift?
                  </li>
                  <li
                    @click="aiConfigured ? useExample('Is a full-time administration officer under the HAS Managers and Admin EBA entitled to a meal allowance for overtime?') : null"
                    :class="{ 'ask-example-preview': !aiConfigured }"
                  >
                    Is a full-time administration officer under the <strong>HAS Managers &amp; Admin EBA</strong> entitled to a meal allowance for overtime?
                  </li>
                </ul>
              </div>

            </div>
          </template>

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'

// ─── AI Worker URL ───────────────────────────────────────────────────────────
// Leave empty until your Cloudflare Worker is deployed.
// Once deployed, paste your Worker URL here, e.g.:
// 'https://eba-ai-search.your-subdomain.workers.dev'
const AI_WORKER_URL = 'https://eba-ask-worker.irresistibl.workers.dev'
const aiConfigured  = AI_WORKER_URL.length > 0
// ─────────────────────────────────────────────────────────────────────────────

const open          = ref(false)
const activeTab     = ref('search')
const query         = ref('')
const selectedEba   = ref('')
const selectedTopic = ref('')
const results       = ref([])
const loading       = ref(false)
const inputRef      = ref(null)

const aiLoading     = ref(false)
const aiAnswer      = ref('')
const aiSources     = ref([])
const aiError       = ref('')

let pagefind = null

// EBA colour map — matches homepage card colours
const ebaColors = {
  'Allied Health Professionals 2021-2026':         { color: '#EA580C', bg: '#EA580C1A' },
  'Biomedical Engineers 2025-2028':                { color: '#4F46E5', bg: '#4F46E51A' },
  "Children's Services Award 2010":                { color: '#DB2777', bg: '#DB27771A' },
  'Doctors in Training 2022-2026':                 { color: '#D97706', bg: '#D977061A' },
  'Health Allied & Managers Admin 2021-2025':      { color: '#3B82F6', bg: '#3B82F61A' },
  'Medical Specialists 2022-2026':                 { color: '#0891B2', bg: '#0891B21A' },
  'Mental Health Services 2024-2028':              { color: '#7C3AED', bg: '#7C3AED1A' },
  'Medical Scientists, Pharm & Psych 2021-2025':   { color: '#059669', bg: '#0596691A' },
  'Nurses and Midwives 2024-2028':                 { color: '#E11D48', bg: '#E11D481A' },
}

function ebaStyle(ebaName) {
  const c = ebaColors[ebaName]
  if (!c) return {}
  return { color: c.color, backgroundColor: c.bg, borderColor: c.color + '40' }
}

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

// Load pagefind once
onMounted(async () => {
  try {
    const importPath = '/pagefind/pagefind.js'
    pagefind = await new Function('path', 'return import(path)')(importPath)
    await pagefind.init()
  } catch {
    console.warn('Pagefind not available — run npm run docs:index to build the index first.')
  }
})

// Focus input when modal opens
watch(open, async (val) => {
  if (val) {
    await nextTick()
    inputRef.value?.focus()
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})

// Keyboard shortcuts
function onKeydown(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    open.value = !open.value
  }
  if (e.key === '/' && !open.value && document.activeElement.tagName !== 'INPUT') {
    e.preventDefault()
    open.value = true
  }
  if (e.key === 'Escape') close()
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))

function close() {
  open.value  = false
  query.value = ''
  results.value = []
  aiAnswer.value = ''
  aiSources.value = []
  aiError.value = ''
}

function switchTab(tab) {
  activeTab.value = tab
  query.value = ''
  results.value = []
  aiAnswer.value = ''
  aiSources.value = []
  aiError.value = ''
  nextTick(() => inputRef.value?.focus())
}

async function doSearch() {
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
    results.value = await Promise.all(search.results.slice(0, 25).map(r => r.data()))
  } catch {
    results.value = []
  }
  loading.value = false
}

function clearFilters() {
  selectedEba.value   = ''
  selectedTopic.value = ''
  doSearch()
}

function useExample(text) {
  query.value = text
  nextTick(() => inputRef.value?.focus())
}

async function submitAsk() {
  if (!aiConfigured || query.value.trim().length < 5 || aiLoading.value) return
  aiLoading.value  = true
  aiAnswer.value   = ''
  aiSources.value  = []
  aiError.value    = ''
  try {
    const res = await fetch(AI_WORKER_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: query.value.trim() }),
    })
    if (!res.ok) throw new Error(`Worker returned ${res.status}`)
    const data = await res.json()
    // Expected Worker response shape:
    // { answer: string (HTML allowed), sources: [{ title: string, url: string }] }
    aiAnswer.value  = data.answer  ?? 'No answer returned.'
    aiSources.value = data.sources ?? []
  } catch (err) {
    aiError.value = err.message ?? 'Unknown error. Please try again.'
  }
  aiLoading.value = false
}
</script>

<style scoped>
/* ── Navbar trigger button ── */
.search-trigger {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.4rem 0.75rem;
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2);
  font-size: 0.875rem;
  cursor: pointer;
  width: 260px;
  margin-left: 2rem;
  transition: border-color 0.2s, color 0.2s, box-shadow 0.2s;
}
.search-trigger:hover {
  border-color: var(--vp-c-brand);
  color: var(--vp-c-text-1);
  box-shadow: 0 0 0 2px var(--vp-c-brand-soft);
}
.search-trigger-text { flex: 1; text-align: left; color: var(--vp-c-text-3); }
.search-trigger-kbd  { font-size: 0.7rem; opacity: 0.5; margin-left: auto; }
@media (max-width: 767px) {
  .search-trigger { width: auto; padding: 0.4rem; }
  .search-trigger-text { display: none; }
  .search-trigger-kbd  { display: none; }
}

/* ── Overlay ── */
.search-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: oklch(0 0 0 / 0.55);
  display: flex; align-items: flex-start; justify-content: center;
  padding-top: clamp(3rem, 8vh, 8rem);
}

/* ── Modal box ── */
.search-modal {
  width: min(680px, calc(100vw - 2rem));
  max-height: calc(100vh - 12rem);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  box-shadow: 0 24px 64px oklch(0 0 0 / 0.3);
  display: flex; flex-direction: column;
  overflow: hidden;
}

/* ── Search header ── */
.search-header {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.875rem 1rem;
  border-bottom: 1px solid var(--vp-c-divider);
}
.search-icon { flex-shrink: 0; color: var(--vp-c-text-3); }
.search-input {
  flex: 1; border: none; background: transparent;
  font-size: 1rem; color: var(--vp-c-text-1);
  outline: none;
}
.search-input::placeholder { color: var(--vp-c-text-3); }
.close-btn {
  background: none; border: 1px solid var(--vp-c-divider);
  border-radius: 4px; padding: 0.125rem 0.4rem;
  font-size: 0.75rem; color: var(--vp-c-text-3); cursor: pointer;
}
.close-btn:hover { color: var(--vp-c-text-1); }

/* ── Tab bar ── */
.search-tab-bar {
  display: flex;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  padding: 0 1rem;
  gap: 0;
}
.search-tab {
  display: flex; align-items: center; gap: 0.35rem;
  padding: 0.55rem 0.85rem;
  font-size: 0.8rem; font-weight: 500;
  color: var(--vp-c-text-2);
  border: none; background: none; cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
  transition: color 0.15s, border-color 0.15s;
}
.search-tab:hover { color: var(--vp-c-text-1); }
.search-tab.active {
  color: var(--vp-c-brand-1);
  border-bottom-color: var(--vp-c-brand-1);
  font-weight: 600;
}
.tab-badge {
  font-size: 0.62rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.04em;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
  padding: 0.05rem 0.35rem;
  border-radius: 999px;
}

/* ── Filters ── */
.search-filters {
  display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: flex-end;
  padding: 0.75rem 1rem;
  border-bottom: 1px solid var(--vp-c-divider);
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

/* ── Body / results ── */
.search-body { flex: 1; overflow-y: auto; padding: 0.75rem 1rem; }
.search-status { text-align: center; color: var(--vp-c-text-2); padding: 2rem 0; }
.no-results-tip { font-size: 0.82rem; margin-top: 0.5rem; color: var(--vp-c-text-3); }
.inline-tab-link {
  background: none; border: none; padding: 0;
  color: var(--vp-c-brand-1); font-size: inherit;
  cursor: pointer; text-decoration: underline;
}
.search-hint { text-align: center; color: var(--vp-c-text-2); padding: 2rem 0; }
.hint-tip { font-size: 0.8rem; margin-top: 0.5rem; color: var(--vp-c-text-3); }
.result-count { font-size: 0.8rem; color: var(--vp-c-text-3); margin-bottom: 0.75rem; }

.result-card {
  display: block; text-decoration: none;
  padding: 0.75rem; margin-bottom: 0.5rem;
  border-radius: 8px; border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  transition: border-color 0.15s, background 0.15s;
}
.result-card:hover { border-color: var(--vp-c-brand); background: var(--vp-c-bg-elv); }
.result-top { display: flex; align-items: baseline; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.25rem; }
.result-title { font-weight: 600; color: var(--vp-c-brand); font-size: 0.925rem; }
.result-eba {
  font-size: 0.7rem;
  padding: 0.1rem 0.55rem;
  border-radius: 999px;
  border: 1px solid transparent;
  white-space: nowrap;
  font-weight: 500;
}
.result-excerpt {
  font-size: 0.825rem; color: var(--vp-c-text-2);
  line-height: 1.65; margin: 0;
}
.result-excerpt :deep(mark) {
  background: oklch(0.88 0.1 75 / 0.45);
  color: inherit; border-radius: 2px; padding: 0 2px;
}
.result-topics { display: flex; gap: 0.35rem; flex-wrap: wrap; margin-top: 0.4rem; }
.result-tag {
  font-size: 0.7rem; background: var(--vp-c-bg-muted);
  color: var(--vp-c-text-3); padding: 0.1rem 0.4rem;
  border-radius: 999px;
}

/* ── Ask AI tab body ── */
.ask-body { display: flex; flex-direction: column; gap: 1rem; }

.ask-input-row {
  display: flex; justify-content: flex-end;
  padding-top: 0.25rem;
}
.ask-btn {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.45rem 1.1rem;
  background: var(--vp-c-brand-1); color: #fff;
  border: none; border-radius: 6px;
  font-size: 0.85rem; font-weight: 600; cursor: pointer;
  transition: background 0.15s;
}
.ask-btn:hover:not(:disabled) { background: var(--vp-c-brand-2); }
.ask-btn:disabled { opacity: 0.45; cursor: not-allowed; }

.ai-not-configured {
  text-align: center; color: var(--vp-c-text-2);
  padding: 2.5rem 1rem;
  display: flex; flex-direction: column; align-items: center; gap: 0.6rem;
}
.ai-not-configured svg { color: var(--vp-c-text-3); }
.ai-not-configured p { margin: 0; font-size: 0.875rem; }
.ai-not-configured strong { color: var(--vp-c-text-1); }

.ai-loading {
  text-align: center; color: var(--vp-c-text-2);
  padding: 2rem 0; font-size: 0.875rem;
}
.ai-error {
  padding: 1rem; border-radius: 8px;
  background: var(--vp-c-danger-soft); color: var(--vp-c-danger-1);
  font-size: 0.875rem;
}

.ai-answer {
  display: flex; flex-direction: column; gap: 0.75rem;
}
.ai-answer-body {
  font-size: 0.9rem; line-height: 1.7;
  color: var(--vp-c-text-1);
  padding: 1rem;
  background: var(--vp-c-bg-soft);
  border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
}
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
.ai-disclaimer {
  font-size: 0.75rem; color: var(--vp-c-text-3);
  margin: 0; line-height: 1.5;
}

.ask-hint { color: var(--vp-c-text-2); font-size: 0.875rem; }
.ask-hint p { margin: 0 0 0.6rem; }
.ask-examples {
  list-style: none; padding: 0; margin: 0;
  display: flex; flex-direction: column; gap: 0.4rem;
}
.ask-examples li {
  padding: 0.6rem 0.85rem;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px; cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
  color: var(--vp-c-brand-1);
  font-style: italic;
}
.ask-examples li:hover { border-color: var(--vp-c-brand-1); background: var(--vp-c-bg-elv); }
.ask-example-preview {
  cursor: default;
  opacity: 0.6;
}
.ask-example-preview:hover {
  border-color: var(--vp-c-divider) !important;
  background: var(--vp-c-bg-soft) !important;
}

/* ── Loading dots animation ── */
.loading-dots span {
  animation: blink 1.2s infinite;
}
.loading-dots span:nth-child(2) { animation-delay: 0.2s; }
.loading-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes blink {
  0%, 80%, 100% { opacity: 0; }
  40% { opacity: 1; }
}

/* ── Transition ── */
.modal-enter-active, .modal-leave-active { transition: opacity 0.18s ease; }
.modal-enter-active .search-modal, .modal-leave-active .search-modal {
  transition: transform 0.18s ease, opacity 0.18s ease;
}
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .search-modal, .modal-leave-to .search-modal {
  transform: translateY(-8px); opacity: 0;
}
</style>