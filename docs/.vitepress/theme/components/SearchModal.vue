<template>
  <!-- Trigger button for navbar -->
  <button class="search-trigger" @click="openModal" aria-label="Search">
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
        <div class="search-modal" ref="modalRef">

          <!-- Search input row -->
          <div class="search-header">
            <svg
              v-show="!hideSharedInput"
              class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              ref="inputRef"
              v-show="!hideSharedInput"
              v-model="query"
              type="search"
              :placeholder="activeTab === 'search' ? 'Search all clauses...' : 'Ask a question about your EBA...'"
              class="search-input"
              @input="activeTab === 'search' ? debouncedSearch() : null"
              @keydown.enter="activeTab === 'ask' ? submitAsk() : null"
              @keydown.down.prevent="focusResult(0)"
              autocomplete="off"
            />
            <!-- Save / bookmark button — only shown when there is an active query on the Search tab -->
            <button
              v-if="activeTab === 'search' && query.trim().length >= 2"
              class="save-search-btn"
              :class="{ saved: isCurrentQuerySaved }"
              @click="toggleSaveSearch"
              :aria-label="isCurrentQuerySaved ? 'Remove saved search' : 'Save this search'"
              :title="isCurrentQuerySaved ? 'Remove saved search' : 'Save this search'"
            >
              <svg v-if="isCurrentQuerySaved" width="15" height="15" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </button>
            <button class="close-btn" @click="close" aria-label="Close search">
              <kbd>Esc</kbd>
            </button>
          </div>

          <!-- Operator pills — shown when the raw query contains parsed operator tokens -->
          <div v-if="activeTab === 'search' && parsedOperators.hasPills" class="operator-pills-row">
            <span class="op-pills-label">Active:</span>
            <!-- EBA operator pill -->
            <span
              v-if="parsedOperators.eba"
              class="op-pill op-pill--eba"
              :style="opPillEbaStyle(parsedOperators.eba)"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
              eba:{{ parsedOperators.ebaSlug }}
              <button class="op-pill-dismiss" @click="dismissOperator('eba')" :aria-label="`Remove EBA filter: ${parsedOperators.ebaSlug}`">×</button>
            </span>
            <!-- Topic operator pill -->
            <span v-if="parsedOperators.topic" class="op-pill op-pill--topic">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
              topic:{{ parsedOperators.topic }}
              <button class="op-pill-dismiss" @click="dismissOperator('topic')" :aria-label="`Remove topic filter: ${parsedOperators.topic}`">×</button>
            </span>
            <!-- Clause operator pill -->
            <span v-if="parsedOperators.clause" class="op-pill op-pill--clause">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              clause:{{ parsedOperators.clause }}
              <button class="op-pill-dismiss" @click="dismissOperator('clause')" :aria-label="`Remove clause filter: ${parsedOperators.clause}`">×</button>
            </span>
            <!-- Exclude operator pills (one per excluded word) -->
            <span
              v-for="word in parsedOperators.exclude"
              :key="word"
              class="op-pill op-pill--exclude"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
              -{{ word }}
              <button class="op-pill-dismiss" @click="dismissOperator('exclude', word)" :aria-label="`Remove exclusion: ${word}`">×</button>
            </span>
            <!-- Phrase pills -->
            <span
              v-for="phrase in parsedOperators.phrases"
              :key="phrase"
              class="op-pill op-pill--phrase"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 2v12c0 1 .5 2 2 2zm9 0c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 2v12c0 1 .5 2 2 2z"/></svg>
              "{{ phrase }}"
              <button class="op-pill-dismiss" @click="dismissOperator('phrase', phrase)" :aria-label="`Remove phrase: ${phrase}`">×</button>
            </span>
            <button class="op-pills-clear" @click="clearAllOperators">Clear all</button>
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
              data-tour="ask-ai-tab"
            >
              <svg class="ask-tab-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
                <path class="ask-tab-sparkle" d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
                <path class="ask-tab-star" d="M20 3v4"/>
                <path class="ask-tab-star" d="M22 5h-4"/>
                <path class="ask-tab-star ask-tab-star--delayed" d="M4 17v2"/>
                <path class="ask-tab-star ask-tab-star--delayed" d="M5 18H3"/>
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
                <select id="eba-filter" v-model="selectedEba" @change="doSearch" :class="{ 'eba-filter-flash': ebaFilterFlash }">
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

            <!-- Results body -->
            <div class="search-body" ref="resultsContainerRef">

              <!-- Loading -->
              <div v-if="loading" class="search-status">
                <span class="loading-dots">Searching<span>.</span><span>.</span><span>.</span></span>
              </div>

              <!-- No results + optional fuzzy fallback -->
              <div v-else-if="query.length > 1 && results.length === 0 && !fuzzyLoading" class="search-status">
                <p>No results for <strong>{{ query }}</strong><span v-if="selectedEba || selectedTopic || parsedOperators.hasPills"> with current filters</span>.</p>

                <!-- Suggestions on zero results — same panel, same component, no duplicated card markup -->
                <div v-if="suggestions.length > 0" class="suggestions-panel" role="list" aria-label="Search suggestions">
                  <p class="suggestions-heading">Did you search for…?</p>
                  <button
                    v-for="s in suggestions"
                    :key="s.label"
                    class="suggestion-card"
                    :class="`suggestion-card--${s.type}`"
                    role="listitem"
                    @click="applySuggestion(s)"
                  >
                    <span class="suggestion-card-icon" aria-hidden="true">
                      <svg v-if="s.type === 'eba'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                      <svg v-else-if="s.type === 'topic'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                      <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                    </span>
                    <span class="suggestion-card-text">
                      <span class="suggestion-card-label">{{ s.label }}</span>
                      <span class="suggestion-card-sublabel">{{ s.sublabel }}</span>
                    </span>
                    <svg class="suggestion-card-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                  </button>
                </div>

                <p v-if="fuzzyResults.length > 0" class="fuzzy-suggestion">
                  Showing results for <strong>{{ fuzzyQuery }}</strong> instead:
                </p>
                <div v-if="fuzzyResults.length > 0" class="search-results fuzzy-results">
                  <a
                    v-for="(result, index) in fuzzyResults"
                    :key="result.url"
                    :href="buildHighlightUrl(result)"
                    class="result-card"
                    :data-result-index="index"
                    @click="handleResultClick(result)"
                    @keydown.up.prevent="focusResult(index - 1)"
                    @keydown.down.prevent="focusResult(index + 1)"
                    @keydown.esc="inputRef?.focus()"
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
                  Try the
                  <button class="inline-tab-link" @click="switchTab('ask')">Ask AI tab</button>
                  to get a direct answer to your question.
                </p>
              </div>

              <!-- Quick Access panel (no query, no filters) -->
              <div v-else-if="query.length <= 1 && !selectedEba && !selectedTopic" class="quick-access">

                <!-- Bookmarks section -->
                <div v-if="bookmarks.length > 0" class="qa-section">
                  <div class="qa-section-header">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                    My bookmarks
                    <span class="qa-bookmark-count">{{ bookmarks.length }}</span>
                  </div>
                  <div class="qa-bookmark-list">
                    <a                    
                      v-for="bm in bookmarks"
                      :key="bm.id"
                      :href="bm.url"
                      class="qa-bookmark-card"
                      @click="close"
                    >
                      <div class="qa-bookmark-card-top">
                        <svg class="qa-bookmark-card-icon" width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                        <span class="qa-bookmark-card-title">{{ bm.title }}</span>
                      </div>
                      <div v-if="bm.eba" class="qa-bookmark-card-eba">{{ bm.eba }}</div>
                      <div v-if="bm.note" class="qa-bookmark-card-note">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        {{ bm.note }}
                      </div>
                    </a>
                  </div>
                </div>

                <!-- Saved searches section -->
                <div v-if="savedSearches.length > 0" class="qa-section">
                  <div class="qa-section-header">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                    Saved searches
                    <button class="qa-clear-recent" @click="clearAllSavedSearches" aria-label="Clear all saved searches">Clear all</button>
                  </div>
                  <div class="qa-chips">
                    <span
                      v-for="saved in savedSearches"
                      :key="saved.id"
                      class="qa-chip qa-chip-saved"
                    >
                      <button class="qa-chip-label" @click="useSavedSearch(saved)">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                        {{ saved.label }}
                      </button>
                      <button class="qa-chip-remove" @click.stop="removeSavedSearch(saved.id)" :aria-label="`Remove saved search: ${saved.label}`">×</button>
                    </span>
                  </div>
                </div>

                <!-- Recent searches section -->
                <div v-if="recentSearches.length > 0" class="qa-section">
                  <div class="qa-section-header">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    Recent searches
                    <button class="qa-clear-recent" @click="clearRecentSearches" aria-label="Clear recent searches">Clear</button>
                  </div>
                  <div class="qa-chips">
                    <button
                      v-for="recent in recentSearches"
                      :key="recent"
                      class="qa-chip qa-chip-recent"
                      @click="useRecentSearch(recent)"
                    >{{ recent }}</button>
                  </div>
                </div>

                <!-- Most Viewed Clauses — fetched from analytics worker on open -->
                <!-- Loading skeleton — shown while fetch is in flight -->
                <div v-if="mostViewedLoading" class="qa-section">
                  <div class="qa-section-header">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    Most viewed
                  </div>
                  <div class="qa-most-viewed-list">
                    <div v-for="n in 3" :key="n" class="qa-most-viewed-card qa-most-viewed-card--skeleton">
                      <span class="qa-skeleton-rank"></span>
                      <span class="qa-skeleton-body">
                        <span class="qa-skeleton-line qa-skeleton-title"></span>
                        <span class="qa-skeleton-line qa-skeleton-eba"></span>
                      </span>
                    </div>
                  </div>
                </div>
                <!-- Populated list — only renders when worker returned ≥1 result -->
                <div v-else-if="mostViewedClauses.length > 0" class="qa-section">
                  <div class="qa-section-header">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    Most viewed
                  </div>
                  <div class="qa-most-viewed-list">
                    <a
                      v-for="(clause, i) in mostViewedClauses"
                      :key="clause.path"
                      :href="clause.path"
                      class="qa-most-viewed-card"
                      @click="close"
                    >
                      <span class="qa-most-viewed-rank" aria-hidden="true">{{ i + 1 }}</span>
                      <span class="qa-most-viewed-body">
                        <span class="qa-most-viewed-title">{{ clause.title }}</span>
                        <span v-if="clause.eba" class="qa-most-viewed-eba">{{ ebaSlugLabels[clause.eba] || clause.eba }}</span>
                      </span>
                      <svg class="qa-most-viewed-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                    </a>
                  </div>
                </div>
                <!-- error and empty-data cases: section simply absent — no user-facing message -->

                <!-- Quick access shortcuts -->
                <div class="qa-section">
                  <div class="qa-section-header">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                    Quick access
                  </div>
                  <div class="qa-shortcuts">
                    <button
                      v-for="shortcut in quickAccessShortcuts"
                      :key="shortcut.label"
                      class="qa-shortcut"
                      @click="fireShortcut(shortcut)"
                    >
                      <span class="qa-shortcut-icon" aria-hidden="true">{{ shortcut.icon }}</span>
                      <span class="qa-shortcut-label">{{ shortcut.label }}</span>
                      <svg class="qa-shortcut-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                    </button>
                  </div>
                </div>

                <p class="search-hint-small">Type to search · Try <code class="op-hint">eba:nurses-midwives</code> <code class="op-hint">topic:wages</code> <code class="op-hint">"exact phrase"</code> <code class="op-hint">-exclude</code></p>
              </div>

              <!-- Normal results list -->
              <div v-else-if="results.length > 0" class="search-results">
                <p class="result-count">{{ results.length }} result{{ results.length === 1 ? '' : 's' }}</p>

                <!-- Smart suggestions — persistent refinement panel, shown whenever keywords match -->
                <div v-if="suggestions.length > 0" class="suggestions-panel suggestions-panel--inline" role="list" aria-label="Search suggestions">
                  <p class="suggestions-heading">Did you search for…?</p>
                  <button
                    v-for="s in suggestions"
                    :key="s.label"
                    class="suggestion-card"
                    :class="`suggestion-card--${s.type}`"
                    role="listitem"
                    @click="applySuggestion(s)"
                  >
                    <span class="suggestion-card-icon" aria-hidden="true">
                      <svg v-if="s.type === 'eba'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                      <svg v-else-if="s.type === 'topic'" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                      <svg v-else width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
                    </span>
                    <span class="suggestion-card-text">
                      <span class="suggestion-card-label">{{ s.label }}</span>
                      <span class="suggestion-card-sublabel">{{ s.sublabel }}</span>
                    </span>
                    <svg class="suggestion-card-arrow" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                  </button>
                </div>
                <a
                  v-for="(result, index) in results"
                  :key="result.url"
                  :href="buildHighlightUrl(result)"
                  class="result-card"
                  :class="{ 'result-card-previewing': previewResult?.url === result.url }"
                  :data-result-index="index"
                  @click="handleResultClick(result)"
                  @keydown.up.prevent="focusResult(index - 1)"
                  @keydown.down.prevent="focusResult(index + 1)"
                  @keydown.esc="inputRef?.focus()"
                  @mouseenter="setPreview(result, $event)"
                  @mouseleave="clearPreview"
                  @focus="setPreview(result, $event)"
                  @blur="clearPreview"
                >
                  <div class="result-top">
                    <span class="result-title">{{ result.meta?.title || result.url }}</span>
                    <span
                      v-if="result.filters?.eba?.[0]"
                      class="result-eba"
                      :style="ebaStyle(result.filters.eba[0])"
                    >{{ result.filters.eba[0] }}</span>
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

          <!-- ASK AI TAB — data-ask-mode on the body div lets CSS key off the active mode -->
          <template v-else-if="activeTab === 'ask'">
            <div class="search-body ask-body" :data-ask-mode="askMode">
              <div v-if="!aiConfigured" class="ai-not-configured">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
                <p><strong>AI Search not yet configured</strong></p>
                <p>The AI search feature requires a Cloudflare Worker to be set up. The Pagefind keyword search is fully operational in the meantime.</p>
              </div>
              <template v-else>

                <!-- ── Ask mode selector (hidden once a conversation starts) ── -->
                <div
                  v-if="conversationHistory.length === 0 && !aiLoading"
                  class="ask-mode-selector"
                  role="group"
                  aria-label="Ask mode"
                >
                  <button
                    class="ask-mode-btn"
                    :class="{ active: askMode === 'question' }"
                    @click="setAskMode('question')"
                  >Ask a question</button>
                  <button
                    class="ask-mode-btn"
                    :class="{ active: askMode === 'situation' }"
                    @click="setAskMode('situation')"
                  >Describe a situation</button>
                  <button
                    class="ask-mode-btn"
                    :class="{ active: askMode === 'draft' }"
                    @click="setAskMode('draft')"
                  >Draft a response</button>
                </div>

                <!-- ── question mode: structured form with EBA/employment dropdowns ── -->
                <div
                  v-if="conversationHistory.length === 0 && !aiLoading && askMode === 'question'"
                  class="ask-form"
                >
                  <div class="ask-form-row">
                    <div class="filter-group">
                      <label for="question-eba-filter">EBA <span class="optional-label">(optional)</span></label>
                      <select id="question-eba-filter" v-model="questionEba">
                        <option value="">Select EBA...</option>
                        <option v-for="eba in ebaList" :key="eba" :value="eba">{{ eba }}</option>
                      </select>
                    </div>
                    <div class="filter-group">
                      <label for="question-emp-filter">Employment type <span class="optional-label">(optional)</span></label>
                      <select id="question-emp-filter" v-model="questionEmpType">
                        <option value="">Select type...</option>
                        <option v-for="et in employmentTypes" :key="et" :value="et">{{ et }}</option>
                      </select>
                    </div>
                  </div>
                  <div class="ask-form-field">
                    <label for="question-text">Your question <span class="required-mark" aria-hidden="true">*</span></label>
                    <textarea
                      id="question-text"
                      v-model="questionText"
                      rows="4"
                      placeholder="e.g. Am I entitled to overtime pay if I work more than 8 hours on a weekend shift?"
                      @keydown.enter.ctrl="submitAsk"
                    ></textarea>
                    <div
                      v-if="questionText.trim().length > 0"
                      class="char-counter"
                      :class="`char-counter--${charCountState(questionCharCount)}`"
                      aria-live="polite"
                    >
                      {{ questionCharCount }} chars
                      <span class="char-counter-sep">·</span>
                      <span class="char-counter-label">
                        <template v-if="charCountState(questionCharCount) === 'too-short'">Too short for a useful answer</template>
                        <template v-else-if="charCountState(questionCharCount) === 'good-start'">Good start — add more detail</template>
                        <template v-else>Good length</template>
                      </span>
                    </div>
                  </div>
                  <div class="ask-input-row">
                    <button
                      class="ask-btn"
                      :style="{ opacity: askBtnOpacity(questionCharCount) }"
                      :disabled="aiLoading || questionText.trim().length < 5"
                      @click="submitAsk"
                    >
                      <span v-if="aiLoading" class="loading-dots">Thinking<span>.</span><span>.</span><span>.</span></span>
                      <span v-else>Ask</span>
                    </button>
                  </div>
                </div>

                <!-- ── situation mode form ── -->
                <div
                  v-if="conversationHistory.length === 0 && !aiLoading && askMode === 'situation'"
                  class="ask-form"
                >
                  <div class="ask-form-row">
                    <div class="filter-group">
                      <label for="situation-eba-filter">EBA <span class="optional-label">(optional)</span></label>
                      <select id="situation-eba-filter" v-model="situationEba">
                        <option value="">Select EBA...</option>
                        <option v-for="eba in ebaList" :key="eba" :value="eba">{{ eba }}</option>
                      </select>
                    </div>
                    <div class="filter-group">
                      <label for="situation-emp-filter">Employment type <span class="optional-label">(optional)</span></label>
                      <select id="situation-emp-filter" v-model="situationEmpType">
                        <option value="">Select type...</option>
                        <option v-for="et in employmentTypes" :key="et" :value="et">{{ et }}</option>
                      </select>
                    </div>
                  </div>
                  <div class="ask-form-field">
                    <label for="situation-text">Describe the situation <span class="required-mark" aria-hidden="true">*</span></label>
                    <textarea
                      id="situation-text"
                      v-model="situationText"
                      rows="4"
                      placeholder="e.g. An employee worked a double shift over the weekend and is questioning whether they're entitled to overtime pay..."
                    ></textarea>
                    <div
                      v-if="situationText.trim().length > 0"
                      class="char-counter"
                      :class="`char-counter--${charCountState(situationCharCount)}`"
                      aria-live="polite"
                    >
                      {{ situationCharCount }} chars
                      <span class="char-counter-sep">·</span>
                      <span class="char-counter-label">
                        <template v-if="charCountState(situationCharCount) === 'too-short'">Too short for a useful answer</template>
                        <template v-else-if="charCountState(situationCharCount) === 'good-start'">Good start — add more detail</template>
                        <template v-else>Good length</template>
                      </span>
                    </div>
                  </div>
                  <div class="ask-input-row">
                    <button
                      class="ask-btn"
                      :style="{ opacity: askBtnOpacity(situationCharCount) }"
                      :disabled="aiLoading || situationText.trim().length < 10"
                      @click="submitAsk"
                    >
                      <span v-if="aiLoading" class="loading-dots">Thinking<span>.</span><span>.</span><span>.</span></span>
                      <span v-else>Describe situation</span>
                    </button>
                  </div>
                </div>

                <!-- ── draft mode form ── -->
                <div
                  v-if="conversationHistory.length === 0 && !aiLoading && askMode === 'draft'"
                  class="ask-form"
                >
                  <div class="ask-form-row">
                    <div class="filter-group">
                      <label for="draft-eba-filter">EBA <span class="required-mark" aria-hidden="true">*</span></label>
                      <select id="draft-eba-filter" v-model="draftEba">
                        <option value="">Select EBA...</option>
                        <option v-for="eba in ebaList" :key="eba" :value="eba">{{ eba }}</option>
                      </select>
                    </div>
                    <div class="filter-group">
                      <label for="draft-emp-filter">Employment type <span class="required-mark" aria-hidden="true">*</span></label>
                      <select id="draft-emp-filter" v-model="draftEmpType">
                        <option value="">Select type...</option>
                        <option v-for="et in employmentTypes" :key="et" :value="et">{{ et }}</option>
                      </select>
                    </div>
                  </div>
                  <div class="ask-form-field">
                    <label for="draft-question">Employee's question <span class="required-mark" aria-hidden="true">*</span></label>
                    <textarea
                      id="draft-question"
                      v-model="draftQuestion"
                      rows="3"
                      placeholder="e.g. Am I entitled to overtime pay for the extra shift I worked?"
                    ></textarea>
                    <div
                      v-if="draftQuestion.trim().length > 0"
                      class="char-counter"
                      :class="`char-counter--${charCountState(draftCharCount)}`"
                      aria-live="polite"
                    >
                      {{ draftCharCount }} chars
                      <span class="char-counter-sep">·</span>
                      <span class="char-counter-label">
                        <template v-if="charCountState(draftCharCount) === 'too-short'">Too short for a useful answer</template>
                        <template v-else-if="charCountState(draftCharCount) === 'good-start'">Good start — add more detail</template>
                        <template v-else>Good length</template>
                      </span>
                    </div>
                  </div>
                  <div class="ask-form-field">
                    <label for="draft-context">Additional context <span class="optional-label">(optional)</span></label>
                    <textarea
                      id="draft-context"
                      v-model="draftContext"
                      rows="3"
                      placeholder="e.g. The employee works Monday to Friday, their shift was on a Sunday, 8 hours. They are classified as Grade 3."
                    ></textarea>
                  </div>
                  <div class="ask-input-row">
                    <button
                      class="ask-btn"
                      :style="{ opacity: askBtnOpacity(draftCharCount) }"
                      :disabled="aiLoading || draftEba === '' || draftEmpType === '' || draftQuestion.trim().length < 5"
                      @click="submitAsk"
                    >
                      <span v-if="aiLoading" class="loading-dots">Thinking<span>.</span><span>.</span><span>.</span></span>
                      <span v-else>Draft response</span>
                    </button>
                  </div>
                </div>

                <!-- ── Conversation thread ── -->
                <div
                  v-if="conversationHistory.length > 0 || aiLoading || aiError"
                  class="conversation-thread"
                  ref="conversationBodyRef"
                  aria-live="polite"
                  aria-label="Conversation history"
                >
                  <template v-for="(turn, idx) in conversationHistory" :key="idx">
                    <div v-if="turn.role === 'user'" class="conv-turn conv-turn--user">
                      <span class="conv-label">You</span>
                      <p class="conv-user-text">{{ turn.content }}</p>
                    </div>
                    <div
                      v-else-if="turn.role === 'assistant'"
                      class="conv-turn conv-turn--assistant"
                      :class="{ 'conv-turn--hedging': turn.hedging }"
                    >
                      <span class="conv-label">
                        EBA Assistant
                        <span v-if="turn.hedging" class="hedging-label" aria-label="This answer contains qualified language — verify carefully">
                          · Verify carefully
                        </span>
                      </span>
                      <div v-if="turn.hedging" class="hedging-callout" role="note" aria-live="polite">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="hedging-callout-icon"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        <span>This answer contains qualified language — the AI has identified conditions or exceptions that may affect the outcome. Verify the relevant clause before acting.</span>
                      </div>
                      <div class="ai-answer-body" v-html="renderMarkdown(turn.content)"></div>
                      <template v-if="idx === conversationHistory.length - 1 && aiSources.length">
                        <div class="ai-sources">
                          <p class="ai-sources-label">Sources used:</p>
                          <a v-for="src in aiSources" :key="src.url" :href="src.url" class="ai-source-link" @click="close">{{ src.title }}</a>
                        </div>
                      </template>
                      <!-- Follow-up question chips — only on the last turn, hidden while loading -->
                      <div
                        v-if="idx === conversationHistory.length - 1 && followUpChips.length > 0 && !aiLoading"
                        class="followup-chips"
                        role="group"
                        aria-label="Suggested follow-up questions"
                      >
                        <span class="followup-chips-label">You might also ask:</span>
                        <div class="followup-chips-row">
                          <button
                            v-for="chip in followUpChips"
                            :key="chip"
                            class="followup-chip"
                            @click="fireFollowUp(chip)"
                          >{{ chip }}</button>
                        </div>
                      </div>
                      <!-- Per-turn copy button — copies this turn's plain text to clipboard -->
                      <div class="conv-copy-wrap">
                        <button
                          class="conv-copy-btn"
                          :class="{
                            'conv-copy-btn--success': turn.copied,
                            'conv-copy-btn--error':   turn.copyError
                          }"
                          :aria-label="turn.copied ? 'Copied!' : turn.copyError ? 'Copy failed — try again' : 'Copy this answer'"
                          :title="turn.copied ? 'Copied!' : turn.copyError ? 'Copy failed — try again' : 'Copy this answer'"
                          @click="copyTurnText(turn, idx)"
                        >
                          <!-- Idle: copy icon -->
                          <svg v-if="!turn.copied && !turn.copyError" width="14" height="14" viewBox="0 0 24 24"
                              fill="none" stroke="currentColor" stroke-width="2"
                              stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <path d="M16 2H8C6.9 2 6 2.9 6 4V18C6 19.1 6.9 20 8 20H18C19.1 20 20 19.1 20 18V6L16 2Z"/>
                            <path d="M16 2V6H20"/>
                            <path d="M4 6H3C2.4 4 2 4.6 2 5V21C2 21.6 2.4 22 3 22H15C15.6 22 16 21.6 16 21V20"/>
                          </svg>
                          <!-- Success: animated tick -->
                          <svg v-if="turn.copied" class="conv-copy-tick" width="14" height="14" viewBox="0 0 24 24"
                              fill="none" stroke="currentColor" stroke-width="2.5"
                              stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                          <!-- Error: X icon -->
                          <svg v-if="turn.copyError" width="14" height="14" viewBox="0 0 24 24"
                              fill="none" stroke="currentColor" stroke-width="2.5"
                              stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                            <line x1="18" y1="6" x2="6" y2="18"/>
                            <line x1="6" y1="6" x2="18" y2="18"/>
                          </svg>
                        </button>
                      </div>
                    </div>
                  </template>

                  <div v-if="aiLoading" class="conv-turn conv-turn--assistant conv-turn--loading">
                    <span class="conv-label">EBA Assistant</span>
                    <span class="loading-dots">Reading EBA content<span>.</span><span>.</span><span>.</span></span>
                  </div>

                  <div v-if="aiError && !aiLoading" class="ai-error">
                    <strong>Something went wrong.</strong> {{ aiError }}
                  </div>
                </div>

                <p v-if="conversationHistory.some(t => t.role === 'assistant')" class="ai-disclaimer">
                  ⚠️ AI answers are generated from wiki content only. Always verify against the full EBA text before acting on this information.
                </p>
                <p v-if="lastAnswerWasDraft && conversationHistory.some(t => t.role === 'assistant')" class="ai-disclaimer ai-disclaimer-draft">
                  📋 Review this draft carefully before sending — it is AI-generated and has not been verified by an employment relations specialist.
                </p>

                <!-- ── Persistent follow-up input — shown after first assistant turn ── -->
                <div
                  v-if="conversationHistory.some(t => t.role === 'assistant') && !aiLoading"
                  class="followup-input-row"
                >
                  <textarea
                    ref="followUpRef"
                    v-model="followUpText"
                    class="followup-input"
                    placeholder="Ask a follow-up question…"
                    rows="3"
                    @keydown.enter.exact.prevent="submitFollowUp"
                    @input="autoResizeFollowUp"
                  ></textarea>
                  <button
                    class="followup-send-btn"
                    :disabled="followUpText.trim().length < 3"
                    @click="submitFollowUp"
                    aria-label="Send follow-up question"
                  >
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg>
                  </button>
                </div>

                <div v-if="conversationHistory.length >= 2" class="conv-reset-row">
                  <button class="conv-reset-btn" @click="resetConversation">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                    New conversation
                  </button>
                </div>

                <!-- ── Ask hint — mode-tailored example prompts ── -->
                <div class="ask-hint" v-if="conversationHistory.length === 0 && !aiLoading">

                  <!-- question mode: examples fill the questionText textarea; EBA/emp type set via dropdowns -->
                  <template v-if="askMode === 'question'">
                    <p>{{ aiConfigured ? 'Select your EBA and employment type above, then try an example:' : 'Example questions you\'ll be able to ask once AI is configured:' }}</p>
                    <ul class="ask-examples">
                      <li @click="aiConfigured ? useQuestionExample('Am I entitled to overtime pay on a public holiday?') : null" :class="{ 'ask-example-preview': !aiConfigured }">Am I entitled to overtime pay on a public holiday?</li>
                      <li @click="aiConfigured ? useQuestionExample('What is the recall allowance if I am called back to work after leaving the premises?') : null" :class="{ 'ask-example-preview': !aiConfigured }">What is the recall allowance if I am called back to work after leaving the premises?</li>
                    </ul>
                  </template>

                  <!-- situation mode: clicking auto-fills the situationText textarea -->
                  <template v-else-if="askMode === 'situation'">
                    <p>Try an example situation, or describe your own above:</p>
                    <ul class="ask-examples">
                      <li @click="aiConfigured ? useSituationExample('An employee worked 12 hours on Saturday and 10 hours on Sunday. They are now claiming overtime pay for both days. I need to understand what they are entitled to under their EBA.') : null" :class="{ 'ask-example-preview': !aiConfigured }">An employee worked 12 hours Saturday and 10 hours Sunday and is claiming overtime for both days.</li>
                      <li @click="aiConfigured ? useSituationExample('An employee was asked to remain at work after their shift ended to cover an absent colleague. They worked an additional 3 hours and are asking what allowances or overtime rates apply.') : null" :class="{ 'ask-example-preview': !aiConfigured }">An employee stayed back after their shift ended to cover an absent colleague and wants to know what they are owed.</li>
                    </ul>
                  </template>

                  <!-- draft mode: clicking auto-fills the draftQuestion input -->
                  <template v-else-if="askMode === 'draft'">
                    <p>Try an example employee question, or enter your own above:</p>
                    <ul class="ask-examples">
                      <li @click="aiConfigured ? useDraftExample('Am I entitled to overtime pay for the extra hours I worked on the weekend?') : null" :class="{ 'ask-example-preview': !aiConfigured }">Am I entitled to overtime pay for the extra hours I worked on the weekend?</li>
                      <li @click="aiConfigured ? useDraftExample('What allowance am I entitled to if I am recalled to work after I have already left the premises?') : null" :class="{ 'ask-example-preview': !aiConfigured }">What allowance am I entitled to if I am recalled to work after leaving the premises?</li>
                    </ul>
                  </template>

                </div>
              </template>
            </div>
          </template>

        </div>
      </div>
    </Transition>
  </Teleport>

  <!-- Floating preview pane -->
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
        <a :href="buildHighlightUrl(previewResult)" class="preview-open-link" @click="handleResultClick(previewResult)">
          Open page
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </a>
      </div>
    </Transition>
  </Teleport>

  <!-- ── Ask AI onboarding overlay — Teleport to body, centred, full-screen backdrop ──
       Shown once per device the first time the user opens the Ask AI tab.
       Dismissed permanently via localStorage key 'eba-ask-ai-intro-seen'.
       Sits at z-index 10002 so it appears above the search modal (9999) and
       the tour tooltip (10001) but is only triggered from within the modal. -->
  <Teleport to="body">
    <Transition name="ai-intro-overlay">
      <div
        v-if="open && activeTab === 'ask' && !askAiIntroSeen"
        class="ai-intro-overlay"
        @click.self="dismissAskIntro"
        aria-hidden="true"
      >
        <div
          class="ai-intro-panel"
          role="dialog"
          aria-modal="true"
          aria-label="Getting the best answers from Ask AI"
        >
          <!-- Header -->
          <div class="ai-intro-header">
            <span class="ai-intro-title">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>
              Getting the best answers from Ask AI
            </span>
            <button class="ai-intro-dismiss" @click="dismissAskIntro" aria-label="Dismiss Ask AI guide">✕</button>
          </div>

          <!-- Scrollable body — sits between sticky header and sticky Got it button -->
          <div class="ai-intro-body-scroll">
          <!-- Warning alert -->
          <div class="ai-intro-alert">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
            Ask AI reads only this wiki — not the full EBA PDFs. Always verify important answers against the official EBA text before acting.
          </div>

          <!-- How to structure -->
          <div class="ai-intro-section">
            <p class="ai-intro-section-title">How to structure your question</p>
            <p class="ai-intro-body">The AI produces significantly better answers when you provide three things:</p>
            <div class="ai-intro-how-list">
              <div class="ai-intro-how-item">
                <span class="ai-intro-how-num">1</span>
                <div>
                  <strong>Which EBA covers the employee</strong>
                  <span>Use the EBA dropdown, or name it in your question. The AI retrieves context from that specific agreement — a vague question without an EBA often returns a generic answer.</span>
                </div>
              </div>
              <div class="ai-intro-how-item">
                <span class="ai-intro-how-num">2</span>
                <div>
                  <strong>The employee's type</strong>
                  <span>Full-time, part-time, casual, or fixed-term. Entitlements vary significantly by employment type; specifying it removes ambiguity.</span>
                </div>
              </div>
              <div class="ai-intro-how-item">
                <span class="ai-intro-how-num">3</span>
                <div>
                  <strong>Be specific, not general</strong>
                  <span>Ask about the precise entitlement or circumstance, not a broad topic. <em>"Am I entitled to a recall allowance if called back after leaving the premises?"</em> retrieves far better results than <em>"What are my allowances?"</em></span>
                </div>
              </div>
            </div>
          </div>

          <!-- Good / poor example -->
          <div class="ai-intro-example-row">
            <div class="ai-intro-example ai-intro-example--good">
              <span class="ai-intro-example-label">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                More effective
              </span>
              <p>"Under the Nurses &amp; Midwives EBA, is a <strong>part-time</strong> employee entitled to overtime if they work more than their agreed hours on a Saturday?"</p>
            </div>
            <div class="ai-intro-example ai-intro-example--poor">
              <span class="ai-intro-example-label">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                Less effective
              </span>
              <p>"What are the overtime rules?"</p>
            </div>
          </div>

          <!-- Three modes -->
          <div class="ai-intro-section">
            <p class="ai-intro-section-title">Three ways to ask</p>
            <div class="ai-intro-modes">
              <div class="ai-intro-mode">
                <span class="ai-intro-mode-icon">❓</span>
                <div>
                  <strong>Ask a question</strong>
                  <span>Direct clause or entitlement query. Best when you know what you are looking for.</span>
                </div>
              </div>
              <div class="ai-intro-mode">
                <span class="ai-intro-mode-icon">📋</span>
                <div>
                  <strong>Describe a situation</strong>
                  <span>Paste the scenario as it happened. The AI identifies the applicable clause — useful when you are unsure of the clause name.</span>
                </div>
              </div>
              <div class="ai-intro-mode">
                <span class="ai-intro-mode-icon">✉️</span>
                <div>
                  <strong>Draft a response</strong>
                  <span>Provide the employee's question and EBA. The AI writes an HR reply citing the correct clause — always review before sending.</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Works well / not suitable footer -->
          <div class="ai-intro-footer">
            <div class="ai-intro-footer-col ai-intro-footer-col--good">
              <span class="ai-intro-footer-head">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                Works well for
              </span>
              <ul>
                <li>Clause meaning &amp; entitlements</li>
                <li>Comparing employment types</li>
                <li>Drafting HR responses</li>
              </ul>
            </div>
            <div class="ai-intro-footer-col ai-intro-footer-col--bad">
              <span class="ai-intro-footer-head">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                Not suitable for
              </span>
              <ul>
                <li>Legal advice or dispute outcomes</li>
                <li>Questions outside these 9 EBAs</li>
                <li>Real-time award rates (verify separately)</li>
              </ul>
            </div>
          </div>

          </div><!-- end ai-intro-body-scroll -->
          <button class="ai-intro-got-it" @click="dismissAskIntro">Got it — start asking</button>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { topicList } from '../../generated/topic-list.mjs'

// ─── AI Worker URL ────────────────────────────────────────────────────────────
const AI_WORKER_URL = 'https://eba-ask-worker.irresistibl.workers.dev'
const ANALYTICS_WORKER_URL = 'https://eba-analytics-worker.irresistibl.workers.dev'
const aiConfigured  = AI_WORKER_URL.length > 0

// ─── Storage keys ─────────────────────────────────────────────────────────────
const SESSION_QUERY_KEY       = 'eba-search-last-query'
const SESSION_EBA_KEY         = 'eba-search-last-eba'
const SESSION_TOPIC_KEY       = 'eba-search-last-topic'
const SESSION_SCROLL_KEY      = 'eba-search-last-scroll'
const SESSION_RECENT_KEY      = 'eba-search-recent'
const LOCAL_SAVED_KEY         = 'eba-search-saved'
const LOCAL_BOOKMARKS_KEY     = 'eba-bookmarks'
const SESSION_EBA_CONTEXT_KEY = 'eba-search-eba-context'   // TTL-gated EBA pre-population
const EBA_CONTEXT_TTL_MS      = 30_000                     // 30 seconds
const LOCAL_ASK_INTRO_KEY     = 'eba-ask-ai-intro-seen'    // Ask AI onboarding card dismissal

// ─── Core state ───────────────────────────────────────────────────────────────
const open                = ref(false)
const activeTab           = ref('search')
const query               = ref('')
const selectedEba         = ref('')
const selectedTopic       = ref('')
const ebaFilterFlash      = ref(false)   // true for 400 ms when Alt+digit fires — drives CSS flash animation
const results             = ref([])
const loading             = ref(false)
const inputRef            = ref(null)
const modalRef            = ref(null)
const resultsContainerRef = ref(null)

// ─── Ask AI intro card ────────────────────────────────────────────────────────
// Shown the first time the user opens the Ask AI tab.
// Dismissed permanently via localStorage. Default true (hidden) until confirmed
// not seen; actual check happens in onMounted so localStorage is available.
const askAiIntroSeen = ref(true)

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

// ─── Smart suggestions ("Did you search for…?") ───────────────────────────────
const suggestions = ref([])

// ─── Recent searches (sessionStorage — session-scoped) ────────────────────────
const recentSearches = ref([])

// ─── Saved searches (localStorage — persists across sessions) ─────────────────
// Each entry: { id: string, label: string, query: string, eba: string, topic: string }
const savedSearches = ref([])

// ─── Bookmarks (localStorage — persists across sessions) ──────────────────────
// Each entry: { id: string, url: string, title: string, eba: string, note: string, savedAt: string }
// Loaded once on mount and kept in sync via the 'eba-bookmarks-updated' CustomEvent
// dispatched by BookmarkButton.vue whenever a bookmark is added, edited, or removed.
const bookmarks = ref([])

// ─── Most Viewed Clauses (analytics worker — site-wide, cached 5 min) ─────────
// Fetched from GET /top-pages on first openModal() each session.
// Shape: Array<{ path: string, title: string, eba: string, count: number }>
// Degrades silently — section simply doesn't render if worker is unreachable.
const mostViewedClauses     = ref([])
const mostViewedLoading     = ref(false)
const mostViewedError       = ref(false)
const MOST_VIEWED_CACHE_KEY = 'eba-most-viewed-cache'
const MOST_VIEWED_TTL_MS    = 5 * 60 * 1000  // 5 minutes — matches worker Cache-Control

function loadBookmarks() {
  try {
    const raw = localStorage.getItem(LOCAL_BOOKMARKS_KEY)
    if (raw) bookmarks.value = JSON.parse(raw)
  } catch { /* corrupt storage — degrade silently */ }
}

// ─── Ask AI intro card dismissal ─────────────────────────────────────────────
function dismissAskIntro() {
  askAiIntroSeen.value = true
  try { localStorage.setItem(LOCAL_ASK_INTRO_KEY, '1') } catch { /* ignore */ }
}

// ─── Most Viewed Clauses fetch ────────────────────────────────────────────────
// Called on every openModal(). Returns immediately from sessionStorage cache
// if data was fetched within the last 5 minutes.
// The worker already has Cache-Control: public, max-age=300 so Cloudflare edge
// handles deduplication across simultaneous users; sessionStorage handles it
// for repeated opens within the same browser tab.
async function fetchMostViewed() {
  // Check sessionStorage cache first — avoid re-fetching within the TTL window
  try {
    const cached = sessionStorage.getItem(MOST_VIEWED_CACHE_KEY)
    if (cached) {
      const { data, ts } = JSON.parse(cached)
      if (Date.now() - ts < MOST_VIEWED_TTL_MS && Array.isArray(data)) {
        mostViewedClauses.value = data   // may be empty array — that's fine, section won't render
        return
      }
    }
  } catch { /* corrupt cache entry — fall through to fresh fetch */ }

  mostViewedLoading.value = true
  mostViewedError.value   = false
  try {
    const res = await fetch(ANALYTICS_WORKER_URL + '/top-pages')
    if (!res.ok) throw new Error(`Worker ${res.status}`)
    const data = await res.json()
    if (Array.isArray(data)) {
      mostViewedClauses.value = data
      // Cache in sessionStorage with timestamp so repeated opens skip the fetch
      try {
        sessionStorage.setItem(MOST_VIEWED_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }))
      } catch { /* storage quota exceeded — skip cache, not critical */ }
    }
  } catch {
    // Worker unreachable or returned an error — degrade silently, section hidden
    mostViewedError.value = true
  } finally {
    mostViewedLoading.value = false
  }
}

// ─── AI state ─────────────────────────────────────────────────────────────────
const aiLoading    = ref(false)
const aiAnswer     = ref('')
const aiSources    = ref([])
const aiError      = ref('')
const followUpText = ref('')   // bound to the persistent follow-up input row
const followUpRef  = ref(null) // template ref for the follow-up textarea

// ─── Conversation history (multi-turn Ask AI) ─────────────────────────────────
const MAX_HISTORY_TURNS    = 3
const conversationHistory  = ref([])
const conversationBodyRef  = ref(null)

// ─── Ask mode state ───────────────────────────────────────────────────────────
const askMode = ref('question')
// Values: 'question' | 'situation' | 'draft'

// Ask a Question mode fields
const questionText    = ref('')
const questionEba     = ref('')
const questionEmpType = ref('')

// Describe a Situation mode fields
const situationText    = ref('')
const situationEba     = ref('')
const situationEmpType = ref('')

// Draft a Response mode fields
const draftEba      = ref('')
const draftEmpType  = ref('')
const draftQuestion = ref('')
const draftContext  = ref('')

// Carries a pre-built question from AskThisPage — bypasses the question-mode builder
const externalQuery = ref('')

// Display label shown in the user turn bubble (shorter than full constructed prompt)
const lastUserDisplay = ref('')

// Tracks whether the last assistant answer was produced in draft mode
const lastAnswerWasDraft = ref(false)

// ─── Computed: always hide shared search-header input on the Ask AI tab ───────
// All three modes now use their own form inputs instead of the navbar text box.
const hideSharedInput = computed(() =>
  activeTab.value === 'ask'
)

let searchTimer           = null
let pagefind              = null
let pendingContentHash    = null
let _externalAskQuery     = ''      // carries AskThisPage pre-built query; bypasses mode form guards
let _pendingEbaFlash      = false   // set by restoreEbaContext(); consumed by watch(open)

// ─── Quick Access shortcuts ───────────────────────────────────────────────────
const quickAccessShortcuts = [
  { icon: '⏱️', label: 'Overtime & Penalty Rates', topic: 'overtime',    query: '' },
  { icon: '📅', label: 'Leave Entitlements',        topic: 'leave',       query: '' },
  { icon: '💵', label: 'Wage Rates',                topic: 'wages',       query: '' },
  { icon: '💰', label: 'Allowances',                topic: 'allowances',  query: '' },
  { icon: '📋', label: 'Termination & Redundancy',  topic: 'termination', query: '' },
]

// ─── Smart suggestions: three-dictionary scoring engine ───────────────────────
// Runs when results === 0 OR (results <= 2 AND query >= 4 chars).
// Returns up to 2 scored suggestion objects, highest score first.
// Each suggestion has: { type: 'eba'|'topic'|'rewrite', label, action }
// ─── EBA keyword dictionary ───────────────────────────────────────────────────
const SUGGESTION_EBA_MAP = [
  // Nurses & Midwives
  { keywords: ['nurse','nurses','nursing','midwife','midwives','midwifery','nm','enrolled','en ','rn ','registered nurse','ward','icu','nicu','theatre','maternity','obstetric','neonatal','pediatric','paediatric'], eba: 'Nurses and Midwives 2024-2028' },
  // Allied Health
  { keywords: ['allied','physio','physiotherapist','physiotherapy','ot ','occupational therapist','occupational therapy','speech','dietitian','dietician','podiatrist','podiatry','social worker','radiographer','radiography','sonographer','sonography','pharmacist','pharmacy','psychology','psychologist','counsellor','counselor','orthoptist','prosthetist','orthotist','music therapy','art therapy'], eba: 'Allied Health Professionals 2021-2026' },
  // Doctors in Training
  { keywords: ['doctor','doctors','intern','interns','rmo','resident','registrar','dit','pgy','prevocational','junior doctor','trainee doctor'], eba: 'Doctors in Training 2022-2026' },
  // Medical Specialists
  { keywords: ['specialist','specialists','consultant','vmo','visiting medical','senior registrar','staff specialist'], eba: 'Medical Specialists 2022-2026' },
  // Medical Scientists, Pharm & Psych
  { keywords: ['scientist','scientists','medical scientist','pathology','laboratory','lab tech','pharmacist','pharmacy','mspp','pharmacology'], eba: 'Medical Scientists, Pharm & Psych 2021-2025' },
  // Mental Health
  { keywords: ['mental health','mental','psychiatric','psychiatry','psychosocial','mho','mental health officer','rpn','registered psychiatric','community mental','acute mental','forensic','inpatient mental'], eba: 'Mental Health Services 2024-2028' },
  // HAS Managers & Admin
  { keywords: ['manager','managers','admin','administration','administrative','clerical','has ','health admin','health manager','ward clerk','receptionist','scheduler','booking','pmo','project manager','operations manager'], eba: 'Health Allied & Managers Admin 2021-2025' },
  // Biomedical Engineers
  { keywords: ['biomedical','engineer','engineers','biomedical engineer','bme','equipment maintenance','clinical engineer','medical equipment'], eba: 'Biomedical Engineers 2025-2028' },
  // Children's Services
  { keywords: ['children','childcare','child care','early childhood','kindergarten','kinder','educator','early education','family day','long day care','occasional care'], eba: "Children's Services Award 2010" },
]

// ─── Topic keyword dictionary ─────────────────────────────────────────────────
const SUGGESTION_TOPIC_MAP = [
  { keywords: ['overtime','ot pay','ot rate','time and half','double time','time-and-a-half','double-time','extra hours','worked extra','worked over'], topic: 'overtime', label: 'Overtime' },
  { keywords: ['penalty','penalty rate','weekend rate','saturday','sunday','public holiday rate','public holidays','holiday pay','shift penalty'], topic: 'penalty-rates', label: 'Penalty Rates' },
  { keywords: ['leave','annual leave','sick leave','personal leave','carer','carers leave','compassionate','long service','lsl','parental','maternity leave','paternity','family leave','bereavement','lwop','leave without pay'], topic: 'leave', label: 'Leave' },
  { keywords: ['wage','wages','salary','salaries','pay rate','pay rates','remuneration','increment','increment level','pay increase','pay rise','band','grade','classification pay'], topic: 'wages', label: 'Wages' },
  { keywords: ['allowance','allowances','meal allowance','uniform','laundry','tool','travel allowance','on-call allowance','recall allowance','first aid','higher duties','hda','in charge','telephone','car allowance'], topic: 'allowances', label: 'Allowances' },
  { keywords: ['termination','redundancy','notice period','notice of termination','separation','severance','retrenchment','dismissed','dismissal','end of employment','resignation','resigned'], topic: 'termination', label: 'Termination & Redundancy' },
  { keywords: ['classification','grade','band','level','pay grade','classification level','job classification','reclassification','classify'], topic: 'classification', label: 'Classification' },
  { keywords: ['hours','hours of work','ordinary hours','span of hours','shift length','roster','rostered','work schedule','scheduled hours','shift pattern','shift arrangement'], topic: 'hours-of-work', label: 'Hours of Work' },
  { keywords: ['dispute','grievance','grievances','complaint','complaints','dispute resolution','iru','industrial relations','unfair','fair work','commission','arbitration','mediation'], topic: 'dispute-resolution', label: 'Dispute Resolution' },
  { keywords: ['full time','part time','casual','fixed term','part-time','full-time','fixed-term','employment type','employment status','casual conversion','regular casual'], topic: 'employment-types', label: 'Employment Types' },
  { keywords: ['professional development','pd ','cpd','continuing education','training','study leave','conference','in-service','education leave','development'], topic: 'professional-development', label: 'Professional Development' },
  { keywords: ['workload','work load','staffing','ratios','nurse ratio','patient ratio','understaffed','unsafe staffing','skill mix'], topic: 'workload', label: 'Workload' },
  { keywords: ['consultation','consult','change management','major change','restructure','restructuring','workplace change'], topic: 'consultation', label: 'Consultation' },
]

// ─── Follow-up question chips ─────────────────────────────────────────────────
// Keyed on section slugs that appear in aiSources URLs
// (e.g. /ebas/nurses-midwives/overtime/57-overtime → slug 'overtime').
// Each topic carries 3 chips. followUpChips (computed below) picks up to 3,
// filtering out any whose text fuzzy-matches a question already asked this session.
const FOLLOWUP_MAP = {
  'overtime': [
    'What about overtime on a public holiday?',
    'Does this overtime rate differ for casual employees?',
    'Is there a meal allowance when working overtime?',
  ],
  'penalty-rates': [
    'What penalty rates apply on a public holiday?',
    'Are casual employees entitled to the same penalty rates?',
    'How do penalty rates interact with overtime?',
  ],
  'allowances': [
    'Does this allowance apply to part-time employees?',
    'Is this allowance included in annual leave loading calculations?',
    'What other allowances might apply to my role?',
  ],
  'leave': [
    'Can unused leave be cashed out?',
    'What happens to leave entitlements on termination?',
    'Does this leave entitlement apply to casual employees?',
  ],
  'wages': [
    'When does the next pay increase take effect?',
    'How are wages calculated for part-time employees?',
    'Is there a higher duties allowance if I act in a higher grade?',
  ],
  'classification': [
    'What is the pay rate for this classification?',
    'How do I apply for reclassification to a higher grade?',
    'Does my classification change if I act in a higher role?',
  ],
  'hours-of-work': [
    'What notice is required to change a roster?',
    'Are there limits on consecutive shifts?',
    'How are ordinary hours calculated for part-time employees?',
  ],
  'termination': [
    'What notice period is required for redundancy?',
    'Is there a severance payment on redundancy?',
    'What happens to unused leave on termination?',
  ],
  'dispute-resolution': [
    'What is the first step in the dispute resolution process?',
    'Can the Fair Work Commission be involved at any stage?',
    'Is there a time limit for raising a grievance?',
  ],
  'employment-types': [
    'Can a casual employee convert to permanent employment?',
    'What entitlements differ between full-time and part-time employees?',
    'How is notice of termination calculated for fixed-term employees?',
  ],
  'professional-development': [
    'Is professional development leave paid?',
    'Who approves professional development applications?',
    'Is there a maximum number of professional development days per year?',
  ],
  'workload': [
    'What can I do if I believe staffing levels are unsafe?',
    'Does the EBA set minimum staffing ratios?',
    'Who do I notify if my workload exceeds safe limits?',
  ],
  'consultation': [
    'What information must the employer provide during consultation?',
    'Can employees respond formally during a consultation process?',
    'What happens if the consultation period ends without agreement?',
  ],
}

// Section-slug aliases — some URL path segments don't match topic keys exactly.
// Maps the raw path segment to the FOLLOWUP_MAP key to look up.
const FOLLOWUP_SLUG_ALIAS = {
  'on-call':              'allowances',
  'recall':               'allowances',
  'meal-allowance':       'allowances',
  'uniform':              'allowances',
  'higher-duties':        'allowances',
  'annual-leave':         'leave',
  'sick-leave':           'leave',
  'personal-leave':       'leave',
  'parental-leave':       'leave',
  'long-service-leave':   'leave',
  'public-holidays':      'penalty-rates',
  'weekend-penalties':    'penalty-rates',
  'shift-penalties':      'penalty-rates',
  'rostering':            'hours-of-work',
  'ordinary-hours':       'hours-of-work',
  'span-of-hours':        'hours-of-work',
  'redundancy':           'termination',
  'notice-of-termination':'termination',
  'salary':               'wages',
  'remuneration':         'wages',
  'pay-rates':            'wages',
}

// followUpChips — computed from all aiSources entries.
// Returns 0–3 chip strings. Suppresses any chip whose lowercased text
// contains 2+ meaningful words that already appeared in a prior user turn.
//
// Topic detection: score FOLLOWUP_MAP keys by word overlap with words extracted
// from every source clause slug. This avoids relying on URL path depth, which
// varies between standard EBAs (3 levels) and nested EBAs like has-managers-admin
// and mental-health (4 levels). The clause slug is always the last path segment.
// e.g. /ebas/has-managers-admin/common-terms/69-public-holidays
//   clause slug words → ["public", "holidays"]
//   → scores "penalty-rates" key (contains "holiday" alias) highest
const followUpChips = computed(() => {
  if (aiLoading.value) return []
  if (conversationHistory.value.length === 0) return []
  if (!aiSources.value.length) return []

  // ── Step 1: collect words from every source URL (all path segments + clause slug) ──
  const sourceWords = new Set()
  for (const src of aiSources.value) {
    // Normalise: strip origin if present so both absolute and root-relative URLs
    // produce the same path segments (e.g. https://example.com/ebas/... → /ebas/...)
    let pathname = src.url
    try { pathname = new URL(src.url, window.location.origin).pathname } catch { /* use as-is */ }
    const cleanUrl = pathname.replace(/\.html$/, '').replace(/\/$/, '')
    const segs     = cleanUrl.split('/').filter(Boolean)
    for (const seg of segs) {
      // Strip leading clause number prefix (e.g. "69-", "25a-") then split on hyphens
      const words = seg.replace(/^\d+[a-z]?-/, '').split('-')
      for (const w of words) {
        if (w.length >= 3) sourceWords.add(w.toLowerCase())
      }
    }
  }

  // ── Step 2: score topic keys by word overlap ───────────────────────────────
  // Pass A: FOLLOWUP_SLUG_ALIAS whole-slug matches (e.g. "annual-leave" → "leave")
  let bestKey   = null
  let bestScore = 0

  for (const [aliasSlug, topicKey] of Object.entries(FOLLOWUP_SLUG_ALIAS)) {
    const aliasWords = aliasSlug.split('-').filter(w => w.length >= 3)
    const matches    = aliasWords.filter(w => sourceWords.has(w)).length
    // Require all alias words to match (whole-slug match), score by specificity
    if (matches === aliasWords.length && matches > bestScore) {
      bestScore = matches
      bestKey   = topicKey
    }
  }

  // Pass B: score every FOLLOWUP_MAP key directly by word overlap
  for (const key of Object.keys(FOLLOWUP_MAP)) {
    const keyWords = key.split('-').filter(w => w.length >= 3)
    const score    = keyWords.filter(w => sourceWords.has(w)).length
    if (score > 0 && score > bestScore) { bestScore = score; bestKey = key }
  }

  if (!bestKey) return []
  const chips = FOLLOWUP_MAP[bestKey]

  // ── Step 3: Option C dedup filter ─────────────────────────────────────────
  const askedWords = new Set()
  for (const turn of conversationHistory.value) {
    if (turn.role !== 'user') continue
    const words = turn.content.toLowerCase().match(/[a-z]{4,}/g) ?? []
    for (const w of words) askedWords.add(w)
  }

  const filtered = chips.filter(chip => {
    const chipWords = chip.toLowerCase().match(/[a-z]{4,}/g) ?? []
    const overlap   = chipWords.filter(w => askedWords.has(w)).length
    return overlap < 2
  })

  return filtered.slice(0, 3)
})

// ─── Query rewrite dictionary (misspellings, abbreviations, synonyms) ─────────
const SUGGESTION_REWRITES = [
  // Common misspellings
  { pattern: /\bnurse?ing\b/i,        rewrite: 'nursing' },
  { pattern: /\bphysio(?:therapist)?\b/i, rewrite: 'physiotherapy' },
  { pattern: /\bOT\b/,                rewrite: 'occupational therapy' },
  { pattern: /\bRMO\b/i,              rewrite: 'resident medical officer' },
  { pattern: /\bDIT\b/i,              rewrite: 'doctors in training' },
  { pattern: /\bHAS\b/i,              rewrite: 'health allied services' },
  { pattern: /\bMSPP\b/i,             rewrite: 'medical scientists pharmacists psychologists' },
  { pattern: /\bMHO\b/i,              rewrite: 'mental health officer' },
  { pattern: /\bRPN\b/i,              rewrite: 'registered psychiatric nurse' },
  { pattern: /\bVMO\b/i,              rewrite: 'visiting medical officer' },
  { pattern: /\bBME\b/i,              rewrite: 'biomedical engineer' },
  { pattern: /\bLSL\b/i,              rewrite: 'long service leave' },
  { pattern: /\bLWOP\b/i,             rewrite: 'leave without pay' },
  { pattern: /\bHDA\b/i,              rewrite: 'higher duties allowance' },
  { pattern: /\bCPD\b/i,              rewrite: 'continuing professional development' },
  { pattern: /\bon[ -]?call\b/i,      rewrite: 'on call allowance' },
  { pattern: /\brecal+\b/i,           rewrite: 'recall allowance' },
  { pattern: /\bovertime pay\b/i,     rewrite: 'overtime' },
  { pattern: /\bpay rise\b/i,         rewrite: 'wages increment' },
  { pattern: /\bsick day\b/i,         rewrite: 'personal leave' },
  { pattern: /\bholiday pay\b/i,      rewrite: 'public holiday penalty rates' },
  { pattern: /\breadditment\b/i,      rewrite: 'redundancy' },
  { pattern: /\bseparation pay\b/i,   rewrite: 'termination redundancy' },
]

// ─── Scoring engine ───────────────────────────────────────────────────────────
// Scores a candidate against a list of keyword strings. Returns 0–100.
// Multi-word keywords score higher (more specific match).
// Substring matches score lower than whole-word matches.
function _scoreKeywords(lowerQuery, keywords) {
  let best = 0
  for (const kw of keywords) {
    if (!lowerQuery.includes(kw)) continue
    // Whole-word bonus: keyword is surrounded by word boundaries
    const re = new RegExp(`(?:^|\\s)${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:\\s|$)`, 'i')
    const wholeWord = re.test(lowerQuery)
    // Score: base 40 for substring + length bonus (longer = more specific) + whole-word bonus
    const score = 40 + Math.min(kw.length * 2, 30) + (wholeWord ? 20 : 0)
    if (score > best) best = score
  }
  return Math.min(best, 100)
}

function buildSuggestions(rawQuery, resultCount) {
  if (!rawQuery || rawQuery.trim().length < 4) return []
  const lq = rawQuery.toLowerCase()
  const candidates = []

  // ── Pass 1: EBA suggestions ───────────────────────────────────────────────
  // Suppressed when that EBA filter is already active — no point suggesting it
  for (const entry of SUGGESTION_EBA_MAP) {
    if (selectedEba.value === entry.eba) continue
    const score = _scoreKeywords(lq, entry.keywords)
    if (score > 0) {
      candidates.push({ type: 'eba', label: `Filter to ${entry.eba.replace(/ \d{4}.*$/, '')}`, sublabel: entry.eba, action: { eba: entry.eba }, score })
    }
  }

  // ── Pass 2: Topic suggestions ─────────────────────────────────────────────
  // Suppressed when that topic filter is already active
  for (const entry of SUGGESTION_TOPIC_MAP) {
    if (selectedTopic.value === entry.topic) continue
    const score = _scoreKeywords(lq, entry.keywords)
    if (score > 0) {
      candidates.push({ type: 'topic', label: `Filter by topic: ${entry.label}`, sublabel: entry.topic, action: { topic: entry.topic }, score })
    }
  }

  // ── Pass 3: Query rewrite suggestions ────────────────────────────────────
  // Rewrites only surface on zero results — they replace the query entirely,
  // which is disruptive on a search that already found something useful.
  if (resultCount === 0) {
    for (const entry of SUGGESTION_REWRITES) {
      if (entry.pattern.test(rawQuery)) {
        if (!lq.includes(entry.rewrite.toLowerCase())) {
          candidates.push({ type: 'rewrite', label: `Search for: ${entry.rewrite}`, sublabel: `instead of "${rawQuery.trim()}"`, action: { rewrite: entry.rewrite }, score: 65 })
        }
      }
    }
  }

  // ── Deduplicate by EBA (keep highest score per EBA) ──────────────────────
  const seen = new Set()
  const deduped = []
  for (const c of candidates.sort((a, b) => b.score - a.score)) {
    const key = c.type === 'eba' ? `eba:${c.action.eba}` : c.type === 'topic' ? `topic:${c.action.topic}` : `rw:${c.action.rewrite}`
    if (!seen.has(key)) { seen.add(key); deduped.push(c) }
  }

  // Return top 2, ensuring we don't return two suggestions of the same type
  // unless there's genuinely nothing else (favours diversity: one EBA + one topic)
  const final = []
  const usedTypes = new Set()
  for (const c of deduped) {
    if (final.length >= 2) break
    if (!usedTypes.has(c.type)) { final.push(c); usedTypes.add(c.type) }
  }
  // If we have room and only one type was present, fill with next best regardless
  for (const c of deduped) {
    if (final.length >= 2) break
    if (!final.includes(c)) final.push(c)
  }
  return final
}

function applySuggestion(s) {
  if (s.type === 'eba') {
    selectedEba.value = s.action.eba
    doSearch()
  } else if (s.type === 'topic') {
    selectedTopic.value = s.action.topic
    doSearch()
  } else if (s.type === 'rewrite') {
    query.value = s.action.rewrite
    selectedEba.value   = ''
    selectedTopic.value = ''
    doSearch()
  }
  nextTick(() => inputRef.value?.focus())
}

// ─── Analytics logging ────────────────────────────────────────────────────────
function logSearch(tab, query, eba, topic, resultCount) {
  if (!ANALYTICS_WORKER_URL || !query?.trim()) return
  try {
    fetch(ANALYTICS_WORKER_URL + '/log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
      tab,
      query,
      eba,
      topic,
      resultCount,
      browser: (() => {
        const ua = navigator.userAgent
        if (/edg\//i.test(ua))             return 'Edge'
        if (/opr\//i.test(ua))             return 'Opera'
        if (/firefox\//i.test(ua))         return 'Firefox'
        if (/chrome\//i.test(ua))          return 'Chrome'
        if (/safari\//i.test(ua))          return 'Safari'
        if (/msie|trident/i.test(ua))      return 'IE'
        return 'Other'
      })(),
      device: (() => {
        const ua = navigator.userAgent
        if (/tablet|ipad|playbook|silk/i.test(ua))                          return 'tablet'
        if (/mobile|iphone|ipod|android.*mobile|blackberry|iemobile/i.test(ua)) return 'mobile'
        return 'desktop'
      })(),
    }),
    }).catch(() => { /* fire-and-forget; never block the UI */ })
  } catch { /* silently ignore */ }
}

function fireShortcut(shortcut) {
  selectedTopic.value = shortcut.topic
  query.value         = shortcut.query
  doSearch()
}

// ─── EBA colour map ───────────────────────────────────────────────────────────
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

// ─── EBA folder slug → short display label ────────────────────────────────────
// Maps the eba field from EBA_PAGEVIEWS entries (folder slug) to a readable name
// shown in the Most Viewed Clauses cards. mspp is the on-disk folder for medical scientists.
const ebaSlugLabels = {
  'allied-health':        'Allied Health',
  'biomedical-engineers': 'Biomedical Engineers',
  'childrens-services':   "Children's Services",
  'doctors-in-training':  'Doctors in Training',
  'has-managers-admin':   'HAS Managers & Admin',
  'medical-specialists':  'Medical Specialists',
  'mental-health':        'Mental Health',
  'mspp':                 'Medical Scientists',
  'nurses-midwives':      'Nurses & Midwives',
}

// ─── Employment types ─────────────────────────────────────────────────────────
const employmentTypes = [
  'Full-time',
  'Part-time',
  'Casual',
  'Fixed-term',
]

// ─── Saved searches logic ─────────────────────────────────────────────────────

const isCurrentQuerySaved = computed(() => {
  const q = query.value.trim()
  const e = selectedEba.value
  const t = selectedTopic.value
  return savedSearches.value.some(s => s.query === q && s.eba === e && s.topic === t)
})

// ─── Ask AI character counters ────────────────────────────────────────────────
// One computed per targeted field. Each returns the trimmed character count so
// whitespace-only entries don't game the threshold. The template uses these to
// drive both the counter display and the submit button appearance class.
//
// Thresholds (shared across all three modes):
//   0–19  → 'too-short'  (grey)
//   20–49 → 'good-start' (amber)
//   50+   → 'good'       (green)
const CHAR_THRESHOLD_MIN  = 20   // below this: too short
const CHAR_THRESHOLD_GOOD = 50   // at or above this: good length

function charCountState(len) {
  if (len < CHAR_THRESHOLD_MIN)  return 'too-short'
  if (len < CHAR_THRESHOLD_GOOD) return 'good-start'
  return 'good'
}

// Linear opacity ramp: 0.45 at 0 chars → 1.0 at CHAR_THRESHOLD_GOOD (50).
// Clamped so it never goes below 0.45 or above 1.0.
// Applied as an inline :style on each submit button so the brand colour is
// preserved at all lengths — only presence/confidence is communicated, not colour.
function askBtnOpacity(len) {
  const MIN_OPACITY = 0.2
  const t = Math.min(len / CHAR_THRESHOLD_GOOD, 1)
  return (MIN_OPACITY + t * (1 - MIN_OPACITY)).toFixed(2)
}

const questionCharCount  = computed(() => questionText.value.trim().length)
const situationCharCount = computed(() => situationText.value.trim().length)
const draftCharCount     = computed(() => draftQuestion.value.trim().length)

function buildSavedLabel() {
  const parts = []
  if (query.value.trim()) parts.push(`"${query.value.trim()}"`)
  if (selectedEba.value)  parts.push(selectedEba.value.split(' ')[0])
  if (selectedTopic.value) parts.push(selectedTopic.value)
  return parts.join(' · ') || 'Search'
}

function toggleSaveSearch() {
  const q = query.value.trim()
  const e = selectedEba.value
  const t = selectedTopic.value
  const existing = savedSearches.value.find(s => s.query === q && s.eba === e && s.topic === t)
  if (existing) {
    savedSearches.value = savedSearches.value.filter(s => s.id !== existing.id)
  } else {
    const entry = { id: Date.now().toString(), label: buildSavedLabel(), query: q, eba: e, topic: t }
    savedSearches.value = [entry, ...savedSearches.value].slice(0, 10)
  }
  persistSavedSearches()
}

function removeSavedSearch(id) {
  savedSearches.value = savedSearches.value.filter(s => s.id !== id)
  persistSavedSearches()
}

function clearAllSavedSearches() {
  savedSearches.value = []
  try { localStorage.removeItem(LOCAL_SAVED_KEY) } catch { /* ignore */ }
}

function useSavedSearch(saved) {
  query.value         = saved.query
  selectedEba.value   = saved.eba
  selectedTopic.value = saved.topic
  doSearch()
  nextTick(() => inputRef.value?.focus())
}

function persistSavedSearches() {
  try { localStorage.setItem(LOCAL_SAVED_KEY, JSON.stringify(savedSearches.value)) } catch { /* ignore */ }
}

function loadSavedSearches() {
  try {
    const raw = localStorage.getItem(LOCAL_SAVED_KEY)
    if (raw) savedSearches.value = JSON.parse(raw)
  } catch { /* ignore */ }
}

// ─── Per-turn AI answer copy ──────────────────────────────────────────────────
// Copies the plain text of a single assistant turn to the clipboard.
// Strips markdown syntax so the pasted result is clean prose.
// Uses the same idle/success/error state pattern as CopyButton.vue.
// State is stored directly on the turn object (turn.copied / turn.copyError)
// so each button is independent — copying turn 1 does not affect turn 3.
async function copyTurnText(turn, idx) {
  // Strip common markdown syntax to produce clean plain text
  let plain = turn.content || ''
  plain = plain
    .replace(/\*\*([^*]+)\*\*/g, '$1')   // bold
    .replace(/\*([^*]+)\*/g, '$1')        // italic
    .replace(/`([^`]+)`/g, '$1')          // inline code
    .replace(/^#{1,6}\s+/gm, '')          // headings
    .replace(/^[-*+]\s+/gm, '• ')         // unordered lists → bullet char
    .replace(/^\d+\.\s+/gm, (m) => m)    // ordered lists — keep number
    .replace(/^>\s?/gm, '')               // blockquotes
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // links → label only
    .replace(/\n{3,}/g, '\n\n')           // collapse excess blank lines
    .trim()

  try {
    await navigator.clipboard.writeText(plain)
    // Mark this specific turn as copied — Vue reactivity requires index assignment
    conversationHistory.value[idx] = { ...conversationHistory.value[idx], copied: true, copyError: false }
    setTimeout(() => {
      conversationHistory.value[idx] = { ...conversationHistory.value[idx], copied: false }
    }, 2500)
  } catch (err) {
    console.error('[SearchModal] copy turn failed:', err)
    conversationHistory.value[idx] = { ...conversationHistory.value[idx], copyError: true, copied: false }
    setTimeout(() => {
      conversationHistory.value[idx] = { ...conversationHistory.value[idx], copyError: false }
    }, 3000)
  }
}

// ─── Markdown → HTML renderer ────────────────────────────────────────────────
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

// ─── AI confidence heuristic ──────────────────────────────────────────────────
// Runs against the raw markdown string (before HTML rendering) and returns true
// when the model's answer contains language that signals genuine uncertainty
// about clause applicability — not just careful professional phrasing.
//
// Design intent: conservative. Phrases that also appear in EBA source text
// (e.g. "generally", "typically", "may be entitled") are deliberately excluded
// to avoid over-firing. Only phrases that a model uses when hedging its OWN
// answer are included.
//
// Called once per assistant turn in submitAsk() — result stored as turn.hedging
// so the template can key off it without re-running on every render.
function detectHedging(md) {
  if (!md) return false
  const lower = md.toLowerCase()
  // Each entry is tested as a simple substring — short phrases are deliberately
  // chosen to be unambiguous in context. No word-boundary regex needed because
  // these phrases cannot plausibly appear as part of an EBA clause citation.
  const HEDGING_PHRASES = [
    'may vary depending on',
    'may vary based on',
    'depends on your',
    'depend on your',
    'depending on your',
    'recommend seeking',
    'recommend consulting',
    'seek advice',
    'seek independent',
    'seek legal',
    'consult a lawyer',
    'consult an employment',
    'consult your',
    'cannot confirm',
    'not certain',
    'it is unclear',
    'may not apply',
    'may differ',
    'cannot determine',
    'professional advice',
    'employment relations advice',
    'i am not able to',
    'i cannot',
    'unable to confirm',
    'i would recommend verifying',
    'recommend verifying',
    'you should verify',
    'you should check with',
    'this is not legal advice',
    // ── Worker retrieval failure templates ────────────────────────────────────
    // These match the worker's own fixed error strings when it cannot route
    // a question to a specific EBA or clause. These responses are never
    // actionable and should always trigger the indicator.
    'i could not identify',
    'could not identify which',
    'could not retrieve',
    'i was unable to find',
    'unable to find',
    'unable to locate',
    'i couldn\'t find',
    'no information found',
    'i don\'t have information',
    'i do not have information',
    'not enough information',
    'please specify',
    'please include the eba',
    'try including the eba',
    'i need more information',
    'more information is needed',
    'clarify which eba',
    'specify which eba',
    'subject to agreement between',
    'would need to be agreed',
    'by mutual agreement'
  ]
  return HEDGING_PHRASES.some(phrase => lower.includes(phrase))
}

// ─── Excerpt cleaner ─────────────────────────────────────────────────────────
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

// ─── Preview pane ────────────────────────────────────────────────────────────
function setPreview(result, event) {
  clearTimeout(previewHideTimer)
  previewKeep = false
  if (window.innerWidth < 900) return
  const modal = modalRef.value?.getBoundingClientRect()
  if (!modal) return
  const left  = modal.right + 12
  const right = window.innerWidth - left
  if (right < 240) return
  const card  = event?.currentTarget?.getBoundingClientRect?.() ?? null
  const top   = card ? Math.min(card.top, window.innerHeight - 360) : modal.top
  const width = Math.min(280, right - 16)
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

// ─── Session persistence ──────────────────────────────────────────────────────
function loadPersistedState() {
  try {
    const savedQuery  = sessionStorage.getItem(SESSION_QUERY_KEY)  || ''
    const savedEba    = sessionStorage.getItem(SESSION_EBA_KEY)    || ''
    const savedTopic  = sessionStorage.getItem(SESSION_TOPIC_KEY)  || ''
    const savedRecent = sessionStorage.getItem(SESSION_RECENT_KEY)
    if (savedQuery)  query.value         = savedQuery
    if (savedEba)    selectedEba.value   = savedEba
    if (savedTopic)  selectedTopic.value = savedTopic
    if (savedRecent) recentSearches.value = JSON.parse(savedRecent)
    if (savedQuery || savedEba || savedTopic) {
      nextTick(() => doSearch().then(() => {
        const savedScroll = parseInt(sessionStorage.getItem(SESSION_SCROLL_KEY) || '0', 10)
        if (savedScroll && resultsContainerRef.value) {
          nextTick(() => { resultsContainerRef.value.scrollTop = savedScroll })
        }
      }))
    }
  } catch { /* degrade silently */ }
}

function persistState() {
  try {
    sessionStorage.setItem(SESSION_QUERY_KEY,  query.value)
    sessionStorage.setItem(SESSION_EBA_KEY,    selectedEba.value)
    sessionStorage.setItem(SESSION_TOPIC_KEY,  selectedTopic.value)
    if (resultsContainerRef.value) {
      sessionStorage.setItem(SESSION_SCROLL_KEY, String(resultsContainerRef.value.scrollTop))
    }
    // TTL-gated EBA context — only written when an EBA filter is actually active.
    // Cleared explicitly when no EBA is set so a previous value never lingers.
    if (selectedEba.value) {
      sessionStorage.setItem(SESSION_EBA_CONTEXT_KEY, JSON.stringify({
        eba: selectedEba.value,
        ts:  Date.now(),
      }))
    } else {
      sessionStorage.removeItem(SESSION_EBA_CONTEXT_KEY)
    }
  } catch { /* silently ignore */ }
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

// ─── Keyboard navigation ──────────────────────────────────────────────────────
function focusResult(index) {
  nextTick(() => {
    const cards = resultsContainerRef.value?.querySelectorAll('.result-card')
    if (!cards) return
    const target = cards[Math.max(0, Math.min(index, cards.length - 1))]
    target?.focus()
  })
}

// ─── Load Pagefind ────────────────────────────────────────────────────────────
onMounted(async () => {
  loadSavedSearches()
  loadBookmarks()
  // Check whether the user has already dismissed the Ask AI intro card
  try {
    if (!localStorage.getItem(LOCAL_ASK_INTRO_KEY)) {
      askAiIntroSeen.value = false
    }
  } catch { /* storage unavailable — treat as already seen */ }
  try {
    const savedRecent = sessionStorage.getItem(SESSION_RECENT_KEY)
    if (savedRecent) recentSearches.value = JSON.parse(savedRecent)
  } catch { /* silently ignore */ }
  try {
    const importPath = '/pagefind/pagefind.js'
    pagefind = await new Function('path', 'return import(path)')(importPath)
    await pagefind.init()
    await pagefind.options({
      ranking: { pageLength: 0.4, termFrequency: 0.8, termSimilarity: 1.2, termSaturation: 1.6 }
    })
  } catch {
    console.warn('Pagefind not available — run npm run docs:index first.')
  }
})

// Called by RelatedClauses.vue "See all related pages" button via custom DOM event.
function openFromExternal(e) {
  const detail = e?.detail ?? {}

  if (detail.tab === 'ask') {
    activeTab.value = 'ask'
    open.value      = true
    if (detail.query) {
      pendingContentHash = detail.contentHash ?? null
      _externalAskQuery  = detail.query
      nextTick(() => submitAsk())
    } else {
      nextTick(() => inputRef.value?.focus())
    }
    return
  }

  const { eba = '', topic = '' } = detail
  selectedEba.value   = eba
  selectedTopic.value = topic
  open.value = true
  if (eba || topic) {
    nextTick(() => doSearch())
  } else {
    nextTick(() => inputRef.value?.focus())
  }
}

// ─── Open / close ─────────────────────────────────────────────────────────────
function openModal() {
  restoreEbaContext()   // must run before open.value = true so _pendingEbaFlash is set
                        // before watch(open) fires and checks it
  open.value = true
  fetchMostViewed()     // non-blocking — populates mostViewedClauses async; degrades silently
  nextTick(() => {
    loadPersistedState()
    inputRef.value?.focus()
  })
}

// ─── TTL-gated EBA context restore ───────────────────────────────────────────
// Silently pre-populates the EBA filter if the advisor closed the modal within
// the last 30 seconds. Does NOT trigger a search — the user types their own
// next query with the filter already set. Fires only when no EBA filter is
// already active (loadPersistedState may have set one via the query-restore path).
// NOTE: does not attempt to flash the select here — the entire modal DOM is
// destroyed/recreated via v-if="open", so #eba-filter does not exist yet when
// this function runs inside nextTick(). Instead, _pendingEbaFlash signals
// watch(open) to fire the flash after the element is guaranteed to exist.
function restoreEbaContext() {
  try {
    const raw = sessionStorage.getItem(SESSION_EBA_CONTEXT_KEY)
    if (!raw) return
    const { eba, ts } = JSON.parse(raw)
    if (!eba || (Date.now() - ts) > EBA_CONTEXT_TTL_MS) return
    // Guard: if a *different* EBA is already set (e.g. openFromExternal set one),
    // do not overwrite it. But if selectedEba already matches (because close() does
    // not clear it), still fire the flash — that is the normal return path.
    if (selectedEba.value && selectedEba.value !== eba) return
    selectedEba.value = eba
    _pendingEbaFlash  = true   // consumed by watch(open) once the DOM exists
  } catch { /* corrupt entry — degrade silently */ }
}

watch(open, async (val) => {
  if (val) {
    await nextTick()
    inputRef.value?.focus()
    document.body.style.overflow = 'hidden'
    // Fire the EBA filter flash if restoreEbaContext() requested it.
    // By the time watch(open) runs after await nextTick(), the v-if="open"
    // DOM subtree is fully inserted and #eba-filter is guaranteed to exist.
    if (_pendingEbaFlash) {
      _pendingEbaFlash = false
      ebaFilterFlash.value = true
      setTimeout(() => { ebaFilterFlash.value = false }, 1200)
    }
  } else {
    document.body.style.overflow = ''
    previewVisible.value = false
    previewResult.value  = null
  }
})

// ─── EBA shortcut index (Alt+1 through Alt+9) ────────────────────────────────
// Order matches ebaList exactly — index 0 = Alt+1, index 8 = Alt+9.
// Kept here so it is co-located with the keyboard handler that uses it.
const EBA_SHORTCUT_LIST = [
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

function applyEbaShortcut(ebaName) {
  // Toggle: if the shortcut EBA is already active everywhere, clear it; otherwise set it.
  const alreadyActive =
    selectedEba.value    === ebaName &&
    questionEba.value    === ebaName &&
    situationEba.value   === ebaName &&
    draftEba.value       === ebaName

  const newValue = alreadyActive ? '' : ebaName

  // Search tab filter
  selectedEba.value    = newValue

  // Ask AI tab — all three mode dropdowns set simultaneously (Option B)
  questionEba.value    = newValue
  situationEba.value   = newValue
  draftEba.value       = newValue

  // If on the search tab and there is already a query, re-run search with the new filter
  if (activeTab.value === 'search' && query.value.trim().length > 0) {
    doSearch()
  }

  // Brief flash on the EBA filter element so the user gets visual confirmation
  ebaFilterFlash.value = true
  setTimeout(() => { ebaFilterFlash.value = false }, 400)
}

function onKeydown(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()
    if (!open.value) openModal()
    else close()
  }
  if (e.key === '/' && !open.value && document.activeElement.tagName !== 'INPUT') {
    e.preventDefault()
    openModal()
  }
  if (e.key === 'Escape') close()

  // ── Shift+F1–F9: EBA filter shortcuts — only fire when modal is open ──────
  // Alt+digit is consumed by Firefox at the OS level. Ctrl+digit switches browser
  // tabs. Shift+digit interferes with typing in the search input.
  // Shift+F1–F9 reaches the window keydown listener cleanly in all browsers and
  // does not conflict with any browser UI. The only known conflict is DevTools
  // internal shortcuts, but DevTools is never open during normal wiki use.
  // No isTyping() guard needed — Shift+F-key never inserts characters anywhere.
  if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && open.value) {
    const codeMatch = e.code.match(/^F([1-9])$/)
    if (codeMatch) {
      e.preventDefault()
      applyEbaShortcut(EBA_SHORTCUT_LIST[parseInt(codeMatch[1], 10) - 1])
    }
  }
}
onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('open-search', openFromExternal)
  // close-search: dispatched by GuidedTour.vue to close the modal without
  // simulating Escape (which would trigger the tour's own Escape handler).
  window.addEventListener('close-search', close)
  // Keep bookmark list fresh when BookmarkButton.vue saves/removes a bookmark
  // while the modal is open (e.g. user bookmarks a page, then opens the modal).
  window.addEventListener('eba-bookmarks-updated', loadBookmarks)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('open-search', openFromExternal)
  window.removeEventListener('close-search', close)
  window.removeEventListener('eba-bookmarks-updated', loadBookmarks)
})

function close() {
  persistState()
  open.value                = false
  previewVisible.value      = false
  previewResult.value       = null
  aiAnswer.value            = ''
  aiSources.value           = []
  aiError.value             = ''
  conversationHistory.value = []
  pendingContentHash        = null
  askMode.value             = 'question'
  externalQuery.value       = ''
  questionText.value        = ''
  questionEba.value         = ''
  questionEmpType.value     = ''
  situationText.value       = ''
  situationEba.value        = ''
  situationEmpType.value    = ''
  draftEba.value            = ''
  draftEmpType.value        = ''
  draftQuestion.value       = ''
  draftContext.value        = ''
  lastAnswerWasDraft.value  = false
  followUpText.value        = ''
}

function switchTab(tab) {
  activeTab.value           = tab
  query.value               = ''
  results.value             = []
  fuzzyResults.value        = []
  aiAnswer.value            = ''
  aiSources.value           = []
  aiError.value             = ''
  conversationHistory.value = []
  pendingContentHash        = null
  askMode.value             = 'question'
  externalQuery.value       = ''
  questionText.value        = ''
  questionEba.value         = ''
  questionEmpType.value     = ''
  situationText.value       = ''
  situationEba.value        = ''
  situationEmpType.value    = ''
  draftEba.value            = ''
  draftEmpType.value        = ''
  draftQuestion.value       = ''
  draftContext.value        = ''
  lastAnswerWasDraft.value  = false
  followUpText.value        = ''
  nextTick(() => inputRef.value?.focus())
}

// ─── Ask mode switcher ────────────────────────────────────────────────────────
function setAskMode(mode) {
  askMode.value          = mode
  questionText.value     = ''
  questionEba.value      = ''
  questionEmpType.value  = ''
  situationText.value    = ''
  situationEba.value     = ''
  situationEmpType.value = ''
  draftEba.value         = ''
  draftEmpType.value     = ''
  draftQuestion.value    = ''
  draftContext.value     = ''
}

// ─── Example prompt helpers ───────────────────────────────────────────────────
// question mode — fills the questionText textarea and focuses it
function useQuestionExample(text) {
  if (!aiConfigured) return
  questionText.value = text
  nextTick(() => document.getElementById('question-text')?.focus())
}

// situation mode — fills situationText textarea and focuses it
function useSituationExample(text) {
  if (!aiConfigured) return
  situationText.value = text
  nextTick(() => document.getElementById('situation-text')?.focus())
}

// draft mode — fills draftQuestion input and focuses it
function useDraftExample(text) {
  if (!aiConfigured) return
  draftQuestion.value = text
  nextTick(() => document.getElementById('draft-question')?.focus())
}

// ─── Advanced search: EBA slug → full filter value map ───────────────────────
const EBA_SLUG_MAP = {
  'nurses-midwives':      'Nurses and Midwives 2024-2028',
  'nurses':               'Nurses and Midwives 2024-2028',
  'nm':                   'Nurses and Midwives 2024-2028',
  'allied-health':        'Allied Health Professionals 2021-2026',
  'allied':               'Allied Health Professionals 2021-2026',
  'mental-health':        'Mental Health Services 2024-2028',
  'mental':               'Mental Health Services 2024-2028',
  'has':                  'Health Allied & Managers Admin 2021-2025',
  'has-managers-admin':   'Health Allied & Managers Admin 2021-2025',
  'managers-admin':       'Health Allied & Managers Admin 2021-2025',
  'medical-scientists':   'Medical Scientists, Pharm & Psych 2021-2025',
  'mspp':                 'Medical Scientists, Pharm & Psych 2021-2025',
  'medical-specialists':  'Medical Specialists 2022-2026',
  'specialists':          'Medical Specialists 2022-2026',
  'doctors-in-training':  'Doctors in Training 2022-2026',
  'dit':                  'Doctors in Training 2022-2026',
  'doctors':              'Doctors in Training 2022-2026',
  'biomedical-engineers': 'Biomedical Engineers 2025-2028',
  'biomedical':           'Biomedical Engineers 2025-2028',
  'childrens-services':   "Children's Services Award 2010",
  'childrens':            "Children's Services Award 2010",
  'children':             "Children's Services Award 2010",
}

// ─── Advanced search: query parser ───────────────────────────────────────────
// Accepts the raw value from the search input and returns:
//   cleanQuery  — the string to pass to pagefind.search() (operators stripped)
//   operators   — structured object with resolved filter values, exclude list, etc.
//   hasPills    — true when any operator was found (drives pill row visibility)
function parseQuery(raw) {
  let working   = raw
  const ops = {
    eba:     null,   // resolved full EBA name string, or null
    ebaSlug: null,   // the raw slug the user typed (shown in pill label)
    topic:   null,   // topic string or null
    clause:  null,   // clause number string or null
    exclude: [],     // array of words to post-filter out
    phrases: [],     // quoted phrase strings (without surrounding quotes)
    hasPills: false,
  }

  // 1. Extract quoted phrases — keep them in cleanQuery verbatim (Pagefind handles them natively)
  //    but also record them so we can show phrase pills.
  working = working.replace(/"([^"]+)"/g, (match, phrase) => {
    if (phrase.trim().length > 0) ops.phrases.push(phrase.trim())
    return match // keep in working string — Pagefind understands "..."
  })

  // 2. eba: operator
  working = working.replace(/\beba:(\S+)/gi, (_, slug) => {
    const resolved = EBA_SLUG_MAP[slug.toLowerCase()]
    if (resolved) {
      ops.eba     = resolved
      ops.ebaSlug = slug.toLowerCase()
    }
    return '' // strip token from query
  })

  // 3. topic: operator — validate against known topicList values
  working = working.replace(/\btopic:(\S+)/gi, (_, t) => {
    const normalised = t.toLowerCase().replace(/_/g, '-')
    // Accept any value — validation happens when Pagefind applies the filter.
    // Unknown topics just return zero results naturally.
    ops.topic = normalised
    return ''
  })

  // 4. clause: operator
  working = working.replace(/\bclause:(\w+)/gi, (_, num) => {
    ops.clause = num
    return ''
  })

  // 5. -exclude operator — words prefixed with a hyphen (not part of a quoted phrase)
  //    Only match bare -word tokens, not hyphens inside words (e.g. part-time).
  //    We look for a hyphen preceded by a word boundary or start/space.
  working = working.replace(/(?:^|\s)-([a-zA-Z]\w*)/g, (_, word) => {
    ops.exclude.push(word.toLowerCase())
    return ' '
  })

  // 6. Clean up the remaining query string
  const cleanQuery = working.replace(/\s{2,}/g, ' ').trim()

  ops.hasPills = !!(ops.eba || ops.topic || ops.clause || ops.exclude.length || ops.phrases.length)

  return { cleanQuery, operators: ops }
}

// ─── Computed: reactively parse operators as user types ───────────────────────
// Used by the pills row in the template. Does NOT re-run search — doSearch()
// reads the same parser output when it fires.
const parsedOperators = computed(() => {
  if (activeTab.value !== 'search') return { hasPills: false }
  return parseQuery(query.value).operators
})

// ─── Pill: EBA brand colour style ────────────────────────────────────────────
// EBA operator pills use the EBA's own brand colour (Option A).
function opPillEbaStyle(resolvedEbaName) {
  const c = ebaColors[resolvedEbaName]
  if (!c) return {}
  return {
    color:           c.color,
    backgroundColor: c.bg,
    borderColor:     c.color + '55',
  }
}

// ─── Dismiss an operator token from the raw query string ─────────────────────
// Removes the token text from query.value, then re-runs search.
function dismissOperator(type, value) {
  let q = query.value
  if (type === 'eba') {
    // Remove eba:<anything> token
    q = q.replace(/\beba:\S+/gi, '')
  } else if (type === 'topic') {
    q = q.replace(/\btopic:\S+/gi, '')
  } else if (type === 'clause') {
    q = q.replace(/\bclause:\w+/gi, '')
  } else if (type === 'exclude') {
    // Remove -word token (preceded by space or start)
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    q = q.replace(new RegExp(`(?:^|\\s)-${escaped}(?=\\s|$)`, 'gi'), ' ')
  } else if (type === 'phrase') {
    // Remove "phrase" token
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    q = q.replace(new RegExp(`"${escaped}"`, 'g'), '')
  }
  query.value = q.replace(/\s{2,}/g, ' ').trim()
  doSearch()
  nextTick(() => inputRef.value?.focus())
}

// ─── Clear all operator tokens from the query string ─────────────────────────
function clearAllOperators() {
  let q = query.value
  q = q.replace(/\beba:\S+/gi, '')
  q = q.replace(/\btopic:\S+/gi, '')
  q = q.replace(/\bclause:\w+/gi, '')
  q = q.replace(/(?:^|\s)-[a-zA-Z]\w*/g, ' ')
  q = q.replace(/"[^"]*"/g, '')
  query.value = q.replace(/\s{2,}/g, ' ').trim()
  doSearch()
  nextTick(() => inputRef.value?.focus())
}

// ─── Search ───────────────────────────────────────────────────────────────────
function debouncedSearch() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(doSearch, 200)
}

async function doSearch() {
  fuzzyResults.value = []
  fuzzyQuery.value   = ''
  suggestions.value  = []

  // ── Parse advanced operators out of the raw query ──────────────────────────
  const { cleanQuery, operators } = parseQuery(query.value)

  // Guard: nothing to search
  if (!pagefind || (cleanQuery.length < 2 && !operators.clause && !selectedEba.value && !selectedTopic.value && !operators.eba && !operators.topic)) {
    results.value = []
    return
  }

  loading.value = true

  // ── Build Pagefind filter object ───────────────────────────────────────────
  // Dropdown values take precedence over operator values when both are set,
  // because the user explicitly chose from the dropdown. Operator fills the
  // gap when the dropdown is on "All EBAs" / "All Topics".
  const filters = {}
  const activeEba   = selectedEba.value   || operators.eba   || null
  const activeTopic = selectedTopic.value || operators.topic || null
  if (activeEba)   filters.eba    = activeEba
  if (activeTopic) filters.topics = activeTopic

  // ── Build the Pagefind query string ───────────────────────────────────────
  // If clause: operator present, prepend the clause number to the clean query
  // so Pagefind scores title matches (which contain the clause number) very highly.
  const pfQuery = operators.clause
    ? [operators.clause, cleanQuery].filter(Boolean).join(' ')
    : cleanQuery || null

  try {
    const search = await pagefind.search(pfQuery, { filters })

    // ── Exact phrase boost (unchanged from original) ───────────────────────
    let exactIds = new Set()
    if (cleanQuery.trim().includes(' ')) {
      try {
        const exactSearch = await pagefind.search(`"${cleanQuery.trim()}"`, { filters })
        const exactData   = await Promise.all(exactSearch.results.slice(0, 5).map(r => r.data()))
        exactIds = new Set(exactData.map(r => r.url))
      } catch { /* exact search optional */ }
    }

    const allResults = await Promise.all(search.results.slice(0, 25).map(r => r.data()))

    // ── Filter-only sort (unchanged from original) ─────────────────────────
    const isFilterOnly = !cleanQuery.trim() && !operators.clause && (activeTopic || activeEba)
    if (isFilterOnly && activeTopic) {
      const topic = activeTopic.toLowerCase().replace(/-/g, ' ')
      const score = r => {
        let s = 0
        if ((r.meta?.title   || '').toLowerCase().includes(topic)) s += 3
        if ((r.meta?.clause  || '').toLowerCase().includes(topic)) s += 2
        if ((r.meta?.section || '').toLowerCase().includes(topic)) s += 1
        return s
      }
      allResults.sort((a, b) => score(b) - score(a))
    }

    // ── Post-filter: apply -exclude words ─────────────────────────────────
    // Pagefind has no native NOT. We remove any result whose title or excerpt
    // contains an excluded word. This operates on the returned excerpt only,
    // not the full page text, but is accurate enough to be useful.
    let filtered = allResults
    if (operators.exclude.length > 0) {
      filtered = allResults.filter(r => {
        const haystack = [
          (r.meta?.title   || ''),
          (r.excerpt       || ''),
        ].join(' ').toLowerCase()
        return !operators.exclude.some(word => haystack.includes(word))
      })
    }

    results.value = [
      ...filtered.filter(r => exactIds.has(r.url)),
      ...filtered.filter(r => !exactIds.has(r.url)),
    ]

    // ── Smart suggestions ─────────────────────────────────────────────────
    // Always build when query is long enough — panel is a persistent refinement
    // tool. buildSuggestions() suppresses already-active filters internally,
    // and restricts rewrites to zero-result searches.
    suggestions.value = cleanQuery.trim().length >= 4
      ? buildSuggestions(query.value, results.value.length)
      : []

    if (results.value.length === 0 && cleanQuery.trim().length > 3) {
      await runFuzzyFallback(cleanQuery.trim(), filters)
    }

    // Log the clean query (without operators) for analytics — operators are
    // implicit in the eba/topic values we already log.
    logSearch('search', cleanQuery || query.value, activeEba || '', activeTopic || '', results.value.length)
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

// ─── Highlight URL builder ────────────────────────────────────────────────────
function buildHighlightUrl(result) {
  const baseUrl = result.url
  const excerpt = result.excerpt
  if (!excerpt) return baseUrl
  const plain = excerpt.replace(/<[^>]+>/g, '').trim()
  if (!plain) return baseUrl
  const words = plain
    .split(/\s+/)
    .filter(w => w.replace(/[^a-zA-Z0-9]/g, '').length >= 3)
    .slice(0, 8)
  if (words.length === 0) return baseUrl
  const phrase = words.join(' ')
  try {
    const url = new URL(baseUrl, window.location.origin)
    url.searchParams.set('highlight', phrase)
    return url.pathname + '?' + url.searchParams.toString()
  } catch {
    return baseUrl
  }
}

// ─── Result click handler ─────────────────────────────────────────────────────
function handleResultClick(result) {
  addToRecentSearches(query.value)
  persistState()
  close()
}

function clearFilters() {
  selectedEba.value   = ''
  selectedTopic.value = ''
  doSearch()
}

async function submitAsk() {
  // ── Mode-aware guard ──────────────────────────────────────────────────────
  if (!aiConfigured || aiLoading.value) return

  // ── Short-circuit: AskThisPage pre-built query bypasses all mode logic ────
  if (_externalAskQuery) {
    const eq = _externalAskQuery
    _externalAskQuery = ''
    lastUserDisplay.value = eq
    lastAnswerWasDraft.value = false
    const isFirstTurn   = conversationHistory.value.length === 0
    const hashToSend    = isFirstTurn ? (pendingContentHash ?? undefined) : undefined
    const historyToSend = conversationHistory.value.slice(-(MAX_HISTORY_TURNS * 2))
    aiLoading.value = true
    aiError.value   = ''
    try {
      const res = await fetch(AI_WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question:    eq,
          contentHash: hashToSend,
          history:     historyToSend.length > 0 ? historyToSend : undefined,
        }),
      })
      if (!res.ok) throw new Error(`Worker returned ${res.status}`)
      const data = await res.json()
      const rawAnswer = data.answer ?? 'No answer returned.'
      conversationHistory.value = [
        ...conversationHistory.value,
        { role: 'user',      content: eq },
        { role: 'assistant', content: rawAnswer, hedging: detectHedging(rawAnswer) },
      ].slice(-(MAX_HISTORY_TURNS * 2))
      aiSources.value = (data.sources ?? []).map(url => {
        const segment = url.split('/').pop().replace('.html', '')
        const match   = segment.match(/^(\d+[a-z]?)-(.+)$/)
        const title   = match
          ? `Clause ${match[1]}: ${match[2].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`
          : segment.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
        return { url, title }
      })
      logSearch('ask', eq, '', '', null)
      await nextTick()
      if (conversationBodyRef.value)
        conversationBodyRef.value.scrollTop = conversationBodyRef.value.scrollHeight
    } catch (err) {
      aiError.value = err.message ?? 'Unknown error. Please try again.'
    }
    aiLoading.value    = false
    pendingContentHash = null
    return
  }

  if (askMode.value === 'question'  && questionText.value.trim().length < 5) return
  if (askMode.value === 'situation' && situationText.value.trim().length < 10) return
  if (askMode.value === 'draft'     && (draftEba.value === '' || draftEmpType.value === '' || draftQuestion.value.trim().length < 5)) return

  // ── Build the question sent to the Worker ─────────────────────────────────
  let question
  if (askMode.value === 'situation') {
    let q = `I am an HR Advisor. I need to understand what EBA clause applies to the following situation:\n\n${situationText.value.trim()}`
    if (situationEba.value)
      q += `\n\nThe employee is covered by the ${situationEba.value}.`
    if (situationEmpType.value)
      q += ` They are a ${situationEmpType.value.toLowerCase()} employee.`
    q += `\n\nPlease identify the most relevant clause, explain what it means, and summarise what the employee may be entitled to.`
    question = q
  } else if (askMode.value === 'draft') {
    let q = `I am an HR Advisor. Please draft a plain-language response I can send directly to the following employee.`
    q += `\n\nEmployee details:\n- EBA: ${draftEba.value}\n- Employment type: ${draftEmpType.value}`
    if (draftContext.value.trim())
      q += `\n- Additional context: ${draftContext.value.trim()}`
    q += `\n\nThe employee has asked:\n"${draftQuestion.value.trim()}"`
    q += `\n\nWrite the response addressed directly to the employee using "you" and "your". Cite the relevant clause number. Keep it to 3–5 sentences. Do not include legal disclaimers or caveats in the draft itself — those will be added separately.`
    question = q
  } else {
    // question mode: build structured prompt including optional EBA and employment type
    let q = questionText.value.trim()
    if (questionEba.value || questionEmpType.value) {
      q += '\n\nContext:'
      if (questionEba.value)     q += `\n- EBA: ${questionEba.value}`
      if (questionEmpType.value) q += `\n- Employment type: ${questionEmpType.value}`
    }
    question = q
  }

  // ── Set display label (short human-readable version for conversation bubble) ──
  if (askMode.value === 'situation') {
    lastUserDisplay.value = situationText.value.trim()
  } else if (askMode.value === 'draft') {
    lastUserDisplay.value = draftQuestion.value.trim()
  } else {
    lastUserDisplay.value = questionText.value.trim()
  }

  // ── Track draft mode for extra disclaimer ─────────────────────────────────
  lastAnswerWasDraft.value = (askMode.value === 'draft')

  const isFirstTurn   = conversationHistory.value.length === 0
  const hashToSend    = isFirstTurn ? (pendingContentHash ?? undefined) : undefined
  const historyToSend = conversationHistory.value.slice(-(MAX_HISTORY_TURNS * 2))

  aiLoading.value = true
  aiAnswer.value  = ''
  aiError.value   = ''
  query.value     = ''

  try {
    const res = await fetch(AI_WORKER_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        contentHash: hashToSend,
        history:     historyToSend.length > 0 ? historyToSend : undefined,
      }),
    })
    if (!res.ok) throw new Error(`Worker returned ${res.status}`)
    const data = await res.json()

    const rawAnswer = data.answer ?? 'No answer returned.'

    conversationHistory.value = [
      ...conversationHistory.value,
      { role: 'user',      content: lastUserDisplay.value },
      { role: 'assistant', content: rawAnswer, hedging: detectHedging(rawAnswer) },
    ].slice(-(MAX_HISTORY_TURNS * 2))

    aiSources.value = (data.sources ?? []).map(url => {
      const segment = url.split('/').pop().replace('.html', '')
      const match   = segment.match(/^(\d+[a-z]?)-(.+)$/)
      const title   = match
        ? `Clause ${match[1]}: ${match[2].replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}`
        : segment.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
      return { url, title }
    })

    logSearch('ask', question, '', '', null)

    await nextTick()
    if (conversationBodyRef.value) {
      conversationBodyRef.value.scrollTop = conversationBodyRef.value.scrollHeight
    }
  } catch (err) {
    aiError.value = err.message ?? 'Unknown error. Please try again.'
  }

  aiLoading.value    = false
  pendingContentHash = null
}

function resetConversation() {
  conversationHistory.value = []
  aiAnswer.value            = ''
  aiSources.value           = []
  aiError.value             = ''
  pendingContentHash        = null
  askMode.value             = 'question'
  externalQuery.value       = ''
  questionText.value        = ''
  questionEba.value         = ''
  questionEmpType.value     = ''
  situationText.value       = ''
  situationEba.value        = ''
  situationEmpType.value    = ''
  draftEba.value            = ''
  draftEmpType.value        = ''
  draftQuestion.value       = ''
  draftContext.value        = ''
  lastAnswerWasDraft.value  = false
  followUpText.value        = ''
  nextTick(() => inputRef.value?.focus())
}

// ─── Follow-up chip handler ───────────────────────────────────────────────────
// Populates the follow-up input with the chip text and focuses it.
// The user can edit the pre-filled text before submitting, or just press Enter.
function fireFollowUp(chipText) {
  if (aiLoading.value) return
  followUpText.value = chipText
  nextTick(() => {
    followUpRef.value?.focus()
    autoResizeFollowUp()
  })
}

// ─── Follow-up input submit ───────────────────────────────────────────────────
// Reads followUpText, clears the input, then routes through question mode
// so the existing conversation history is preserved (Option A).
function submitFollowUp() {
  const text = followUpText.value.trim()
  if (!text || text.length < 3 || aiLoading.value) return
  const activeEba = questionEba.value || situationEba.value || draftEba.value || ''
  followUpText.value    = ''
  // Reset textarea height
  if (followUpRef.value) { followUpRef.value.style.height = 'auto' }
  askMode.value         = 'question'
  questionText.value    = text
  questionEba.value     = activeEba
  questionEmpType.value = ''
  situationText.value    = ''
  situationEba.value     = ''
  situationEmpType.value = ''
  draftEba.value         = ''
  draftEmpType.value     = ''
  draftQuestion.value    = ''
  draftContext.value     = ''
  lastAnswerWasDraft.value = false
  nextTick(() => submitAsk())
}

// ─── Auto-resize the follow-up textarea as the user types ─────────────────────
function autoResizeFollowUp() {
  const el = followUpRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 120) + 'px'
}
</script>

<style scoped>
/* ── Navbar trigger ── */
.search-trigger {
  display: flex; align-items: center; gap: 0.5rem;
  padding: 0.4rem 0.75rem; border-radius: 8px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft); color: var(--vp-c-text-2);
  font-size: 0.875rem; cursor: pointer; width: 260px; margin-left: 2rem;
  transition: border-color 0.2s, color 0.2s, box-shadow 0.2s;
}
.search-trigger:hover {
  border-color: var(--vp-c-brand); color: var(--vp-c-text-1);
  box-shadow: 0 0 0 2px var(--vp-c-brand-soft);
}
.search-trigger-text { flex: 1; text-align: left; color: var(--vp-c-text-3); }
.search-trigger-kbd  { font-size: 0.7rem; opacity: 0.5; margin-left: auto; }
@media (max-width: 767px) {
  .search-trigger { width: auto; padding: 0.4rem; }
  .search-trigger-text, .search-trigger-kbd { display: none; }
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
  background: var(--vp-c-bg); border: 1px solid var(--vp-c-divider);
  border-radius: 12px; box-shadow: 0 24px 64px oklch(0 0 0 / 0.3);
  display: flex; flex-direction: column; overflow: hidden;
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
.close-btn {
  background: none; border: 1px solid var(--vp-c-divider);
  border-radius: 4px; padding: 0.125rem 0.4rem;
  font-size: 0.75rem; color: var(--vp-c-text-3); cursor: pointer;
}
.close-btn:hover { color: var(--vp-c-text-1); }

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

/* ── Ask AI tab animated sparkles icon ── */
.ask-tab-icon { flex-shrink: 0; }

/* Large sparkle: fills with colour on active tab, pulses continuously */
.ask-tab-sparkle {
  fill: none;
  transition: fill 0.2s;
}
.search-tab.active .ask-tab-sparkle {
  fill: currentColor;
  animation: sparkle-pulse 2.4s ease-in-out infinite;
}
.search-tab:not(.active):hover .ask-tab-sparkle {
  fill: currentColor;
  opacity: 0.5;
}

/* Small star lines: blink in and out on a loop */
.ask-tab-star {
  animation: star-blink 2.4s ease-in-out infinite;
}
.ask-tab-star--delayed {
  animation-delay: 1.2s;
}

@keyframes sparkle-pulse {
  0%, 100% { opacity: 1;   transform: scale(1);    }
  50%       { opacity: 0.7; transform: scale(0.92); }
}

@keyframes star-blink {
  0%, 15%, 85%, 100% { opacity: 1; }
  40%, 60%           { opacity: 0; }
}

/* ── Ask AI tab animated sparkles icon ── */
.ask-tab-icon { flex-shrink: 0; }

/* Large sparkle: fills with colour on active tab, pulses continuously */
.ask-tab-sparkle {
  fill: none;
  transition: fill 0.2s;
}
.search-tab.active .ask-tab-sparkle {
  fill: currentColor;
  animation: sparkle-pulse 2.4s ease-in-out infinite;
}
.search-tab:not(.active):hover .ask-tab-sparkle {
  fill: currentColor;
  opacity: 0.5;
}

/* Small star lines: blink in and out on a loop */
.ask-tab-star {
  animation: star-blink 2.4s ease-in-out infinite;
}
.ask-tab-star--delayed {
  animation-delay: 1.2s;
}

@keyframes sparkle-pulse {
  0%, 100% { opacity: 1;   transform: scale(1);    }
  50%       { opacity: 0.7; transform: scale(0.92); }
}

@keyframes star-blink {
  0%, 15%, 85%, 100% { opacity: 1; }
  40%, 60%           { opacity: 0; }
}

/* ── Ask AI tab animated sparkles icon ── */
.ask-tab-icon { flex-shrink: 0; }

/* Large sparkle: fills with colour on active tab, pulses continuously */
.ask-tab-sparkle {
  fill: none;
  transition: fill 0.2s;
}
.search-tab.active .ask-tab-sparkle {
  fill: currentColor;
  animation: sparkle-pulse 2.4s ease-in-out infinite;
}
.search-tab:not(.active):hover .ask-tab-sparkle {
  fill: currentColor;
  opacity: 0.5;
}

/* Small star lines: blink in and out on a loop */
.ask-tab-star {
  animation: star-blink 2.4s ease-in-out infinite;
}
.ask-tab-star--delayed {
  animation-delay: 1.2s;
}

@keyframes sparkle-pulse {
  0%, 100% { opacity: 1;   transform: scale(1);    }
  50%       { opacity: 0.7; transform: scale(0.92); }
}

@keyframes star-blink {
  0%, 15%, 85%, 100% { opacity: 1; }
  40%, 60%           { opacity: 0; }
}

/* ── Ask AI tab animated sparkles icon ── */
.ask-tab-icon { flex-shrink: 0; }

/* Large sparkle: fills with colour on active tab, pulses continuously */
.ask-tab-sparkle {
  fill: none;
  transition: fill 0.2s;
}
.search-tab.active .ask-tab-sparkle {
  fill: currentColor;
  animation: sparkle-pulse 2.4s ease-in-out infinite;
}
.search-tab:not(.active):hover .ask-tab-sparkle {
  fill: currentColor;
  opacity: 0.5;
}

/* Small star lines: blink in and out on a loop */
.ask-tab-star {
  animation: star-blink 2.4s ease-in-out infinite;
}
.ask-tab-star--delayed {
  animation-delay: 1.2s;
}

@keyframes sparkle-pulse {
  0%, 100% { opacity: 1;   transform: scale(1);    }
  50%       { opacity: 0.7; transform: scale(0.92); }
}

@keyframes star-blink {
  0%, 15%, 85%, 100% { opacity: 1; }
  40%, 60%           { opacity: 0; }
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

/* ── Recent search chips (pill style — unchanged) ── */
.qa-chip {
  padding: 0.25rem 0.65rem; border-radius: 999px;
  border: 1px solid var(--vp-c-divider); background: var(--vp-c-bg-soft);
  font-size: 0.78rem; color: var(--vp-c-text-2); cursor: pointer;
  transition: border-color 0.15s, color 0.15s;
}
.qa-chip:hover { border-color: var(--vp-c-brand); color: var(--vp-c-brand-1); }

/* ── Saved search chips (inline-code style) ── */
.qa-chip-saved {
  display: inline-flex; align-items: center;
  padding: 0; overflow: hidden;
  border-radius: 4px;
  border: 1px solid var(--vp-c-divider);
  background: var(--vp-c-bg-soft);
  font-family: var(--vp-font-family-mono, ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace);
}
.qa-chip-saved .qa-chip-label {
  display: flex; align-items: center; gap: 0.3rem;
  padding: 0.15rem 0.45rem 0.15rem 0.55rem;
  font-size: 0.78rem; color: var(--vp-c-text-2);
  background: none; border: none; cursor: pointer;
  transition: color 0.15s;
  font-family: inherit;
}
.qa-chip-saved .qa-chip-label svg { color: #F59E0B; flex-shrink: 0; }
.qa-chip-saved .qa-chip-label:hover { color: var(--vp-c-brand-1); }
.qa-chip-saved .qa-chip-remove {
  display: flex; align-items: center; justify-content: center;
  width: 20px; height: 100%; padding: 0 3px;
  font-size: 0.82rem; line-height: 1;
  background: none; border: none; border-left: 1px solid var(--vp-c-divider);
  color: var(--vp-c-text-3); cursor: pointer;
  transition: background 0.12s, color 0.12s;
  font-family: inherit;
}
.qa-chip-saved .qa-chip-remove:hover { background: var(--vp-c-danger-soft); color: var(--vp-c-danger-1); }

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

/* ── Most Viewed Clauses ── */
.qa-most-viewed-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.qa-most-viewed-card {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.7rem;
  border-radius: 7px;
  border: 1px solid var(--vp-c-divider);
  border-left: 3px solid var(--vp-c-brand);
  background: var(--vp-c-bg-soft);
  text-decoration: none;
  transition: border-color 0.15s, background 0.15s;
}

.qa-most-viewed-card:hover {
  background: var(--vp-c-bg-elv);
  border-color: var(--vp-c-brand);
  border-left-color: var(--vp-c-brand);
}

.qa-most-viewed-rank {
  flex-shrink: 0;
  width: 1.1rem;
  font-size: 0.68rem;
  font-weight: 700;
  color: var(--vp-c-brand);
  text-align: center;
  opacity: 0.65;
  font-variant-numeric: tabular-nums;
}

.qa-most-viewed-body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.qa-most-viewed-title {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.3;
  transition: color 0.15s;
}

.qa-most-viewed-card:hover .qa-most-viewed-title {
  color: var(--vp-c-brand-1);
}

.qa-most-viewed-eba {
  font-size: 0.69rem;
  color: var(--vp-c-text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.qa-most-viewed-arrow {
  flex-shrink: 0;
  color: var(--vp-c-text-3);
  transition: transform 0.15s, color 0.15s;
}

.qa-most-viewed-card:hover .qa-most-viewed-arrow {
  transform: translateX(3px);
  color: var(--vp-c-brand);
}

/* ── Most Viewed loading skeleton ── */
.qa-most-viewed-card--skeleton {
  pointer-events: none;
  border-left-color: var(--vp-c-divider);
  animation: none;
}

.qa-skeleton-rank {
  flex-shrink: 0;
  width: 1.1rem;
  height: 0.7rem;
  border-radius: 3px;
  background: var(--vp-c-divider);
  animation: qa-skeleton-pulse 1.5s ease-in-out infinite;
}

.qa-skeleton-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
}

.qa-skeleton-line {
  display: block;
  border-radius: 3px;
  background: var(--vp-c-divider);
  animation: qa-skeleton-pulse 1.5s ease-in-out infinite;
}

.qa-skeleton-title { height: 0.7rem; width: 65%; }
.qa-skeleton-eba   { height: 0.55rem; width: 38%; animation-delay: 0.25s; }

@keyframes qa-skeleton-pulse {
  0%, 100% { opacity: 1;   }
  50%       { opacity: 0.35; }
}

/* ── Bookmark count badge in section header ── */
.qa-bookmark-count {
  margin-left: 0.2rem;
  font-size: 0.65rem;
  font-weight: 700;
  color: var(--vp-c-bg);
  background: #F59E0B;
  border-radius: 999px;
  padding: 0.05rem 0.4rem;
  line-height: 1.5;
}

/* ── Bookmark card list — vertical stack, one card per bookmark ── */
.qa-bookmark-list {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.qa-bookmark-card {
  display: block;
  text-decoration: none;
  padding: 0.55rem 0.7rem;
  border-radius: 7px;
  border: 1px solid var(--vp-c-divider);
  border-left: 3px solid #F59E0B;
  background: var(--vp-c-bg-soft);
  transition: border-color 0.15s, background 0.15s;
}

.qa-bookmark-card:hover {
  background: var(--vp-c-bg-elv);
  border-color: var(--vp-c-brand);
  border-left-color: #F59E0B;
}

.qa-bookmark-card-top {
  display: flex;
  align-items: center;
  gap: 0.35rem;
}

.qa-bookmark-card-icon {
  color: #F59E0B;
  flex-shrink: 0;
}

.qa-bookmark-card-title {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--vp-c-brand);
  line-height: 1.35;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.qa-bookmark-card:hover .qa-bookmark-card-title {
  color: var(--vp-c-brand-1);
}

.qa-bookmark-card-eba {
  font-size: 0.7rem;
  color: var(--vp-c-text-3);
  margin-top: 0.15rem;
  margin-left: 1.35rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.qa-bookmark-card-note {
  display: flex;
  align-items: flex-start;
  gap: 0.3rem;
  margin-top: 0.35rem;
  margin-left: 1.35rem;
  font-size: 0.75rem;
  font-style: italic;
  color: #B45309;
  line-height: 1.45;
}

.dark .qa-bookmark-card-note {
  color: #FCD34D;
}

.qa-bookmark-card-note svg {
  flex-shrink: 0;
  margin-top: 0.15rem;
  opacity: 0.7;
}

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

/* ── Cleaned excerpt ── */
.result-excerpt {
  font-size: 0.825rem; color: var(--vp-c-text-2);
  line-height: 1.65; margin: 0;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
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

/* ── Floating preview pane ── */
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
.preview-excerpt {
  font-size: 0.8rem; color: var(--vp-c-text-2); line-height: 1.65;
}
.preview-topics { display: flex; gap: 0.3rem; flex-wrap: wrap; }
.preview-open-link {
  display: inline-flex; align-items: center; gap: 0.3rem;
  font-size: 0.78rem; font-weight: 600; color: var(--vp-c-brand-1);
  text-decoration: none; margin-top: 0.25rem; align-self: flex-start;
}
.preview-open-link:hover { text-decoration: underline; }

/* ── Preview transition ── */
.preview-enter-active, .preview-leave-active { transition: opacity 0.15s ease, transform 0.15s ease; }
.preview-enter-from, .preview-leave-to { opacity: 0; transform: translateX(8px); }

/* ── Per-turn AI answer copy button ── */
/* Sits in the bottom-right of each completed assistant turn.
   Hidden by default on desktop (hover-reveal via .conv-turn--assistant:hover).
   Always visible on touch devices (no reliable hover). */
.conv-copy-wrap {
  display: flex;
  justify-content: flex-end;
  margin-top: 0.5rem;
  /* On desktop the button is opacity-0 until the parent turn is hovered.
     The transition is on the button itself so it fades in smoothly. */
}

.conv-copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.75rem;
  height: 1.75rem;
  padding: 0;
  color: var(--vp-c-text-3);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  cursor: pointer;
  /* Fade in on hover — starts transparent on desktop */
  opacity: 0;
  transition:
    opacity      150ms ease,
    background   150ms ease,
    color        150ms ease,
    border-color 150ms ease,
    transform    150ms ease;
}

/* Reveal the button when the parent assistant turn is hovered or
   when the button itself receives keyboard focus */
.conv-turn--assistant:hover .conv-copy-btn,
.conv-copy-btn:focus-visible {
  opacity: 1;
}

.conv-copy-btn:hover {
  opacity: 1;
  background: var(--vp-c-bg-mute);
  color: var(--vp-c-text-1);
  border-color: var(--vp-c-brand);
}

.conv-copy-btn:active {
  transform: scale(0.92);
}

/* Success state — green, matches CopyButton.vue exactly */
.conv-copy-btn--success {
  opacity: 1 !important;
  color:        #22863a !important;
  border-color: #34d058 !important;
  background:   #f0fff4 !important;
}

/* Tick draws in via stroke-dashoffset animation — same as CopyButton.vue */
.conv-copy-tick {
  stroke-dasharray: 30;
  stroke-dashoffset: 30;
  animation: conv-draw-tick 250ms ease forwards;
}

@keyframes conv-draw-tick {
  to { stroke-dashoffset: 0; }
}

/* Error state — red, matches CopyButton.vue exactly */
.conv-copy-btn--error {
  opacity: 1 !important;
  color:        #cb2431 !important;
  border-color: #f97583 !important;
  background:   #fff5f5 !important;
}

/* Mobile: always show the button — touch devices have no hover state */
@media (hover: none) {
  .conv-copy-btn {
    opacity: 1;
  }
}

/* ── Conversation thread ── */
.conversation-thread {
  display:        flex;
  flex-direction: column;
  gap:            0;
  max-height:     420px;
  overflow-y:     auto;
  border:         1px solid var(--vp-c-divider);
  border-radius:  8px;
  background:     var(--vp-c-bg-soft);
  scroll-behavior: smooth;
}

/* Individual turn bubble */
.conv-turn {
  padding:       0.85rem 1rem;
  border-bottom: 1px solid var(--vp-c-divider);
}
.conv-turn:last-child { border-bottom: none; }

.conv-turn--user { background: var(--vp-c-bg); }
.conv-turn--assistant { background: var(--vp-c-bg-soft); }
.conv-turn--loading { color: var(--vp-c-text-2); font-size: 0.875rem; }

/* Small "You" / "EBA Assistant" label above each turn */
.conv-label {
  display:       block;
  font-size:     0.68rem;
  font-weight:   700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color:         var(--vp-c-text-3);
  margin-bottom: 0.35rem;
}
.conv-turn--user .conv-label { color: var(--vp-c-brand-1); }

/* ── Confidence indicator: hedging turns ── */
/* Amber left border signals the entire turn requires closer scrutiny.
   Uses a warm amber palette (F59E0B / FEF3C7) distinct from danger red
   and from the brand purple — intentional: this is a caution, not an error. */
.conv-turn--hedging {
  border-left: 3px solid #F59E0B;
  padding-left: calc(1rem - 3px); /* compensate for the added border width */
}

/* "· Verify carefully" inline suffix on the conv-label line */
.hedging-label {
  color: #D97706;
  font-weight: 700;
  letter-spacing: 0.04em;
  /* Inherits font-size / text-transform / uppercase from .conv-label */
}

/* Callout block — amber banner rendered before the answer body */
.hedging-callout {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  margin-bottom: 0.65rem;
  padding: 0.55rem 0.7rem;
  background: #FEF3C7;
  border: 1px solid #FDE68A;
  border-radius: 6px;
  font-size: 0.78rem;
  line-height: 1.55;
  color: #92400E;
}
.dark .hedging-callout {
  background: oklch(0.32 0.06 75);
  border-color: oklch(0.45 0.1 75);
  color: #FDE68A;
}
.hedging-callout-icon {
  flex-shrink: 0;
  margin-top: 1px;
  color: #D97706;
}
.dark .hedging-callout-icon {
  color: #FCD34D;
}

/* The user's question text */
.conv-user-text {
  margin: 0; font-size: 0.875rem;
  color: var(--vp-c-text-1); font-weight: 500; line-height: 1.55;
}

/* "New conversation" reset row */
.conv-reset-row { display: flex; justify-content: flex-start; }
.conv-reset-btn {
  display: inline-flex; align-items: center; gap: 0.35rem;
  padding: 0.3rem 0.7rem; font-size: 0.78rem; font-weight: 600;
  color: var(--vp-c-text-2); background: transparent;
  border: 1px solid var(--vp-c-divider); border-radius: 6px;
  cursor: pointer; transition: color 0.15s, border-color 0.15s, background 0.15s;
}
.conv-reset-btn:hover {
  color: var(--vp-c-brand-1); border-color: var(--vp-c-brand-1); background: var(--vp-c-bg-soft);
}

/* ── Ask AI tab ── */
.ask-body { display: flex; flex-direction: column; gap: 1rem; }
.ask-input-row { display: flex; justify-content: flex-end; padding-top: 0.25rem; }

/* Base button — brand purple (question mode default) */
.ask-btn {
  display: flex; align-items: center; gap: 0.4rem;
  padding: 0.45rem 1.1rem; background: var(--vp-c-brand-1); color: #fff;
  border: none; border-radius: 6px; font-size: 0.85rem; font-weight: 600;
  cursor: pointer; transition: background 0.2s, box-shadow 0.2s, opacity 0.2s;
}
.ask-btn:hover:not(:disabled) { background: var(--vp-c-brand-2); }
.ask-btn:disabled { opacity: 0.45; cursor: not-allowed; }

/* ────────────────────────────────────────────────────────────────────────────
   MODE COLOUR THEMING
   Driven by data-ask-mode attribute on .ask-body.
   situation → cyan  #0891B2  (calm, analytical, distinct from brand)
   draft     → rose  #D21C62  (brand gradient endpoint, action-oriented)
   question  → brand purple (default, no override needed)
──────────────────────────────────────────────────────────────────────────── */

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
.ai-answer-body h2,
.ai-answer-body h3,
.ai-answer-body h4 {
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
.ai-sources-label { font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: var(--vp-c-text-3); margin: 0; }
.ai-source-link { font-size: 0.82rem; color: var(--vp-c-brand-1); text-decoration: underline; text-underline-offset: 2px; }
.ai-source-link:hover { color: var(--vp-c-brand-2); }

/* ── Follow-up question chips ── */
.followup-chips {
  display: flex;
  flex-direction: column;
  gap: 0.45rem;
  margin-top: 0.75rem;
  padding-top: 0.65rem;
  border-top: 1px solid var(--vp-c-divider);
}
.followup-chips-label {
  font-size: 0.68rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--vp-c-text-3);
}
.followup-chips-row {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}
.followup-chip {
  display: inline-flex;
  align-items: center;
  padding: 0.3rem 0.7rem;
  font-size: 0.8rem;
  font-weight: 500;
  color: var(--vp-c-brand-1);
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 999px;
  cursor: pointer;
  line-height: 1.4;
  text-align: left;
  transition: background 0.14s, color 0.14s, border-color 0.14s, box-shadow 0.14s;
}
.followup-chip:hover {
  background: var(--vp-c-brand-soft);
  border-color: var(--vp-c-brand-2);
  color: var(--vp-c-brand-2);
  box-shadow: 0 0 0 2px var(--vp-c-brand-soft);
}
.followup-chip:active {
  transform: scale(0.97);
}
/* On touch devices, always show at full opacity — no hover state available */
@media (hover: none) {
  .followup-chip { opacity: 1; }
}

/* ── Follow-up input row ── */
.followup-input-row {
  display: flex;
  align-items: flex-end;
  gap: 0.5rem;
  margin-top: 0.75rem;
  padding: 0.6rem 0.75rem;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  transition: border-color 0.15s, box-shadow 0.15s;
}
.followup-input-row:focus-within {
  border-color: var(--vp-c-brand);
  box-shadow: 0 0 0 2px var(--vp-c-brand-soft);
}
.followup-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  font-size: 0.875rem;
  font-family: inherit;
  color: var(--vp-c-text-1);
  outline: none;
  resize: none;
  line-height: 1.5;
  min-height: 4.5rem;
  max-height: 180px;
  overflow-y: auto;
  padding-top: 0.25rem;
}
.followup-input::placeholder { color: var(--vp-c-text-3); }
.followup-send-btn {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: var(--vp-c-brand-1);
  color: #fff;
  cursor: pointer;
  transition: background 0.15s, transform 0.1s;
}
.followup-send-btn:hover:not(:disabled) { background: var(--vp-c-brand-2); }
.followup-send-btn:active:not(:disabled) { transform: scale(0.92); }
.followup-send-btn:disabled { opacity: 0.35; cursor: not-allowed; }
.ai-disclaimer { font-size: 0.75rem; color: var(--vp-c-text-3); margin: 0; line-height: 1.5; }
.ask-hint { color: var(--vp-c-text-2); font-size: 0.875rem; }
.ask-hint p { margin: 0 0 0.6rem; }
.ask-examples { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.4rem; }
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

/* ── Smart suggestions panel ── */
.suggestions-panel {
  margin: 0.75rem 0 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}
.suggestions-panel--inline {
  margin-bottom: 0.75rem;
}
.suggestions-heading {
  font-size: 0.7rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color: var(--vp-c-text-3);
  margin: 0 0 0.2rem;
}
.suggestion-card {
  display: flex;
  align-items: center;
  gap: 0.65rem;
  width: 100%;
  padding: 0.55rem 0.75rem;
  background: var(--vp-c-bg);
  border: 1px solid var(--vp-c-divider);
  border-left-width: 3px;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  transition: background 0.13s, border-color 0.13s;
}
.suggestion-card:hover {
  background: var(--vp-c-bg-soft);
}
.suggestion-card--eba  { border-left-color: var(--vp-c-brand-1); }
.suggestion-card--topic { border-left-color: #7C3AED; }
.suggestion-card--rewrite { border-left-color: #0891B2; }
.suggestion-card-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  color: var(--vp-c-text-3);
}
.suggestion-card--eba    .suggestion-card-icon { color: var(--vp-c-brand-1); }
.suggestion-card--topic  .suggestion-card-icon { color: #7C3AED; }
.suggestion-card--rewrite .suggestion-card-icon { color: #0891B2; }
.suggestion-card-text {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}
.suggestion-card-label {
  font-size: 0.82rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.suggestion-card-sublabel {
  font-size: 0.72rem;
  color: var(--vp-c-text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.suggestion-card-arrow {
  flex-shrink: 0;
  color: var(--vp-c-text-3);
  transition: transform 0.13s;
}
.suggestion-card:hover .suggestion-card-arrow {
  transform: translateX(3px);
  color: var(--vp-c-text-2);
}

/* ── EBA filter flash — triggered by Alt+digit shortcut and EBA context restore ── */
@keyframes eba-flash {
  0%   { box-shadow: 0 0 0 0px var(--vp-c-brand-soft); border-color: var(--vp-c-brand); }
  30%  { box-shadow: 0 0 0 4px var(--vp-c-brand-soft); border-color: var(--vp-c-brand); }
  70%  { box-shadow: 0 0 0 4px var(--vp-c-brand-soft); border-color: var(--vp-c-brand); }
  100% { box-shadow: 0 0 0 0px var(--vp-c-brand-soft); border-color: var(--vp-c-divider); }
}
.eba-filter-flash {
  animation: eba-flash 1.2s ease forwards;
}

/* ── Modal transition ── */
.modal-enter-active, .modal-leave-active { transition: opacity 0.18s ease; }
.modal-enter-active .search-modal, .modal-leave-active .search-modal { transition: transform 0.18s ease, opacity 0.18s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .search-modal, .modal-leave-to .search-modal { transform: translateY(-8px); opacity: 0; }

/* ── Operator pills row ── */
.operator-pills-row {
  display: flex; align-items: center; flex-wrap: wrap; gap: 0.4rem;
  padding: 0.45rem 1rem;
  background: var(--vp-c-bg-soft);
  border-bottom: 1px solid var(--vp-c-divider);
}
.op-pills-label {
  font-size: 0.68rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.07em; color: var(--vp-c-text-3); flex-shrink: 0;
}
.op-pill {
  display: inline-flex; align-items: center; gap: 0.3rem;
  padding: 0.2rem 0.35rem 0.2rem 0.5rem;
  border-radius: 999px; border: 1px solid;
  font-size: 0.72rem; font-weight: 600; font-family: var(--vp-font-family-mono, ui-monospace, monospace);
  white-space: nowrap;
}
/* EBA pill: colour comes from inline :style (opPillEbaStyle) — Option A */
.op-pill--eba { /* colour applied via inline style */ }

/* Topic pill: brand violet */
.op-pill--topic {
  color: #7C3AED; background: #7C3AED1A; border-color: #7C3AED55;
}
/* Clause pill: slate blue */
.op-pill--clause {
  color: #2563EB; background: #2563EB1A; border-color: #2563EB55;
}
/* Exclude pill: danger red */
.op-pill--exclude {
  color: #DC2626; background: #DC26261A; border-color: #DC262655;
}
/* Phrase pill: brand teal-ish (distinct from topic) */
.op-pill--phrase {
  color: #0891B2; background: #0891B21A; border-color: #0891B255;
}
.op-pill-dismiss {
  display: inline-flex; align-items: center; justify-content: center;
  width: 14px; height: 14px; padding: 0; margin-left: 0.1rem;
  background: none; border: none; cursor: pointer;
  font-size: 0.85rem; line-height: 1; color: inherit; opacity: 0.6;
  border-radius: 999px; transition: opacity 0.12s, background 0.12s;
}
.op-pill-dismiss:hover { opacity: 1; background: oklch(0 0 0 / 0.1); }
.op-pills-clear {
  margin-left: auto; background: none; border: none;
  font-size: 0.7rem; color: var(--vp-c-text-3); cursor: pointer;
  text-decoration: underline; font-weight: 400; flex-shrink: 0;
  padding: 0;
}
.op-pills-clear:hover { color: var(--vp-c-text-2); }

/* Inline operator hint chips in the Quick Access footer */
.op-hint {
  display: inline;
  font-family: var(--vp-font-family-mono, ui-monospace, monospace);
  font-size: 0.68rem; font-weight: 600;
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 4px; padding: 0.05rem 0.3rem;
  color: var(--vp-c-brand-1);
}

/* ── Save search button ── */
.save-search-btn {
  flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border: none; background: none; cursor: pointer;
  color: var(--vp-c-text-3); border-radius: 6px; transition: color 0.15s, background 0.15s;
}
.save-search-btn:hover { color: var(--vp-c-brand-1); background: var(--vp-c-bg-soft); }
.save-search-btn.saved { color: #F59E0B; }
.save-search-btn.saved:hover { color: #D97706; }

/* ── Ask mode selector ── */
.ask-mode-selector {
  display: flex; flex-wrap: wrap; gap: 0;
  background: var(--vp-c-bg-soft); border: 1px solid var(--vp-c-divider);
  border-radius: 8px; overflow: visible; margin-bottom: 1rem;
}
.ask-mode-btn {
  flex: 1; min-width: max-content; padding: 0.45rem 0.5rem; font-size: 0.78rem; font-weight: 500;
  color: var(--vp-c-text-2); background: none;
  border: none; border-right: 1px solid var(--vp-c-divider);
  cursor: pointer; transition: color 0.15s, background 0.15s; white-space: nowrap;
}
.ask-mode-btn:last-child { border-right: none; }
.ask-mode-btn:hover { color: var(--vp-c-text-1); background: var(--vp-c-bg-elv); }
/* base active — overridden per mode above */
.ask-mode-btn.active {
  color: var(--vp-c-brand-1); background: var(--vp-c-brand-soft); font-weight: 600;
}
/* on very narrow viewports, stack the buttons vertically */
@media (max-width: 420px) {
  .ask-mode-btn {
    flex-basis: 100%;
    border-right: none;
    border-bottom: 1px solid var(--vp-c-divider);
  }
  .ask-mode-btn:last-child { border-bottom: none; }
}

/* ── Ask AI structured forms ── */
.ask-form { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 0.75rem; }
.ask-form-row { display: flex; gap: 0.75rem; }
.ask-form-row .filter-group { flex: 1; min-width: 0; }
.ask-form-field { display: flex; flex-direction: column; gap: 0.2rem; }
.ask-form-field label {
  font-size: 0.7rem; font-weight: 600; text-transform: uppercase;
  letter-spacing: 0.06em; color: var(--vp-c-text-3);
}

/* Required asterisk — default red; overridden per mode above */
.required-mark {
  color: #DC2626; font-size: 0.75rem; font-weight: 700; margin-left: 0.1rem;
}

/* Optional label — consistent across all modes and contexts */
.optional-label {
  font-weight: 400; text-transform: none; letter-spacing: 0;
  color: var(--vp-c-text-3); opacity: 0.7;
  margin-left: 0.25rem; font-size: 0.68rem;
}

.ask-form-field input[type="text"],
.ask-form-field textarea {
  padding: 0.45rem 0.65rem; font-size: 0.875rem;
  border: 1px solid var(--vp-c-divider); border-radius: 6px;
  background: var(--vp-c-bg); color: var(--vp-c-text-1);
  resize: vertical; font-family: inherit;
  transition: border-color 0.15s, box-shadow 0.15s; outline: none;
}
/* default (question mode) focus */
.ask-form-field input[type="text"]:focus,
.ask-form-field textarea:focus {
  border-color: var(--vp-c-brand);
  box-shadow: 0 0 0 2px var(--vp-c-brand-soft);
}
.ask-form-field input[type="text"]::placeholder,
.ask-form-field textarea::placeholder { color: var(--vp-c-text-3); }

/* ── Ask AI character counter ── */
/* Sits between the textarea/input and the submit button row.
   Hidden until the user starts typing (v-if on length > 0).
   Colour transitions smoothly as the count crosses thresholds. */
.char-counter {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  font-size: 0.72rem;
  font-weight: 500;
  margin-top: 0.3rem;
  transition: color 0.2s;
  /* Default (zero chars — never rendered, but safe fallback) */
  color: var(--vp-c-text-3);
}
.char-counter--too-short  { color: var(--vp-c-text-3); }   /* grey  */
.char-counter--good-start { color: #D97706; }               /* amber */
.char-counter--good       { color: #16A34A; }               /* green */
.dark .char-counter--good { color: #4ADE80; }               /* green — lighter for dark mode contrast */

.char-counter-sep {
  opacity: 0.5;
  font-weight: 400;
}
.char-counter-label {
  font-weight: 400;
  font-style: italic;
}

/* ── Ask button opacity ramp ── */
/* Opacity is driven by an inline :style binding (askBtnOpacity computed) that
   interpolates linearly from 0.45 at 0 chars to 1.0 at CHAR_THRESHOLD_GOOD (50).
   No class modifiers needed — the transition: opacity rule on .ask-btn handles
   the smooth animation as the user types. */

/* ═══════════════════════════════════════════════════════════════════════════
   Ask AI onboarding — full-screen Teleport overlay
   Shown once per device on first Ask AI tab open. Dismissed via "Got it".
   localStorage key: eba-ask-ai-intro-seen
   z-index 10002: above the search modal (9999) and tour tooltip (10001).
   ═══════════════════════════════════════════════════════════════════════════ */

/* ── Full-screen backdrop ── */
.ai-intro-overlay {
  position:        fixed;
  inset:           0;
  z-index:         10002;
  background:      rgba(0, 0, 0, 0.55);
  display:         flex;
  align-items:     center;
  justify-content: center;
  padding:         1.5rem;
  overflow-y:      auto;
}

/* ── Panel — centred card, scrollable if content overflows viewport ── */
.ai-intro-panel {
  position:        relative;
  width:           100%;
  max-width:       540px;
  max-height:      calc(100vh - 3rem);
  display:         flex;
  flex-direction:  column;
  background:      var(--vp-c-bg);
  border:          1px solid var(--vp-c-divider);
  border-radius:   14px;
  box-shadow:
    0 0 0 1px rgba(74, 42, 114, 0.12),
    0 24px 64px rgba(0, 0, 0, 0.35),
    0 4px 16px rgba(0, 0, 0, 0.15);
  font-size:       0.83rem;
  overflow:        hidden;
}

/* ── Card header ── */
.ai-intro-header {
  display:         flex;
  align-items:     center;
  justify-content: space-between;
  gap:             0.5rem;
  padding:         0.9rem 1.1rem 0.75rem;
  background:      linear-gradient(135deg, rgba(74,42,114,0.07), rgba(210,28,98,0.04));
  border-bottom:   1px solid var(--vp-c-divider);
  position:        sticky;
  top:             0;
  z-index:         1;
}

.ai-intro-title {
  display:     flex;
  align-items: center;
  gap:         0.4rem;
  font-size:   0.85rem;
  font-weight: 700;
  color:       var(--vp-c-text-1);
}

.ai-intro-title svg { color: var(--vp-c-brand-1); flex-shrink: 0; }

.ai-intro-dismiss {
  display:          flex;
  align-items:      center;
  justify-content:  center;
  width:            28px;
  height:           28px;
  font-size:        0.9rem;
  color:            var(--vp-c-text-3);
  background:       var(--vp-c-bg);
  border:           1px solid var(--vp-c-divider);
  border-radius:    6px;
  cursor:           pointer;
  transition:       color 0.12s, border-color 0.12s, background-color 0.12s;
  flex-shrink:      0;
}
.ai-intro-dismiss:hover {
  color:            var(--vp-c-text-1);
  border-color:     var(--vp-c-brand);
  background-color: var(--vp-c-brand-soft);
}

/* ── Scrollable body — everything between the sticky header and sticky footer ── */
.ai-intro-body-scroll {
  overflow-y:  auto;
  flex:        1 1 auto;
  min-height:  0;
}

/* ── Warning alert banner ── */
.ai-intro-alert {
  display:     flex;
  align-items: flex-start;
  gap:         0.5rem;
  margin:      0.85rem 1.1rem 0;
  padding:     0.6rem 0.8rem;
  background:  rgba(217, 119, 6, 0.08);
  border:      1px solid rgba(217, 119, 6, 0.22);
  border-radius: 7px;
  font-size:   0.77rem;
  color:       var(--vp-c-text-2);
  line-height: 1.55;
}
.ai-intro-alert svg { color: #D97706; flex-shrink: 0; margin-top: 2px; }

/* ── Sections ── */
.ai-intro-section { padding: 0.85rem 1.1rem 0; }

.ai-intro-section-title {
  font-size:      0.7rem;
  font-weight:    700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color:          var(--vp-c-text-3);
  margin:         0 0 0.45rem;
}

.ai-intro-body {
  color:       var(--vp-c-text-2);
  line-height: 1.55;
  margin:      0 0 0.5rem;
  font-size:   0.8rem;
}

/* ── Numbered how-to list — matches 'Three ways to ask' card style ── */
.ai-intro-how-list {
  display:        flex;
  flex-direction: column;
  gap:            0.4rem;
}

.ai-intro-how-item {
  display:       flex;
  align-items:   flex-start;
  gap:           0.6rem;
  padding:       0.5rem 0.7rem;
  background:    var(--vp-c-bg-soft);
  border:        1px solid var(--vp-c-divider);
  border-radius: 7px;
}

.ai-intro-how-num {
  display:         flex;
  align-items:     center;
  justify-content: center;
  width:           20px;
  height:          20px;
  min-width:       20px;
  border-radius:   50%;
  background:      var(--vp-c-brand-soft);
  color:           var(--vp-c-brand-1);
  font-size:       0.68rem;
  font-weight:     700;
  line-height:     1;
  flex-shrink:     0;
  margin-top:      1px;
  text-align:      center;
}

.ai-intro-how-item strong {
  display:       block;
  font-size:     0.8rem;
  font-weight:   600;
  color:         var(--vp-c-text-1);
  line-height:   1.3;
  margin-bottom: 0.15rem;
}

.ai-intro-how-item span { display: block; font-size: 0.74rem; color: var(--vp-c-text-3); line-height: 1.45; }
.ai-intro-how-item em   { font-style: italic; color: var(--vp-c-brand-1); }

/* ── Good / poor example row ── */
.ai-intro-example-row {
  display:               grid;
  grid-template-columns: 1fr 1fr;
  gap:                   0.55rem;
  margin:                0.85rem 1.1rem 0;
}
@media (max-width: 480px) { .ai-intro-example-row { grid-template-columns: 1fr; } }

.ai-intro-example {
  padding:       0.6rem 0.7rem;
  border-radius: 8px;
  border:        1px solid;
}
.ai-intro-example--good { background: rgba(5,150,105,0.06);  border-color: rgba(5,150,105,0.22); }
.ai-intro-example--poor { background: rgba(203,36,49,0.05);  border-color: rgba(203,36,49,0.18); }

.ai-intro-example-label {
  display:        flex;
  align-items:    center;
  gap:            0.25rem;
  font-size:      0.68rem;
  font-weight:    700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom:  0.3rem;
}
.ai-intro-example--good .ai-intro-example-label { color: #059669; }
.ai-intro-example--poor .ai-intro-example-label { color: #CB2431; }

.ai-intro-example p        { font-size: 0.78rem; color: var(--vp-c-text-2); line-height: 1.5; margin: 0; font-style: italic; }
.ai-intro-example p strong { font-weight: 700; color: var(--vp-c-text-1); font-style: normal; }

/* ── Three mode cards ── */
.ai-intro-modes         { display: flex; flex-direction: column; gap: 0.4rem; }

.ai-intro-mode {
  display:       flex;
  align-items:   flex-start;
  gap:           0.6rem;
  padding:       0.5rem 0.7rem;
  background:    var(--vp-c-bg-soft);
  border:        1px solid var(--vp-c-divider);
  border-radius: 7px;
}

.ai-intro-mode-icon { font-size: 1rem; line-height: 1; flex-shrink: 0; margin-top: 1px; }
.ai-intro-mode strong { display: block; font-size: 0.8rem; font-weight: 600; color: var(--vp-c-text-1); line-height: 1.3; }
.ai-intro-mode span   { display: block; font-size: 0.74rem; color: var(--vp-c-text-3); line-height: 1.45; }

/* ── Footer works-well / not-suitable grid ── */
.ai-intro-footer {
  display:               grid;
  grid-template-columns: 1fr 1fr;
  gap:                   0.55rem;
  margin:                0.85rem 1.1rem 0;
  padding:               0.7rem 0.8rem;
  background:            var(--vp-c-bg-soft);
  border:                1px solid var(--vp-c-divider);
  border-radius:         8px;
}
@media (max-width: 480px) { .ai-intro-footer { grid-template-columns: 1fr; } }

.ai-intro-footer-head {
  display:        flex;
  align-items:    center;
  gap:            0.28rem;
  font-size:      0.68rem;
  font-weight:    700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom:  0.35rem;
}
.ai-intro-footer-col--good .ai-intro-footer-head { color: #059669; }
.ai-intro-footer-col--bad  .ai-intro-footer-head { color: #CB2431; }

.ai-intro-footer ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 0.22rem; }
.ai-intro-footer li { font-size: 0.74rem; color: var(--vp-c-text-2); line-height: 1.4; }

/* ── Bottom CTA button — sticky at bottom of panel, always reachable ── */
.ai-intro-got-it {
  display:          block;
  width:            calc(100% - 2.2rem);
  margin:           0.85rem 1.1rem 1rem;
  flex-shrink:      0;
  padding:          0.55rem;
  background:       var(--vp-c-brand-soft);
  color:            var(--vp-c-brand-1);
  font-size:        0.83rem;
  font-weight:      600;
  border:           1px solid var(--vp-c-brand-1);
  border-radius:    7px;
  cursor:           pointer;
  transition:       background 0.15s, color 0.15s, transform 0.1s;
  text-align:       center;
}
.ai-intro-got-it:hover  { background: var(--vp-c-brand-1); color: #fff; }
.ai-intro-got-it:active { transform: scale(0.98); }

/* ── Overlay transition ── */
.ai-intro-overlay-enter-active { transition: opacity 0.25s ease; }
.ai-intro-overlay-leave-active { transition: opacity 0.2s ease; }
.ai-intro-overlay-enter-from,
.ai-intro-overlay-leave-to     { opacity: 0; }

/* Panel scales in slightly for polish */
.ai-intro-overlay-enter-active .ai-intro-panel { transition: transform 0.25s cubic-bezier(0.34, 1.3, 0.64, 1); }
.ai-intro-overlay-enter-from .ai-intro-panel   { transform: scale(0.95) translateY(10px); }
</style>