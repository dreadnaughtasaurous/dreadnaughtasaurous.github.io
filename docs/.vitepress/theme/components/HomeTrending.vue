<script setup>
/**
 * HomeTrending.vue
 *
 * A compact single-row trending strip for the homepage, placed immediately
 * above the Enterprise Agreements section. Fetches the top 3 trending pages
 * from the analytics worker and enriches them with page-catalog.json metadata.
 * Silently disappears if the worker is unreachable (failed ref stays true,
 * the v-if on the root element hides the whole component).
 */
import { ref, onMounted }   from 'vue'
import ForYouCard            from './ForYouCard.vue'

const ANALYTICS_URL = 'https://eba-analytics-worker.irresistibl.workers.dev'
const CATALOG_URL   = '/page-catalog.json'

const trending = ref([])
const loading  = ref(true)
const failed   = ref(false)

onMounted(async () => {
  try {
    // Fetch both in parallel to minimise time-to-first-card
    const [catalogRes, trendingRes] = await Promise.all([
      fetch(CATALOG_URL),
      fetch(`${ANALYTICS_URL}/trending?days=7&limit=3`),
    ])

    const catalog      = await catalogRes.json()
    const trendingData = await trendingRes.json()
    const catalogMap   = Object.fromEntries(catalog.map(p => [p.path, p]))

    // Enrich each trending result with full catalog metadata
    trending.value = (trendingData.trending || [])
      .slice(0, 3)
      .map(tp => {
        const meta = catalogMap[tp.path]
        return meta
          ? { ...meta, _count: tp.count }
          : { path: tp.path, title: tp.title, eba: tp.eba, ebaSlug: tp.eba, topics: [], _count: tp.count }
      })
  } catch {
    failed.value = true
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <!-- Whole row hidden if worker unreachable — no broken state visible -->
  <div v-if="!failed" class="ht-wrap">

    <div class="ht-label-row">
      <span class="ht-label">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"
             aria-hidden="true" class="ht-flame">
          <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z"/>
        </svg>
        Trending Now
      </span>
      <a href="/for-you/" class="ht-see-all">For You page →</a>
    </div>

    <!-- Skeleton shimmer while loading -->
    <div v-if="loading" class="ht-grid">
      <div v-for="n in 3" :key="n" class="ht-skeleton"></div>
    </div>

    <!-- Populated cards -->
    <div v-else-if="trending.length" class="ht-grid">
      <ForYouCard
        v-for="page in trending"
        :key="page.path"
        :page="page"
        variant="standard"
      />
    </div>

  </div>
</template>

<style scoped>
.ht-wrap {
  margin-bottom: 0.5rem;
}

/* Label row — mirrors .home-section-label but adds a right-aligned link */
.ht-label-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--vp-c-text-2);
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--vp-c-divider);
}

.ht-label {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.ht-flame {
  color: #EA580C;
}
.dark .ht-flame {
  color: #fb923c;
}

.ht-see-all {
  font-size: 0.75rem;
  font-weight: 500;
  text-transform: none;
  letter-spacing: 0;
  color: var(--vp-c-brand-1);
  text-decoration: none;
}
.ht-see-all:hover { text-decoration: underline; }

/* 3-column grid — collapses to 1 on mobile */
.ht-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

@media (max-width: 768px) {
  .ht-grid { grid-template-columns: 1fr; }
}

@media (min-width: 769px) and (max-width: 959px) {
  .ht-grid { grid-template-columns: repeat(2, 1fr); }
}

/* Skeleton shimmer — matches ForYou.vue skeleton aesthetic */
.ht-skeleton {
  height: 96px;
  border-radius: 10px;
  background: linear-gradient(
    90deg,
    var(--vp-c-bg-soft) 25%,
    var(--vp-c-bg-mute) 50%,
    var(--vp-c-bg-soft) 75%
  );
  background-size: 200% 100%;
  animation: ht-shimmer 1.5s ease-in-out infinite;
}

@keyframes ht-shimmer {
  0%   { background-position:  200% 0; }
  100% { background-position: -200% 0; }
}
</style>