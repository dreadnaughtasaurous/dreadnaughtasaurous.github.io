<template>
  <!-- Trigger button for navbar -->
  <!-- pointerenter: pre-warms pagefind on desktop hover before the click lands  -->
  <!-- focus: pre-warms pagefind when user Tabs to the button via keyboard        -->
  <!-- Both call initPagefind() which deduplicates via pagefindInitPromise        -->
  <button
    class="search-trigger"
    @click="openModal"
    @pointerenter="initPagefind"
    @focus="initPagefind"
    aria-label="Search"
  >
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
    <span class="search-trigger-text">Search</span>
    <span class="search-trigger-kbd"><kbd>Ctrl+K</kbd></span>
  </button>

  <!-- Modal overlay -->
  <Teleport to="body">
    <Transition :name="isMobileSheet ? 'sheet' : 'modal'">
      <div v-if="open" class="search-overlay" :class="{ 'search-overlay--sheet': isMobileSheet }"
           @click.self="close" role="dialog" aria-modal="true" aria-label="Search wiki">
        <div class="search-modal" ref="modalRef"
             :class="{ 'search-modal--sheet': isMobileSheet }"
             :style="isMobileSheet ? { maxHeight: (viewportHeight * 0.85) + 'px' } : {}">

          <!-- Drag handle — visible on mobile sheet only; purely decorative affordance -->
          <div class="sheet-handle" aria-hidden="true"></div>

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
              @input="activeTab === 'search' ? (warmupSearch(), debouncedSearch()) : null"
              @keydown.enter="activeTab === 'ask' ? submitAsk() : (operatorHint && hintIndex >= 0 ? acceptHint(operatorHint.items[hintIndex]) : null)"
              @keydown.down.prevent="operatorHint ? (hintIndex = Math.min(hintIndex + 1, operatorHint.items.length - 1)) : focusResult(0)"
              @keydown.up.prevent="operatorHint ? (hintIndex = Math.max(hintIndex - 1, -1)) : null"
              @keydown.esc="operatorHint ? dismissHint() : close()"
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

          <!-- Operator hint autocomplete dropdown — Teleported to body to escape overflow:hidden -->
          <Teleport to="body">
            <div
              v-if="operatorHint"
              class="op-hint-dropdown"
              :style="hintStyle"
              role="listbox"
              :aria-label="operatorHint.type === 'eba' ? 'EBA completions' : 'Topic completions'"
              @mousedown.prevent
            >
              <div class="op-hint-header">
                <span class="op-hint-header-label">
                  {{ operatorHint.type === 'eba' ? 'eba: completions' : 'topic: completions' }}
                </span>
                <kbd class="op-hint-header-kbd">↑↓ navigate</kbd>
                <kbd class="op-hint-header-kbd">Enter / Tab complete</kbd>
                <kbd class="op-hint-header-kbd">Esc dismiss</kbd>
              </div>

              <!-- EBA rows: colour dot + canonical slug + full name -->
              <template v-if="operatorHint.type === 'eba'">
                <button
                  v-for="(item, i) in operatorHint.items"
                  :key="item.slug"
                  class="op-hint-item"
                  :class="{ 'op-hint-item--active': hintIndex === i }"
                  role="option"
                  :aria-selected="hintIndex === i"
                  @click="acceptHint(item)"
                  @mouseenter="hintIndex = i"
                >
                  <span
                    class="op-hint-eba-dot"
                    :style="{ background: ebaColors[item.fullName]?.color ?? '#888' }"
                  ></span>
                  <span class="op-hint-item-primary">eba:{{ item.slug }}</span>
                  <span class="op-hint-item-secondary">{{ item.fullName }}</span>
                </button>
              </template>

              <!-- Topic rows: plain slug string -->
              <template v-else>
                <button
                  v-for="(item, i) in operatorHint.items"
                  :key="item"
                  class="op-hint-item"
                  :class="{ 'op-hint-item--active': hintIndex === i }"
                  role="option"
                  :aria-selected="hintIndex === i"
                  @click="acceptHint(item)"
                  @mouseenter="hintIndex = i"
                >
                  <svg class="op-hint-topic-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                  <span class="op-hint-item-primary">topic:{{ item }}</span>
                </button>
              </template>
            </div>
          </Teleport>

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
            </div>

            <!-- ─── Unified active filters bar ────────────────────────────────
                 Shown whenever any filter is active — dropdown OR typed operator.
                 Positioned here (inside the search tab template, below the filter
                 dropdowns, above the results body) so it is always visible,
                 including when no query has been typed yet.
            ─────────────────────────────────────────────────────────────────── -->
            <div
              v-if="parsedOperators.hasPills || selectedEba || selectedTopic"
              class="operator-pills-row"
              role="group"
              aria-label="Active filters"
            >
              <span class="op-pills-label">Active:</span>

              <!-- ── Dropdown EBA pill ──────────────────────────────────────
                   Only shown when the dropdown has a value AND no eba: operator
                   is also set (to avoid duplicate pills for the same EBA).
                   When both are set, we show both with distinct prefix labels
                   (filter: vs eba:) so the user knows which is which.
              ──────────────────────────────────────────────────────────────── -->
              <span
                v-if="selectedEba && !parsedOperators.eba"
                class="op-pill op-pill--eba"
                :style="opPillEbaStyle(selectedEba)"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                {{ selectedEba }}
                <button class="op-pill-dismiss" @click="dismissDropdown('eba')" :aria-label="`Remove EBA filter: ${selectedEba}`">×</button>
              </span>

              <!-- ── Dropdown Topic pill ─────────────────────────────────── -->
              <span
                v-if="selectedTopic && !parsedOperators.topic"
                class="op-pill op-pill--topic"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                {{ selectedTopic }}
                <button class="op-pill-dismiss" @click="dismissDropdown('topic')" :aria-label="`Remove topic filter: ${selectedTopic}`">×</button>
              </span>

              <!-- ── Typed operator pills (existing) ────────────────────── -->
              <span
                v-if="parsedOperators.eba"
                class="op-pill op-pill--eba"
                :style="opPillEbaStyle(parsedOperators.eba)"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                eba:{{ parsedOperators.ebaSlug }}
                <button class="op-pill-dismiss" @click="dismissOperator('eba')" :aria-label="`Remove EBA operator: ${parsedOperators.ebaSlug}`">×</button>
              </span>
              <span v-if="parsedOperators.topic" class="op-pill op-pill--topic">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                topic:{{ parsedOperators.topic }}
                <button class="op-pill-dismiss" @click="dismissOperator('topic')" :aria-label="`Remove topic operator: ${parsedOperators.topic}`">×</button>
              </span>
              <span v-if="parsedOperators.clause" class="op-pill op-pill--clause">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                clause:{{ parsedOperators.clause }}
                <button class="op-pill-dismiss" @click="dismissOperator('clause')" :aria-label="`Remove clause filter: ${parsedOperators.clause}`">×</button>
              </span>
              <span
                v-for="word in parsedOperators.exclude"
                :key="word"
                class="op-pill op-pill--exclude"
              >
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
                -{{ word }}
                <button class="op-pill-dismiss" @click="dismissOperator('exclude', word)" :aria-label="`Remove exclusion: ${word}`">×</button>
              </span>
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

            <!-- Results body -->
            <div class="search-body" ref="resultsContainerRef">

              <!-- Skeleton shimmer cards — shown while Pagefind stubs are resolving -->
              <!-- skeletonCount is set immediately after pagefind.search() returns,  -->
              <!-- before the slower .data() Promise.all completes.                    -->
              <div v-if="loading || skeletonCount > 0" class="search-results search-results--skeleton" aria-busy="true" aria-label="Loading search results">
                <div class="result-count-skeleton"></div>
                <div
                  v-for="n in (skeletonCount > 0 ? skeletonCount : 4)"
                  :key="n"
                  class="result-card result-card--skeleton"
                  aria-hidden="true"
                >
                  <!-- Row 1: title + EBA pill -->
                  <div class="result-top">
                    <span class="sk-line sk-title"></span>
                    <span class="sk-pill"></span>
                  </div>
                  <!-- Row 2: breadcrumb -->
                  <div class="result-breadcrumb">
                    <span class="sk-line sk-breadcrumb"></span>
                  </div>
                  <!-- Row 3: excerpt (two lines) -->
                  <div class="sk-excerpt">
                    <span class="sk-line sk-excerpt-line sk-excerpt-line--full"></span>
                    <span class="sk-line sk-excerpt-line sk-excerpt-line--partial"></span>
                  </div>
                </div>
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
                      <template v-if="getResultStream(result)">
                        <span>{{ getResultStream(result) }}</span>
                        <span class="breadcrumb-sep">›</span>
                      </template>
                      <span v-if="result.meta?.section">{{ result.meta.section }}</span>
                      <span v-if="result.meta?.section && result.meta?.clause" class="breadcrumb-sep">›</span>
                      <span v-if="result.meta?.clause" class="breadcrumb-clause">{{ result.meta.clause }}</span>
                    </div>
                    <p v-if="result.excerpt" class="result-excerpt" v-html="cleanExcerpt(result.excerpt)"></p>
                  </a>
                </div>
                <!-- ── Ask AI CTA: primary (total dead-end — fuzzy also zero) ── -->
                <div v-if="fuzzyResults.length === 0" class="ask-ai-cta ask-ai-cta--primary">
                  <div class="ask-ai-cta-body">
                    <svg class="ask-ai-cta-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>
                    <span class="ask-ai-cta-heading">No matches found</span>
                    <span class="ask-ai-cta-sub">Ask AI can answer questions that keyword search can't find.</span>
                  </div>
                  <button class="ask-ai-cta-btn ask-ai-cta-btn--primary" @click="redirectToAskAI">
                    Ask AI about &ldquo;{{ parseQuery(query).cleanQuery.trim() || query.trim() }}&rdquo;
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                  </button>
                </div>

                <!-- ── Ask AI CTA: secondary (fuzzy found something — shown below) ── -->
                <div v-if="fuzzyResults.length > 0" class="ask-ai-cta ask-ai-cta--secondary">
                  <button class="ask-ai-cta-btn ask-ai-cta-btn--secondary" @click="redirectToAskAI">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>
                    Not finding what you need? Ask AI about &ldquo;{{ parseQuery(query).cleanQuery.trim() || query.trim() }}&rdquo;
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
                  </button>
                </div>
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
                    Most viewed pages
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
                    Most viewed pages
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

                <!-- Trending topics — rendered only when worker returned ≥1 result -->
                <div v-if="trendingShortcuts.length > 0" class="qa-section">
                  <div class="qa-section-header">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                    Trending topics this week
                  </div>
                  <div class="qa-chips">
                    <button
                      v-for="shortcut in trendingShortcuts"
                      :key="'trending-' + shortcut.topic"
                      class="qa-chip qa-chip-trending"
                      @click="fireShortcut(shortcut)"
                    >{{ shortcut.label }}</button>
                  </div>
                </div>
                <!-- Loading skeleton — two ghost chips while fetch is in flight -->
                <div v-else-if="trendingLoading" class="qa-section">
                  <div class="qa-section-header">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>
                    Trending this week
                  </div>
                  <div class="qa-chips">
                    <div v-for="n in 2" :key="n" class="qa-chip qa-chip--skeleton"></div>
                  </div>
                </div>

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
                    <template v-if="getResultStream(result)">
                      <span>{{ getResultStream(result) }}</span>
                      <span class="breadcrumb-sep">›</span>
                    </template>
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

                <!-- ── Page context banner ────────────────────────────────────
                     Shown only on clause pages (≥5 path segments under /ebas/),
                     before any conversation has started. Offers to seed the
                     first worker request with the current page's sourcePath.
                     Dismissal is per-open (Option A): resets in close().
                ──────────────────────────────────────────────────────────── -->
                <div
                  v-if="showPageContextBanner"
                  class="page-ctx-banner"
                  :style="{ borderLeftColor: ebaColors[currentPageEba]?.color ?? 'var(--vp-c-brand)' }"
                  role="note"
                  aria-label="Page context available"
                >
                  <svg class="page-ctx-icon" width="14" height="14" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                       aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                  </svg>
                  <div class="page-ctx-banner-body">
                    <span class="page-ctx-banner-label">
                      <strong>{{ currentPageClauseLabel }}</strong>
                      <span
                        v-if="currentPageEba"
                        class="page-ctx-banner-eba"
                        :style="ebaStyle(currentPageEba)"
                      >{{ currentPageEbaShort }}</span>
                    </span>
                    <span class="page-ctx-banner-sub">Include this page as context for your question?</span>
                  </div>
                  <div class="page-ctx-banner-actions">
                    <button class="page-ctx-use-btn" @click="acceptPageContext">Use this page</button>
                    <button
                      class="page-ctx-skip-btn"
                      @click="pageContextBannerDismissed = true"
                      aria-label="Ask generally without this page's context"
                    >Not now</button>
                  </div>
                </div>

                <!-- ── Context active indicator ───────────────────────────────
                     Shown after the user accepts the banner, before the first
                     submit. Confirms context is active and allows removal.
                     Disappears once aiLoading fires (conversation starts).
                ──────────────────────────────────────────────────────────── -->
                <div
                  v-else-if="pageContextAccepted && conversationHistory.length === 0 && !aiLoading"
                  class="page-ctx-active"
                >
                  <svg class="page-ctx-active-icon" width="12" height="12" viewBox="0 0 24 24" fill="none"
                       stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"
                       aria-hidden="true">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                  </svg>
                  <span>Using context from <strong>{{ currentPageClauseLabel }}</strong></span>
                  <button
                    class="page-ctx-clear-btn"
                    @click="clearPageContext"
                    aria-label="Remove page context"
                  >×</button>
                </div>

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
          <template v-if="getResultStream(previewResult)">
            <span>{{ getResultStream(previewResult) }}</span>
            <span class="breadcrumb-sep">›</span>
          </template>
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
import { useData, useRoute } from 'vitepress'
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
const skeletonCount       = ref(0)   // set to stub count immediately after pagefind.search(); drives shimmer cards
const inputRef            = ref(null)
const modalRef            = ref(null)
const resultsContainerRef = ref(null)

// ─── Ask AI intro card ────────────────────────────────────────────────────────
// Shown the first time the user opens the Ask AI tab.
// Dismissed permanently via localStorage. Default true (hidden) until confirmed
// not seen; actual check happens in onMounted so localStorage is available.
const askAiIntroSeen = ref(true)

// ─── Mobile bottom-sheet state ────────────────────────────────────────────────
// isMobileSheet: true when viewport < 768px — drives the sheet CSS class and
// the dynamic transition name ('sheet' vs 'modal').
// viewportHeight: tracks window.visualViewport.height reactively so the sheet
// shrinks correctly when the soft keyboard opens on iOS/Android.
// NOTE: visualViewport is not available during SSR — guard with typeof window.
const isMobileSheet  = ref(false)
const viewportHeight = ref(0)

function updateMobileSheet() {
  if (typeof window === 'undefined') return
  isMobileSheet.value  = window.innerWidth < 768
  viewportHeight.value = window.visualViewport?.height ?? window.innerHeight
}

function onVisualViewportResize() {
  viewportHeight.value = window.visualViewport?.height ?? window.innerHeight
}

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

// ─── Operator hint autocomplete ───────────────────────────────────────────────
// hintIndex: which item in the hint list is keyboard-highlighted (-1 = none)
const hintIndex   = ref(-1)
// hintStyle: Teleport position; set reactively when the hint list opens
const hintStyle   = ref({})

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

// ─── Trending Topics (analytics worker — past 7 days, cached 1 hour) ──────────
// Fetched from GET /trending-topics on first openModal() each session.
// Shape: Array<{ topic: string, count: number }>
// Maps topic slug → quickAccessShortcuts entry so the chip fires fireShortcut().
// Degrades silently — section simply doesn't render if worker is unreachable
// or returns an empty array (e.g. no topic-filter searches in the past 7 days).
const trendingTopics      = ref([])
const trendingLoading     = ref(false)
const TRENDING_CACHE_KEY  = 'eba-trending-topics-cache'
const TRENDING_TTL_MS     = 60 * 60 * 1000  // 1 hour — matches worker Cache-Control

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

// ─── Trending Topics fetch ────────────────────────────────────────────────────
// Mirrors fetchMostViewed exactly. sessionStorage cache prevents re-fetching
// within the 1-hour TTL window — aligns with the worker's Cache-Control header.
async function fetchTrendingTopics() {
  try {
    const cached = sessionStorage.getItem(TRENDING_CACHE_KEY)
    if (cached) {
      const { data, ts } = JSON.parse(cached)
      if (Date.now() - ts < TRENDING_TTL_MS && Array.isArray(data)) {
        trendingTopics.value = data
        return
      }
    }
  } catch { /* corrupt cache — fall through to fresh fetch */ }

  trendingLoading.value = true
  try {
    const res = await fetch(ANALYTICS_WORKER_URL + '/trending-topics')
    if (!res.ok) throw new Error(`Worker ${res.status}`)
    const data = await res.json()
    console.log('[trending]', data)   // ← correct position
    if (Array.isArray(data)) {
      trendingTopics.value = data
      try {
        sessionStorage.setItem(TRENDING_CACHE_KEY, JSON.stringify({ data, ts: Date.now() }))
      } catch { /* quota exceeded — skip cache */ }
    }
  } catch {
    trendingTopics.value = []
  } finally {
    trendingLoading.value = false
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

// ─── Page context banner state ────────────────────────────────────────────────
// pageContextBannerDismissed: true when user clicks "Not now" or clears context.
//   Hides the banner for this modal open only. Reset to false in close().
// pageContextAccepted: true when user clicks "Use this page". Shows the
//   "context active" indicator and seeds pendingSourcePath + EBA dropdowns.
// pageContextBannerSuppressed: true when openFromExternal fires with a pre-built
//   query (AskThisPage path). Prevents a stray single-frame flash of the banner
//   before aiLoading becomes true and hides the pre-conversation forms.
const pageContextBannerDismissed  = ref(false)
const pageContextAccepted         = ref(false)
const pageContextBannerSuppressed = ref(false)

// ─── Computed: always hide shared search-header input on the Ask AI tab ───────
// All three modes now use their own form inputs instead of the navbar text box.
const hideSharedInput = computed(() =>
  activeTab.value === 'ask'
)

// ─── Current page metadata (for page context banner) ──────────────────────────
// useData() and useRoute() are VitePress composables — called at the top level
// of <script setup> so they are reactive and update correctly on SPA navigation.
const { page } = useData()
const route    = useRoute()

// A clause page has ≥5 path segments after the leading slash:
//   /ebas/<eba>/<section>/<clause>             → length 5 (standard)
//   /ebas/<eba>/<stream>/<section>/<clause>    → length 6 (nested EBAs)
// Index pages (length 3–4) and non-EBA pages do not qualify.
const currentPageIsClause = computed(() => {
  const parts = (route.path || '').replace(/\/$/, '').replace(/\.html$/, '').split('/')
  return parts.length >= 5 && parts[1] === 'ebas'
})

// "Clause 35" derived from the title frontmatter ("35. Travelling and Reimbursement")
const currentPageClauseLabel = computed(() => {
  const title = page.value?.frontmatter?.title ?? ''
  const match = title.match(/^(\d+[A-Za-z]?)[\.\s]/)
  return match ? `Clause ${match[1]}` : (title || 'this clause')
})

const currentPageEba = computed(() => page.value?.frontmatter?.eba ?? '')

// Short display label for the EBA colour pill inside the compact banner row.
// Full EBA names are too long for the one-liner; these readable abbreviations
// match the keys in ebaColors exactly so the pill gets the right colour.
const EBA_SHORT_NAMES = {
  'Allied Health Professionals 2021-2026':       'Allied Health',
  'Biomedical Engineers 2025-2028':              'Biomedical Eng.',
  "Children's Services Award 2010":              "Children's Services",
  'Doctors in Training 2022-2026':               'Doctors in Training',
  'Health Allied & Managers Admin 2021-2025':    'HAS Managers & Admin',
  'Medical Specialists 2022-2026':               'Medical Specialists',
  'Mental Health Services 2024-2028':            'Mental Health',
  'Medical Scientists, Pharm & Psych 2021-2025': 'Medical Scientists',
  'Nurses and Midwives 2024-2028':               'Nurses & Midwives',
}
const currentPageEbaShort = computed(() =>
  EBA_SHORT_NAMES[currentPageEba.value] ?? currentPageEba.value
)

// Banner shows when: Ask AI tab is active, user is on a clause page, no
// conversation has started yet, and it has not been dismissed or suppressed.
const showPageContextBanner = computed(() =>
  activeTab.value === 'ask' &&
  currentPageIsClause.value &&
  conversationHistory.value.length === 0 &&
  !aiLoading.value &&
  !pageContextBannerDismissed.value &&
  !pageContextBannerSuppressed.value
)

let searchTimer           = null
let pagefind              = null
let pagefindInitPromise   = null    // deduplicates concurrent init calls from hover + focus
let pendingContentHash    = null
let pendingSourcePath     = null
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

// ─── Trending topics display map + computed ───────────────────────────────────
// TOPIC_DISPLAY provides curated labels for the 13 core taxonomy slugs.
// The ?? fallback in trendingShortcuts auto-formats any slug outside this map
// (kebab-case → Title Case) so future topics surface without a code change.
const TOPIC_DISPLAY = {
  'allowances':               'Allowances',
  'classification':           'Classification',
  'consultation':             'Consultation',
  'dispute-resolution':       'Dispute Resolution',
  'employment-types':         'Employment Types',
  'hours-of-work':            'Hours of Work',
  'leave':                    'Leave Entitlements',
  'overtime':                 'Overtime',
  'penalty-rates':            'Penalty Rates',
  'professional-development': 'Professional Development',
  'termination':              'Termination & Redundancy',
  'wages':                    'Wage Rates',
  'workload':                 'Workload',
}

const trendingShortcuts = computed(() => {
  return trendingTopics.value
    .filter(t => t.topic)
    .slice(0, 3)
    .map(t => ({
      topic: t.topic,
      query: '',
      label: TOPIC_DISPLAY[t.topic] ?? t.topic.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
    }))
})

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

// ─── Stream label for nested EBAs ────────────────────────────────────────────
// Returns the humanised stream label for has-managers-admin and mental-health
// result cards (e.g. 'common-terms' → 'Common Terms'), or null for all others.
// Derives from result.url — no Pagefind meta change required.
const NESTED_EBA_FOLDERS = new Set(['has-managers-admin', 'mental-health'])

function getResultStream(result) {
  if (!result?.url) return null
  const parts = result.url.replace(/\.html$/, '').replace(/\/$/, '').split('/').filter(Boolean)
  // Nested clause: parts[0]='ebas', [1]=ebaFolder, [2]=streamSlug, [3]=section, [4]=clause → length 5
  if (parts[0] !== 'ebas') return null
  if (!NESTED_EBA_FOLDERS.has(parts[1])) return null
  if (parts.length < 5) return null
  return parts[2].split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

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

function buildSuggestions(rawQuery, resultCount, operators = {}) {
  if (!rawQuery || rawQuery.trim().length < 4) return []
  const lq = rawQuery.toLowerCase()
  const candidates = []

  // ── Pass 1: EBA suggestions ───────────────────────────────────────────────
  // Suppressed when the dropdown OR an eba: operator already targets this EBA.
  // operators.eba is the resolved full name (EBA_SLUG_MAP already handled the slug).
  for (const entry of SUGGESTION_EBA_MAP) {
    if (selectedEba.value === entry.eba) continue
    if (operators.eba     === entry.eba) continue
    const score = _scoreKeywords(lq, entry.keywords)
    if (score > 0) {
      candidates.push({ type: 'eba', label: `Filter to ${entry.eba.replace(/ \d{4}.*$/, '')}`, sublabel: entry.eba, action: { eba: entry.eba }, score })
    }
  }

  // ── Pass 2: Topic suggestions ─────────────────────────────────────────────
  // Suppressed when the dropdown OR a topic: operator already targets this topic.
  for (const entry of SUGGESTION_TOPIC_MAP) {
    if (selectedTopic.value === entry.topic) continue
    if (operators.topic     === entry.topic) continue
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

// ─── Pagefind prefetch + lazy init ───────────────────────────────────────────
// Two-phase strategy:
//   Phase 1 (onMounted): inject <link rel="prefetch"> tags so the browser
//     queues a background fetch of pagefind.js and pagefind-entry.json into
//     the HTTP cache. No module evaluation, no wasm. Zero blocking cost.
//   Phase 2 (initPagefind): called from pointerenter/focus on the trigger
//     button, or from openModal() as a guaranteed fallback. Performs the
//     dynamic import() and pagefind.init() — both hit the HTTP cache because
//     Phase 1 completed during idle time.
//
// pagefindInitPromise deduplicates concurrent callers (hover fires, then
// focus fires 30ms later before the import resolves — both await the same
// Promise rather than spawning two parallel imports).

function prefetchPagefind() {
  // Belt-and-suspenders: config.js already injects these tags at build time
  // into every page's static <head>. This function is a runtime fallback for
  // SPA navigations (VitePress swaps the <head> on client-side route changes)
  // and for any environment where the build-time head injection didn't run
  // (e.g. local dev without a production build).
  if (typeof document === 'undefined') return
  // pagefind.js: inject as modulepreload so the browser parses the ES module
  // into the module registry (not just downloads it). Deduplicates against
  // the build-time tag config.js already injected into the static <head>.
  if (!document.querySelector('link[rel="modulepreload"][href="/pagefind/pagefind.js"]')) {
    const ml = document.createElement('link')
    ml.rel  = 'modulepreload'
    ml.href = '/pagefind/pagefind.js'
    document.head.appendChild(ml)
  }
  // pagefind-entry.json: prefetch only (JSON data file, not an ES module).
  if (!document.querySelector('link[rel="prefetch"][href="/pagefind/pagefind-entry.json"]')) {
    const pf = document.createElement('link')
    pf.rel         = 'prefetch'
    pf.href        = '/pagefind/pagefind-entry.json'
    pf.as          = 'fetch'
    pf.crossOrigin = 'anonymous'
    document.head.appendChild(pf)
  }
}

async function initPagefind() {
  // Already initialised — nothing to do.
  if (pagefind) return

  // Deduplicate: if another caller already started the init, await their Promise.
  if (pagefindInitPromise) {
    await pagefindInitPromise
    return
  }

  pagefindInitPromise = (async () => {
    try {
      const importPath = '/pagefind/pagefind.js'
      pagefind = await new Function('path', 'return import(path)')(importPath)
      await pagefind.init()
      await pagefind.options({
        ranking: { pageLength: 0.6, termFrequency: 0.8, termSimilarity: 0.9, termSaturation: 1.6 }
      })
    } catch {
      console.warn('Pagefind not available — run npm run docs:index first.')
    }
  })()

  await pagefindInitPromise
}

onMounted(() => {
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

  // Phase 1: queue background preload of pagefind assets.
  // modulepreload for pagefind.js — parses the module into the registry.
  // prefetch for pagefind-entry.json — downloads the JSON index into cache.
  prefetchPagefind()

  // Phase 2: full idle-time init — import() + pagefind.init() + WASM fetch.
  // Fires during the browser's first idle window after the page is interactive
  // (typically 1–3 s after load). By the time the user presses Ctrl+K,
  // Pagefind is fully initialised and pagefind.search() can be called with
  // zero async startup cost.
  // pagefindInitPromise deduplication means this is a no-op if pointerenter
  // or openModal() already fired initPagefind() first.
  // Safari <16.4 does not support requestIdleCallback — setTimeout(2000) fallback.
  if (typeof window !== 'undefined') {
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => initPagefind(), { timeout: 3000 })
    } else {
      setTimeout(() => initPagefind(), 2000)
    }
  }
})

// Called by RelatedClauses.vue "See all related pages" button via custom DOM event.
function openFromExternal(e) {
  const detail = e?.detail ?? {}

  if (detail.tab === 'ask') {
    activeTab.value = 'ask'
    open.value      = true
    fetchMostViewed()
    fetchTrendingTopics()
    if (detail.query) {
      pendingContentHash = detail.contentHash ?? null
      pendingSourcePath  = detail.sourcePath  ?? null   // ← new
      _externalAskQuery  = detail.query
      pageContextBannerSuppressed.value = true   // prevents stray banner flash before aiLoading fires
      nextTick(() => submitAsk())
    } else {
      nextTick(() => { if (!isMobileSheet.value) inputRef.value?.focus() })
    }
    return
  }

  const { eba = '', topic = '' } = detail
  selectedEba.value   = eba
  selectedTopic.value = topic
  open.value = true
  fetchMostViewed()
  fetchTrendingTopics()
  if (eba || topic) {
    nextTick(() => doSearch())
  } else {
    nextTick(() => { if (!isMobileSheet.value) inputRef.value?.focus() })
  }
}

// ─── Open / close ─────────────────────────────────────────────────────────────
function openModal() {
  restoreEbaContext()   // must run before open.value = true so _pendingEbaFlash is set
                        // before watch(open) fires and checks it
  // Guaranteed fallback: if the user opened the modal via Ctrl+K or the mobile
  // tap path (no pointerenter/focus pre-warm), initPagefind() starts now.
  // It deduplicates against any in-flight init from the hover/focus path.
  initPagefind()
  open.value = true
  // Defer fetchMostViewed() by 50ms so the modal DOM paints its first frame
  // before the analytics worker request competes for network bandwidth.
  // The Most Viewed panel is below the fold on open so the delay is imperceptible.
  setTimeout(() => { fetchMostViewed(); fetchTrendingTopics() }, 50)
  nextTick(() => {
    loadPersistedState()
    if (!isMobileSheet.value) inputRef.value?.focus()
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
    if (!isMobileSheet.value) inputRef.value?.focus()
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
  if (e.key === 'Escape' && open.value) close()

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
  updateMobileSheet()
  window.addEventListener('resize', updateMobileSheet)
  if (typeof window !== 'undefined' && window.visualViewport) {
    window.visualViewport.addEventListener('resize', onVisualViewportResize)
  }
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
  window.removeEventListener('resize', updateMobileSheet)
  if (typeof window !== 'undefined' && window.visualViewport) {
    window.visualViewport.removeEventListener('resize', onVisualViewportResize)
  }
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
  pageContextBannerDismissed.value  = false
  pageContextAccepted.value         = false
  pageContextBannerSuppressed.value = false
  pendingSourcePath                 = null
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
  pageContextBannerDismissed.value  = false
  pageContextAccepted.value         = false
  pageContextBannerSuppressed.value = false
  pendingSourcePath                 = null
  nextTick(() => inputRef.value?.focus())
}

// ─── Zero-result → Ask AI redirect ───────────────────────────────────────────
// Converts the current search state into a natural-language question and
// pre-populates the Ask AI "question" mode form, then switches to that tab.
//
// EBA resolution priority:
//   1. selectedEba.value  — user set the dropdown explicitly
//   2. operators.eba      — parseQuery already resolves eba:nm → full name;
//                           no second EBA_SLUG_MAP lookup required
// cleanQuery is used (all operators stripped) so the AI gets plain search terms.

function buildAskQuestion(clean, ebaName) {
  const terms = clean.trim() || query.value.trim()
  if (!terms) return ''
  const ebaFragment = ebaName ? `the ${ebaName} EBA` : 'the EBA'
  return `What does ${ebaFragment} say about ${terms}?`
}

function redirectToAskAI() {
  const { cleanQuery, operators } = parseQuery(query.value)
  // operators.eba is already the full EBA name string (resolved by parseQuery)
  const resolvedEba = selectedEba.value || operators.eba || ''
  const questionStr = buildAskQuestion(cleanQuery, resolvedEba)

  // switchTab resets all Ask AI fields — re-apply our values in the next tick
  switchTab('ask')
  nextTick(() => {
    questionEba.value  = resolvedEba
    questionText.value = questionStr
    nextTick(() => document.getElementById('question-text')?.focus())
  })
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

// ─── Page context banner handlers ─────────────────────────────────────────────
// acceptPageContext: user clicked "Use this page".
//   Seeds pendingSourcePath so submitAsk() sends it to the worker on the first
//   turn. Also pre-fills EBA dropdowns for all three modes — only when they are
//   currently empty so an explicit user selection is never overwritten.
function acceptPageContext() {
  pendingSourcePath = route.path.replace(/\/$/, '').replace(/\.html$/, '')
  const eba = currentPageEba.value
  if (eba) {
    if (!questionEba.value)  questionEba.value  = eba
    if (!situationEba.value) situationEba.value = eba
    if (!draftEba.value)     draftEba.value     = eba
  }
  pageContextAccepted.value        = true
  pageContextBannerDismissed.value = true   // collapses banner, shows active pill
}

// clearPageContext: user clicked × on the "context active" pill.
//   Nulls pendingSourcePath and re-shows the banner so the user can reconsider.
//   Does NOT clear EBA dropdowns — the user may have intentionally set them.
function clearPageContext() {
  pendingSourcePath                = null
  pageContextAccepted.value        = false
  pageContextBannerDismissed.value = false
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

// ─── Operator hint autocomplete ───────────────────────────────────────────────
// Detects whether the tail of the raw query is an incomplete eba: or topic:
// token (i.e. the last whitespace-delimited token starts with eba: or topic:
// and the user has not yet moved on by typing a space after a valid value).
//
// Returns null when no hint should show, or an object:
//   { type: 'eba'|'topic', fragment: string, items: Array }
//
// For eba: — items is one entry per unique EBA, using the canonical (shortest)
//   slug as the primary label, full EBA name as secondary text.
// For topic: — items is the filtered topicList array (plain strings).
const operatorHint = computed(() => {
  if (activeTab.value !== 'search') return null
  const raw   = query.value
  if (!raw) return null

  // Split on whitespace; examine the last token only (tail-only trigger)
  const tokens    = raw.split(/\s+/)
  const lastToken = tokens[tokens.length - 1]

  // ── eba: hint ──────────────────────────────────────────────────────────────
  const ebaMatch = lastToken.match(/^eba:(.*)$/i)
  if (ebaMatch) {
    const fragment = ebaMatch[1].toLowerCase()

    // Build one row per EBA: pick the canonical slug (shortest key that maps
    // to this EBA name) so the hint always shows the most natural alias.
    const seen      = new Map()  // fullName → canonicalSlug
    for (const [slug, fullName] of Object.entries(EBA_SLUG_MAP)) {
      if (!seen.has(fullName) || slug.length < seen.get(fullName).length) {
        seen.set(fullName, slug)
      }
    }

    const rows = []
    for (const [fullName, canonicalSlug] of seen) {
      if (!fragment || canonicalSlug.includes(fragment) || fullName.toLowerCase().includes(fragment)) {
        rows.push({ slug: canonicalSlug, fullName })
      }
    }

    if (rows.length === 0) return null
    return { type: 'eba', fragment, items: rows }
  }

  // ── topic: hint ────────────────────────────────────────────────────────────
  const topicMatch = lastToken.match(/^topic:(.*)$/i)
  if (topicMatch) {
    const fragment = topicMatch[1].toLowerCase()
    const items    = fragment
      ? topicList.filter(t => t.includes(fragment))
      : [...topicList]
    if (items.length === 0) return null
    return { type: 'topic', fragment, items }
  }

  return null
})

// ─── Position the hint dropdown below the search input ───────────────────────
// Called reactively via a watch on operatorHint — positions the Teleported
// dropdown using the input element's bounding rect, same pattern as the
// floating preview pane. Must be called after nextTick so the DOM is ready.
function positionHint() {
  if (!inputRef.value) return
  const rect          = inputRef.value.getBoundingClientRect()
  hintStyle.value = {
    position: 'fixed',
    top:      `${rect.bottom + 4}px`,
    left:     `${rect.left}px`,
    width:    `${rect.width}px`,
    zIndex:   '10005',
  }
}

// ─── Complete an operator hint item into the query ────────────────────────────
// Replaces the incomplete tail token with the completed value and a trailing
// space, then fires debouncedSearch() so the new operator takes effect.
function acceptHint(item) {
  const tokens    = query.value.split(/\s+/)
  const prefix    = tokens.slice(0, -1)   // everything before the tail token
  const completed = operatorHint.value?.type === 'eba'
    ? `eba:${item.slug}`
    : `topic:${item}`
  query.value = [...prefix, completed, ''].join(' ').trimStart()
  hintIndex.value = -1
  nextTick(() => {
    inputRef.value?.focus()
    debouncedSearch()
  })
}

// ─── Dismiss the hint without completing ─────────────────────────────────────
function dismissHint() {
  // We don't modify the query — just clear the keyboard index so the next
  // ↓ press re-opens navigation from the top.
  hintIndex.value = -1
}

// ─── Watch operatorHint to reposition the dropdown whenever it opens ─────────
watch(operatorHint, (val) => {
  if (val) {
    hintIndex.value = -1
    nextTick(positionHint)
  }
})

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

// ─── Dismiss a single dropdown filter ────────────────────────────────────────
// Called by the dropdown EBA/topic pills in the unified active filters bar.
// Clears the relevant ref and re-runs search, mirroring dismissOperator() but
// for selectedEba/selectedTopic rather than query string tokens.
function dismissDropdown(type) {
  if (type === 'eba')   selectedEba.value   = ''
  if (type === 'topic') selectedTopic.value = ''
  doSearch()
  nextTick(() => inputRef.value?.focus())
}

// ─── Clear all operator tokens from the query string ─────────────────────────
function clearAllOperators() {
  // Strip all operator tokens from the query string
  let q = query.value
  q = q.replace(/\beba:\S+/gi, '')
  q = q.replace(/\btopic:\S+/gi, '')
  q = q.replace(/\bclause:\w+/gi, '')
  q = q.replace(/(?:^|\s)-[a-zA-Z]\w*/g, ' ')
  q = q.replace(/"[^"]*"/g, '')
  query.value = q.replace(/\s{2,}/g, ' ').trim()
  // Also clear the dropdown filters — "Clear all" means everything
  selectedEba.value   = ''
  selectedTopic.value = ''
  doSearch()
  nextTick(() => inputRef.value?.focus())
}

// ─── Search ───────────────────────────────────────────────────────────────────
// Pre-warms Pagefind's internal chunk cache on the first keystroke, before the
// debounce window expires. Uses only the first 3 characters so the fetch is fast
// and targets the same chunks doSearch() will need. Fire-and-forget — no state
// changes, no error handling required.
function warmupSearch() {
  const fragment = query.value.trim()
  if (!pagefind || fragment.length < 2) return
  pagefind.search(fragment.slice(0, 3)).catch(() => {})
}

function debouncedSearch() {
  clearTimeout(searchTimer)
  // Adaptive debounce: shorter delay for longer queries where Pagefind
  // chunk cache is likely warm; longer delay for short fragments to avoid
  // firing on every intermediate keystroke from slower typists.
  const len   = query.value.trim().length
  const delay = len >= 6 ? 120 : len >= 3 ? 220 : 380
  searchTimer = setTimeout(doSearch, delay)
}

async function doSearch() {
  fuzzyResults.value = []
  fuzzyQuery.value   = ''
  suggestions.value  = []

  // ── Parse advanced operators out of the raw query ──────────────────────────
  const { cleanQuery, operators } = parseQuery(query.value)

  // ── Promote eba: and topic: operators into their dropdown equivalents ──────
  // When the user types eba:<slug> or topic:<value> and it resolves, we sync
  // the corresponding dropdown ref and strip the token from the query string.
  // This makes both operators fast-fill shortcuts for the dropdowns rather than
  // parallel filters, eliminating any dual-source scenario.
  let needsReparse = false
  if (operators.eba && operators.eba !== selectedEba.value) {
    selectedEba.value = operators.eba
    query.value = query.value.replace(/\beba:\S+/gi, '').replace(/\s{2,}/g, ' ').trim()
    needsReparse = true
  }
  if (operators.topic && operators.topic !== selectedTopic.value) {
    selectedTopic.value = operators.topic
    query.value = query.value.replace(/\btopic:\S+/gi, '').replace(/\s{2,}/g, ' ').trim()
    needsReparse = true
  }
  if (needsReparse) {
    const reparsed = parseQuery(query.value)
    Object.assign(operators, reparsed.operators)
  }

  // Guard: nothing to search
  if (!pagefind || (cleanQuery.length < 2 && !operators.clause && !selectedEba.value && !selectedTopic.value)) {
    results.value = []
    return
  }

  loading.value    = true
  skeletonCount.value = 0   // reset before new search

  // ── Build Pagefind filter object ───────────────────────────────────────────
  // Dropdown values take precedence over operator values when both are set,
  // because the user explicitly chose from the dropdown. Operator fills the
  // gap when the dropdown is on "All EBAs" / "All Topics".
  const filters = {}
  const activeEba   = selectedEba.value   || null
  const activeTopic = selectedTopic.value || null
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

    // ── Show skeleton cards immediately — count is known from stubs ───────
    // Stubs are available instantly; .data() calls happen below.
    // Setting skeletonCount here and clearing loading lets Vue render the
    // shimmer grid before the slower per-card data fetches complete.
    const stubSlice = search.results.slice(0, 12)
    skeletonCount.value = stubSlice.length
    loading.value       = false

    // ── Exact phrase boost ────────────────────────────────────────────────
    // Sources, in priority order:
    //   1. Quoted phrases from the operator parser  ("annual leave")
    //   2. The cleanQuery itself, when multi-word   (ordinary multi-word search)
    // All phrase searches run in parallel. exactIds is the union of all hits.
    let exactIds = new Set()
    const phraseQueries = [
      // Operator phrases — already quoted by the user
      ...operators.phrases.map(p => `"${p}"`),
      // cleanQuery phrase — only when it contains a space (original behaviour)
      ...(cleanQuery.trim().includes(' ') ? [`"${cleanQuery.trim()}"`] : []),
    ]
    if (phraseQueries.length > 0) {
      const phraseResults = await Promise.allSettled(
        phraseQueries.map(pq => pagefind.search(pq, { filters }))
      )
      for (const outcome of phraseResults) {
        if (outcome.status !== 'fulfilled') {
          console.warn('[SearchModal] exact-phrase search failed:', outcome.reason)
          continue
        }
        try {
          const data = await Promise.all(outcome.value.results.slice(0, 5).map(r => r.data()))
          data.forEach(r => exactIds.add(r.url))
        } catch (innerErr) {
          console.warn('[SearchModal] exact-phrase data fetch failed:', innerErr)
        }
      }
    }

    const settled    = await Promise.allSettled(stubSlice.map(r => r.data()))
    const allResults = settled
      .filter(s => s.status === 'fulfilled')
      .map(s => s.value)

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

    skeletonCount.value = 0
    results.value = [
      ...filtered.filter(r => exactIds.has(r.url)),
      ...filtered.filter(r => !exactIds.has(r.url)),
    ]

    // ── Smart suggestions ─────────────────────────────────────────────────
    // Always build when query is long enough — panel is a persistent refinement
    // tool. Pass operators so eba:/topic: tokens suppress the same filter type
    // as dropdown suppression — no point suggesting what the user already typed.
    suggestions.value = cleanQuery.trim().length >= 4
      ? buildSuggestions(query.value, results.value.length, operators)
      : []

    if (results.value.length === 0 && cleanQuery.trim().length > 3) {
      await runFuzzyFallback(cleanQuery.trim(), filters)
    }

    // Log the clean query (without operators) for analytics — operators are
    // implicit in the eba/topic values we already log.
    logSearch('search', cleanQuery || query.value, activeEba || '', activeTopic || '', results.value.length)
  } catch (err) {
    results.value       = []
    skeletonCount.value = 0
    // ── Telemetry: Pagefind hard failure ──────────────────────────────────
    // Console for devtools visibility; analytics worker for operational dashboards.
    console.error('[SearchModal] Pagefind search failed:', err)
    try {
      logSearch('search_error', query.value, activeEba || '', activeTopic || '', -1)
    } catch { /* logSearch itself must never throw */ }
  }
  loading.value       = false
  skeletonCount.value = 0
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
        const settled = await Promise.allSettled(search.results.slice(0, 8).map(r => r.data()))
        const data    = settled.filter(s => s.status === 'fulfilled').map(s => s.value)
        fuzzyResults.value = data
        fuzzyQuery.value   = candidate
        break
      }
    } catch { break }
  }
  fuzzyLoading.value = false
}

// ─── Highlight URL builder ────────────────────────────────────────────────────
// Word priority (highest → lowest):
//   1. Quoted phrase words — most precise, user explicitly grouped these
//   2. cleanQuery words    — what Pagefind actually searched
//   3. fuzzyQuery words    — stem that matched when cleanQuery returned zero
// Excerpt is NOT used — it contains surrounding context words, not intent words.
function buildHighlightUrl(result) {
  const baseUrl = result.url
  if (!baseUrl) return baseUrl ?? ''

  // ── Collect words from each source in priority order ─────────────────────
  const seen  = new Set()
  const words = []

  function addWords(str) {
    if (!str) return
    str.trim().split(/\s+/).forEach(w => {
      // Strip punctuation, require ≥ 3 alphanumeric chars
      const clean = w.replace(/[^a-zA-Z0-9]/g, '')
      if (clean.length >= 3 && !seen.has(clean.toLowerCase())) {
        seen.add(clean.toLowerCase())
        words.push(clean)
      }
    })
  }

  // 1. Quoted phrase words (strip surrounding quotes, split on spaces)
  const { operators } = parseQuery(query.value)
  operators.phrases.forEach(phrase => addWords(phrase))

  // 2. cleanQuery words
  const { cleanQuery } = parseQuery(query.value)
  addWords(cleanQuery)

  // 3. Fuzzy stem words (only when fuzzy fallback is active for this result)
  if (fuzzyQuery.value && fuzzyResults.value.some(r => r.url === result.url)) {
    addWords(fuzzyQuery.value)
  }

  if (words.length === 0) return baseUrl

  // Cap at 6 words — enough for precise node scoring, short enough to stay
  // under URL length limits even on long clause page paths.
  const phrase = words.slice(0, 6).join(' ')

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
          sourcePath:  pendingSourcePath ?? undefined,   // ← new
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
    pendingSourcePath  = null
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
        sourcePath:  pendingSourcePath ?? undefined,
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
  pendingSourcePath  = null
}

function resetConversation() {
  conversationHistory.value = []
  aiAnswer.value            = ''
  aiSources.value           = []
  aiError.value             = ''
  pendingContentHash        = null
  pendingSourcePath         = null
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
  // pageContextBannerDismissed is intentionally NOT reset here.
  // The user has already been offered context for this modal open — don't re-offer it.
  pageContextAccepted.value         = false
  pageContextBannerSuppressed.value = false
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
  border-radius: 12px; box-shadow: 0 20px 60px rgba(0,0,0,0.3); overflow: hidden;
  display: flex; flex-direction: column;
  /* Promote to compositor layer before the open transition starts.
     Prevents first-frame stutter caused by simultaneous DOM insertion
     and compositing. GPU memory cost is negligible for a modal. */
  will-change: transform, opacity;
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
/* ── Ask AI zero-result CTA ──────────────────────────────────────────────────── */
.ask-ai-cta { margin-top: 1rem; }

/* Primary: total dead-end — fuzzy also returned nothing */
.ask-ai-cta--primary {
  padding: 1rem 1.1rem;
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 10px;
  background: var(--vp-c-brand-soft);
  display: flex;
  flex-direction: column;
  gap: 0.65rem;
}
.ask-ai-cta-body {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}
.ask-ai-cta-icon { color: var(--vp-c-brand-1); margin-bottom: 0.15rem; }
.ask-ai-cta-heading { font-size: 0.85rem; font-weight: 700; color: var(--vp-c-text-1); line-height: 1.3; }
.ask-ai-cta-sub    { font-size: 0.78rem; color: var(--vp-c-text-2); line-height: 1.45; }

.ask-ai-cta-btn--primary {
  display: flex; align-items: center; justify-content: center; gap: 0.45rem;
  width: 100%; padding: 0.55rem 0.9rem;
  background: var(--vp-c-brand-1); color: #fff;
  font-size: 0.82rem; font-weight: 600;
  border: none; border-radius: 7px; cursor: pointer;
  text-align: center; line-height: 1.35;
  transition: opacity 0.15s, transform 0.1s;
}
.ask-ai-cta-btn--primary:hover  { opacity: 0.88; }
.ask-ai-cta-btn--primary:active { transform: scale(0.98); }

/* Secondary: fuzzy found something — quieter, shown below results */
.ask-ai-cta--secondary { margin-top: 0.75rem; }
.ask-ai-cta-btn--secondary {
  display: flex; align-items: center; gap: 0.4rem;
  width: 100%; padding: 0.45rem 0.75rem;
  background: transparent; color: var(--vp-c-brand-1);
  font-size: 0.78rem; font-weight: 500;
  border: 1px solid var(--vp-c-brand-1); border-radius: 7px;
  cursor: pointer; line-height: 1.35;
  transition: background 0.15s, color 0.15s;
  opacity: 0.85;
}
.ask-ai-cta-btn--secondary:hover { background: var(--vp-c-brand-soft); opacity: 1; }
.ask-ai-cta-btn--secondary svg:first-child { flex-shrink: 0; opacity: 0.75; }
.ask-ai-cta-btn--secondary svg:last-child  { flex-shrink: 0; margin-left: auto; }
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
  padding: 0.25rem 0.65rem; border-radius: 6px;
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

/* Trending topic chips — reuse qa-chip base, add a brand accent */
.qa-chip-trending {
  border-color: var(--vp-c-brand-2, #a855f7);
  color: var(--vp-c-brand-1);
}
.qa-chip-trending:hover {
  background: var(--vp-c-brand-soft);
  border-color: var(--vp-c-brand-1);
}

/* Skeleton chip for trending loading state */
.qa-chip--skeleton {
  width: 96px;
  pointer-events: none;
  background: var(--vp-c-bg-elv);
  border-color: transparent;
  animation: qa-shimmer 1.4s ease-in-out infinite;
}
@keyframes qa-shimmer {
  0%, 100% { opacity: 0.35; }
  50%       { opacity: 0.75; }
}

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

/* ── Search result skeleton shimmer ── */
/* Reuses the qa-skeleton-pulse keyframe already defined above.             */
/* sk-* classes mirror the exact structure of a real .result-card so there */
/* is zero layout shift when real cards replace the skeletons.              */

.result-card--skeleton {
  pointer-events: none;
  user-select:    none;
  cursor:         default;
}

/* Suppress hover/focus styles on skeleton cards */
.result-card--skeleton:hover,
.result-card--skeleton:focus-visible {
  border-color: var(--vp-c-divider);
  background:   var(--vp-c-bg-soft);
  box-shadow:   none;
}

/* Generic shimmer line — width overridden per element below */
.sk-line {
  display:       inline-block;
  height:        0.7rem;
  border-radius: 3px;
  background:    var(--vp-c-divider);
  animation:     qa-skeleton-pulse 1.5s ease-in-out infinite;
}

/* Title shimmer: ~60% of the row, matches typical clause title length */
.sk-title {
  width:            58%;
  height:           0.875rem;  /* slightly taller than body lines — matches .result-title font-size */
  animation-delay:  0s;
}

/* EBA pill shimmer */
.sk-pill {
  display:          inline-block;
  width:            5.5rem;
  height:           1.25rem;
  border-radius:    999px;
  background:       var(--vp-c-divider);
  animation:        qa-skeleton-pulse 1.5s ease-in-out infinite;
  animation-delay:  0.1s;
  flex-shrink:      0;
}

/* Breadcrumb shimmer: ~40% — mirrors section › clause text */
.sk-breadcrumb {
  width:            38%;
  height:           0.6rem;
  animation-delay:  0.15s;
}

/* Excerpt block: two lines, staggered delay for wave effect */
.sk-excerpt {
  display:        flex;
  flex-direction: column;
  gap:            0.35rem;
  margin-top:     0.35rem;
}

.sk-excerpt-line--full    { width: 96%; animation-delay: 0.2s; }
.sk-excerpt-line--partial { width: 72%; animation-delay: 0.3s; }

/* Result-count placeholder row */
.result-count-skeleton {
  width:            4.5rem;
  height:           0.65rem;
  border-radius:    3px;
  background:       var(--vp-c-divider);
  animation:        qa-skeleton-pulse 1.5s ease-in-out infinite;
  animation-delay:  0s;
  margin-bottom:    0.75rem;
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
  font-size: 0.7rem; padding: 0.1rem 0.55rem; border-radius: 6px;
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
  color: var(--vp-c-text-3); padding: 0.1rem 0.4rem; border-radius: 6px;
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

/* ── Modal transition (desktop) ── */
.modal-enter-active, .modal-leave-active { transition: opacity 0.18s ease; }
.modal-enter-active .search-modal, .modal-leave-active .search-modal { transition: transform 0.18s ease, opacity 0.18s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .search-modal, .modal-leave-to .search-modal { transform: translateY(-8px); opacity: 0; }

/* ── Sheet transition (mobile) ── */
.sheet-enter-active, .sheet-leave-active { transition: opacity 0.22s ease; }
.sheet-enter-active .search-modal--sheet, .sheet-leave-active .search-modal--sheet { transition: transform 0.28s cubic-bezier(0.32, 0.72, 0, 1); }
.sheet-enter-from, .sheet-leave-to { opacity: 0; }
.sheet-enter-from .search-modal--sheet { transform: translateY(100%); }
.sheet-leave-to .search-modal--sheet   { transform: translateY(100%); }

/* ── Mobile bottom sheet layout ── */
@media (max-width: 767px) {
  .search-overlay--sheet {
    align-items: flex-end;
    padding-top: 0;
  }

  .search-modal--sheet {
    width: 100%;
    max-width: 100%;
    /* maxHeight bound reactively via :style; 85dvh is the CSS fallback
       for the initial render frame before viewportHeight is read. */
    max-height: 85dvh;
    border-radius: 16px 16px 0 0;
    border-bottom: none;
    box-shadow: 0 -4px 32px rgba(0, 0, 0, 0.22);
    /* Safe area inset for iOS home indicator */
    padding-bottom: env(safe-area-inset-bottom);
    /* Prevent scroll chaining to the page behind the sheet */
    overscroll-behavior: contain;
  }

  /* Drag handle pill */
  .sheet-handle {
    flex-shrink: 0;
    width: 40px;
    height: 4px;
    background: var(--vp-c-divider);
    border-radius: 999px;
    margin: 10px auto 6px;
  }

  /* Hide Esc close button text on mobile — replaced by a close button feel via the handle */
  .close-btn {
    display: none;
  }

  /* Ensure search body scrolls correctly with momentum on iOS */
  .search-body {
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }

  /* Prevent preview pane from appearing (belt-and-suspenders; JS already guards this) */
  .preview-pane { display: none !important; }
}

/* ── Operator pills row ── */
.operator-pills-row {
  display: flex; align-items: center; flex-wrap: wrap; gap: 0.4rem;
  padding: 0.45rem 1rem;
  background: var(--vp-c-bg-soft);
  border-bottom: 1px solid var(--vp-c-divider);
  /* Animate in/out when v-if toggles — VitePress uses v-show internally for
     some transitions but v-if here is fine; the bar appears/disappears quickly
     enough that a 150ms fade is the right level of subtlety. */
  animation: pills-row-in 0.15s ease;
}
@keyframes pills-row-in {
  from { opacity: 0; transform: translateY(-4px); }
  to   { opacity: 1; transform: translateY(0); }
}
.op-pills-label {
  font-size: 0.68rem; font-weight: 700; text-transform: uppercase;
  letter-spacing: 0.07em; color: var(--vp-c-text-3); flex-shrink: 0;
}
.op-pill {
  display: inline-flex; align-items: center; gap: 0.3rem;
  padding: 0.2rem 0.35rem 0.2rem 0.5rem;
  border-radius: 6px; border: 1px solid;
  font-size: 0.72rem; font-weight: 600; font-family: var(--vp-font-family-mono, ui-monospace, monospace);
  white-space: nowrap;
}
/* EBA pill: colour applied entirely via inline :style (opPillEbaStyle) — no static rules needed */

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

/* ── Operator hint autocomplete dropdown ── */
.op-hint-dropdown {
  background:    var(--vp-c-bg);
  border:        1px solid var(--vp-c-divider);
  border-radius: 10px;
  box-shadow:
    0 0 0 1px rgba(74,42,114,0.10),
    0 8px 32px rgba(0,0,0,0.22),
    0 2px 8px rgba(0,0,0,0.10);
  overflow:      hidden;
  max-height:    320px;
  overflow-y:    auto;
  /* Scroll-contain so the page body doesn't scroll when this list is full */
  overscroll-behavior: contain;
}
.op-hint-header {
  display:         flex;
  align-items:     center;
  gap:             0.5rem;
  padding:         0.4rem 0.75rem;
  background:      var(--vp-c-bg-soft);
  border-bottom:   1px solid var(--vp-c-divider);
  flex-wrap:       wrap;
}
.op-hint-header-label {
  font-size:      0.68rem;
  font-weight:    700;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color:          var(--vp-c-text-3);
  font-family:    var(--vp-font-family-mono, ui-monospace, monospace);
  flex-shrink:    0;
  margin-right:   auto;
}
.op-hint-header-kbd {
  font-size:     0.62rem;
  color:         var(--vp-c-text-3);
  background:    var(--vp-c-bg);
  border:        1px solid var(--vp-c-divider);
  border-radius: 4px;
  padding:       0.1rem 0.3rem;
  font-family:   var(--vp-font-family-mono, ui-monospace, monospace);
  white-space:   nowrap;
}
.op-hint-item {
  display:        flex;
  align-items:    center;
  gap:            0.55rem;
  width:          100%;
  padding:        0.45rem 0.75rem;
  background:     none;
  border:         none;
  border-bottom:  1px solid var(--vp-c-divider);
  cursor:         pointer;
  text-align:     left;
  transition:     background 0.1s;
}
.op-hint-item:last-child { border-bottom: none; }
.op-hint-item:hover,
.op-hint-item--active {
  background: var(--vp-c-bg-soft);
}
.op-hint-eba-dot {
  flex-shrink:   0;
  width:         10px;
  height:        10px;
  border-radius: 50%;
  display:       inline-block;
}
.op-hint-topic-icon {
  flex-shrink: 0;
  color:       #7C3AED;
}
.op-hint-item-primary {
  font-size:   0.8rem;
  font-weight: 600;
  color:       var(--vp-c-text-1);
  font-family: var(--vp-font-family-mono, ui-monospace, monospace);
  white-space: nowrap;
  overflow:    hidden;
  text-overflow: ellipsis;
}
.op-hint-item-secondary {
  font-size:  0.72rem;
  color:      var(--vp-c-text-3);
  white-space: nowrap;
  overflow:   hidden;
  text-overflow: ellipsis;
  margin-left: auto;
  padding-left: 0.5rem;
}
/* ── Dim secondary text when the item is active so primary pops ── */
.op-hint-item--active .op-hint-item-secondary { color: var(--vp-c-text-2); }

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

/* ── Page context banner ─────────────────────────────────────────────────────
   Compact one-liner shown at the top of the Ask AI tab when the user is on a
   clause page. Subtle style: muted background, EBA-coloured left border accent,
   small typography. Designed to be noticed but not intrusive.
──────────────────────────────────────────────────────────────────────────── */
.page-ctx-banner {
  display:       flex;
  align-items:   center;
  gap:           0.55rem;
  padding:       0.45rem 0.7rem;
  margin:        0 0 0.6rem;
  border:        1px solid var(--vp-c-divider);
  border-left:   3px solid var(--vp-c-brand); /* overridden per-EBA via :style */
  border-radius: 6px;
  background:    var(--vp-c-bg-soft);
  flex-shrink:   0;
}

.page-ctx-icon {
  flex-shrink: 0;
  color:       var(--vp-c-text-3);
}

.page-ctx-banner-body {
  flex:           1;
  display:        flex;
  flex-direction: column;
  gap:            0.1rem;
  min-width:      0;
}

.page-ctx-banner-label {
  display:     flex;
  align-items: center;
  gap:         0.35rem;
  flex-wrap:   wrap;
  font-size:   0.78rem;
  color:       var(--vp-c-text-1);
  line-height: 1.35;
}

.page-ctx-banner-eba {
  display:       inline-flex;
  align-items:   center;
  padding:       0.05rem 0.4rem;
  border-radius: 3px;
  font-size:     0.68rem;
  font-weight:   500;
  border:        1px solid transparent;
  white-space:   nowrap;
  line-height:   1.5;
}

.page-ctx-banner-sub {
  font-size: 0.71rem;
  color:     var(--vp-c-text-3);
  line-height: 1.3;
}

.page-ctx-banner-actions {
  display:    flex;
  gap:        0.35rem;
  flex-shrink: 0;
}

.page-ctx-use-btn {
  padding:       0.22rem 0.55rem;
  border-radius: 5px;
  font-size:     0.73rem;
  font-weight:   500;
  cursor:        pointer;
  border:        1px solid var(--vp-c-brand);
  background:    var(--vp-c-brand-soft);
  color:         var(--vp-c-brand-1);
  white-space:   nowrap;
  transition:    filter 0.15s;
  line-height:   1.4;
}
.page-ctx-use-btn:hover  { filter: brightness(1.1); }
.page-ctx-use-btn:active { filter: brightness(0.95); }

.page-ctx-skip-btn {
  padding:       0.22rem 0.5rem;
  border-radius: 5px;
  font-size:     0.73rem;
  cursor:        pointer;
  border:        1px solid var(--vp-c-divider);
  background:    transparent;
  color:         var(--vp-c-text-3);
  white-space:   nowrap;
  transition:    color 0.15s, border-color 0.15s;
  line-height:   1.4;
}
.page-ctx-skip-btn:hover {
  color:        var(--vp-c-text-2);
  border-color: var(--vp-c-text-3);
}

/* Mobile: stack banner vertically when viewport is very narrow */
@media (max-width: 480px) {
  .page-ctx-banner { flex-wrap: wrap; }
  .page-ctx-banner-actions { width: 100%; justify-content: flex-end; }
}

/* ── Context active indicator ── */
.page-ctx-active {
  display:       flex;
  align-items:   center;
  gap:           0.45rem;
  padding:       0.35rem 0.65rem;
  margin:        0 0 0.6rem;
  border:        1px solid var(--vp-c-divider);
  border-left:   3px solid var(--vp-c-brand);
  border-radius: 6px;
  background:    var(--vp-c-brand-soft);
  font-size:     0.75rem;
  color:         var(--vp-c-text-2);
  flex-shrink:   0;
}

.page-ctx-active-icon {
  flex-shrink: 0;
  color:       var(--vp-c-brand-1);
}

.page-ctx-active span {
  flex: 1;
  line-height: 1.35;
}

.page-ctx-clear-btn {
  padding:       0.1rem 0.35rem;
  border:        none;
  background:    transparent;
  color:         var(--vp-c-text-3);
  cursor:        pointer;
  font-size:     0.9rem;
  border-radius: 3px;
  line-height:   1;
  flex-shrink:   0;
  transition:    color 0.15s, background 0.15s;
}
.page-ctx-clear-btn:hover {
  color:       var(--vp-c-text-1);
  background:  var(--vp-c-bg-mute);
}

</style>