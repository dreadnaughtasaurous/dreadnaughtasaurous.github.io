<template>
  <!-- Trigger button for navbar -->

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
    <span class="search-trigger-kbd"><kbd class="kbd-slash">/</kbd></span>
  </button>

  <!-- Modal overlay -->
  <Teleport to="body">
    <Transition :name="isMobileSheet ? 'sheet' : 'modal'">
      <div v-if="open" class="search-overlay" :class="{ 'search-overlay--sheet': isMobileSheet }"
           @click.self="close" role="dialog" aria-modal="true" aria-label="Search wiki">
        <div class="search-modal" ref="modalRef"
             :class="{ 'search-modal--sheet': isMobileSheet, 'search-modal--compact': compactResults }"
             :style="isMobileSheet ? { maxHeight: (viewportHeight * 0.85) + 'px' } : {}"
             @keydown="trapFocus">

          <!-- Drag handle — visible on mobile sheet only; purely decorative affordance -->
          <div class="sheet-handle" aria-hidden="true"></div>

          <!-- Search input row -->
          <div class="search-header">
            <svg
              class="search-icon" width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
            <input
              ref="inputRef"
              v-model="query"
              type="search"
              placeholder="Search across agreements or ask a question"
              class="search-input"
              @input="warmupSearch(); debouncedSearch()"
              @keydown.enter="operatorHint && hintIndex >= 0 ? acceptHint(operatorHint.items[hintIndex]) : operatorCheatsheet && hintIndex >= 0 ? insertOperator(CHEATSHEET_OPS[hintIndex].prefix) : null"
              @keydown.down.prevent="operatorHint ? (hintIndex = Math.min(hintIndex + 1, operatorHint.items.length - 1)) : operatorCheatsheet ? (hintIndex = Math.min(hintIndex + 1, CHEATSHEET_OPS.length - 1)) : focusResult(0)"
              @keydown.up.prevent="(operatorHint || operatorCheatsheet) ? (hintIndex = Math.max(hintIndex - 1, -1)) : null"
              @keydown.esc="operatorHint ? dismissHint() : operatorCheatsheet ? dismissCheatsheet() : close()"
              autocomplete="off"
            
            />
            <!-- Search mode toggle — ~ fuzzy (default) / = exact phrase ── -->
            <button
              class="search-mode-btn"
              :class="{ 'search-mode-btn--exact': searchMode === 'exact' }"
              @click="toggleSearchMode"
              :title="searchMode === 'fuzzy' ? 'Toggle exact search' : 'Toggle fuzzy search'"
              :aria-label="searchMode === 'fuzzy' ? 'Toggle exact search' : 'Toggle fuzzy search'"
              :aria-pressed="String(searchMode === 'exact')"
            >{{ searchMode === 'fuzzy' ? '~' : '=' }}</button>

            <!-- Gear button — opens the extensible settings panel -->
            <button
              class="settings-gear-btn"
              :class="{ 'settings-gear-btn--active': showSettingsPanel }"
              @click="showSettingsPanel = !showSettingsPanel"
              aria-label="Search settings"
              :aria-expanded="String(showSettingsPanel)"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
            </button>
            <!-- Copy search link — only shown when there is an active query/filter to share -->
            <button
              v-if="query.trim() || selectedEba || selectedTopic"
              class="copy-link-btn"
              :class="{ 'copy-link-btn--copied': urlCopied }"
              @click="copySearchLink"
              :aria-label="urlCopied ? 'Link copied!' : 'Copy search link'"
              :title="urlCopied ? 'Link copied!' : 'Copy search link'"
            >
              <svg v-if="!urlCopied" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
                <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
              </svg>
              <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </button>

            <button
              class="clear-query-btn"
              :class="{ 'clear-query-btn--active': query.trim() }"
              @click="clearQuery"
              aria-label="Clear search"
              title="Clear search"
            >
              <span class="vpi-delete" aria-hidden="true"></span>
            </button>
          </div>

          <!-- Settings panel -->
          <Transition name="settings-panel">
            <div v-if="showSettingsPanel" class="search-settings-panel" role="region" aria-label="Search settings">

              <!-- ── Search behaviour ──────────────────────────────────────────────────── -->
              <div class="settings-section-head">Search behaviour</div>

              <div class="settings-row">
                <span class="settings-row-label">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  Default EBA
                </span>
                <select class="settings-select" :value="defaultEba" @change="setDefaultEba($event.target.value)" aria-label="Default EBA filter">
                  <option value="">No default</option>
                  <option v-for="eba in ebaList" :key="eba" :value="eba">{{ eba }}</option>
                </select>
              </div>

              <div class="settings-row">
                <span class="settings-row-label">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/></svg>
                  Open results in new tab
                </span>
                <button class="settings-toggle" :class="{ 'settings-toggle--on': resultsNewTab }" @click="toggleResultsNewTab" role="switch" :aria-checked="String(resultsNewTab)" aria-label="Open results in new tab">
                  <span class="settings-toggle-knob"></span>
                </button>
              </div>

              <!-- ── Display ───────────────────────────────────────────────────────────── -->
              <div class="settings-section-head">Display</div>

              <div class="settings-row">
                <span class="settings-row-label">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
                  Compact results
                </span>
                <button class="settings-toggle" :class="{ 'settings-toggle--on': compactResults }" @click="toggleCompactResults" role="switch" :aria-checked="String(compactResults)" aria-label="Compact results">
                  <span class="settings-toggle-knob"></span>
                </button>
              </div>

              <div class="settings-row">
                <span class="settings-row-label">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>
                  Floating preview pane
                </span>
                <button class="settings-toggle" :class="{ 'settings-toggle--on': previewEnabled }" @click="togglePreviewEnabled" role="switch" :aria-checked="String(previewEnabled)" aria-label="Floating preview pane">
                  <span class="settings-toggle-knob"></span>
                </button>
              </div>

              <!-- ── Privacy ───────────────────────────────────────────────────────────── -->
              <div class="settings-section-head">Privacy</div>

              <div class="settings-row">
                <span class="settings-row-label">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>
                  Share anonymous search analytics
                </span>
                <button class="settings-toggle" :class="{ 'settings-toggle--on': analyticsEnabled }" @click="toggleAnalyticsEnabled" role="switch" :aria-checked="String(analyticsEnabled)" aria-label="Share anonymous search analytics">
                  <span class="settings-toggle-knob"></span>
                </button>
              </div>

            </div>
          </Transition>

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
                <span class="op-hint-keycap-pair"><kbd class="op-hint-keycap">↑</kbd><kbd class="op-hint-keycap">↓</kbd></span>
                <kbd class="op-hint-keycap op-hint-keycap--wide">Enter</kbd>
                <kbd class="op-hint-keycap">Esc</kbd>
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

          <!-- Operator cheatsheet — shown when user types a bare ':' as the last query token.  -->
          <!-- Bridges operator discoverability without requiring the user to read docs.         -->
          <Teleport to="body">
            <div
              v-if="operatorCheatsheet"
              class="op-hint-dropdown"
              :style="hintStyle"
              role="tooltip"
              aria-label="Search operator cheatsheet"
              @mousedown.prevent
            >
              <div class="op-hint-header">
                <span class="op-hint-header-label">Search operators</span>
                <span class="op-hint-keycap-pair"><kbd class="op-hint-keycap">↑</kbd><kbd class="op-hint-keycap">↓</kbd></span>
                <kbd class="op-hint-keycap op-hint-keycap--wide">Enter</kbd>
                <kbd class="op-hint-keycap">Esc</kbd>
              </div>
              <button class="op-hint-item op-cs-row" :class="{ 'op-hint-item--active': hintIndex === 0 }" @click="insertOperator('eba:')"    @mouseenter="hintIndex = 0">
                <span class="op-hint-item-primary">eba:</span>
                <span class="op-hint-item-secondary">Filter to one EBA</span>
                <span class="op-cs-examples"><code>nurses</code><code>allied</code></span>
              </button>
              <button class="op-hint-item op-cs-row" :class="{ 'op-hint-item--active': hintIndex === 1 }" @click="insertOperator('topic:')"  @mouseenter="hintIndex = 1">
                <span class="op-hint-item-primary">topic:</span>
                <span class="op-hint-item-secondary">Filter by topic</span>
                <span class="op-cs-examples"><code>wages</code><code>leave</code></span>
              </button>
              <button class="op-hint-item op-cs-row" :class="{ 'op-hint-item--active': hintIndex === 2 }" @click="insertOperator('clause:')" @mouseenter="hintIndex = 2">
                <span class="op-hint-item-primary">clause:</span>
                <span class="op-hint-item-secondary">Find by clause number</span>
                <span class="op-cs-examples"><code>42</code><code>15A</code></span>
              </button>
              <button class="op-hint-item op-cs-row" :class="{ 'op-hint-item--active': hintIndex === 3 }" @click="insertOperator('-')"       @mouseenter="hintIndex = 3">
                <span class="op-hint-item-primary">-word</span>
                <span class="op-hint-item-secondary">Exclude a word</span>
                <span class="op-cs-examples"><code>-casual</code></span>
              </button>
              <button class="op-hint-item op-cs-row" :class="{ 'op-hint-item--active': hintIndex === 4 }" @click="insertOperator('&quot;')"  @mouseenter="hintIndex = 4">
                <span class="op-hint-item-primary">"phrase"</span>
                <span class="op-hint-item-secondary">Match exact phrase</span>
                <span class="op-cs-examples"><code>"ordinary time"</code></span>
              </button>
            </div>
          </Teleport>

          <!-- SEARCH CONTENT -->
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

              <!-- ── Inline AI answer (streamed) — takes over the body when active ── -->
              <div v-if="inlineAnswer" class="inline-answer">
                <button class="inline-answer-back" @click="closeInlineAnswer">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 12H5"/><path d="m12 19-7-7 7-7"/></svg>
                  Back to results
                </button>

                <div class="inline-answer-question">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>
                  <span>{{ inlineQuestion }}</span>
                </div>

                <div class="inline-answer-content">
                  <div v-if="inlineAnswerText" class="inline-answer-text" v-html="renderMarkdown(inlineAnswerText)"></div>
                  <span v-if="inlineAnswerLoading && inlineAnswerText" class="inline-answer-cursor" aria-hidden="true"></span>
                  <div v-if="inlineAnswerLoading && !inlineAnswerText" class="inline-answer-thinking">
                    <span class="ap-dots">Thinking<span>.</span><span>.</span><span>.</span></span>
                  </div>
                </div>

                <div v-if="inlineAnswerError" class="inline-answer-error">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {{ inlineAnswerError }}
                </div>

                <div v-if="inlineAnswerSources.length > 0" class="inline-answer-sources">
                  <div class="inline-answer-sources-head">Sources</div>
                  <a
                    v-for="src in inlineAnswerSources"
                    :key="src"
                    :href="srcToPath(src)"
                    class="inline-answer-source"
                    @click="close"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    {{ srcToLabel(src) }}
                  </a>
                </div>

                <div v-if="!inlineAnswerLoading" class="inline-answer-disclaimer">
                  AI answers are generated from wiki content only. Always verify against the full EBA text before acting.
                </div>
              </div>

              <div v-else-if="loading || skeletonCount > 0" class="search-results search-results--skeleton" aria-busy="true" aria-label="Loading search results">
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
                    :target="resultsNewTab ? '_blank' : null"
                    :rel="resultsNewTab ? 'noopener noreferrer' : null"
                    :data-result-index="index"
                    @click="handleResultClick(result)"
                    @keydown.up.prevent="focusResult(index - 1)"
                    @keydown.down.prevent="focusResult(index + 1)"
                    @keydown.esc="inputRef?.focus()"
                    @mouseenter="setPreview(result, $event)"
                    @mouseleave="clearPreview"
                    @focus="setPreview(result, $event); onResultCardFocus(result.url, $event)"
                    @blur="clearPreview(); onResultCardBlur()"
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
                    <p v-if="result.excerpt || result.meta?.excerpt" class="result-excerpt" v-html="cleanExcerpt(getExcerpt(result))"></p>
                  </a>
                </div>
                <!-- ── Ask AI suggestions (zero results) ────────────────────── -->
                <div v-if="aiSuggestions.length > 0" class="ask-ai-suggestions">
                  <div class="ask-ai-suggestions-header">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>
                    Ask AI Assistant
                  </div>
                  <button
                    v-for="suggestion in aiSuggestions"
                    :key="suggestion"
                    class="ask-ai-suggestion-row"
                    @click="askInline(suggestion)"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>
                    {{ suggestion }}
                  </button>
                </div>
              </div>

              <!-- ── New idle state: Recently Viewed + Bookmarks + Suggested ── -->
              <div v-else-if="query.length <= 1 && !selectedEba && !selectedTopic" class="idle-state">

                <!-- Recent searches -->
                <div v-if="recentSearches.length > 0" class="idle-section">
                  <div class="idle-section-header">
                    Recent Searches
                    <button class="op-pills-clear" @click="clearRecentSearches">Clear all</button>
                  </div>
                  <div class="recent-search-pills">
                    <div
                      v-for="term in recentSearches"
                      :key="term"
                      class="recent-item-wrapper"
                    >
                      <button class="recent-item" @click="runRecentSearch(term)">{{ term }}</button>
                      <button
                        class="recent-delete-btn"
                        title="Remove search"
                        @click.stop="removeRecentSearch(term)"
                      >
                        <span class="vpi-delete delete-icon-mini" aria-hidden="true"></span>
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Recently viewed -->
                <div v-if="recentlyViewed.length > 0" class="idle-section">
                  <div class="idle-section-header">Recently viewed</div>
                  <a
                    v-for="page in recentlyViewed"
                    :key="page.path"
                    :href="page.path"
                    class="idle-row"
                    @click="close"
                    @keydown.up.prevent="focusIdleRow($event.currentTarget, -1)"
                    @keydown.down.prevent="focusIdleRow($event.currentTarget, 1)"
                    @keydown.esc="inputRef?.focus()"
                  >
                    <svg class="idle-row-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                    <span class="idle-row-label">{{ page.title || page.path }}</span>
                    <span v-if="page.eba && ebaSlugLabels[page.eba]" class="idle-row-eba" :style="ebaStyle(ebaSlugToFullName(page.eba))">{{ ebaSlugLabels[page.eba] }}</span>
                  </a>
                </div>

                <!-- Bookmarks (compact — max 3, Option B) -->
                <div v-if="bookmarks.length > 0" class="idle-section">
                  <div class="idle-section-header">
                    My bookmarks
                    <span class="idle-section-count">{{ bookmarks.length }}</span>
                  </div>
                  <a
                    v-for="bm in bookmarks.slice(0, 3)"
                    :key="bm.id"
                    :href="bm.url"
                    class="idle-row idle-row--bm"
                    @click="close"
                    @keydown.up.prevent="focusIdleRow($event.currentTarget, -1)"
                    @keydown.down.prevent="focusIdleRow($event.currentTarget, 1)"
                    @keydown.esc="inputRef?.focus()"
                  >
                    <svg class="idle-row-icon" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>
                    <span class="idle-row-body">
                      <span class="idle-row-label">{{ bm.title }}</span>
                      <span v-if="bm.note" class="idle-row-note">{{ bm.note }}</span>
                    </span>
                    <span v-if="bm.eba" class="idle-row-eba" :style="ebaStyle(bm.eba)">{{ bm.eba.split(' ')[0] }}</span>
                  </a>
                </div>

                <!-- Suggested operator shortcuts -->
                <div class="idle-section" data-tour="operator-hints">
                  <div class="idle-section-header">Suggested</div>
                  <button class="idle-row idle-row--btn" @click="insertOperator('eba:')"
                    @keydown.up.prevent="focusIdleRow($event.currentTarget, -1)"
                    @keydown.down.prevent="focusIdleRow($event.currentTarget, 1)"
                    @keydown.esc="inputRef?.focus()">
                    <svg class="idle-row-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    <span class="idle-row-label">Search across EBAs</span>
                    <code class="idle-row-operator">eba:</code>
                  </button>
                  <button class="idle-row idle-row--btn" @click="insertOperator('topic:')"
                    @keydown.up.prevent="focusIdleRow($event.currentTarget, -1)"
                    @keydown.down.prevent="focusIdleRow($event.currentTarget, 1)"
                    @keydown.esc="inputRef?.focus()">
                    <svg class="idle-row-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"/><line x1="7" y1="7" x2="7.01" y2="7"/></svg>
                    <span class="idle-row-label">Search across topics</span>
                    <code class="idle-row-operator">topic:</code>
                  </button>
                  <button class="idle-row idle-row--btn" @click="insertOperator(':')"
                    @keydown.up.prevent="focusIdleRow($event.currentTarget, -1)"
                    @keydown.down.prevent="focusIdleRow($event.currentTarget, 1)"
                    @keydown.esc="inputRef?.focus()">
                    <svg class="idle-row-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="6" y1="18" x2="18" y2="18"/></svg>
                    <span class="idle-row-label">Advanced search</span>
                    <span class="idle-row-adv-hint" aria-hidden="true">eba: &nbsp;topic: &nbsp;clause:</span>
                  </button>
                </div>

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
                  v-for="(result, index) in visibleResults"
                  :key="result.url"
                  :href="buildHighlightUrl(result)"
                  class="result-card"
                  :class="{ 'result-card-previewing': previewResult?.url === result.url }"
                  :target="resultsNewTab ? '_blank' : null"
                  :rel="resultsNewTab ? 'noopener noreferrer' : null"
                  :data-result-index="index"
                  @click="handleResultClick(result)"
                  @keydown.up.prevent="focusResult(index - 1)"
                  @keydown.down.prevent="focusResult(index + 1)"
                  @keydown.esc="inputRef?.focus()"
                  @mouseenter="setPreview(result, $event)"
                  @mouseleave="clearPreview"
                  @focus="setPreview(result, $event); onResultCardFocus(result.url, $event)"
                  @blur="clearPreview(); onResultCardBlur()"
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
                  <div v-if="result.excerpt || result.meta?.excerpt" class="result-excerpt" v-html="cleanExcerpt(getExcerpt(result))"></div>
                  <div v-if="result.filters?.topics?.length" class="result-topics">
                    <span v-for="t in result.filters.topics" :key="t" class="result-tag">{{ t }}</span>
                  </div>
                  <!-- Match counter badge — shown when this card is focused and has ≥2 marks -->
                  <span
                    v-if="activeCardUrl === result.url && cardMarkCount > 1"
                    class="match-counter"
                    aria-live="polite"
                    :aria-label="`Match ${activeMatchIndex + 1} of ${cardMarkCount}`"
                  >{{ activeMatchIndex + 1 }}<span class="match-counter-sep">/</span>{{ cardMarkCount }}</span>
                </a>

                <!-- View more results -->
                <button
                  v-if="results.length > visibleCount"
                  class="view-more-btn"
                  @click="visibleCount += 5"
                >
                  View more results
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
                </button>

                <!-- Ask AI suggestions (with results) -->
                <div v-if="aiSuggestions.length > 0" class="ask-ai-suggestions">
                  <div class="ask-ai-suggestions-header">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>
                    Ask AI Assistant
                  </div>
                  <button
                    v-for="suggestion in aiSuggestions"
                    :key="suggestion"
                    class="ask-ai-suggestion-row"
                    @click="askInline(suggestion)"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>
                    {{ suggestion }}
                  </button>
                </div>
              </div>

          </div>

          <div v-if="!inlineAnswer" class="search-footer-hint" aria-hidden="true">
            <span class="sfh-item">
              <kbd class="sfh-key">↑</kbd><kbd class="sfh-key">↓</kbd>
              <span class="sfh-label">to navigate</span>
            </span>
            <span class="sfh-sep"></span>
            <span class="sfh-item">
              <kbd class="sfh-key sfh-key--wide">↵</kbd>
              <span class="sfh-label">to select</span>
            </span>
            <span class="sfh-sep"></span>
            <span class="sfh-item">
              <kbd class="sfh-key">←</kbd><kbd class="sfh-key">→</kbd>
              <span class="sfh-label">to cycle matches</span>
            </span>
            <span class="sfh-sep"></span>
            <span class="sfh-item">
              <kbd class="sfh-key sfh-key--wide">esc</kbd>
              <span class="sfh-label">to close</span>
            </span>
          </div>

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
        <!-- Loading shimmer — shown during debounce + fetch -->
        <div v-if="previewLoading" class="preview-shimmer" aria-hidden="true">
          <div class="preview-shimmer-line" style="width: 90%"></div>
          <div class="preview-shimmer-line" style="width: 70%"></div>
          <div class="preview-shimmer-line" style="width: 80%"></div>
          <div class="preview-shimmer-line" style="width: 60%"></div>
          <div class="preview-shimmer-line" style="width: 75%"></div>
        </div>

        <div
          v-else-if="previewHtml"
          class="preview-content vp-doc"
          v-html="highlightedPreviewHtml"
        ></div>

        <!-- Fallback: Pagefind excerpt (dev mode or fetch error) -->
        <template v-else>
          <div v-if="previewResult.excerpt || previewResult.meta?.excerpt" class="preview-excerpt" v-html="cleanExcerpt(getExcerpt(previewResult))"></div>
          <div v-if="previewResult.filters?.topics?.length" class="preview-topics">
            <span v-for="t in previewResult.filters.topics" :key="t" class="result-tag">{{ t }}</span>
          </div>
        </template>
        <a :href="buildHighlightUrl(previewResult)" class="preview-open-link" @click="handleResultClick(previewResult)">
          Open page
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
        </a>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { topicList } from '../../generated/topic-list.mjs'
import { ebaColors, ebaList, ebaSlugLabels, EBA_REGISTRY } from '../eba-registry.js'

// ─── AI Worker URL ────────────────────────────────────────────────────────────
const AI_WORKER_URL = 'https://eba-ask-worker.irresistibl.workers.dev'
const ANALYTICS_WORKER_URL = 'https://eba-analytics-worker.irresistibl.workers.dev'

// ─── Storage keys ─────────────────────────────────────────────────────────────
const SESSION_QUERY_KEY       = 'eba-search-last-query'
const SESSION_EBA_KEY         = 'eba-search-last-eba'
const SESSION_TOPIC_KEY       = 'eba-search-last-topic'
const SESSION_SCROLL_KEY      = 'eba-search-last-scroll'
const LOCAL_BOOKMARKS_KEY     = 'eba-bookmarks'
const LOCAL_RECENTLY_VIEWED_KEY = 'eba-recently-viewed'  // Array<{path,title,eba,timestamp}> max 4
const LOCAL_RECENT_SEARCHES_KEY = 'eba-search-recent-queries'  // Array<string> max 5, localStorage
const SESSION_EBA_CONTEXT_KEY = 'eba-search-eba-context'   // TTL-gated EBA pre-population
const EBA_CONTEXT_TTL_MS      = 30_000                     // 30 seconds
const LOCAL_DEFAULT_EBA_KEY    = 'eba-default-eba'          // Pre-selected EBA on every modal open
const LOCAL_NEW_TAB_KEY        = 'eba-results-new-tab'      // 'true' when results open in new tab
const LOCAL_COMPACT_KEY        = 'eba-compact-results'      // 'true' when compact result density is on
const LOCAL_PREVIEW_KEY        = 'eba-preview-pane'         // 'false' to disable floating preview
const LOCAL_ANALYTICS_KEY      = 'eba-analytics-enabled'    // 'false' to opt out of search logging
const LOCAL_SEARCH_MODE_KEY    = 'eba-search-mode'          // 'exact' for phrase mode; default 'fuzzy'

// ─── Core state ───────────────────────────────────────────────────────────────
const open                = ref(false)
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

// ─── Mobile bottom-sheet state ────────────────────────────────────────────────
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

// ─── Preview page fetch ───────────────────────────────────────────────────────
const previewHtml    = ref(null)
const previewLoading = ref(false)
const previewCache   = new Map()
let   previewFetchTimer = null

// ─── Fuzzy fallback ───────────────────────────────────────────────────────────
const fuzzyResults  = ref([])
const fuzzyQuery    = ref('')
const fuzzyLoading  = ref(false)

// ─── Smart suggestions ("Did you search for…?") ───────────────────────────────
const suggestions = ref([])

// ─── Operator hint autocomplete ───────────────────────────────────────────────
const hintIndex   = ref(-1)
// hintStyle: Teleport position; set reactively when the hint list opens
const hintStyle   = ref({})

const showSettingsPanel  = ref(false)   // true when the gear settings panel is expanded

// ─── General settings refs ────────────────────────────────────────────────────
const defaultEba        = ref('')       // pre-fills EBA filter on open ('' = no default)
const resultsNewTab     = ref(false)    // open result <a> tags with target="_blank"
const compactResults    = ref(false)    // hides excerpts + topic tags in result cards
const previewEnabled    = ref(true)     // floating preview pane on hover/focus (default on)
const analyticsEnabled  = ref(true)     // POST to analytics worker on search (default on)
const searchMode        = ref('fuzzy')  // 'fuzzy' | 'exact' — toggled by the ~/= button
const urlCopied         = ref(false)    // true for 2 s after copy-link — drives ✓ icon state

// ─── Bookmarks (localStorage — persists across sessions) ──────────────────────
const bookmarks = ref([])

// ─── Recently viewed (localStorage — persists across sessions) ────────────────
const recentlyViewed = ref([])

function loadRecentlyViewed() {
  try {
    const raw = localStorage.getItem(LOCAL_RECENTLY_VIEWED_KEY)
    if (raw) recentlyViewed.value = JSON.parse(raw)
  } catch { /* degrade silently */ }
}

// Recent searches (localStorage - pill list, persists across sessions)
const recentSearches = ref([])

function loadRecentSearches() {
  try {
    const raw = localStorage.getItem(LOCAL_RECENT_SEARCHES_KEY)
    if (raw) recentSearches.value = JSON.parse(raw)
  } catch { /* degrade silently */ }
}

function saveRecentSearch(term) {
  const trimmed = (term || '').trim()
  if (trimmed.length < 2) return
  const deduped = recentSearches.value.filter(q => q.toLowerCase() !== trimmed.toLowerCase())
  recentSearches.value = [trimmed, ...deduped].slice(0, 5)
  try {
    localStorage.setItem(LOCAL_RECENT_SEARCHES_KEY, JSON.stringify(recentSearches.value))
  } catch { /* localStorage unavailable or full - degrade silently */ }
}

function removeRecentSearch(term) {
  recentSearches.value = recentSearches.value.filter(q => q !== term)
  try {
    localStorage.setItem(LOCAL_RECENT_SEARCHES_KEY, JSON.stringify(recentSearches.value))
  } catch { /* degrade silently */ }
}

function clearRecentSearches() {
  recentSearches.value = []
  try { localStorage.removeItem(LOCAL_RECENT_SEARCHES_KEY) } catch { /* degrade silently */ }
}

function runRecentSearch(term) {
  query.value = term
  debouncedSearch()
  nextTick(() => inputRef.value?.focus())
}

// ─── EBA slug → full canonical name (for ebaStyle() on recently viewed rows) ──
const ebaNameToSlug = Object.fromEntries(EBA_REGISTRY.map(e => [e.name, e.slug]))

const EBA_SLUG_TO_FULL_NAME = {
  'allied-health':        'Allied Health Professionals 2021-2026',
  'biomedical-engineers': 'Biomedical Engineers 2025-2028',
  'childrens-services':   "Children's Services Award 2010",
  'doctors-in-training':  'Doctors in Training 2022-2026',
  'has-managers-admin':   'Health Allied & Managers Admin 2021-2025',
  'medical-specialists':  'Medical Specialists 2022-2026',
  'mental-health':        'Mental Health Services 2024-2028',
  'mspp':                 'Medical Scientists, Pharm & Psych 2021-2025',
  'nurses-midwives':      'Nurses and Midwives 2024-2028',
}

function ebaSlugToFullName(slug) {
  return EBA_SLUG_TO_FULL_NAME[slug] ?? slug
}

// ─── Progressive results — start at 5, expand by 5 on "View more" ─────────────
const visibleCount = ref(5)

const visibleResults = computed(() => results.value.slice(0, visibleCount.value))

// ─── Match cycling state ──────────────────────────────────────────────────────
const focusedCardEl    = ref(null)  // DOM element of the focused result card
const activeCardUrl    = ref('')    // result.url of the focused card (unique key)
const activeMatchIndex = ref(-1)    // 0-based index of the lit <mark> (-1 = none)
const cardMarkCount    = ref(0)     // total <mark> elements in the focused card

// ─── Inline AI answer state ───────────────────────────────────────────────────
const inlineAnswer        = ref(false)   // controls the answer view
const inlineQuestion      = ref('')      // the question being answered
const inlineAnswerText    = ref('')      // accumulates streamed tokens
const inlineAnswerLoading = ref(false)   // true while the stream is open
const inlineAnswerSources = ref([])      // populated from the terminal SSE event
const inlineAnswerError   = ref('')      // set on stream / fetch failure

watch([query, selectedEba, selectedTopic], () => {
  visibleCount.value = 5
  if (inlineAnswer.value) closeInlineAnswer()
  onResultCardBlur()
})

// ─── Client-side AI question suggestions ──────────────────────────────────────
const aiSuggestions = computed(() => {
  const q = parseQuery(query.value).cleanQuery.trim()
  if (!q || q.length < 3) return []
  const eba = selectedEba.value
  const ebaFrag = eba ? ` under the ${eba}` : ''
  return [
    `Can you tell me about ${q}?`,
    `What are my entitlements regarding ${q}${ebaFrag}?`,
    `How does ${q} apply to casual employees?`,
    `What does the EBA say about ${q}?`,
    `Are there any exceptions to ${q}?`,
  ]
})

// ─── Inline AI answer — stream the answer inside the SearchModal ────
async function askInline(questionText) {
  const q = (questionText || '').trim()
  if (!q) return

  inlineAnswer.value        = true
  inlineQuestion.value      = q
  inlineAnswerText.value    = ''
  inlineAnswerSources.value = []
  inlineAnswerError.value   = ''
  inlineAnswerLoading.value = true

  nextTick(() => { if (resultsContainerRef.value) resultsContainerRef.value.scrollTop = 0 })

  try { logSearch('ask', q, selectedEba.value, selectedTopic.value, 0) } catch { /* non-fatal */ }

  try {
    const res = await fetch(AI_WORKER_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ question: q, stream: true, style: 'detailed' }),
    })
    if (!res.ok || !res.body) throw new Error(`Worker returned ${res.status}`)

    const reader  = res.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const events = buffer.split('\n\n')
      buffer = events.pop()   // keep the trailing incomplete event for the next read
      for (const evt of events) {
        const line = evt.trim()
        if (!line.startsWith('data:')) continue
        const payload = line.slice(5).trim()
        if (!payload) continue
        try {
          const json = JSON.parse(payload)
          if (json.token) {
            inlineAnswerText.value += json.token
          } else if (json.done) {
            inlineAnswerSources.value = Array.isArray(json.sources) ? json.sources : []
          } else if (json.error) {
            inlineAnswerError.value = json.error
          }
        } catch { /* ignore malformed chunk */ }
      }
    }
  } catch (err) {

    if (!inlineAnswerText.value) {
      try {
        const res2 = await fetch(AI_WORKER_URL, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ question: q, style: 'detailed' }),
        })
        if (res2.ok) {
          const data = await res2.json()
          inlineAnswerText.value    = data.answer ?? ''
          inlineAnswerSources.value = Array.isArray(data.sources) ? data.sources : []
          if (!inlineAnswerText.value) inlineAnswerError.value = 'No answer was returned. Please try rephrasing.'
        } else {
          inlineAnswerError.value = `Unable to get an answer (status ${res2.status}). Please try again.`
        }
      } catch {
        inlineAnswerError.value = 'Unable to reach the AI service. Please check your connection and try again.'
      }
    }
  }

  inlineAnswerLoading.value = false
}

function closeInlineAnswer() {
  inlineAnswer.value        = false
  inlineQuestion.value      = ''
  inlineAnswerText.value    = ''
  inlineAnswerSources.value = []
  inlineAnswerError.value   = ''
  inlineAnswerLoading.value = false
}

// Source URL → relative wiki path (for in-app navigation)
function srcToPath(src) {
  try { return new URL(src).pathname.replace(/\.html$/, '') }
  catch { return src }
}

// Source URL → human-readable label, e.g. ".../49-overtime.html" → "Clause 49 — Overtime"
function srcToLabel(src) {
  const path  = srcToPath(src)
  const parts = path.split('/').filter(Boolean)
  const slug  = parts[parts.length - 1] || path
  return slug
    .replace(/^(\d+[a-z]?)-/i, 'Clause $1 \u2014 ')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
}

function loadBookmarks() {
  try {
    const raw = localStorage.getItem(LOCAL_BOOKMARKS_KEY)
    if (raw) bookmarks.value = JSON.parse(raw)
  } catch { /* corrupt storage — degrade silently */ }
}

let searchTimer           = null
let historyTimer          = null
let pagefind              = null
let pagefindInitPromise   = null    // deduplicates concurrent init calls from hover + focus
let _pendingEbaFlash      = false   // set by restoreEbaContext(); consumed by watch(open)

// ─── Smart suggestions: three-dictionary scoring engine ───────────────────────
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
  if (!analyticsEnabled.value) return
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

// ─── EBA colour map ───────────────────────────────────────────────────────────

function ebaStyle(ebaName) {
  const c = ebaColors[ebaName]
  if (!c) return {}
  return { color: c.color, backgroundColor: c.bg, borderColor: c.color + '40' }
}

// ─── General settings ─────────────────────────────────────────────────────────
function saveSetting(key, value) {
  try { localStorage.setItem(key, String(value)) } catch { /* ignore */ }
}

function loadSettings() {
  try {
    const de = localStorage.getItem(LOCAL_DEFAULT_EBA_KEY)
    const nt = localStorage.getItem(LOCAL_NEW_TAB_KEY)
    const cr = localStorage.getItem(LOCAL_COMPACT_KEY)
    const pp = localStorage.getItem(LOCAL_PREVIEW_KEY)
    const ae = localStorage.getItem(LOCAL_ANALYTICS_KEY)
    const sm = localStorage.getItem(LOCAL_SEARCH_MODE_KEY)
    if (de !== null) defaultEba.value       = de
    if (nt !== null) resultsNewTab.value    = nt === 'true'
    if (cr !== null) compactResults.value   = cr === 'true'
    if (pp !== null) previewEnabled.value   = pp !== 'false'
    if (ae !== null) analyticsEnabled.value = ae !== 'false'
    if (sm === 'fuzzy' || sm === 'exact')   searchMode.value = sm
  } catch { /* degrade silently */ }
}

function setDefaultEba(val) {
  defaultEba.value  = val
  selectedEba.value = val   // apply (or clear) the filter immediately — no reopen needed
  saveSetting(LOCAL_DEFAULT_EBA_KEY, val)
  if (query.value.trim().length >= 2) doSearch()   // re-filter live results if a query is active
}

function toggleSearchMode() {
  searchMode.value = searchMode.value === 'fuzzy' ? 'exact' : 'fuzzy'
  saveSetting(LOCAL_SEARCH_MODE_KEY, searchMode.value)
  if (query.value.trim().length >= 2) doSearch()
}
function toggleResultsNewTab()    { resultsNewTab.value    = !resultsNewTab.value;    saveSetting(LOCAL_NEW_TAB_KEY,   resultsNewTab.value)    }
function toggleCompactResults()   { compactResults.value   = !compactResults.value;   saveSetting(LOCAL_COMPACT_KEY,   compactResults.value)   }
function togglePreviewEnabled()   { previewEnabled.value   = !previewEnabled.value;   saveSetting(LOCAL_PREVIEW_KEY,   previewEnabled.value)   }
function toggleAnalyticsEnabled() { analyticsEnabled.value = !analyticsEnabled.value; saveSetting(LOCAL_ANALYTICS_KEY, analyticsEnabled.value) }

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

// ─── Excerpt selector ────────────────────────────────────────────────────────
function getExcerpt(result) {
  if (result?.excerpt && /<mark>/i.test(result.excerpt)) return result.excerpt
  return result?.meta?.excerpt || result?.excerpt || ''
}

// ─── Preview keyword highlighting ────────────────────────────────────────────
function extractHighlightTargets(rawQuery, mode) {
  const { cleanQuery, operators } = parseQuery(rawQuery)

  const bareClean = cleanQuery.replace(/"/g, '').replace(/\s{2,}/g, ' ').trim()

  const phrases = [...operators.phrases]

  if (mode === 'exact' && bareClean && !phrases.includes(bareClean)) {
    phrases.push(bareClean)
  }

  const excludeSet = new Set(operators.exclude.map(w => w.toLowerCase()))
  const words = bareClean
    .split(/\s+/)
    .filter(t => t.length >= 2)
    .filter(t => !excludeSet.has(t.toLowerCase()))

    if (operators.clause && !words.includes(operators.clause)) {
      words.push(operators.clause)
    }

    const filteredWords = phrases.length
      ? words.filter(w => {
          const esc = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          const tokenRe = new RegExp(`(?:^|\\s)${esc}(?:\\s|$)`, 'i')
          return !phrases.some(p => tokenRe.test(p))
        })
      : words

    return { phrases, words: filteredWords }
  }

function highlightTermsInHtml(html, phrases, words) {
  if (!html) return html
  const allTerms = [
    ...phrases
      .sort((a, b) => b.length - a.length)           // longest phrase first
      .map(p => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
    ...words
      .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
  ]
  if (!allTerms.length) return html
  const re = new RegExp(`(<[^>]*>)|(${allTerms.join('|')})`, 'gi')
  return html.replace(re, (match, tag) => tag ? tag : `<mark class="preview-mark">${match}</mark>`)
}

const highlightedPreviewHtml = computed(() => {
  if (!previewHtml.value) return null
  const { phrases, words } = extractHighlightTargets(query.value, searchMode.value)
  return highlightTermsInHtml(previewHtml.value, phrases, words)
})

// ─── Preview pane ────────────────────────────────────────────────────────────
function setPreview(result, event) {
  if (!previewEnabled.value) return
  clearTimeout(previewHideTimer)
  clearTimeout(previewFetchTimer)
  previewKeep = false
  if (window.innerWidth < 900) return
  const modal = modalRef.value?.getBoundingClientRect()
  if (!modal) return
  const left  = modal.right + 12
  const right = window.innerWidth - left
  if (right < 280) return
  const card  = event?.currentTarget?.getBoundingClientRect?.() ?? null
  const top   = card ? Math.min(card.top, window.innerHeight - 400) : modal.top
  const width = Math.min(380, right - 16)
  previewStyle.value = {
    left:      `${left}px`,
    top:       `${Math.max(80, top)}px`,
    width:     `${width}px`,
    maxHeight: `${window.innerHeight - Math.max(80, top) - 24}px`,
  }
  previewResult.value  = result
  previewVisible.value = true

  // Reset fetch state for this card
  previewHtml.value    = null
  previewLoading.value = false

  // Cache hit — no network needed
  const url = result.url
  if (previewCache.has(url)) {
    previewHtml.value = previewCache.get(url)
    return
  }

  // Debounce: only fetch if user hovers > 200ms — prevents flood on fast scanning
  previewLoading.value = true
  previewFetchTimer = setTimeout(() => fetchPreviewHtml(url), 200)
}

function clearPreview() {
  if (previewKeep) return
  clearTimeout(previewFetchTimer)
  previewHideTimer = setTimeout(() => {
    if (!previewKeep) {
      previewVisible.value = false
      previewResult.value  = null
      previewHtml.value    = null
      previewLoading.value = false
    }
  }, 120)
}

// ─── Preview page fetch ───────────────────────────────────────────────────────
async function fetchPreviewHtml(url) {

  if (!previewVisible.value || previewResult.value?.url !== url) {
    previewLoading.value = false
    return
  }
  try {
    const fetchUrl = url.replace(/\/$/, '').replace(/\.html$/, '')
    const res      = await fetch(fetchUrl)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)

    const parser = new DOMParser()
    const doc    = parser.parseFromString(await res.text(), 'text/html')
    const vpDoc  = doc.querySelector('.vp-doc')

    if (!vpDoc) {

      previewLoading.value = false
      return
    }

    vpDoc.querySelectorAll([
      '[class*="vp-nolebase-git-changelog"]',
      '.related-clauses-panel',
      '.legislation-panel',
      '.doc-toolbar',
    ].join(',')).forEach(el => el.remove())

    const allH2s = [...vpDoc.querySelectorAll('h2')]
    const lastH2 = allH2s[allH2s.length - 1]
    if (lastH2 && /changelog/i.test(lastH2.textContent)) lastH2.remove()

    vpDoc.querySelector('h1')?.remove()

    const html = vpDoc.innerHTML

    if (previewResult.value?.url !== url) {
      previewLoading.value = false
      return
    }

    previewCache.set(url, html)
    previewHtml.value    = html
    previewLoading.value = false
  } catch {

    previewLoading.value = false
  }
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
    if (savedQuery)  query.value         = savedQuery
    if (savedEba)    selectedEba.value   = savedEba
    if (savedTopic)  selectedTopic.value = savedTopic
    // Apply default EBA whenever the modal opens with no active EBA filter.
    if (defaultEba.value && !selectedEba.value) {
      selectedEba.value = defaultEba.value
    }
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

// ─── Keyboard navigation ──────────────────────────────────────────────────────

// focusResult — used by result cards AND (via the updated selector) idle rows.
// Pressing ↓ from the search input calls focusResult(0) in both states.
function focusResult(index) {
  nextTick(() => {
    const cards = resultsContainerRef.value?.querySelectorAll('.result-card, .idle-row')
    if (!cards?.length) return
    const target = cards[Math.max(0, Math.min(index, cards.length - 1))]
    target?.focus()
  })
}

// ─── Match cycling ────────────────────────────────────────────────────────────

// onResultCardFocus — called when any result card receives keyboard focus.
// Waits one tick (so the :focus-visible CSS has reflowed the unclamped excerpt)
// then finds all <mark> elements, highlights the first one, and stores state.
function onResultCardFocus(resultUrl, event) {
  focusedCardEl.value = event.currentTarget
  activeCardUrl.value = resultUrl
  nextTick(() => {
    const marks = [...(focusedCardEl.value?.querySelectorAll('mark') ?? [])]
    cardMarkCount.value = marks.length
    marks.forEach((m, i) => m.classList.toggle('mark--active', i === 0))
    activeMatchIndex.value = marks.length > 0 ? 0 : -1
  })
}

// onResultCardBlur — strips mark--active styling and clears all cycling state.
function onResultCardBlur() {
  focusedCardEl.value?.querySelectorAll('mark.mark--active')
    .forEach(m => m.classList.remove('mark--active'))
  focusedCardEl.value  = null
  activeCardUrl.value  = ''
  activeMatchIndex.value = -1
  cardMarkCount.value  = 0
}

function cycleMatch(delta) {
  if (!focusedCardEl.value) return
  const marks = [...focusedCardEl.value.querySelectorAll('mark')]
  if (marks.length < 2) return
  marks[activeMatchIndex.value]?.classList.remove('mark--active')
  activeMatchIndex.value = (activeMatchIndex.value + delta + marks.length) % marks.length
  const mark = marks[activeMatchIndex.value]
  mark.classList.add('mark--active')

  mark.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

function focusIdleRow(el, delta) {
  nextTick(() => {
    const rows = [...(resultsContainerRef.value?.querySelectorAll('.idle-row') ?? [])]
    const current = rows.indexOf(el)
    if (current === -1) return
    const next = current + delta
    if (next < 0) { inputRef.value?.focus(); return }
    const target = rows[Math.min(next, rows.length - 1)]
    target?.focus()
  })
}

function trapFocus(e) {
  if (e.key !== 'Tab') return
  const modal = modalRef.value
  if (!modal) return
  const focusable = [...modal.querySelectorAll(
    'button:not([disabled]):not([tabindex="-1"]), ' +
    'input:not([disabled]):not([tabindex="-1"]), ' +
    'select:not([disabled]):not([tabindex="-1"]), ' +
    'a[href]:not([tabindex="-1"]), ' +
    '[tabindex]:not([tabindex="-1"])'
  )].filter(el => !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length))
  if (!focusable.length) return
  const first = focusable[0]
  const last  = focusable[focusable.length - 1]
  if (e.shiftKey) {
    if (document.activeElement === first) { e.preventDefault(); last.focus() }
  } else {
    if (document.activeElement === last)  { e.preventDefault(); first.focus() }
  }
}

// ─── Pagefind prefetch + lazy init ───────────────────────────────────────────

function prefetchPagefind() {

  if (typeof document === 'undefined') return

  if (!document.querySelector('link[rel="modulepreload"][href="/pagefind/pagefind.js"]')) {
    const ml = document.createElement('link')
    ml.rel  = 'modulepreload'
    ml.href = '/pagefind/pagefind.js'
    document.head.appendChild(ml)
  }

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

  if (pagefind) return

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
        ranking: { pageLength: 0.72, termFrequency: 1.0, termSimilarity: 0.9, termSaturation: 1.3 }
      })
    } catch {
      console.warn('Pagefind not available — run npm run docs:index first.')
    }
  })()

  await pagefindInitPromise
}

onMounted(() => {
  loadBookmarks()
  loadRecentlyViewed()
  loadRecentSearches()
  loadSettings()
  updateMobileSheet()
  if (typeof window !== 'undefined') {
    if (window.visualViewport) window.visualViewport.addEventListener('resize', onVisualViewportResize)
    const p = new URLSearchParams(window.location.search)
    if (p.has('q') || p.has('eba') || p.has('topic')) nextTick(() => openModal())
    // Idle-time init; Safari <16.4 fallback to setTimeout.
    if ('requestIdleCallback' in window) {
      requestIdleCallback(() => initPagefind(), { timeout: 3000 })
    } else {
      setTimeout(() => initPagefind(), 2000)
    }
  }
  prefetchPagefind()
  window.addEventListener('resize', updateMobileSheet)
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('open-search', openFromExternal)
  window.addEventListener('close-search', close)
  window.addEventListener('eba-bookmarks-updated', loadBookmarks)
})

function openFromExternal(e) {
  const detail = e?.detail ?? {}
  const { eba = '', topic = '' } = detail
  selectedEba.value   = eba
  selectedTopic.value = topic
  open.value = true
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

  initPagefind()
  loadRecentlyViewed()   // refresh from localStorage so newly-visited pages appear
  open.value = true
  nextTick(() => {
    loadPersistedState()

    if (readUrlParams()) nextTick(() => doSearch())
    if (!isMobileSheet.value) inputRef.value?.focus()
  })
}

// ─── TTL-gated EBA context restore ───────────────────────────────────────────
function restoreEbaContext() {
  try {
    const raw = sessionStorage.getItem(SESSION_EBA_CONTEXT_KEY)
    if (!raw) return
    const { eba, ts } = JSON.parse(raw)
    if (!eba || (Date.now() - ts) > EBA_CONTEXT_TTL_MS) return

    if (selectedEba.value && selectedEba.value !== eba) return
    selectedEba.value = eba
    _pendingEbaFlash  = true
  } catch { /* corrupt entry — degrade silently */ }
}

// ─── URL param state ──────────────────────────────────────────────────────────

// readUrlParams() — reads ?q=, ?eba=, ?topic= from the current URL, applies them
// to reactive state (overriding sessionStorage), then strips the params via
// history.replaceState so they are consumed exactly once per navigation.
// Returns true when any param was found.
function readUrlParams() {
  if (typeof window === 'undefined') return false
  const params = new URLSearchParams(window.location.search)
  const q      = params.get('q')
  const eba    = params.get('eba')
  const topic  = params.get('topic')
  if (!q && !eba && !topic) return false
  if (q)     query.value         = q
  if (eba)   selectedEba.value   = EBA_SLUG_MAP[eba] ?? eba
  if (topic) selectedTopic.value = topic

  const clean = window.location.pathname + window.location.hash
  window.history.replaceState({}, '', clean)
  return true
}

function buildShareUrl() {
  const params = new URLSearchParams()
  if (query.value.trim())  params.set('q',     query.value.trim())
  if (selectedEba.value)   params.set('eba',   ebaNameToSlug[selectedEba.value] ?? selectedEba.value)
  if (selectedTopic.value) params.set('topic', selectedTopic.value)
  const qs = params.toString()
  return `${window.location.origin}/${qs ? '?' + qs : ''}`
}

async function copySearchLink() {
  try {
    await navigator.clipboard.writeText(buildShareUrl())
    urlCopied.value = true
    setTimeout(() => { urlCopied.value = false }, 2000)
  } catch { /* clipboard API blocked — degrade silently */ }
}

watch(open, async (val) => {
  if (val) {
    await nextTick()
    if (!isMobileSheet.value) inputRef.value?.focus()
    document.body.style.overflow = 'hidden'

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

  const newValue = selectedEba.value === ebaName ? '' : ebaName
  selectedEba.value = newValue

  if (query.value.trim().length > 0) doSearch()

  ebaFilterFlash.value = true
  setTimeout(() => { ebaFilterFlash.value = false }, 400)
}

function onKeydown(e) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
    e.preventDefault()

    if (open.value) close()
    window.dispatchEvent(new CustomEvent('open-ask-panel'))
  }
  if (e.key === '/' && !open.value && document.activeElement.tagName !== 'INPUT') {
    e.preventDefault()
    openModal()
  }
  if (e.key === 'Escape' && open.value) close()

  // ── Shift+F1–F9: EBA filter shortcuts ───────────────────────────────────────
  if (e.shiftKey && !e.ctrlKey && !e.metaKey && !e.altKey && open.value) {
    const codeMatch = e.code.match(/^F([1-9])$/)
    if (codeMatch) {
      e.preventDefault()
      applyEbaShortcut(EBA_SHORTCUT_LIST[parseInt(codeMatch[1], 10) - 1])
    }
  }

  // ── ArrowLeft/Right: cycle marks on the focused result card ─────────────────
  if (
    open.value &&
    !operatorHint.value &&
    !operatorCheatsheet.value &&
    document.activeElement?.classList.contains('result-card')
  ) {
    if (e.code === 'ArrowLeft') {
      e.preventDefault()
      cycleMatch(-1)
    }
    if (e.code === 'ArrowRight') {
      e.preventDefault()
      cycleMatch(1)
    }
  }
}

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
  onResultCardBlur()
  open.value              = false
  showSettingsPanel.value = false
  previewVisible.value    = false
  previewResult.value     = null
  closeInlineAnswer()
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

  working = working.replace(/"([^"]+)"/g, (match, phrase) => {
    if (phrase.trim().length > 0) ops.phrases.push(phrase.trim())
    return match // keep in working string — Pagefind understands "..."
  })

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

  working = working.replace(/\bclause:(\w+)/gi, (_, num) => {
    ops.clause = num
    return ''
  })

  working = working.replace(/(?:^|\s)-([a-zA-Z]\w*)/g, (_, word) => {
    ops.exclude.push(word.toLowerCase())
    return ' '
  })

  const cleanQuery = working.replace(/\s{2,}/g, ' ').trim()

  ops.hasPills = !!(ops.eba || ops.topic || ops.clause || ops.exclude.length || ops.phrases.length)

  return { cleanQuery, operators: ops }
}

// ─── Title-match relevance scorer ─────────────────────────────────────────────
function computeTitleScore(result, queryWords) {
  if (!queryWords.length) return 0
  const rawTitle = result.meta?.title || ''
  if (!rawTitle) return 0
  const title = rawTitle.toLowerCase()

  const titleContent = title.replace(/^\d+[a-z]*[.\s]+/i, '')

  const titleWords = titleContent.split(/[\s/\-,().]+/).filter(w => w.length >= 3)
  if (titleWords.length === 0) return 0

  const matchCount = queryWords.filter(qw => {
    const escaped = qw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`\\b${escaped}`, 'i').test(title)
  }).length

  if (matchCount === 0) return 0

  const specificity = matchCount / titleWords.length
  const allPresent  = (matchCount === queryWords.length) ? 1 : 0

  return (specificity * 2) + allPresent
}

// ─── Computed: reactively parse operators as user types ───────────────────────
const parsedOperators = computed(() => {
  return parseQuery(query.value).operators
})

// ─── Pill: EBA brand colour style ────────────────────────────────────────────
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
const operatorHint = computed(() => {
  const raw   = query.value
  if (!raw) return null

  // Split on whitespace; examine the last token only (tail-only trigger)
  const tokens    = raw.split(/\s+/)
  const lastToken = tokens[tokens.length - 1]

  // ── eba: hint ──────────────────────────────────────────────────────────────
  const ebaMatch = lastToken.match(/^eba:(.*)$/i)
  if (ebaMatch) {
    const fragment = ebaMatch[1].toLowerCase()

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

// ─── Cheatsheet operator definitions (index matches rendered row order) ────────
const CHEATSHEET_OPS = [
  { prefix: 'eba:'    },
  { prefix: 'topic:'  },
  { prefix: 'clause:' },
  { prefix: '-'       },
  { prefix: '"'       },
]

// ─── Operator cheatsheet — triggered by a bare ':' as the last query token ───
const operatorCheatsheet = computed(() => {
  if (operatorHint.value !== null)  return false   // specific hint takes priority
  const raw = query.value
  if (!raw) return false
  const tokens = raw.split(/\s+/)
  return tokens[tokens.length - 1] === ':'
})

// ─── Position the hint dropdown below the search input ───────────────────────
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

// ─── Insert an operator prefix from the cheatsheet ───────────────────────────
function insertOperator(prefix) {
  const tokens = query.value.split(/\s+/)
  tokens[tokens.length - 1] = prefix
  query.value = tokens.join(' ').trimStart()
  nextTick(() => inputRef.value?.focus())
}

// ─── Dismiss the cheatsheet by removing the trailing ':' token ───────────────
function dismissCheatsheet() {
  const tokens = query.value.split(/\s+/)
  if (tokens[tokens.length - 1] === ':') {
    tokens.pop()
    query.value = tokens.join(' ').trim()
  }
  nextTick(() => inputRef.value?.focus())
}

// ─── Watch operatorHint + operatorCheatsheet — reposition whenever either opens
watch([operatorHint, operatorCheatsheet], ([hint, sheet]) => {
  if (hint || sheet) {
    hintIndex.value = -1
    nextTick(positionHint)
  }
})

// ─── Dismiss an operator token from the raw query string ─────────────────────
function dismissOperator(type, value) {
  let q = query.value
  if (type === 'eba') {

    q = q.replace(/\beba:\S+/gi, '')
  } else if (type === 'topic') {
    q = q.replace(/\btopic:\S+/gi, '')
  } else if (type === 'clause') {
    q = q.replace(/\bclause:\w+/gi, '')
  } else if (type === 'exclude') {

    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    q = q.replace(new RegExp(`(?:^|\\s)-${escaped}(?=\\s|$)`, 'gi'), ' ')
  } else if (type === 'phrase') {

    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    q = q.replace(new RegExp(`"${escaped}"`, 'g'), '')
  }
  query.value = q.replace(/\s{2,}/g, ' ').trim()
  doSearch()
  nextTick(() => inputRef.value?.focus())
}

// ─── Dismiss a single dropdown filter ────────────────────────────────────────
function dismissDropdown(type) {
  if (type === 'eba')   selectedEba.value   = ''
  if (type === 'topic') selectedTopic.value = ''
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

  selectedEba.value   = ''
  selectedTopic.value = ''
  doSearch()
  nextTick(() => inputRef.value?.focus())
}

// ─── Search ───────────────────────────────────────────────────────────────────
function warmupSearch() {
  const fragment = query.value.trim()
  if (!pagefind || fragment.length < 2) return
  pagefind.search(fragment.slice(0, 3)).catch(() => {})
}

// ── Clear query button ────────────────────────────────────────────────────
// Resets the query input, triggers a fresh (empty) search so the Quick
// Access panel is shown, and returns focus to the input.
function clearQuery() {
  query.value = ''
  debouncedSearch()
  nextTick(() => inputRef.value?.focus())
}

function debouncedSearch() {
  clearTimeout(searchTimer)

  const len   = query.value.trim().length
  const delay = len >= 6 ? 120 : len >= 3 ? 220 : 380
  searchTimer = setTimeout(doSearch, delay)

  // Recent searches use a separate, longer debounce so only a query the
  // user has actually paused on gets saved — not every intermediate
  // keystroke the fast live-search debounce above reacts to.
  clearTimeout(historyTimer)
  historyTimer = setTimeout(() => {
    const { cleanQuery } = parseQuery(query.value)
    saveRecentSearch(cleanQuery || query.value)
  }, 900)
}

async function doSearch() {
  fuzzyResults.value = []
  fuzzyQuery.value   = ''
  suggestions.value  = []

  const { cleanQuery, operators } = parseQuery(query.value)

  // Promote eba:/topic: operators to dropdown equivalents
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

  if (!pagefind || (cleanQuery.length < 2 && !operators.clause && !selectedEba.value && !selectedTopic.value)) {
    results.value = []
    return
  }

  loading.value    = true
  skeletonCount.value = 0   // reset before new search

  // Build filter object
  const filters = {}
  const activeEba   = selectedEba.value   || null
  const activeTopic = selectedTopic.value || null
  if (activeEba)   filters.eba    = activeEba
  if (activeTopic) filters.topics = activeTopic

  // Build Pagefind query string
  let pfQuery = operators.clause
    ? [operators.clause, cleanQuery].filter(Boolean).join(' ')
    : cleanQuery || null
  if (searchMode.value === 'exact' && pfQuery && !operators.clause) {
    const alreadyQuoted = pfQuery.startsWith('"') && pfQuery.endsWith('"')
    if (!alreadyQuoted) pfQuery = `"${pfQuery}"`
  }

  try {
    const search = await pagefind.search(pfQuery, { filters, excerptLength: 45 })

    const stubSlice = search.results.slice(0, 12)
    skeletonCount.value = stubSlice.length
    loading.value       = false

    // Exact phrase boost — run in parallel
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

    // Post-filter: -exclude words
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

    // Title-match re-ranking
    if (!isFilterOnly && cleanQuery.trim().length >= 2) {
      const queryWords = cleanQuery.toLowerCase()
        .split(/\s+/)
        .filter(w => w.length >= 3)

      if (queryWords.length > 0) {
        filtered.sort((a, b) => {
          const aExact = exactIds.has(a.url) ? 1 : 0
          const bExact = exactIds.has(b.url) ? 1 : 0
          if (aExact !== bExact) return bExact - aExact
          return computeTitleScore(b, queryWords) - computeTitleScore(a, queryWords)
        })
      }
    }

    // Result diversification (MAX_PER_EBA per EBA in top DIVERSITY_WINDOW)
    const MAX_PER_EBA      = 2
    const DIVERSITY_WINDOW = 8
    if (!isFilterOnly && !activeEba && filtered.length > MAX_PER_EBA) {
      const ebaCounts = {}
      const topSlice  = []
      const spillover = []
      for (const r of filtered) {
        const eba   = r.filters?.eba?.[0] || '__unknown__'
        const count = ebaCounts[eba] || 0
        if (topSlice.length < DIVERSITY_WINDOW && count < MAX_PER_EBA) {
          topSlice.push(r)
          ebaCounts[eba] = count + 1
        } else {
          spillover.push(r)
        }
      }
      filtered = [...topSlice, ...spillover]
    }

    results.value = filtered

    suggestions.value = cleanQuery.trim().length >= 4
      ? buildSuggestions(query.value, results.value.length, operators)
      : []

    if (results.value.length === 0 && cleanQuery.trim().length > 3 && searchMode.value !== 'exact') {
      await runFuzzyFallback(cleanQuery.trim(), filters)
    }

    logSearch('search', cleanQuery || query.value, activeEba || '', activeTopic || '', results.value.length)
  } catch (err) {
    results.value       = []
    skeletonCount.value = 0

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
      const search = await pagefind.search(candidate, { filters, excerptLength: 45 })
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
function buildHighlightUrl(result) {
  const baseUrl = result.url
  if (!baseUrl) return baseUrl ?? ''

  const seen  = new Set()
  const words = []

  function addWords(str) {
    if (!str) return
    str.trim().split(/\s+/).forEach(w => {

      const clean = w.replace(/[^a-zA-Z0-9]/g, '')
      if (clean.length >= 3 && !seen.has(clean.toLowerCase())) {
        seen.add(clean.toLowerCase())
        words.push(clean)
      }
    })
  }

  const { operators } = parseQuery(query.value)
  operators.phrases.forEach(phrase => addWords(phrase))

  const { cleanQuery } = parseQuery(query.value)
  addWords(cleanQuery)

  if (fuzzyQuery.value && fuzzyResults.value.some(r => r.url === result.url)) {
    addWords(fuzzyQuery.value)
  }

  if (words.length === 0) return baseUrl

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
  persistState()
  close()
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
.search-trigger-kbd  { margin-left: auto; display: inline-flex; align-items: center; }
.search-trigger-kbd .kbd-slash {
  display:         inline-flex;
  align-items:     center;
  justify-content: center;
  min-width:       1.5em;
  padding:         0.1em 0.3em;
  font-family:     var(--vp-font-family-mono);
  font-size:       0.72rem;
  font-weight:     700;
  line-height:     1;
  color:           var(--vp-c-text-3);
  background:      var(--vp-c-bg);
  border:          1px solid var(--vp-c-divider);
  border-radius:   4px;
  box-shadow:      0 1px 0 0 var(--vp-c-divider);
}
@media (max-width: 767px) {
  .search-trigger { width: auto; padding: 0.4rem; }
  .search-trigger-text, .search-trigger-kbd { display: none; }
}

/* ── Overlay ── */
.search-overlay {
  position: fixed; inset: 0; z-index: 9999;
  background: oklch(0 0 0 / 0.55);
  display: flex; align-items: flex-start; justify-content: center;
  padding-top: 68px;
}

/* ── Modal box ── */
.search-modal {
  width: min(640px, calc(100vw - 2rem));
  max-height: calc(100vh - 88px);
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
.filter-group select:focus-visible {
  outline: 2px solid var(--vp-c-brand-1);
  outline-offset: 2px;
  border-color: var(--vp-c-brand-1);
}
.filter-group:focus-within > label {
  color: var(--vp-c-brand-1);
}

/* ── Body ── */
.search-body { flex: 1; overflow-y: auto; padding: 0.75rem 1rem; }
.search-status { text-align: center; color: var(--vp-c-text-2); padding: 2rem 0; }
/* ── Fuzzy suggestion ── */
.fuzzy-suggestion { font-size: 0.82rem; color: var(--vp-c-text-3); margin-top: 0.75rem; margin-bottom: 0.5rem; }
.fuzzy-results { opacity: 0.92; }

@keyframes qa-skeleton-pulse {
  0%, 100% { opacity: 1;   }
  50%       { opacity: 0.35; }
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
  position: relative; /* required by .match-counter absolute positioning */
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

/* When a card is keyboard-focused, remove the 3-line clamp so all marks are
   visible and reachable via ←/→ cycling. Returns to clamped on blur via CSS. */
.result-card:focus-visible .result-excerpt {
  display:           block;
  -webkit-line-clamp: unset;
  line-clamp:        unset;
  overflow:          visible;
}

.result-excerpt :deep(mark),
.preview-excerpt :deep(mark) {
  background: oklch(0.88 0.1 75 / 0.45);
  color: inherit; border-radius: 2px; padding: 0 2px;
}

/* Active mark — visually distinct from passive marks during cycling */
.result-excerpt :deep(mark.mark--active) {
  background: oklch(0.78 0.18 70 / 0.72);
  outline:    1.5px solid oklch(0.58 0.20 70 / 0.7);
  border-radius: 2px;
}

/* Match counter badge — absolute top-right of the focused card */
.match-counter {
  position:       absolute;
  top:            0.5rem;
  right:          0.5rem;
  font-size:      0.65rem;
  font-family:    var(--vp-font-family-mono);
  font-weight:    600;
  color:          var(--vp-c-text-3);
  background:     var(--vp-c-bg-mute);
  border:         1px solid var(--vp-c-divider);
  border-radius:  4px;
  padding:        0.1rem 0.4rem;
  line-height:    1.4;
  pointer-events: none;
  user-select:    none;
  white-space:    nowrap;
}
.match-counter-sep {
  margin:  0 0.15rem;
  opacity: 0.4;
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

/* ══════════════════════════════════════════════════════════════════════════════
   SETTINGS PANEL — gear icon, slide-down panel, toggle switch, consent banner
   ══════════════════════════════════════════════════════════════════════════════ */

/* ── Gear button ─────────────────────────────────────────────────────────────── */
.settings-gear-btn {
  display:         flex;
  align-items:     center;
  justify-content: center;
  width:           28px;
  height:          28px;
  flex-shrink:     0;
  padding:         0;
  border:          none;
  background:      transparent;
  color:           var(--vp-c-text-3);
  cursor:          pointer;
  border-radius:   6px;
  transition:      color 0.15s, background 0.15s, transform 0.25s ease;
}
.settings-gear-btn:hover  { color: var(--vp-c-text-1); }
.settings-gear-btn--active {
  color:      var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
  transform:  rotate(60deg);
}

/* Clear query button */
.clear-query-btn {
  flex-shrink:     0;
  display:         flex;
  align-items:     center;
  justify-content: center;
  width:           26px;
  height:          26px;
  padding:         0;
  background:      none;
  border:          none;
  border-radius:   50%;
  color:           var(--vp-c-text-3);
  opacity:         0.35;
  cursor:          default;
  pointer-events:  none;
  transition:      opacity 0.15s, color 0.15s;
}
.clear-query-btn--active {
  opacity:        1;
  cursor:         pointer;
  pointer-events: auto;
}
.clear-query-btn--active:hover {
  color: var(--vp-c-text-1);
}
.clear-query-btn .vpi-delete {
  display:     block;
  width:       16px;
  height:      16px;
  flex-shrink: 0;
}

/* ── Search mode toggle (~ fuzzy / = exact) ─────────────────────────────────── */
.search-mode-btn {
  flex-shrink:     0;
  display:         flex;
  align-items:     center;
  justify-content: center;
  width:           26px;
  height:          26px;
  padding:         0;
  background:      none;
  border:          none;
  border-radius:   5px;
  color:           var(--vp-c-text-3);
  cursor:          pointer;
  font-family:     var(--vp-font-family-mono);
  font-size:       1.1rem;
  font-weight:     700;
  line-height:     1;
  transition:      color 0.15s, background 0.15s;
}
.search-mode-btn:hover {
  color:      var(--vp-c-text-1);
  background: var(--vp-c-bg-mute);
}
.search-mode-btn--exact {
  color:      var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}
.search-mode-btn--exact:hover {
  background: var(--vp-c-brand-soft);
}

/* ── Copy search link button ─────────────────────────────────────────────────── */
.copy-link-btn {
  display:         flex;
  align-items:     center;
  justify-content: center;
  width:           28px;
  height:          28px;
  flex-shrink:     0;
  padding:         0;
  border:          none;
  background:      transparent;
  color:           var(--vp-c-text-3);
  cursor:          pointer;
  border-radius:   6px;
  transition:      color 0.15s, background 0.15s;
}
.copy-link-btn:hover            { color: var(--vp-c-text-1); background: var(--vp-c-bg-mute); }
.copy-link-btn--copied          { color: #16a34a; }
.dark .copy-link-btn--copied    { color: #4ade80; }

/* ── Settings panel slide transition ─────────────────────────────────────────── */
.settings-panel-enter-active,
.settings-panel-leave-active {
  transition: max-height 0.2s ease, opacity 0.18s ease;
  overflow:   hidden;
}
.settings-panel-enter-from,
.settings-panel-leave-to  { max-height: 0;     opacity: 0; }
.settings-panel-enter-to,
.settings-panel-leave-from { max-height: 360px; opacity: 1; }

/* ── Settings panel container ───────────────────────────────────────────────── */
.search-settings-panel {
  border-bottom:  1px solid var(--vp-c-divider);
  background:     var(--vp-c-bg-soft);
  padding:        0.45rem 0.9rem;
}

/* ── Individual settings row (reusable for future settings) ─────────────────── */
.settings-row {
  display:     flex;
  align-items: center;
  gap:         0.6rem;
  min-height:  32px;
  padding:     0.18rem 0;
}

.settings-row-label {
  display:     flex;
  align-items: center;
  gap:         0.4rem;
  flex:        1;
  font-size:   0.78rem;
  color:       var(--vp-c-text-2);
  user-select: none;
}

/* ── Toggle switch (pure CSS, no library) ───────────────────────────────────── */
.settings-toggle {
  position:      relative;
  width:         32px;
  height:        18px;
  flex-shrink:   0;
  padding:       0;
  border:        none;
  border-radius: 9px;
  background:    var(--vp-c-divider);
  cursor:        pointer;
  transition:    background 0.2s;
}
.settings-toggle--on               { background: var(--vp-c-brand-1); }
.settings-toggle:focus-visible     { outline: 2px solid var(--vp-c-brand-1); outline-offset: 2px; }

.settings-toggle-knob {
  position:       absolute;
  top:            2px;
  left:           2px;
  width:          14px;
  height:         14px;
  border-radius:  50%;
  background:     #fff;
  box-shadow:     0 1px 3px rgba(0,0,0,0.2);
  transition:     transform 0.2s;
  pointer-events: none;
}
.settings-toggle--on .settings-toggle-knob { transform: translateX(14px); }

/* ── Settings section heading ────────────────────────────────────────────────── */
.settings-section-head {
  font-size:      0.68rem;
  font-weight:    600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color:          var(--vp-c-text-3);
  padding:        0.5rem 0 0.2rem;
  margin-top:     0.3rem;
  border-top:     1px solid var(--vp-c-divider);
}
.search-settings-panel > .settings-section-head:first-child {
  border-top:  none;
  margin-top:  0;
  padding-top: 0.1rem;
}

/* ── Settings select (Default EBA dropdown) ──────────────────────────────────── */
.settings-select {
  font-size:     0.75rem;
  padding:       0.22rem 0.4rem;
  border:        1px solid var(--vp-c-divider);
  border-radius: 5px;
  background:    var(--vp-c-bg);
  color:         var(--vp-c-text-1);
  max-width:     190px;
  cursor:        pointer;
  flex-shrink:   0;
}
.settings-select:focus { outline: 2px solid var(--vp-c-brand-1); outline-offset: 1px; }

/* ── Compact results mode ────────────────────────────────────────────────────── */
.search-modal--compact .result-excerpt,
.search-modal--compact .result-topics  { display: none; }
.search-modal--compact .result-card    { padding-bottom: 0.5rem; }

/* ══════════════════════════════════════════════════════════════════════════════
   PHASE 1 REDESIGN — Idle state, AI suggestions, View more
══════════════════════════════════════════════════════════════════════════════ */

/* ── Idle state container ──────────────────────────────────────────────────── */
.idle-state {
  padding: 0.25rem 0 0.5rem;
}

/* ── Idle section ──────────────────────────────────────────────────────────── */
.idle-section {
  padding: 0.1rem 0 0.1rem;
  border-bottom: 1px solid var(--vp-c-divider);
}
.idle-section:last-child { border-bottom: none; }

.idle-section-header {
  display:        flex;
  align-items:    center;
  gap:            0.4rem;
  font-size:      0.7rem;
  font-weight:    600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color:          var(--vp-c-text-3);
  padding:        0.4rem 1rem 0.15rem;
}

.idle-section-count {
  margin-left:   auto;
  font-size:     0.68rem;
  font-weight:   500;
  color:         var(--vp-c-text-3);
  background:    var(--vp-c-bg-mute);
  border-radius: 999px;
  padding:       0.05rem 0.45rem;
}

/* ── Idle row (shared by recently viewed, bookmarks, and suggested items) ──── */
.idle-row {
  display:     flex;
  align-items: center;
  gap:         0.55rem;
  padding:     0.34rem 1rem;
  text-decoration: none;
  color:       var(--vp-c-text-1);
  font-size:   0.875rem;
  cursor:      pointer;
  border:      none;
  background:  none;
  width:       100%;
  text-align:  left;
  transition:  background 0.12s;
}
.idle-row:hover { background: var(--vp-c-bg-soft); }
.idle-row:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: -2px; }

.idle-row-icon {
  flex-shrink: 0;
  color:       var(--vp-c-text-3);
}

.idle-row-label {
  flex:          1;
  overflow:      hidden;
  text-overflow: ellipsis;
  white-space:   nowrap;
}

.idle-row-eba {
  flex-shrink:   0;
  font-size:     0.68rem;
  font-weight:   600;
  padding:       0.1rem 0.45rem;
  border-radius: 999px;
  border:        1px solid transparent;
}

.idle-row-operator {
  flex-shrink:   0;
  font-family:   var(--vp-font-family-mono);
  font-size:     0.72rem;
  padding:       0.1rem 0.45rem;
  border-radius: 4px;
  background:    var(--vp-c-bg-mute);
  color:         var(--vp-c-brand-1);
  border:        1px solid var(--vp-c-divider);
}

/* Bookmark-row modifier */
.idle-row--bm {
  align-items: flex-start;
}

.idle-row--bm .idle-row-icon {
  color:      #F59E0B;
  margin-top: 3px; /* nudge so icon tip aligns with the title text baseline */
}

/* Column container for title + note within the bookmark row */
.idle-row-body {
  flex:           1;
  min-width:      0;
  display:        flex;
  flex-direction: column;
  gap:            0.1rem;
  overflow:       hidden;
}

/* When label sits inside idle-row-body, remove the horizontal flex-grow
   that it carries in the base .idle-row-label rule — the parent body
   already carries flex:1 in the row direction. */
.idle-row-body .idle-row-label {
  flex: none;
}

/* Annotation line — italic, amber, single-line truncated */
.idle-row-note {
  font-size:     0.72rem;
  font-style:    italic;
  color:         #B45309;   /* amber-700 — same as .qa-bookmark-card-note */
  white-space:   nowrap;
  overflow:      hidden;
  text-overflow: ellipsis;
  line-height:   1.4;
}

.dark .idle-row-note {
  color: #FCD34D;           /* amber-300 — legible on dark backgrounds */
}

/* Recent searches */
.recent-search-pills {
  display:   flex;
  flex-wrap: wrap;
  gap:       0.4rem;
  padding:   0.3rem 1rem 0.5rem;
}

.recent-item-wrapper {
  display:       flex;
  align-items:   center;
  background:    var(--vp-c-bg-mute);
  border-radius: 6px;
  opacity:       0.6;
  transition:    opacity 0.15s;
}

.recent-item-wrapper:hover {
  opacity: 1;
}

.recent-item {
  background:    none;
  border:        none;
  padding:       0.28rem 0.2rem 0.28rem 0.6rem;
  font-size:     0.78rem;
  color:         var(--vp-c-text-2);
  cursor:        pointer;
  max-width:     14rem;
  overflow:      hidden;
  text-overflow: ellipsis;
  white-space:   nowrap;
}

.recent-item-wrapper:hover .recent-item {
  color: var(--vp-c-text-1);
}

.recent-delete-btn {
  display:         flex;
  align-items:     center;
  justify-content: center;
  background:      none;
  border:          none;
  padding:         0.3rem 0.5rem 0.3rem 0.25rem;
  cursor:          pointer;
  color:           var(--vp-c-text-3);
  border-radius:   0 6px 6px 0;
}

.recent-delete-btn .delete-icon-mini {
  width:  10px;
  height: 10px;
}

.recent-delete-btn:hover {
  color: #DC2626;
}

.dark .recent-delete-btn:hover {
  color: #F87171;
}

/* ── Ask AI suggestions section ─────────────────────────────────────────────── */
.ask-ai-suggestions {
  border-top: 1px solid var(--vp-c-divider);
  padding:    0.1rem 0 0.2rem;
}

.ask-ai-suggestions-header {
  display:        flex;
  align-items:    center;
  gap:            0.4rem;
  font-size:      0.7rem;
  font-weight:    600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color:          var(--vp-c-text-3);
  padding:        0.4rem 1rem 0.15rem;
}

.ask-ai-suggestion-row {
  display:     flex;
  align-items: center;
  gap:         0.55rem;
  padding:     0.28rem 1rem;
  width:       100%;
  text-align:  left;
  border:      none;
  background:  none;
  color:       var(--vp-c-text-2);
  font-size:   0.845rem;
  cursor:      pointer;
  transition:  background 0.12s, color 0.12s;
}
.ask-ai-suggestion-row:hover {
  background: var(--vp-c-bg-soft);
  color:      var(--vp-c-brand-1);
}
.ask-ai-suggestion-row svg {
  flex-shrink: 0;
  color:       var(--vp-c-brand-1);
  opacity:     0.65;
}
.ask-ai-suggestion-row:hover svg { opacity: 1; }
.ask-ai-suggestion-row:focus-visible { outline: 2px solid var(--vp-c-brand-1); outline-offset: -2px; }

/* ══════════════════════════════════════════════════════════════════════════════
   ISSUE 4 — Inline AI answer view (streamed inside the SearchModal)
══════════════════════════════════════════════════════════════════════════════ */
.inline-answer {
  display:        flex;
  flex-direction: column;
  gap:            0.6rem;
  padding:        0.5rem 0.25rem 0.75rem;
}

.inline-answer-back {
  display:       inline-flex;
  align-items:   center;
  gap:           0.35rem;
  align-self:    flex-start;
  padding:       0.25rem 0.5rem 0.25rem 0.35rem;
  border:        none;
  background:    none;
  border-radius: 6px;
  cursor:        pointer;
  color:         var(--vp-c-text-3);
  font-size:     0.8rem;
  font-weight:   500;
  transition:    background 0.12s, color 0.12s;
}
.inline-answer-back:hover { background: var(--vp-c-bg-soft); color: var(--vp-c-text-1); }

.inline-answer-question {
  display:       flex;
  align-items:   flex-start;
  gap:           0.5rem;
  padding:       0.55rem 0.7rem;
  background:    var(--vp-c-brand-soft);
  border-radius: 10px;
  font-size:     0.9rem;
  font-weight:   600;
  line-height:   1.45;
  color:         var(--vp-c-text-1);
}
.inline-answer-question svg { flex-shrink: 0; margin-top: 0.15rem; color: var(--vp-c-brand-1); }

.inline-answer-content {
  font-size:   0.9rem;
  line-height: 1.62;
  color:       var(--vp-c-text-1);
  padding:     0 0.25rem;
}
.inline-answer-text :deep(p)      { margin: 0 0 0.7em; }
.inline-answer-text :deep(p:last-child) { margin: 0; }
.inline-answer-text :deep(ul),
.inline-answer-text :deep(ol)     { margin: 0.4em 0 0.7em 1.3em; padding: 0; }
.inline-answer-text :deep(li)     { margin: 0.2em 0; }
.inline-answer-text :deep(strong) { font-weight: 700; }
.inline-answer-text :deep(h2),
.inline-answer-text :deep(h3)     { font-size: 0.92rem; font-weight: 700; margin: 0.7em 0 0.3em; }
.inline-answer-text :deep(code)   {
  font-family:   var(--vp-font-family-mono);
  font-size:     0.82em;
  background:    var(--vp-c-bg-mute);
  padding:       0.1em 0.35em;
  border-radius: 3px;
}
.inline-answer-text :deep(table)  { border-collapse: collapse; margin: 0.5em 0; font-size: 0.85em; width: 100%; }
.inline-answer-text :deep(th),
.inline-answer-text :deep(td)     { border: 1px solid var(--vp-c-divider); padding: 0.3em 0.5em; text-align: left; }

/* Blinking caret shown at the tail of the streaming answer */
.inline-answer-cursor {
  display:        inline-block;
  width:          2px;
  height:         1.05em;
  margin-left:    1px;
  vertical-align: text-bottom;
  background:     var(--vp-c-brand-1);
  animation:      inline-caret-blink 1s steps(2, start) infinite;
}
@keyframes inline-caret-blink { 0%, 50% { opacity: 1; } 50.01%, 100% { opacity: 0; } }

.inline-answer-thinking {
  padding:   0.25rem;
  font-size: 0.88rem;
  color:     var(--vp-c-text-2);
}
.inline-answer-thinking .ap-dots span {
  display:        inline-block;
  animation:      inline-dot-blink 1.2s infinite;
  opacity:        0;
}
.inline-answer-thinking .ap-dots span:nth-child(1) { animation-delay: 0s;   }
.inline-answer-thinking .ap-dots span:nth-child(2) { animation-delay: 0.2s; }
.inline-answer-thinking .ap-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes inline-dot-blink { 0%, 60%, 100% { opacity: 0; } 30% { opacity: 1; } }

.inline-answer-error {
  display:       flex;
  align-items:   flex-start;
  gap:           0.45rem;
  padding:       0.55rem 0.7rem;
  border-radius: 8px;
  background:    var(--vp-c-danger-soft, #fef2f2);
  color:         var(--vp-c-danger-1, #e53e3e);
  font-size:     0.85rem;
  line-height:   1.45;
}
.inline-answer-error svg { flex-shrink: 0; margin-top: 0.1rem; }

.inline-answer-sources {
  display:        flex;
  flex-direction: column;
  gap:            0.15rem;
  padding-top:    0.4rem;
  border-top:     1px solid var(--vp-c-divider);
}
.inline-answer-sources-head {
  font-size:      0.7rem;
  font-weight:    600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color:          var(--vp-c-text-3);
  margin-bottom:  0.1rem;
}
.inline-answer-source {
  display:         inline-flex;
  align-items:     center;
  gap:             0.4rem;
  padding:         0.28rem 0.4rem;
  border-radius:   6px;
  text-decoration: none;
  color:           var(--vp-c-brand-1);
  font-size:       0.83rem;
  transition:      background 0.12s;
}
.inline-answer-source:hover { background: var(--vp-c-bg-soft); }
.inline-answer-source svg   { flex-shrink: 0; opacity: 0.7; }

.inline-answer-disclaimer {
  font-size:   0.72rem;
  color:       var(--vp-c-text-3);
  line-height: 1.5;
  padding:     0.3rem 0.25rem 0;
  border-top:  1px solid var(--vp-c-divider);
}

/* ── View more results button ────────────────────────────────────────────────── */
.view-more-btn {
  display:         flex;
  align-items:     center;
  justify-content: center;
  gap:             0.4rem;
  width:           100%;
  padding:         0.65rem 1rem;
  border:          none;
  border-top:      1px solid var(--vp-c-divider);
  background:      none;
  color:           var(--vp-c-brand-1);
  font-size:       0.845rem;
  font-weight:     500;
  cursor:          pointer;
  transition:      background 0.12s;
}
.view-more-btn:hover           { background: var(--vp-c-bg-soft); }
.view-more-btn:focus-visible   { outline: 2px solid var(--vp-c-brand-1); outline-offset: -2px; }

/* ── Operator hint footer bar ────────────────────────────────────────────────── */
/* Keyboard-hint footer bar */
.search-footer-hint {
  flex-shrink:     0;
  display:         flex;
  align-items:     center;
  justify-content: center;
  gap:             0.5rem;
  padding:         0.5rem 1rem;
  margin:          0 0.75rem 0.6rem;
  border-radius:   8px;
  background:      var(--vp-c-bg-elv, #1e1e20);
  border:          1px solid var(--vp-c-divider);
}

/* Dark mode: use a near-black background; light mode: use a soft grey */
.dark .search-footer-hint {
  background: rgba(255,255,255,0.04);
}

.sfh-item {
  display:     flex;
  align-items: center;
  gap:         0.2rem;
}

/* Individual keycap */
.sfh-key {
  display:         inline-flex;
  align-items:     center;
  justify-content: center;
  min-width:       1.35rem;
  height:          1.35rem;
  padding:         0 0.3rem;
  border-radius:   4px;
  border:          1px solid var(--vp-c-divider);
  background:      var(--vp-c-bg-soft);
  font-family:     var(--vp-font-family-mono);
  font-size:       0.68rem;
  font-weight:     600;
  color:           var(--vp-c-text-1);
  line-height:     1;
  letter-spacing:  0;
}

.sfh-key--wide {
  min-width: 2rem;
  font-size: 0.62rem;
  text-transform: lowercase;
}

.sfh-label {
  font-size:   0.68rem;
  color:       var(--vp-c-text-3);
  white-space: nowrap;
  margin-left: 0.15rem;
}

/* Thin vertical divider between hint groups */
.sfh-sep {
  width:        1px;
  height:       0.85rem;
  background:   var(--vp-c-divider);
  flex-shrink:  0;
  margin:       0 0.15rem;
}

/* Hide on small mobile — not enough horizontal room */
@media (max-width: 480px) {
  .search-footer-hint { display: none; }
}

/* Advanced search idle-row hint — right-aligned operator preview chips */
.idle-row-adv-hint {
  margin-left:   auto;
  flex-shrink:   0;
  font-family:   var(--vp-font-family-mono);
  font-size:     0.68rem;
  color:         var(--vp-c-text-3);
  letter-spacing: 0.01em;
  white-space:   nowrap;
}

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
  gap: 0.5rem;
  width: 100%;
  padding: 0.38rem 0.6rem;
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
.suggestion-card--eba   { border-left-color: var(--vp-c-brand-1); }
.suggestion-card--topic { border-left-color: #7C3AED; }
.suggestion-card--rewrite { border-left-color: #0891B2; }
.suggestion-card-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  color: var(--vp-c-text-3);
}
.suggestion-card--eba     .suggestion-card-icon { color: var(--vp-c-brand-1); }
.suggestion-card--topic   .suggestion-card-icon { color: #7C3AED; }
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

/* ── EBA filter flash — triggered by Shift+F shortcut and EBA context restore ── */
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
    max-height: 85dvh;
    border-radius: 16px 16px 0 0;
    border-bottom: none;
    box-shadow: 0 -4px 32px rgba(0, 0, 0, 0.22);
    padding-bottom: env(safe-area-inset-bottom);
    overscroll-behavior: contain;
  }

  .sheet-handle {
    flex-shrink: 0;
    width: 40px;
    height: 4px;
    background: var(--vp-c-divider);
    border-radius: 999px;
    margin: 10px auto 6px;
  }

  .search-body {
    -webkit-overflow-scrolling: touch;
    overscroll-behavior: contain;
  }

  .preview-pane { display: none !important; }
}

/* ── Operator pills row ── */
.operator-pills-row {
  display: flex; align-items: center; flex-wrap: wrap; gap: 0.4rem;
  padding: 0.45rem 1rem;
  background: var(--vp-c-bg-soft);
  border-bottom: 1px solid var(--vp-c-divider);
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
.op-pill--topic  { color: #7C3AED; background: #7C3AED1A; border-color: #7C3AED55; }
.op-pill--clause { color: #2563EB; background: #2563EB1A; border-color: #2563EB55; }
.op-pill--exclude { color: #DC2626; background: #DC26261A; border-color: #DC262655; }
.op-pill--phrase { color: #0891B2; background: #0891B21A; border-color: #0891B255; }
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

/* Inline operator hint chips in the footer */
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
  overscroll-behavior: contain;
}
.op-hint-header {
  display:       flex;
  align-items:   center;
  gap:           0.5rem;
  padding:       0.4rem 0.75rem;
  background:    var(--vp-c-bg-soft);
  border-bottom: 1px solid var(--vp-c-divider);
  flex-wrap:     wrap;
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
/* ── Keycap-style nav badges in hint/cheatsheet headers ── */
.op-hint-keycap {
  display:         inline-flex;
  align-items:     center;
  justify-content: center;
  font-size:       0.6rem;
  font-family:     var(--vp-font-family-mono, ui-monospace, monospace);
  color:           var(--vp-c-text-2);
  background:      var(--vp-c-bg);
  border:          1px solid var(--vp-c-divider);
  border-radius:   4px;
  padding:         0.1rem 0.3rem;
  min-width:       1.5em;
  line-height:     1.5;
  white-space:     nowrap;
  user-select:     none;
  flex-shrink:     0;
  box-shadow:      0 2px 0 var(--vp-c-border, #c2c2c4);
}
.op-hint-keycap--wide { min-width: 2.8em; }
.op-hint-keycap-pair  { display: inline-flex; gap: 2px; flex-shrink: 0; }
.op-hint-item {
  display:       flex;
  align-items:   center;
  gap:           0.55rem;
  width:         100%;
  padding:       0.45rem 0.75rem;
  background:    none;
  border:        none;
  border-bottom: 1px solid var(--vp-c-divider);
  cursor:        pointer;
  text-align:    left;
  transition:    background 0.1s;
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
  font-size:     0.8rem;
  font-weight:   600;
  color:         var(--vp-c-text-1);
  font-family:   var(--vp-font-family-mono, ui-monospace, monospace);
  white-space:   nowrap;
  overflow:      hidden;
  text-overflow: ellipsis;
}
.op-hint-item-secondary {
  font-size:     0.72rem;
  color:         var(--vp-c-text-3);
  white-space:   nowrap;
  overflow:      hidden;
  text-overflow: ellipsis;
  margin-left:   auto;
  padding-left:  0.5rem;
}
/* ── Dim secondary text when the item is active so primary pops ── */
.op-hint-item--active .op-hint-item-secondary { color: var(--vp-c-text-2); }

/* ── Operator cheatsheet rows ── */
.op-cs-row { gap: 0.75rem; }
.op-cs-row .op-hint-item-primary  { flex-shrink: 0; min-width: 6.5rem; }
.op-cs-row .op-hint-item-secondary { margin-left: 0; }
.op-cs-examples {
  display: inline-flex; gap: 0.25rem;
  margin-left: auto; flex-shrink: 0; flex-wrap: wrap; justify-content: flex-end;
}
.op-cs-examples code {
  font-size:     0.6rem;
  font-family:   var(--vp-font-family-mono, ui-monospace, monospace);
  background:    var(--vp-c-bg-soft);
  border:        1px solid var(--vp-c-divider);
  border-radius: 3px;
  padding:       0.05rem 0.25rem;
  color:         var(--vp-c-text-3);
  pointer-events: none;
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

/* ── Inline AI answer view (streamed inside the SearchModal) ── */
.inline-answer {
  display:        flex;
  flex-direction: column;
  gap:            0.6rem;
  padding:        0.5rem 0.25rem 0.75rem;
}
.inline-answer-back {
  display:       inline-flex;
  align-items:   center;
  gap:           0.35rem;
  align-self:    flex-start;
  padding:       0.25rem 0.5rem 0.25rem 0.35rem;
  border:        none;
  background:    none;
  border-radius: 6px;
  cursor:        pointer;
  color:         var(--vp-c-text-3);
  font-size:     0.8rem;
  font-weight:   500;
  transition:    background 0.12s, color 0.12s;
}
.inline-answer-back:hover { background: var(--vp-c-bg-soft); color: var(--vp-c-text-1); }
.inline-answer-question {
  display:       flex;
  align-items:   flex-start;
  gap:           0.5rem;
  padding:       0.55rem 0.7rem;
  background:    var(--vp-c-brand-soft);
  border-radius: 10px;
  font-size:     0.9rem;
  font-weight:   600;
  line-height:   1.45;
  color:         var(--vp-c-text-1);
}
.inline-answer-question svg { flex-shrink: 0; margin-top: 0.15rem; color: var(--vp-c-brand-1); }
.inline-answer-content {
  font-size:   0.9rem;
  line-height: 1.62;
  color:       var(--vp-c-text-1);
  padding:     0 0.25rem;
}
.inline-answer-text :deep(p)      { margin: 0 0 0.7em; }
.inline-answer-text :deep(p:last-child) { margin: 0; }
.inline-answer-text :deep(ul),
.inline-answer-text :deep(ol)     { margin: 0.4em 0 0.7em 1.3em; padding: 0; }
.inline-answer-text :deep(li)     { margin: 0.2em 0; }
.inline-answer-text :deep(strong) { font-weight: 700; }
.inline-answer-text :deep(h2),
.inline-answer-text :deep(h3)     { font-size: 0.92rem; font-weight: 700; margin: 0.7em 0 0.3em; }
.inline-answer-text :deep(code)   {
  font-family:   var(--vp-font-family-mono);
  font-size:     0.82em;
  background:    var(--vp-c-bg-mute);
  padding:       0.1em 0.35em;
  border-radius: 3px;
}
.inline-answer-text :deep(table)  { border-collapse: collapse; margin: 0.5em 0; font-size: 0.85em; width: 100%; }
.inline-answer-text :deep(th),
.inline-answer-text :deep(td)     { border: 1px solid var(--vp-c-divider); padding: 0.3em 0.5em; text-align: left; }
.inline-answer-cursor {
  display:        inline-block;
  width:          2px;
  height:         1.05em;
  margin-left:    1px;
  vertical-align: text-bottom;
  background:     var(--vp-c-brand-1);
  animation:      inline-caret-blink 1s steps(2, start) infinite;
}
@keyframes inline-caret-blink { 0%, 50% { opacity: 1; } 50.01%, 100% { opacity: 0; } }
.inline-answer-thinking {
  padding:   0.25rem;
  font-size: 0.88rem;
  color:     var(--vp-c-text-2);
}
.inline-answer-thinking .ap-dots span {
  display:   inline-block;
  animation: inline-dot-blink 1.2s infinite;
  opacity:   0;
}
.inline-answer-thinking .ap-dots span:nth-child(1) { animation-delay: 0s;   }
.inline-answer-thinking .ap-dots span:nth-child(2) { animation-delay: 0.2s; }
.inline-answer-thinking .ap-dots span:nth-child(3) { animation-delay: 0.4s; }
@keyframes inline-dot-blink { 0%, 60%, 100% { opacity: 0; } 30% { opacity: 1; } }
.inline-answer-error {
  display:       flex;
  align-items:   flex-start;
  gap:           0.45rem;
  padding:       0.55rem 0.7rem;
  border-radius: 8px;
  background:    var(--vp-c-danger-soft, #fef2f2);
  color:         var(--vp-c-danger-1, #e53e3e);
  font-size:     0.85rem;
  line-height:   1.45;
}
.inline-answer-error svg { flex-shrink: 0; margin-top: 0.1rem; }
.inline-answer-sources {
  display:        flex;
  flex-direction: column;
  gap:            0.15rem;
  padding-top:    0.4rem;
  border-top:     1px solid var(--vp-c-divider);
}
.inline-answer-sources-head {
  font-size:      0.7rem;
  font-weight:    600;
  text-transform: uppercase;
  letter-spacing: 0.07em;
  color:          var(--vp-c-text-3);
  margin-bottom:  0.1rem;
}
.inline-answer-source {
  display:         inline-flex;
  align-items:     center;
  gap:             0.4rem;
  padding:         0.28rem 0.4rem;
  border-radius:   6px;
  text-decoration: none;
  color:           var(--vp-c-brand-1);
  font-size:       0.83rem;
  transition:      background 0.12s;
}
.inline-answer-source:hover { background: var(--vp-c-bg-soft); }
.inline-answer-source svg   { flex-shrink: 0; opacity: 0.7; }
.inline-answer-disclaimer {
  font-size:   0.72rem;
  color:       var(--vp-c-text-3);
  line-height: 1.5;
  padding:     0.3rem 0.25rem 0;
  border-top:  1px solid var(--vp-c-divider);
}

/* Preview rendered clause content */
.preview-content.vp-doc {
  font-size:   0.78rem;
  line-height: 1.6;
  color:       var(--vp-c-text-2);
}
.preview-content.vp-doc :deep(h1) { display: none; }
.preview-content.vp-doc :deep(h2) { font-size: 0.82rem; font-weight: 700; margin: 0.65rem 0 0.25rem; padding-top: 0; border-top: none; }
.preview-content.vp-doc :deep(h3) { font-size: 0.78rem; font-weight: 600; margin: 0.45rem 0 0.2rem; }
.preview-content.vp-doc :deep(h4) { font-size: 0.76rem; font-weight: 600; margin: 0.35rem 0 0.15rem; }
.preview-content.vp-doc :deep(p)  { margin: 0 0 0.45rem; }
.preview-content.vp-doc :deep(ul),
.preview-content.vp-doc :deep(ol) { margin: 0.2rem 0 0.45rem 1rem; padding: 0; }
.preview-content.vp-doc :deep(li) { margin: 0.1rem 0; }
.preview-content.vp-doc :deep(table) {
  border-collapse: collapse; font-size: 0.73rem; width: 100%; margin: 0.45rem 0;
}
.preview-content.vp-doc :deep(th),
.preview-content.vp-doc :deep(td) {
  border: 1px solid var(--vp-c-divider); padding: 0.2rem 0.4rem; text-align: left;
}
.preview-content.vp-doc :deep(th) { background: var(--vp-c-bg-soft); font-weight: 600; }
.preview-content.vp-doc :deep(a)  { color: var(--vp-c-brand-1); text-decoration: none; pointer-events: none; }
.preview-content.vp-doc :deep(strong) { font-weight: 700; color: var(--vp-c-text-1); }
.preview-content.vp-doc :deep(blockquote) {
  font-size: 0.78rem; margin: 0.35rem 0; padding: 0.25rem 0.6rem;
  border-left: 3px solid var(--vp-c-divider); color: var(--vp-c-text-2);
}
.preview-content.vp-doc :deep(blockquote p) { margin: 0; }

.preview-content.vp-doc :deep(mark.preview-mark) {
  background:    var(--vp-c-yellow-soft, #fef9c3);
  color:         inherit;
  border-radius: 2px;
  padding:       0 1px;
}
/* Dark mode: use a warmer amber so the mark stays visible on dark backgrounds */
.dark .preview-content.vp-doc :deep(mark.preview-mark) {
  background: rgba(250, 200, 50, 0.25);
  color:      inherit;
}

.preview-content.vp-doc :deep(.custom-block) {
  padding: 0.4rem 0.6rem; border-radius: 6px; font-size: 0.75rem; margin: 0.4rem 0;
}

/* Preview loading shimmer */
.preview-shimmer {
  display:        flex;
  flex-direction: column;
  gap:            0.5rem;
  padding:        0.1rem 0;
}
.preview-shimmer-line {
  height:          0.65rem;
  border-radius:   4px;
  background:      linear-gradient(
    90deg,
    var(--vp-c-bg-soft) 25%,
    var(--vp-c-bg-mute) 50%,
    var(--vp-c-bg-soft) 75%
  );
  background-size: 200% 100%;
  animation:       preview-shimmer-move 1.4s infinite;
}
@keyframes preview-shimmer-move {
  0%   { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

</style>
