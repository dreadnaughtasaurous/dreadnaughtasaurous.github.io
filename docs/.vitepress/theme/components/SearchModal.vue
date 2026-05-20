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

            <!-- Results body -->
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

                <p class="search-hint-small">Type to search across all 1,275 clauses · Use filters to narrow by EBA or topic</p>
              </div>

              <!-- Normal results list -->
              <div v-else-if="results.length > 0" class="search-results">
                <p class="result-count">{{ results.length }} result{{ results.length === 1 ? '' : 's' }}</p>
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
                  </div>
                  <div class="ask-input-row">
                    <button
                      class="ask-btn"
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
                  </div>
                  <div class="ask-input-row">
                    <button
                      class="ask-btn"
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
                    <input
                      type="text"
                      id="draft-question"
                      v-model="draftQuestion"
                      placeholder="e.g. Am I entitled to overtime pay for the extra shift I worked?"
                    />
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
                    <div v-else-if="turn.role === 'assistant'" class="conv-turn conv-turn--assistant">
                      <span class="conv-label">EBA Assistant</span>
                      <div class="ai-answer-body" v-html="renderMarkdown(turn.content)"></div>
                      <template v-if="idx === conversationHistory.length - 1 && aiSources.length">
                        <div class="ai-sources">
                          <p class="ai-sources-label">Sources used:</p>
                          <a v-for="src in aiSources" :key="src.url" :href="src.url" class="ai-source-link" @click="close">{{ src.title }}</a>
                        </div>
                      </template>
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
                    <p>{{ aiConfigured ? 'Select your EBA and employment type above, then try one of these examples:' : 'Example questions you\'ll be able to ask once AI is configured:' }}</p>
                    <ul class="ask-examples">
                      <li @click="aiConfigured ? useQuestionExample('Am I entitled to overtime pay on a public holiday?') : null" :class="{ 'ask-example-preview': !aiConfigured }">Am I entitled to overtime pay on a public holiday?</li>
                      <li @click="aiConfigured ? useQuestionExample('How much notice is required before my roster can be changed?') : null" :class="{ 'ask-example-preview': !aiConfigured }">How much notice is required before my roster can be changed?</li>
                      <li @click="aiConfigured ? useQuestionExample('What is the recall allowance if I am called back to work after leaving the premises?') : null" :class="{ 'ask-example-preview': !aiConfigured }">What is the recall allowance if I am called back to work after leaving the premises?</li>
                      <li @click="aiConfigured ? useQuestionExample('What overtime rates apply after 10 hours on a weekday shift?') : null" :class="{ 'ask-example-preview': !aiConfigured }">What overtime rates apply after 10 hours on a weekday shift?</li>
                      <li @click="aiConfigured ? useQuestionExample('Am I entitled to a meal allowance if I work overtime?') : null" :class="{ 'ask-example-preview': !aiConfigured }">Am I entitled to a meal allowance if I work overtime?</li>
                    </ul>
                  </template>

                  <!-- situation mode: clicking auto-fills the situationText textarea -->
                  <template v-else-if="askMode === 'situation'">
                    <p>Try one of these example situations, or describe your own above:</p>
                    <ul class="ask-examples">
                      <li @click="aiConfigured ? useSituationExample('An employee worked 12 hours on Saturday and 10 hours on Sunday. They are now claiming overtime pay for both days. I need to understand what they are entitled to under their EBA.') : null" :class="{ 'ask-example-preview': !aiConfigured }">An employee worked 12 hours Saturday and 10 hours Sunday and is claiming overtime for both days.</li>
                      <li @click="aiConfigured ? useSituationExample('A part-time employee has requested a change to their agreed roster. Their manager has agreed but has not given any written notice. The employee is asking whether this is compliant with their EBA.') : null" :class="{ 'ask-example-preview': !aiConfigured }">A part-time employee's roster was changed verbally by their manager with no written notice.</li>
                      <li @click="aiConfigured ? useSituationExample('An employee has been absent on sick leave for four weeks and their sick leave balance has been exhausted. They are now asking whether they can access any other form of leave under the EBA.') : null" :class="{ 'ask-example-preview': !aiConfigured }">An employee has exhausted their sick leave after four weeks of continuous absence.</li>
                      <li @click="aiConfigured ? useSituationExample('A casual employee has been regularly rostered for the same shifts each week for over 12 months. They are asking whether they have any entitlement to convert to part-time employment under the EBA.') : null" :class="{ 'ask-example-preview': !aiConfigured }">A casual employee has worked the same regular shifts for over 12 months and wants to convert to part-time.</li>
                      <li @click="aiConfigured ? useSituationExample('An employee was asked to remain at work after their shift ended to cover an absent colleague. They worked an additional 3 hours and are asking what allowances or overtime rates apply.') : null" :class="{ 'ask-example-preview': !aiConfigured }">An employee stayed back after their shift ended to cover an absent colleague and wants to know what they are owed.</li>
                    </ul>
                  </template>

                  <!-- draft mode: clicking auto-fills the draftQuestion input -->
                  <template v-else-if="askMode === 'draft'">
                    <p>Try one of these example employee questions, or enter your own above:</p>
                    <ul class="ask-examples">
                      <li @click="aiConfigured ? useDraftExample('Am I entitled to overtime pay for the extra hours I worked on the weekend?') : null" :class="{ 'ask-example-preview': !aiConfigured }">Am I entitled to overtime pay for the extra hours I worked on the weekend?</li>
                      <li @click="aiConfigured ? useDraftExample('Can my manager change my roster without giving me notice in writing?') : null" :class="{ 'ask-example-preview': !aiConfigured }">Can my manager change my roster without giving me notice in writing?</li>
                      <li @click="aiConfigured ? useDraftExample('I have run out of sick leave - am I allowed to take unpaid leave instead?') : null" :class="{ 'ask-example-preview': !aiConfigured }">I have run out of sick leave — am I allowed to take unpaid leave instead?</li>
                      <li @click="aiConfigured ? useDraftExample('I have been working the same casual shifts every week for over a year. Am I entitled to convert to part-time?') : null" :class="{ 'ask-example-preview': !aiConfigured }">I have been working the same casual shifts for over a year. Can I convert to part-time?</li>
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
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { topicList } from '../../generated/topic-list.mjs'

// ─── AI Worker URL ────────────────────────────────────────────────────────────
const AI_WORKER_URL = 'https://eba-ask-worker.irresistibl.workers.dev'
const ANALYTICS_WORKER_URL = 'https://eba-analytics-worker.irresistibl.workers.dev'
const aiConfigured  = AI_WORKER_URL.length > 0

// ─── Storage keys ─────────────────────────────────────────────────────────────
const SESSION_QUERY_KEY  = 'eba-search-last-query'
const SESSION_EBA_KEY    = 'eba-search-last-eba'
const SESSION_TOPIC_KEY  = 'eba-search-last-topic'
const SESSION_SCROLL_KEY = 'eba-search-last-scroll'
const SESSION_RECENT_KEY = 'eba-search-recent'
const LOCAL_SAVED_KEY    = 'eba-search-saved'

// ─── Core state ───────────────────────────────────────────────────────────────
const open                = ref(false)
const activeTab           = ref('search')
const query               = ref('')
const selectedEba         = ref('')
const selectedTopic       = ref('')
const results             = ref([])
const loading             = ref(false)
const inputRef            = ref(null)
const modalRef            = ref(null)
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

// ─── Recent searches (sessionStorage — session-scoped) ────────────────────────
const recentSearches = ref([])

// ─── Saved searches (localStorage — persists across sessions) ─────────────────
// Each entry: { id: string, label: string, query: string, eba: string, topic: string }
const savedSearches = ref([])

// ─── AI state ─────────────────────────────────────────────────────────────────
const aiLoading = ref(false)
const aiAnswer  = ref('')
const aiSources = ref([])
const aiError   = ref('')

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

let searchTimer        = null
let pagefind           = null
let pendingContentHash = null
let _externalAskQuery  = ''   // carries AskThisPage pre-built query; bypasses mode form guards

// ─── Quick Access shortcuts ───────────────────────────────────────────────────
const quickAccessShortcuts = [
  { icon: '⏱️', label: 'Overtime & Penalty Rates', topic: 'overtime',    query: '' },
  { icon: '📅', label: 'Leave Entitlements',        topic: 'leave',       query: '' },
  { icon: '💵', label: 'Wage Rates',                topic: 'wages',       query: '' },
  { icon: '💰', label: 'Allowances',                topic: 'allowances',  query: '' },
  { icon: '📋', label: 'Termination & Redundancy',  topic: 'termination', query: '' },
]

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

  if (detail.tab === 'ask' && detail.query) {
    pendingContentHash = detail.contentHash ?? null
    _externalAskQuery  = detail.query
    activeTab.value     = 'ask'
    open.value          = true
    nextTick(() => submitAsk())
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
  open.value = true
  nextTick(() => {
    loadPersistedState()
    inputRef.value?.focus()
  })
}

watch(open, async (val) => {
  if (val) {
    await nextTick()
    inputRef.value?.focus()
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
    previewVisible.value = false
    previewResult.value  = null
  }
})

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
}
onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  window.addEventListener('open-search', openFromExternal)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('open-search', openFromExternal)
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
      } catch { /* exact search optional */ }
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
    logSearch('search', query.value, selectedEba.value, selectedTopic.value, results.value.length)
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
        { role: 'assistant', content: rawAnswer },
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
      { role: 'assistant', content: rawAnswer },
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
  nextTick(() => inputRef.value?.focus())
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
  cursor: pointer; transition: background 0.2s, box-shadow 0.2s;
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

/* ── Modal transition ── */
.modal-enter-active, .modal-leave-active { transition: opacity 0.18s ease; }
.modal-enter-active .search-modal, .modal-leave-active .search-modal { transition: transform 0.18s ease, opacity 0.18s ease; }
.modal-enter-from, .modal-leave-to { opacity: 0; }
.modal-enter-from .search-modal, .modal-leave-to .search-modal { transform: translateY(-8px); opacity: 0; }

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

.ai-disclaimer-draft {
  font-size: 0.75rem; color: var(--vp-c-text-3); margin: 0; line-height: 1.5;
}
</style>