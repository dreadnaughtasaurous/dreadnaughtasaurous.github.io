<template>
  <div class="search-page">
    <h1>Search</h1>

    <div class="search-controls">
      <input
        v-model="query"
        type="search"
        placeholder="Search all clauses..."
        class="search-input"
        @input="doSearch"
      />

      <div class="search-filters">
        <div class="filter-group">
          <label>EBA</label>
          <select v-model="selectedEba" @change="doSearch">
            <option value="">All EBAs</option>
            <option v-for="eba in ebaList" :key="eba" :value="eba">{{ eba }}</option>
          </select>
        </div>

        <div class="filter-group">
          <label>Topic</label>
          <select v-model="selectedTopic" @change="doSearch">
            <option value="">All Topics</option>
            <option v-for="topic in topicList" :key="topic" :value="topic">{{ topic }}</option>
          </select>
        </div>

        <button class="clear-btn" @click="clearFilters">Clear filters</button>
      </div>
    </div>

    <div v-if="loading" class="search-status">Searching...</div>
    <div v-else-if="query.length > 1 && results.length === 0" class="search-status">
      No results found for <strong>{{ query }}</strong>
      <span v-if="selectedEba || selectedTopic"> with current filters</span>.
    </div>

    <div v-else-if="results.length > 0" class="search-results">
      <p class="result-count">{{ results.length }} result{{ results.length === 1 ? '' : 's' }}</p>
      <div v-for="result in results" :key="result.url" class="result-card">
        <a :href="result.url" class="result-title">{{ result.meta?.title || result.url }}</a>
        <div class="result-meta">
          <span v-if="result.filters?.eba" class="result-eba">{{ result.filters.eba[0] }}</span>
        </div>
        <p v-if="result.excerpt" class="result-excerpt" v-html="result.excerpt"></p>
      </div>
    </div>

    <div v-else-if="query.length <= 1" class="search-status">
      Type at least 2 characters to search.
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'

const query        = ref('')
const selectedEba  = ref('')
const selectedTopic = ref('')
const results      = ref([])
const loading      = ref(false)
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

onMounted(async () => {
  try {
    const importPath = '/eba/pagefind/pagefind.js'
    pagefind = await new Function('path', 'return import(path)')(importPath)
    await pagefind.init()
  } catch (e) {
    console.warn('Pagefind not available in dev mode — run npm run docsindex to build the index first.')
  }
})

async function doSearch() {
  if (!pagefind || query.value.length < 2) {
    results.value = []
    return
  }

  loading.value = true

  const filters = {}
  if (selectedEba.value)   filters.eba    = selectedEba.value
  if (selectedTopic.value) filters.topics = selectedTopic.value

  try {
    const search = await pagefind.search(query.value, { filters })
    const data   = await Promise.all(search.results.slice(0, 20).map(r => r.data()))
    results.value = data
  } catch (e) {
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
.search-page { max-width: 860px; margin: 0 auto; padding: 2rem 1rem; }
.search-input {
  width: 100%; padding: 0.75rem 1rem; font-size: 1rem;
  border: 1px solid var(--vp-c-divider); border-radius: 8px;
  background: var(--vp-c-bg-soft); color: var(--vp-c-text-1);
  margin-bottom: 1rem;
}
.search-input:focus { outline: 2px solid var(--vp-c-brand); border-color: transparent; }
.search-filters { display: flex; gap: 1rem; flex-wrap: wrap; align-items: flex-end; margin-bottom: 1.5rem; }
.filter-group { display: flex; flex-direction: column; gap: 0.25rem; min-width: 200px; }
.filter-group label { font-size: 0.75rem; font-weight: 600; color: var(--vp-c-text-2); text-transform: uppercase; letter-spacing: 0.05em; }
.filter-group select {
  padding: 0.5rem 0.75rem; font-size: 0.875rem;
  border: 1px solid var(--vp-c-divider); border-radius: 6px;
  background: var(--vp-c-bg-soft); color: var(--vp-c-text-1);
}
.clear-btn {
  padding: 0.5rem 1rem; font-size: 0.875rem; border-radius: 6px;
  border: 1px solid var(--vp-c-divider); background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-2); cursor: pointer; align-self: flex-end;
}
.clear-btn:hover { background: var(--vp-c-bg-muted); }
.search-status { color: var(--vp-c-text-2); padding: 2rem 0; text-align: center; }
.result-count { font-size: 0.875rem; color: var(--vp-c-text-2); margin-bottom: 1rem; }
.result-card {
  padding: 1rem; margin-bottom: 0.75rem; border-radius: 8px;
  border: 1px solid var(--vp-c-divider); background: var(--vp-c-bg-soft);
}
.result-title { font-weight: 600; color: var(--vp-c-brand); text-decoration: none; font-size: 1rem; }
.result-title:hover { text-decoration: underline; }
.result-meta { margin: 0.25rem 0; }
.result-eba { font-size: 0.75rem; color: var(--vp-c-text-2); background: var(--vp-c-bg-muted); padding: 0.125rem 0.5rem; border-radius: 999px; }
.result-excerpt { font-size: 0.875rem; color: var(--vp-c-text-2); margin-top: 0.5rem; line-height: 1.6; }
.result-excerpt :deep(mark) { background: oklch(0.9 0.12 85); color: inherit; border-radius: 2px; padding: 0 2px; }
</style>