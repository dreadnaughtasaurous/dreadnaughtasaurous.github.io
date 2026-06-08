<script setup>
/**
 * ForYou.vue
 *
 * The "For You" page. Fetches page-catalog.json and the /trending endpoint,
 * reads eba-visit-history from localStorage, then runs a client-side
 * recommendation engine to populate four rows:
 *
 *   1. Trending Now       — top pages globally (analytics worker)
 *   2. Matches Interests  — unvisited pages matching the user's top topics
 *   3. Fresh Discovery    — pages from topic areas the user hasn't explored
 *   4. Recommended        — 60% topic affinity + 40% trending blend
 *
 * All personalisation data stays on-device in localStorage.
 * No personal data is sent to any server.
 */
import { ref, computed, onMounted } from 'vue'
import ForYouCard from './ForYouCard.vue'

const ANALYTICS_URL = 'https://eba-analytics-worker.irresistibl.workers.dev'
const CATALOG_URL   = '/page-catalog.json'
const HISTORY_KEY   = 'eba-visit-history'

// ── Reactive state ────────────────────────────────────────────────────────────
const catalog         = ref([])
const trendingRaw     = ref([])
const visitHistory    = ref([])   // array of paths, newest first
const catalogLoading  = ref(true)
const trendingLoading = ref(true)
const trendingFailed  = ref(false)

// ── Load all data sources in onMounted (client-side only) ─────────────────────
onMounted(async () => {
  // ── 1. Visit history from localStorage ─────────────────────────────────────
  try {
    const raw = localStorage.getItem(HISTORY_KEY)
    if (raw) {
      const stored       = JSON.parse(raw)
      visitHistory.value = Array.isArray(stored.v) ? stored.v : []
    }
  } catch { /* private browsing or corrupted data — use empty history */ }

  // ── 2. Page catalog ─────────────────────────────────────────────────────────
  // Fetched as a static JSON file from /public. Provides full metadata for
  // every clause page so the algorithm can score unvisited pages.
  try {
    const r       = await fetch(CATALOG_URL)
    catalog.value = await r.json()
  } catch { /* catalog unavailable — personalisation rows show empty state */ }
  catalogLoading.value = false

  // ── 3. Trending from analytics worker ───────────────────────────────────────
  // Fetches the top 12 most-viewed pages over the last 7 days. Row 1 uses
  // the top 3. The remaining 9 feed into the blend score for Row 4.
  try {
    const r           = await fetch(`${ANALYTICS_URL}/trending?days=7&limit=12`)
    const data        = await r.json()
    trendingRaw.value = data.trending || []
  } catch {
    trendingFailed.value = true
  }
  trendingLoading.value = false
})

// ── Recommendation engine ─────────────────────────────────────────────────────

// O(1) lookup: path → catalog entry
const catalogMap = computed(() =>
  Object.fromEntries(catalog.value.map(p => [p.path, p]))
)

// Visited paths as a Set for fast membership tests
const visitedSet = computed(() => new Set(visitHistory.value))

// Topic frequency map: how many visited pages contain each topic
const topicCounts = computed(() => {
  const counts = {}
  for (const path of visitHistory.value) {
    const page = catalogMap.value[path]
    if (!page) continue
    for (const t of page.topics || []) {
      counts[t] = (counts[t] || 0) + 1
    }
  }
  return counts
})

// Topics ranked by how frequently the user has visited them
const topTopics = computed(() =>
  Object.entries(topicCounts.value)
    .sort((a, b) => b[1] - a[1])
    .map(([t]) => t)
)

// True once the user has browsed at least one clause page
const hasHistory = computed(() => visitHistory.value.length > 0)

// Score a page by how strongly it matches the user's visited topics
function topicScore(page) {
  return (page.topics || []).reduce((sum, t) => sum + (topicCounts.value[t] || 0), 0)
}

// Build a "Because you viewed: X" reason string for a page
function topReason(page) {
  const matchingTopic = (page.topics || [])
    .filter(t => topicCounts.value[t])
    .sort((a, b) => (topicCounts.value[b] || 0) - (topicCounts.value[a] || 0))[0]
  if (!matchingTopic) return ''
  const label = matchingTopic.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
  return `Because you viewed: ${label}`
}

// ── Row 1: Trending Now ───────────────────────────────────────────────────────
// Enrich the raw trending API results with full catalog metadata.
// The API returns minimal data (path, title, eba slug, count); catalog provides
// section, topics, and excerpt for the rich card display.
const enrichedTrending = computed(() =>
  trendingRaw.value
    .slice(0, 3)
    .map(tp => {
      const meta = catalogMap.value[tp.path]
      return meta
        ? { ...meta, _count: tp.count }
        : { path: tp.path, title: tp.title, eba: tp.eba, ebaSlug: tp.eba, topics: [], _count: tp.count }
    })
)

// ── Row 2: Matches Your Interests ────────────────────────────────────────────
// Unvisited pages ranked by cumulative topic affinity score.
const matchesInterests = computed(() => {
  if (!catalog.value.length) return []
  return catalog.value
    .filter(p => !visitedSet.value.has(p.path))
    .map(p => {
      const topTopic = (p.topics || [])
        .filter(t => topicCounts.value[t])
        .sort((a, b) => (topicCounts.value[b] || 0) - (topicCounts.value[a] || 0))[0]
      const topicLabel = topTopic
        ? topTopic.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        : ''
      return {
        ...p,
        _score:      topicScore(p),
        _contextMsg: topicLabel
          ? `Based on your interest in ${topicLabel}`
          : 'Matches your reading history',
      }
    })
    .filter(p => p._score > 0)
    .sort((a, b) => b._score - a._score)
    .slice(0, 3)
})

// ── Row 3: Fresh Discovery ────────────────────────────────────────────────────
// Unvisited pages whose topics are mostly outside the user's explored areas.
// A page scores higher the more "new" topics it has relative to its total topics.
const visitedTopicSet = computed(() => new Set(topTopics.value))

const freshDiscovery = computed(() => {
  if (!catalog.value.length) return []
  return catalog.value
    .filter(p => !visitedSet.value.has(p.path))
    .map(p => {
      const allTopics    = p.topics || []
      const novelTopics  = allTopics.filter(t => !visitedTopicSet.value.has(t))
      const noveltyScore = allTopics.length > 0 ? novelTopics.length / allTopics.length : 0
      return { ...p, _noveltyScore: noveltyScore, _contextMsg: 'A topic area you haven\'t explored yet' }
    })
    .filter(p => p._noveltyScore > 0)
    .sort((a, b) => b._noveltyScore - a._noveltyScore)
    .slice(0, 3)
})

// ── Row 4: Recommended For You ────────────────────────────────────────────────
// Excludes pages already shown in Rows 1–3, then ranks by a weighted blend
// of topic affinity (60%) and global trending popularity (40%).
const shownPaths = computed(() => new Set([
  ...enrichedTrending.value.map(p => p.path),
  ...matchesInterests.value.map(p => p.path),
  ...freshDiscovery.value.map(p => p.path),
]))

const trendingScoreMap = computed(() => {
  const m   = {}
  const len = trendingRaw.value.length || 1
  trendingRaw.value.forEach((p, i) => { m[p.path] = 1 - (i / len) })
  return m
})

const recommendedForYou = computed(() => {
  if (!catalog.value.length) return []
  return catalog.value
    .filter(p => !visitedSet.value.has(p.path) && !shownPaths.value.has(p.path))
    .map(p => ({
      ...p,
      _blendScore: (topicScore(p) * 0.6) + ((trendingScoreMap.value[p.path] || 0) * 100 * 0.4),
      _contextMsg: topicScore(p) > 0
        ? 'Relevant to your work in this area'
        : 'You may find this useful',
    }))
    .sort((a, b) => b._blendScore - a._blendScore)
    .slice(0, 3)
})

// ── Overall loading gate ──────────────────────────────────────────────────────
const isLoading = computed(() => catalogLoading.value || trendingLoading.value)
</script>

<template>
  <div class="fy-page">

    <!-- ── Page header ──────────────────────────────────────────────────────── -->
    <div class="fy-header">
      <h1 class="fy-page-title">
        For You
        <span class="fy-title-rainbow" aria-hidden="true"></span>
      </h1>
      <p class="fy-page-subtitle">
        Personalised clause recommendations based on what you've been reading.
        <a href="/ebas/" class="fy-browse-link">Browse all EBAs →</a>
      </p>
    </div>

    <!-- ── Loading skeletons (shown while catalog + trending load) ───────────── -->
    <template v-if="isLoading">
      <div v-for="n in 4" :key="n" class="fy-section">
        <div class="fy-skeleton fy-skeleton--heading"></div>
        <div class="fy-grid">
          <div v-for="c in 3" :key="c" class="fy-skel-card">
            <div class="fy-skeleton fy-skel-pill"></div>
            <div class="fy-skeleton fy-skel-title fy-skel-title--1"></div>
            <div class="fy-skeleton fy-skel-title fy-skel-title--2"></div>
            <div class="fy-skeleton fy-skel-section"></div>
            <div class="fy-skel-topics">
              <div class="fy-skeleton fy-skel-topic"></div>
              <div class="fy-skeleton fy-skel-topic fy-skel-topic--2"></div>
              <div class="fy-skeleton fy-skel-topic fy-skel-topic--3"></div>
            </div>
            <div class="fy-skeleton fy-skel-context"></div>
          </div>
        </div>
      </div>
    </template>

    <template v-else>

      <!-- ── Row 1: Trending Now ─────────────────────────────────────────────── -->
      <section v-if="!trendingFailed && enrichedTrending.length" class="fy-section">
        <h2 class="fy-section-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"
               aria-hidden="true" class="fy-section-icon fy-section-icon--flame">
            <path d="M13.5.67s.74 2.65.74 4.8c0 2.06-1.35 3.73-3.41 3.73-2.07 0-3.63-1.67-3.63-3.73l.03-.36C5.21 7.51 4 10.62 4 14c0 4.42 3.58 8 8 8s8-3.58 8-8C20 8.61 17.41 3.8 13.5.67z"/>
          </svg>
          Trending Now
          <span class="fy-section-sub">Most viewed this week across the wiki</span>
        </h2>
        <div class="fy-grid">
          <ForYouCard
            v-for="page in enrichedTrending"
            :key="page.path"
            :page="page"
            variant="standard"
          />
        </div>
      </section>

      <!-- ── Row 2: Matches Your Interests ──────────────────────────────────── -->
      <section class="fy-section">
        <h2 class="fy-section-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round"
               aria-hidden="true" class="fy-section-icon">
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
          </svg>
          Matches Your Interests
          <span class="fy-section-sub">Based on clauses you've read</span>
        </h2>
        <div v-if="hasHistory && matchesInterests.length" class="fy-grid">
          <ForYouCard
            v-for="page in matchesInterests"
            :key="page.path"
            :page="page"
            variant="standard"
          />
        </div>
        <div v-else class="fy-empty">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="1.5"
               stroke-linecap="round" stroke-linejoin="round" class="fy-empty-icon">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
          <p>Browse a few clause pages and we'll surface matches here.</p>
          <a href="/ebas/" class="fy-empty-link">Start browsing →</a>
        </div>
      </section>

      <!-- ── Row 3: Fresh Discovery ──────────────────────────────────────────── -->
      <section class="fy-section">
        <h2 class="fy-section-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round"
               aria-hidden="true" class="fy-section-icon">
            <circle cx="12" cy="12" r="10"/>
            <path d="M12 8v4l3 3"/>
          </svg>
          Fresh Discovery
          <span class="fy-section-sub">Topic areas you haven't explored yet</span>
        </h2>
        <div v-if="hasHistory && freshDiscovery.length" class="fy-grid">
          <ForYouCard
            v-for="page in freshDiscovery"
            :key="page.path"
            :page="page"
            variant="standard"
          />
        </div>
        <div v-else class="fy-empty">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="1.5"
               stroke-linecap="round" stroke-linejoin="round" class="fy-empty-icon">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
            <path d="M3 3v5h5"/>
            <path d="M12 7v5l4 2"/>
          </svg>
          <p>Keep browsing to unlock discovery recommendations from unexplored areas.</p>
          <a href="/ebas/" class="fy-empty-link">Explore EBAs →</a>
        </div>
      </section>

      <!-- ── Row 4: Recommended For You ─────────────────────────────────────── -->
      <section class="fy-section">
        <h2 class="fy-section-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="2"
               stroke-linecap="round" stroke-linejoin="round"
               aria-hidden="true" class="fy-section-icon">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
          </svg>
          Recommended For You
          <span class="fy-section-sub">Your personalised picks</span>
        </h2>
        <div v-if="recommendedForYou.length" class="fy-grid">
          <ForYouCard
            v-for="page in recommendedForYou"
            :key="page.path"
            :page="page"
            variant="standard"
          />
        </div>
        <div v-else class="fy-empty">
          <svg width="30" height="30" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" stroke-width="1.5"
               stroke-linecap="round" stroke-linejoin="round" class="fy-empty-icon">
            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
          </svg>
          <p>Recommendations will appear here as you explore more of the wiki.</p>
        </div>
      </section>

    </template>
  </div>
</template>

<style scoped>
/* ── Page shell ──────────────────────────────────────────────────────────── */
.fy-page {
  max-width: 960px;
  margin: 0 auto;
  padding: 2rem 1.5rem 4rem;
}

/* ── Header ──────────────────────────────────────────────────────────────── */
.fy-header { margin-bottom: 2.5rem; }

.fy-page-title {
  position: relative;
  display: inline-block;
  font-size: 2rem;
  font-weight: 700;
  margin: 0 0 0.1rem 0;
  padding: 0;
  border: none;
  letter-spacing: -0.02em;
}

/* Title underline — brand gradient (purple #4A2A72 → hot pink #D21C62) */
.fy-title-rainbow {
  display: block;
  height: 3px;
  border-radius: 2px;
  margin-top: 0.3rem;
  background: linear-gradient(90deg, #4A2A72, #D21C62);
}

.fy-page-subtitle {
  font-size: 0.87rem;
  color: var(--vp-c-text-2);
  margin: 0.5rem 0 0 0;
}

.fy-browse-link {
  color: var(--vp-c-brand-1);
  text-decoration: none;
  font-weight: 500;
  margin-left: 0.4rem;
}
.fy-browse-link:hover { text-decoration: underline; }

/* ── Section rows ────────────────────────────────────────────────────────── */
.fy-section { margin-bottom: 2.5rem; }

.fy-section-title {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.97rem;
  font-weight: 600;
  margin: 0 0 0.85rem 0;
  padding-bottom: 0.5rem;
  border: none;
  border-bottom: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-1);
}

.fy-section-icon { flex-shrink: 0; color: var(--vp-c-brand-1); }
.fy-section-icon--flame { color: #EA580C; }
.dark .fy-section-icon--flame { color: #fb923c; }

.fy-section-sub {
  font-size: 0.74rem;
  font-weight: 400;
  color: var(--vp-c-text-2);
  margin-left: 0.2rem;
}

/* ── 3-column card grid ──────────────────────────────────────────────────── */
.fy-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.85rem;
}

@media (max-width: 768px) {
  .fy-grid   { grid-template-columns: 1fr; }
  .fy-page   { padding: 1.25rem 1rem 5.5rem; }
  .fy-page-title { font-size: 1.5rem; }
}

@media (min-width: 769px) and (max-width: 959px) {
  .fy-grid { grid-template-columns: repeat(2, 1fr); }
}

/* ── Empty states ────────────────────────────────────────────────────────── */
.fy-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  padding: 2rem 1rem;
  border: 1px dashed var(--vp-c-divider);
  border-radius: 10px;
  text-align: center;
  color: var(--vp-c-text-2);
}

.fy-empty-icon { opacity: 0.5; }
.fy-empty p    { margin: 0; font-size: 0.84rem; }

.fy-empty-link {
  font-size: 0.81rem;
  color: var(--vp-c-brand-1);
  text-decoration: none;
  font-weight: 500;
}
.fy-empty-link:hover { text-decoration: underline; }

/* ── Loading skeletons ───────────────────────────────────────────────────── */
.fy-skeleton {
  border-radius: 8px;
  background: linear-gradient(
    90deg,
    var(--vp-c-bg-soft) 25%,
    var(--vp-c-bg-mute) 50%,
    var(--vp-c-bg-soft) 75%
  );
  background-size: 200% 100%;
  animation: fy-shimmer 1.5s ease-in-out infinite;
}

.fy-skeleton--heading { height: 22px; width: 200px; margin-bottom: 0.85rem; }
.fy-skel-card {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  padding: 0.9rem 1rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg-soft);
}
.fy-skel-pill     { height: 18px; width: 72px; border-radius: 4px; }
.fy-skel-title    { height: 13px; border-radius: 4px; }
.fy-skel-title--1 { width: 85%; }
.fy-skel-title--2 { width: 62%; }
.fy-skel-section  { height: 11px; width: 55%; border-radius: 4px; }
.fy-skel-topics   { display: flex; gap: 0.28rem; }
.fy-skel-topic    { height: 16px; width: 52px; border-radius: 4px; }
.fy-skel-topic--2 { width: 62px; }
.fy-skel-topic--3 { width: 44px; }
.fy-skel-context  { height: 10px; width: 48%; border-radius: 4px; }

@keyframes fy-shimmer {
  0%   { background-position:  200% 0; }
  100% { background-position: -200% 0; }
}
</style>