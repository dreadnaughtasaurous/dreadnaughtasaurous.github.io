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
              placeholder="Search all clauses..."
              class="search-input"
              @input="doSearch"
              autocomplete="off"
            />
            <button class="close-btn" @click="close" aria-label="Close search">
              <kbd>Esc</kbd>
            </button>
          </div>

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
            <div v-if="loading" class="search-status">Searching…</div>

            <div v-else-if="query.length > 1 && results.length === 0" class="search-status">
              No results for <strong>{{ query }}</strong>
              <span v-if="selectedEba || selectedTopic"> with current filters</span>.
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
                  <span v-if="result.filters?.eba?.[0]" class="result-eba">
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

        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue'

const open         = ref(false)
const query        = ref('')
const selectedEba  = ref('')
const selectedTopic = ref('')
const results      = ref([])
const loading      = ref(false)
const inputRef     = ref(null)
let pagefind       = null

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
    // Use indirect import to prevent Vite resolving this at build time.
    // pagefind.js is generated post-build and doesn't exist during compilation.
    const importPath = '/eba/pagefind/pagefind.js'
    pagefind = await new Function('path', 'return import(path)')(importPath)
    await pagefind.init()
  } catch {
    console.warn('Pagefind not available — run npm run docsindex to build the index first.')
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
  open.value = false
  query.value = ''
  results.value = []
}

async function doSearch() {
  if (!pagefind || (query.value.length < 2 && !selectedEba.value && !selectedTopic.value)) {
    results.value = []
    return
  }
  loading.value = true
  const filters = {}
  if (selectedEba.value)    filters.eba    = selectedEba.value
  if (selectedTopic.value)  filters.topics = selectedTopic.value
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
.search-trigger-text {
  flex: 1;
  text-align: left;
  color: var(--vp-c-text-3);
}
.search-trigger-kbd {
  font-size: 0.7rem;
  opacity: 0.5;
  margin-left: auto;
}
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
  font-size: 0.7rem; color: var(--vp-c-text-3);
  background: var(--vp-c-bg-muted); padding: 0.1rem 0.45rem;
  border-radius: 999px; white-space: nowrap;
}
.result-excerpt {
  font-size: 0.825rem; color: var(--vp-c-text-2);
  line-height: 1.55; margin: 0;
}
.result-excerpt :deep(mark) {
  background: oklch(0.9 0.12 85); color: inherit;
  border-radius: 2px; padding: 0 2px;
}
.result-topics { display: flex; gap: 0.35rem; flex-wrap: wrap; margin-top: 0.4rem; }
.result-tag {
  font-size: 0.7rem; background: var(--vp-c-bg-muted);
  color: var(--vp-c-text-3); padding: 0.1rem 0.4rem;
  border-radius: 999px;
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