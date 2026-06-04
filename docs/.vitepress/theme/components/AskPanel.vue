<template>
  <Teleport to="body">

    <!-- Mobile backdrop -->
    <Transition name="panel-backdrop">
      <div
        v-if="isOpen && isMobileSheet"
        class="ask-panel-backdrop"
        @click="close"
        aria-hidden="true"
      />
    </Transition>

    <!-- Panel -->
    <Transition :name="isMobileSheet ? 'panel-sheet' : 'panel-slide'">
      <div
        v-if="isOpen"
        ref="panelRef"
        class="ask-panel"
        :class="{ 'ask-panel--expanded': isExpanded, 'ask-panel--sheet': isMobileSheet }"
        role="complementary"
        aria-label="Ask AI"
        @keydown.esc.stop="close"
      >

        <!-- ── Header ──────────────────────────────────────────────────────── -->
        <div class="ask-panel-header">

          <div class="ask-panel-title-area" ref="titleAreaRef">
            <button
              class="ask-panel-chat-btn"
              @click.stop="toggleDropdown"
              :aria-expanded="showDropdown"
              aria-haspopup="listbox"
            >
              <svg class="aph-sparkle" width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
              </svg>
              <span class="aph-chat-label">{{ activeChat?.title || 'New chat' }}</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
            </button>

            <!-- Chat history dropdown -->
            <div
              v-if="showDropdown"
              class="ask-panel-dropdown"
              ref="dropdownRef"
              role="listbox"
              aria-label="Chat history"
            >
              <button
                v-for="chat in chats"
                :key="chat.id"
                class="apd-item"
                :class="{ 'apd-item--active': chat.id === activeChatId }"
                role="option"
                :aria-selected="chat.id === activeChatId"
                @click="selectChat(chat.id)"
              >
                <svg v-if="chat.id === activeChatId" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
                <span class="apd-item-text">{{ chat.title }}</span>
              </button>

              <div class="apd-sep" />

              <button class="apd-action" @click="startNewChatFromDropdown">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
                Add new chat
              </button>

              <button
                v-if="chats.length > 0"
                class="apd-action apd-action--danger"
                @click="clearAllChats"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/></svg>
                Clear all chats
              </button>
            </div>
          </div>

          <div class="aph-actions">
            <button class="aph-btn" @click="startNewChat" title="New chat" aria-label="Start new chat">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>
            </button>
            <button class="aph-btn" @click="toggleExpand" :title="isExpanded ? 'Collapse' : 'Expand'" :aria-label="isExpanded ? 'Collapse panel' : 'Expand panel'">
              <svg v-if="!isExpanded" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>
              <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="14" x2="21" y2="3"/><line x1="3" y1="21" x2="14" y2="10"/></svg>
            </button>
            <button class="aph-btn aph-btn--close" @click="close" title="Close" aria-label="Close Ask AI">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
        </div>

        <!-- ── Disclaimer ──────────────────────────────────────────────────── -->
        <div class="ask-panel-disclaimer" role="note">
          Responses are generated using AI and may contain mistakes.
          <template v-if="activeChat?.scope === 'page' && activeChat?.pageTitle">
            <span class="apd-sep-dot" aria-hidden="true">·</span>
            <a :href="activeChat.pageUrl" class="apd-ctx-link" @click.prevent="navigateToPage">{{ activeChat.pageTitle }}</a>
          </template>
        </div>

        <!-- ── Context filters ────────────────────────────────────────────── -->
        <div v-if="activeChat?.scope !== 'page'" class="ask-panel-filters" role="group" aria-label="Refine your question">

          <!-- EBA pill -->
          <div class="apf-pill" :class="{ 'apf-pill--active': filterEba }">
            <svg class="apf-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
            </svg>
            <div class="apf-select-wrap">
              <select v-model="filterEba" class="apf-select" aria-label="Filter by EBA">
                <option v-for="opt in EBA_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
              <svg class="apf-chevron" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
            </div>
            <button v-if="filterEba" class="apf-clear" @click="filterEba = ''" :aria-label="`Clear EBA filter (${filterEba})`">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <!-- Employment type pill -->
          <div class="apf-pill" :class="{ 'apf-pill--active': filterEmploymentType }">
            <svg class="apf-icon" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
            <div class="apf-select-wrap">
              <select v-model="filterEmploymentType" class="apf-select" aria-label="Filter by employment type">
                <option v-for="opt in EMPLOYMENT_TYPE_OPTIONS" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
              </select>
              <svg class="apf-chevron" width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>
            </div>
            <button v-if="filterEmploymentType" class="apf-clear" @click="filterEmploymentType = ''" :aria-label="`Clear employment type filter (${filterEmploymentType})`">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>

          <p v-if="!filterEba && !filterEmploymentType" class="apf-nudge">Set these for more specific answers</p>

        </div>

        <!-- ── Messages body ───────────────────────────────────────────────── -->
        <div class="ask-panel-body" ref="bodyRef">

          <!-- Empty state -->
          <div v-if="messages.length === 0 && !loading && !error" class="apb-empty">
          <svg class="apb-empty-icon" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" fill="currentColor"/>
              <path class="ask-tab-star" d="M20 3v4"/>
              <path class="ask-tab-star" d="M22 5h-4"/>
              <path class="ask-tab-star ask-tab-star--delayed" d="M4 17v2"/>
              <path class="ask-tab-star ask-tab-star--delayed" d="M5 18H3"/>
            </svg>
            <p class="apb-empty-title">
              {{ (activeChat?.scope === 'page' && activeChat?.pageTitle)
                  ? `Ask about ${activeChat.pageTitle}`
                  : 'Ask about the EBA wiki' }}
            </p>
            <p class="apb-empty-sub">Answers are sourced from wiki content only. Always verify against the full EBA text.</p>
            <div v-if="activeChat?.scope !== 'page'" class="apb-hints">
              <div class="apb-hint-row">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                <span>Select your EBA above for agreement-specific answers</span>
              </div>
              <div class="apb-hint-row">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <span>Select employment type to remove ambiguity</span>
              </div>
              <div class="apb-hint-row">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                <span>Be specific — name the entitlement, not the topic</span>
              </div>
            </div>
          </div>

          <!-- Message bubbles -->
          <template v-for="(msg, i) in messages" :key="i">
            <div class="apm-row" :class="`apm-row--${msg.role}`">
              <div
                class="apm-bubble"
                :class="{ 'apm-bubble--hedging': msg.role === 'assistant' && msg.hedging }"
                v-html="msg.role === 'assistant' ? renderMarkdown(msg.content) : escHtml(msg.content)"
              ></div>
              <div v-if="msg.role === 'assistant' && msg.hedging" class="apm-hedging">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                Low confidence — verify against the EBA PDF
              </div>
            </div>
          </template>

          <!-- Loading -->
          <div v-if="loading" class="apm-row apm-row--assistant">
            <div class="apm-bubble apm-bubble--loading">
              <span class="ap-dots">Thinking<span>.</span><span>.</span><span>.</span></span>
            </div>
          </div>

          <!-- Error -->
          <div v-if="error" class="apb-error">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {{ error }}
          </div>
        </div>

        <!-- ── Footer / input ──────────────────────────────────────────────── -->
        <div class="ask-panel-footer">
          <textarea
            ref="inputRef"
            v-model="question"
            :placeholder="(activeChat?.scope === 'page') ? 'Ask a question about the page' : 'Ask a question about the EBA wiki'"
            class="ap-input"
            rows="1"
            :disabled="loading"
            @keydown.enter.exact.prevent="submit"
            @input="autoResize"
          ></textarea>
          <button
            class="ap-send-btn"
            @click="submit"
            :disabled="loading || question.trim().length < 3"
            aria-label="Send"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>
          </button>
        </div>

      </div>
    </Transition>
  </Teleport>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useRouter } from 'vitepress'

// ─── Constants ────────────────────────────────────────────────────────────────
const AI_WORKER_URL    = 'https://eba-ask-worker.irresistibl.workers.dev'
const LOCAL_CHATS_KEY  = 'eba-ask-chats'
const MAX_CHATS        = 10
const MAX_HIST_PAIRS   = 3   // up to 3 user+assistant pairs sent as history

// ─── Filter option lists ───────────────────────────────────────────────────────
// Values must match the ebaColors key names used in SearchModal / the worker.
const EBA_OPTIONS = [
  { value: '',                                            label: 'All EBAs'            },
  { value: 'Allied Health Professionals 2021-2026',       label: 'Allied Health'        },
  { value: 'Biomedical Engineers 2025-2028',              label: 'Biomedical Engineers' },
  { value: "Children's Services Award 2010",              label: "Children's Services"  },
  { value: 'Doctors in Training 2022-2026',               label: 'Doctors in Training'  },
  { value: 'Health Allied Managers Admin 2021-2025',      label: 'HAS Managers & Admin' },
  { value: 'Medical Specialists 2022-2026',               label: 'Medical Specialists'  },
  { value: 'Mental Health Services 2024-2028',            label: 'Mental Health'        },
  { value: 'Medical Scientists, Pharm & Psych 2021-2025', label: 'Medical Scientists'   },
  { value: 'Nurses and Midwives 2024-2028',               label: 'Nurses & Midwives'    },
]

const EMPLOYMENT_TYPE_OPTIONS = [
  { value: '',            label: 'All employment types' },
  { value: 'full-time',   label: 'Full-time'            },
  { value: 'part-time',   label: 'Part-time'            },
  { value: 'casual',      label: 'Casual'               },
  { value: 'fixed-term',  label: 'Fixed-term'           },
  { value: 'sessional',   label: 'Sessional'            },
]

// ─── UI state ─────────────────────────────────────────────────────────────────
const isOpen        = ref(false)
const isExpanded    = ref(false)
const isMobileSheet = ref(false)
const showDropdown  = ref(false)
const loading       = ref(false)
const error         = ref('')
const question      = ref('')

// ─── Template refs ────────────────────────────────────────────────────────────
const panelRef    = ref(null)
const bodyRef     = ref(null)
const inputRef    = ref(null)
const titleAreaRef = ref(null)
const dropdownRef  = ref(null)

// ─── Chat data ─────────────────────────────────────────────────────────────────
// Shape: Array<{
//   id: string, title: string, scope: 'page'|'wiki',
//   pageUrl: string, pageTitle: string,
//   createdAt: string,
//   filterEba: string, filterEmploymentType: string,
//   messages: Array<{ role: 'user'|'assistant', content: string, hedging?: boolean, timestamp: string }>
// }>
const chats        = ref([])
const activeChatId = ref(null)

// ─── Computed ─────────────────────────────────────────────────────────────────
const activeChat = computed(() =>
  chats.value.find(c => c.id === activeChatId.value) ?? null
)

const messages = computed(() => activeChat.value?.messages ?? [])

// ─── Per-chat filter state (writable computed — reads/writes the active chat) ──
const filterEba = computed({
  get: () => activeChat.value?.filterEba ?? '',
  set: (val) => {
    const idx = chats.value.findIndex(c => c.id === activeChatId.value)
    if (idx === -1) return
    chats.value[idx] = { ...chats.value[idx], filterEba: val }
    chats.value = [...chats.value]   // trigger Vue reactivity
    saveChats()
  },
})

const filterEmploymentType = computed({
  get: () => activeChat.value?.filterEmploymentType ?? '',
  set: (val) => {
    const idx = chats.value.findIndex(c => c.id === activeChatId.value)
    if (idx === -1) return
    chats.value[idx] = { ...chats.value[idx], filterEmploymentType: val }
    chats.value = [...chats.value]
    saveChats()
  },
})

// ─── Router (used for page navigation from context badge link) ────────────────
const router = useRouter()

// ─── Helpers ─────────────────────────────────────────────────────────────────
function genId() {
  return 'chat_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}

function truncateTitle(text, max = 48) {
  const t = (text || '').trim()
  return t.length > max ? t.slice(0, max) + '…' : t || 'New chat'
}

// ─── Persistence ──────────────────────────────────────────────────────────────
function loadChats() {
  try {
    const raw = localStorage.getItem(LOCAL_CHATS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) chats.value = parsed
    }
  } catch { /* degrade silently */ }
}

function saveChats() {
  try {
    localStorage.setItem(LOCAL_CHATS_KEY, JSON.stringify(chats.value.slice(0, MAX_CHATS)))
  } catch { /* degrade silently */ }
}

// ─── Chat management ──────────────────────────────────────────────────────────
function createChat(pageUrl = '', pageTitle = '', scope = 'wiki') {
  const chat = {
    id:                   genId(),
    title:                'New chat',
    scope,
    pageUrl,
    pageTitle,
    createdAt:            new Date().toISOString(),
    filterEba:            '',
    filterEmploymentType: '',
    messages:             [],
  }
  chats.value = [chat, ...chats.value].slice(0, MAX_CHATS)
  activeChatId.value = chat.id
  saveChats()
  return chat
}

function addMessage(msg) {
  const idx = chats.value.findIndex(c => c.id === activeChatId.value)
  if (idx === -1) return
  chats.value[idx] = {
    ...chats.value[idx],
    messages: [...chats.value[idx].messages, msg],
  }
  // Update chat title from the first user message
  if (msg.role === 'user' && chats.value[idx].title === 'New chat') {
    chats.value[idx] = { ...chats.value[idx], title: truncateTitle(msg.content) }
  }
  // Trigger reactivity
  chats.value = [...chats.value]
  saveChats()
}

function startNewChat() {
  createChat()
  showDropdown.value = false
  question.value     = ''
  error.value        = ''
  nextTick(() => inputRef.value?.focus())
}

function startNewChatFromDropdown() {
  showDropdown.value = false
  nextTick(() => startNewChat())
}

function selectChat(id) {
  activeChatId.value = id
  showDropdown.value = false
  question.value     = ''
  error.value        = ''
  nextTick(() => {
    scrollToBottom()
    inputRef.value?.focus()
  })
}

function clearAllChats() {
  chats.value        = []
  activeChatId.value = null
  showDropdown.value = false
  try { localStorage.removeItem(LOCAL_CHATS_KEY) } catch { /* silent */ }
}

// ─── Panel open / close ───────────────────────────────────────────────────────
function openPanel(detail = {}) {
  const {
    question: pendingQ = '',
    pageUrl   = '',
    pageTitle = '',
    scope     = 'wiki',
  } = detail

  // Decide whether to continue the current chat or start a new one.
  // Start fresh when: no chat exists, OR context has changed
  // (different page, or switching between page/wiki scope).
  const cur       = activeChat.value
  const needsFresh = !activeChatId.value || !cur ||
    (scope === 'page' && cur.pageUrl !== pageUrl) ||
    (scope === 'wiki' && cur.scope  === 'page')

  if (needsFresh) createChat(pageUrl, pageTitle, scope)

  question.value = ''
  error.value    = ''
  isOpen.value   = true
  applyBodyClass()

  nextTick(() => {
    if (pendingQ) {
      question.value = pendingQ
      nextTick(() => submit())
    } else {
      inputRef.value?.focus()
    }
    scrollToBottom()
  })
}

function close() {
  isOpen.value = false
  removeBodyClass()
  showDropdown.value = false
}

function toggleExpand() {
  isExpanded.value = !isExpanded.value
  applyBodyClass()
}

function applyBodyClass() {
  if (typeof document === 'undefined') return
  document.body.classList.add('ask-panel-open')
  if (isExpanded.value) {
    document.body.classList.add('ask-panel-expanded')
  } else {
    document.body.classList.remove('ask-panel-expanded')
  }
}

function removeBodyClass() {
  if (typeof document === 'undefined') return
  document.body.classList.remove('ask-panel-open', 'ask-panel-expanded')
}

// Navigate to the clause page the chat was contextualised on,
// and close the panel so the user reads the source.
function navigateToPage() {
  if (activeChat.value?.pageUrl) {
    router.go(activeChat.value.pageUrl)
    close()
  }
}

// ─── Submit ───────────────────────────────────────────────────────────────────
async function submit() {
  const q = question.value.trim()
  if (!q || q.length < 3 || loading.value) return

  error.value    = ''
  question.value = ''
  resetInputHeight()

  // Ensure an active chat exists
  if (!activeChatId.value) createChat()

  addMessage({ role: 'user', content: q, timestamp: new Date().toISOString() })
  loading.value = true
  await nextTick()
  scrollToBottom()

  // Build history slice (last MAX_HIST_PAIRS pairs → last N*2 messages)
  const allMsgs = activeChat.value?.messages ?? []
  // Exclude the message we just added (it's the last one now), take the rest for history
  const histSlice = allMsgs.slice(0, -1).slice(-(MAX_HIST_PAIRS * 2))
  const history   = histSlice.map(m => ({ role: m.role, content: m.content }))

  try {
    const body = {
      question:             q,
      history:              history.length > 0 ? history : undefined,
      filterEba:            filterEba.value            || undefined,
      filterEmploymentType: filterEmploymentType.value || undefined,
    }
    // Page-scoped: send sourcePath so the worker retrieves the right clause
    if (activeChat.value?.scope === 'page' && activeChat.value?.pageUrl) {
      body.sourcePath = activeChat.value.pageUrl.replace(/\/$/, '').replace(/\.html$/, '')
    }

    const res = await fetch(AI_WORKER_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`Worker returned ${res.status}`)

    const data      = await res.json()
    const rawAnswer = data.answer ?? 'No answer returned.'

    addMessage({
      role:      'assistant',
      content:   rawAnswer,
      hedging:   detectHedging(rawAnswer),
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    error.value = err.message ?? 'Something went wrong — please try again.'
  }

  loading.value = false
  await nextTick()
  scrollToBottom()
  inputRef.value?.focus()
}

// ─── Dropdown ─────────────────────────────────────────────────────────────────
function toggleDropdown() {
  showDropdown.value = !showDropdown.value
}

function handleDropdownOutside(e) {
  if (titleAreaRef.value && !titleAreaRef.value.contains(e.target)) {
    showDropdown.value = false
  }
}

watch(showDropdown, (val) => {
  if (val) {
    nextTick(() => document.addEventListener('click', handleDropdownOutside, true))
  } else {
    document.removeEventListener('click', handleDropdownOutside, true)
  }
})

// ─── Scroll ───────────────────────────────────────────────────────────────────
function scrollToBottom() {
  nextTick(() => {
    if (bodyRef.value) bodyRef.value.scrollTop = bodyRef.value.scrollHeight
  })
}

// ─── Input auto-resize (max ~5 lines) ─────────────────────────────────────────
function autoResize(e) {
  const el = e?.target ?? inputRef.value
  if (!el) return
  el.style.height = 'auto'
  el.style.height = Math.min(el.scrollHeight, 120) + 'px'
}

function resetInputHeight() {
  if (inputRef.value) inputRef.value.style.height = 'auto'
}

// ─── Mobile sheet detection ───────────────────────────────────────────────────
function updateMobileSheet() {
  if (typeof window !== 'undefined') isMobileSheet.value = window.innerWidth < 900
}

// ─── HTML escape (for user message display) ───────────────────────────────────
function escHtml(text) {
  return (text || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>')
}

// ─── Markdown renderer (mirrors SearchModal subset) ───────────────────────────
function renderMarkdown(md) {
  if (!md) return ''
  let html = md

  // Escape HTML entities first so we don't double-escape later
  html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  // Fenced code blocks
  html = html.replace(/```[\w]*\n?([\s\S]*?)```/g, (_, code) =>
    `<pre><code>${code.trim()}</code></pre>`)

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>')

  // Bold + italic
  html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>')
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>')

  // Headings
  html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>')
  html = html.replace(/^## (.+)$/gm,  '<h2>$1</h2>')

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')

  // Auto-bold % and $ amounts (EBA specificity)
  html = html.replace(/\b(\d+(?:\.\d+)?%)/g, '<strong>$1</strong>')
  html = html.replace(/(\$[\d,]+(?:\.\d{1,2})?)/g, '<strong>$1</strong>')

  // Lists
  const lines = html.split('\n')
  const out   = []
  let inOl = false, inUl = false

  for (const line of lines) {
    const olM = line.match(/^(\d+)\.\s+(.+)/)
    const ulM = line.match(/^[-*+]\s+(.+)/)
    if (olM) {
      if (inUl) { out.push('</ul>'); inUl = false }
      if (!inOl) { out.push('<ol>'); inOl = true }
      out.push(`<li>${olM[2]}</li>`)
    } else if (ulM) {
      if (inOl) { out.push('</ol>'); inOl = false }
      if (!inUl) { out.push('<ul>'); inUl = true }
      out.push(`<li>${ulM[1]}</li>`)
    } else {
      if (inOl) { out.push('</ol>'); inOl = false }
      if (inUl) { out.push('</ul>'); inUl = false }
      out.push(line)
    }
  }
  if (inOl) out.push('</ol>')
  if (inUl) out.push('</ul>')
  html = out.join('\n')
  html = html.replace(/<\/ol>\n<ol>/g, '').replace(/<\/ul>\n<ul>/g, '')

  // Paragraphs (double newlines → <p>)
  const blockRe = /^<(h[2-6]|ul|ol|blockquote|hr|pre|div|p[ >])/
  html = html.split(/\n{2,}/).map(chunk => {
    const t = chunk.trim()
    if (!t) return ''
    if (blockRe.test(t)) return t
    return `<p>${t.replace(/\n/g, '<br>')}</p>`
  }).filter(Boolean).join('\n')

  return html
}

// ─── Hedging detector ─────────────────────────────────────────────────────────
function detectHedging(md) {
  if (!md) return false
  const lower = md.toLowerCase()
  return [
    'may vary depending on', 'may vary based on', 'depends on your',
    'recommend seeking', 'recommend consulting', 'seek advice', 'seek legal',
    'consult a lawyer', 'consult your', 'cannot confirm', 'not certain',
    'it is unclear', 'may not apply', 'cannot determine', 'professional advice',
    'i am not able to', 'i cannot', 'unable to confirm',
    'i could not identify', 'could not retrieve', 'i was unable to find',
    'unable to find', 'no information found', "i don't have information",
    'not enough information', 'please specify', 'please include the eba',
    'i need more information', 'clarify which eba', 'specify which eba',
  ].some(p => lower.includes(p))
}

// ─── Lifecycle ────────────────────────────────────────────────────────────────
function handleOpenEvent(e) {
  openPanel(e?.detail ?? {})
}

onMounted(() => {
  loadChats()
  updateMobileSheet()
  if (typeof window !== 'undefined') {
    window.addEventListener('resize', updateMobileSheet)
    window.addEventListener('open-ask-panel', handleOpenEvent)
  }
})

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('resize', updateMobileSheet)
    window.removeEventListener('open-ask-panel', handleOpenEvent)
  }
  document.removeEventListener('click', handleDropdownOutside, true)
  removeBodyClass()
})
</script>

<!-- ══ Global styles (non-scoped) ══════════════════════════════════════════════
     These rules style the "Ask AI" nav button injected by index.js.
     They must be non-scoped to escape the component's CSS isolation.
     The panel itself is a fixed overlay; no layout condensing is applied.
════════════════════════════════════════════════════════════════════════════════ -->
<style>
/* ── Page condensing (desktop only) ─────────────────────────────────────────────
   Reduce the WIDTH of the content and the fixed nav bar rather than adding a
   right margin. margin-right on a width:100% element pushes total width past the
   viewport and causes the horizontal overflow we saw. Constraining width keeps
   everything inside the viewport and genuinely condenses the reading column.
   The panel (position:fixed, right:0) then occupies the freed-up right strip.
   Only applies >=900px; below that the panel is a bottom sheet and nothing moves. */
/* Panel is a fixed overlay — page content and nav bar are intentionally
   left at full width. The panel slides in over the top of the content. */

/* ── Ask AI nav button (rendered inline in index.js Layout) ─────────────────── */
.ask-ai-nav-btn {
  display:         flex;
  align-items:     center;
  gap:             0.35rem;
  padding:         0.35rem 0.7rem;
  border-radius:   8px;
  border:          1px solid var(--vp-c-divider);
  background:      var(--vp-c-bg-soft);
  color:           var(--vp-c-text-2);
  font-size:       0.83rem;
  font-weight:     500;
  cursor:          pointer;
  white-space:     nowrap;
  margin-left:     0.5rem;
  transition:      border-color 0.15s, color 0.15s, box-shadow 0.15s;
}
.ask-ai-nav-btn:hover {
  border-color: var(--vp-c-brand-1);
  color:        var(--vp-c-text-1);
  box-shadow:   0 0 0 2px var(--vp-c-brand-soft);
}
/* Sparkle icon container */
.ask-ai-nav-sparkle {
  display:         inline-flex;
  align-items:     center;
  justify-content: center;
  flex-shrink:     0;
  color:           currentColor;
}

/* Allow the small outer star paths to animate outside the SVG bounding box */
.ask-nav-sparkle-svg { overflow: visible; }

/* Small blinking stars — alternate timing creates a twinkling effect */
.ask-nav-star-sm {
  animation: ask-nav-star-blink 2.8s ease-in-out infinite;
}
.ask-nav-star-sm--b {
  animation-delay: 1.4s;
}

@keyframes ask-nav-star-blink {
  0%, 15%, 80%, 100% { opacity: 1;    }
  42%,  58%          { opacity: 0.05; }
}

/* Collapse text on narrow viewports — icon only */
@media (max-width: 767px) {
  .ask-ai-nav-btn { padding: 0.4rem; margin-left: 0.25rem; }
  .ask-ai-nav-btn .ask-ai-nav-text { display: none; }
}
</style>

<!-- ══ Scoped styles ═══════════════════════════════════════════════════════════ -->
<style scoped>
/* ── Panel shell ─────────────────────────────────────────────────────────────── */
.ask-panel {
  position:         fixed;
  top:              0;
  right:            0;
  height:           100vh;
  width:            380px;
  max-height:       100vh;
  background:       var(--vp-c-bg);
  border-left:      1px solid var(--vp-c-divider);
  box-shadow:       -4px 0 32px rgba(0, 0, 0, 0.1);
  z-index:          9000;
  display:          flex;
  flex-direction:   column;
  overflow:         hidden;
  will-change:      transform;
}

.ask-panel--expanded { width: 520px; }

/* Mobile: slide up from bottom */
.ask-panel--sheet {
  top:           auto;
  bottom:        0;
  left:          0;
  right:         0;
  width:         100%;
  height:        72vh;
  max-height:    88vh;
  border-left:   none;
  border-top:    1px solid var(--vp-c-divider);
  border-radius: 16px 16px 0 0;
  box-shadow:    0 -4px 32px rgba(0, 0, 0, 0.12);
}

/* Mobile backdrop */
.ask-panel-backdrop {
  position:   fixed;
  inset:      0;
  background: oklch(0 0 0 / 0.45);
  z-index:    8999;
}

/* ── Header ─────────────────────────────────────────────────────────────────── */
.ask-panel-header {
  display:         flex;
  align-items:     center;
  justify-content: space-between;
  padding:         0 0.6rem 0 0.75rem;
  height:          52px;
  border-bottom:   1px solid var(--vp-c-divider);
  flex-shrink:     0;
  gap:             0.5rem;
}

.ask-panel-title-area {
  position:  relative;
  flex:      1;
  min-width: 0;
}

.ask-panel-chat-btn {
  display:       flex;
  align-items:   center;
  gap:           0.4rem;
  padding:       0.3rem 0.45rem 0.3rem 0.3rem;
  border:        none;
  background:    none;
  border-radius: 7px;
  cursor:        pointer;
  color:         var(--vp-c-text-1);
  font-size:     0.875rem;
  font-weight:   600;
  max-width:     240px;
  transition:    background 0.12s;
}
.ask-panel-chat-btn:hover   { background: var(--vp-c-bg-soft); }
.aph-sparkle                { flex-shrink: 0; color: var(--vp-c-brand-1); }
.aph-chat-label {
  overflow:      hidden;
  text-overflow: ellipsis;
  white-space:   nowrap;
  flex:          1;
}

/* Header action buttons */
.aph-actions {
  display:     flex;
  align-items: center;
  gap:         0;
  flex-shrink: 0;
}
.aph-btn {
  display:         flex;
  align-items:     center;
  justify-content: center;
  width:           32px;
  height:          32px;
  border:          none;
  background:      none;
  border-radius:   7px;
  cursor:          pointer;
  color:           var(--vp-c-text-2);
  transition:      background 0.12s, color 0.12s;
}
.aph-btn:hover              { background: var(--vp-c-bg-mute); color: var(--vp-c-text-1); }
.aph-btn--close:hover       { background: color-mix(in srgb, var(--vp-c-red-soft, #fef2f2) 60%, transparent); color: var(--vp-c-red-1, #e53e3e); }

/* ── Dropdown ────────────────────────────────────────────────────────────────── */
.ask-panel-dropdown {
  position:      absolute;
  top:           calc(100% + 6px);
  left:          0;
  min-width:     210px;
  max-width:     300px;
  background:    var(--vp-c-bg);
  border:        1px solid var(--vp-c-divider);
  border-radius: 10px;
  box-shadow:    0 8px 24px rgba(0, 0, 0, 0.12);
  z-index:       10;
  overflow:      hidden;
  padding:       4px 0;
}

.apd-item {
  display:     flex;
  align-items: center;
  gap:         0.45rem;
  width:       100%;
  padding:     0.42rem 0.75rem;
  border:      none;
  background:  none;
  text-align:  left;
  cursor:      pointer;
  color:       var(--vp-c-text-1);
  font-size:   0.845rem;
  transition:  background 0.1s;
}
.apd-item:hover             { background: var(--vp-c-bg-soft); }
.apd-item--active           { font-weight: 600; }
.apd-item svg               { flex-shrink: 0; color: var(--vp-c-brand-1); }
.apd-item-text {
  overflow:      hidden;
  text-overflow: ellipsis;
  white-space:   nowrap;
}

.apd-sep {
  height:     1px;
  background: var(--vp-c-divider);
  margin:     4px 0;
}

.apd-action {
  display:     flex;
  align-items: center;
  gap:         0.45rem;
  width:       100%;
  padding:     0.42rem 0.75rem;
  border:      none;
  background:  none;
  text-align:  left;
  cursor:      pointer;
  color:       var(--vp-c-text-2);
  font-size:   0.845rem;
  transition:  background 0.1s, color 0.1s;
}
.apd-action:hover             { background: var(--vp-c-bg-soft); color: var(--vp-c-text-1); }
.apd-action--danger           { color: var(--vp-c-red-1, #e53e3e); }
.apd-action--danger:hover     { background: var(--vp-c-red-soft, #fef2f2); }

/* ── Disclaimer bar ──────────────────────────────────────────────────────────── */
.ask-panel-disclaimer {
  display:       flex;
  align-items:   center;
  flex-wrap:     wrap;
  gap:           0.3rem;
  padding:       0.32rem 0.75rem;
  font-size:     0.7rem;
  color:         var(--vp-c-text-3);
  background:    var(--vp-c-bg-soft);
  border-bottom: 1px solid var(--vp-c-divider);
  flex-shrink:   0;
  line-height:   1.4;
}
.apd-sep-dot  { opacity: 0.5; }
.apd-ctx-link {
  color:           var(--vp-c-brand-1);
  text-decoration: none;
  font-weight:     500;
}
.apd-ctx-link:hover { text-decoration: underline; }

/* ── Messages body ───────────────────────────────────────────────────────────── */
.ask-panel-body {
  flex:            1;
  overflow-y:      auto;
  padding:         0.85rem 0.75rem;
  scroll-behavior: smooth;
  display:         flex;
  flex-direction:  column;
  gap:             0.7rem;
}

/* Empty state */
.apb-empty {
  display:         flex;
  flex-direction:  column;
  align-items:     center;
  justify-content: center;
  text-align:      center;
  padding:         2.5rem 1rem;
  gap:             0.55rem;
  flex:            1;
}
.apb-empty-icon   { color: var(--vp-c-brand-1); opacity: 0.5; }
.apb-empty-title  { font-size: 0.9rem; font-weight: 600; color: var(--vp-c-text-1); margin: 0; }
.apb-empty-sub    { font-size: 0.76rem; color: var(--vp-c-text-3); margin: 0; line-height: 1.5; }

.apb-hints {
  display:        flex;
  flex-direction: column;
  width:          100%;
  margin-top:     0.75rem;
  border:         1px solid var(--vp-c-divider);
  border-radius:  8px;
  background:     var(--vp-c-bg-soft);
  overflow:       hidden;
  text-align:     left;
}
.apb-hint-row {
  display:     flex;
  align-items: center;
  gap:         0.5rem;
  padding:     0.45rem 0.65rem;
  font-size:   0.75rem;
  color:       var(--vp-c-text-2);
  line-height: 1.4;
}
.apb-hint-row + .apb-hint-row { border-top: 1px solid var(--vp-c-divider); }
.apb-hint-row svg              { flex-shrink: 0; opacity: 0.45; }

/* Message rows */
.apm-row          { display: flex; flex-direction: column; gap: 0.2rem; }
.apm-row--user    { align-items: flex-end; }
.apm-row--assistant { align-items: flex-start; }

.apm-bubble {
  max-width:     88%;
  padding:       0.55rem 0.8rem;
  font-size:     0.855rem;
  line-height:   1.58;
  border-radius: 12px;
  word-wrap:     break-word;
}

.apm-row--user .apm-bubble {
  background:    var(--vp-c-brand-soft);
  color:         var(--vp-c-text-1);
  border-radius: 12px 12px 4px 12px;
}
.apm-row--assistant .apm-bubble {
  background:    var(--vp-c-bg-soft);
  border:        1px solid var(--vp-c-divider);
  color:         var(--vp-c-text-1);
  border-radius: 12px 12px 12px 4px;
}

/* Markdown content inside assistant bubble */
.apm-row--assistant .apm-bubble :deep(p)     { margin: 0 0 0.5em; }
.apm-row--assistant .apm-bubble :deep(p:last-child) { margin: 0; }
.apm-row--assistant .apm-bubble :deep(ul),
.apm-row--assistant .apm-bubble :deep(ol)    { margin: 0.3em 0 0.4em 1.25em; padding: 0; }
.apm-row--assistant .apm-bubble :deep(li)    { margin: 0.15em 0; }
.apm-row--assistant .apm-bubble :deep(strong){ font-weight: 700; }
.apm-row--assistant .apm-bubble :deep(h2),
.apm-row--assistant .apm-bubble :deep(h3)    { font-size: 0.88rem; font-weight: 700; margin: 0.5em 0 0.2em; }
.apm-row--assistant .apm-bubble :deep(code)  {
  font-family:   var(--vp-font-family-mono);
  font-size:     0.82em;
  background:    var(--vp-c-bg-mute);
  padding:       0.1em 0.35em;
  border-radius: 3px;
}
.apm-row--assistant .apm-bubble :deep(pre) {
  background:    var(--vp-c-bg-mute);
  padding:       0.6em 0.8em;
  border-radius: 6px;
  overflow-x:    auto;
  margin:        0.4em 0;
}
.apm-row--assistant .apm-bubble :deep(pre code) {
  background: none;
  padding:    0;
}
.apm-row--assistant .apm-bubble :deep(a) {
  color:           var(--vp-c-brand-1);
  text-decoration: underline;
}

/* Loading dots inside assistant bubble */
.apm-bubble--loading { min-width: 72px; }
.ap-dots span {
  display:         inline-block;
  animation:       ask-dot-blink 1.2s infinite;
  opacity:         0;
}
.ap-dots span:nth-child(1) { animation-delay: 0s;   }
.ap-dots span:nth-child(2) { animation-delay: 0.2s; }
.ap-dots span:nth-child(3) { animation-delay: 0.4s; }

@keyframes ask-dot-blink {
  0%, 60%, 100% { opacity: 0; }
  30%           { opacity: 1; }
}

/* Hedging badge */
.apm-hedging {
  display:     flex;
  align-items: center;
  gap:         0.3rem;
  font-size:   0.7rem;
  color:       var(--vp-c-warning-1, #d97706);
  padding:     0 0.4rem;
}

/* Error bar */
.apb-error {
  display:       flex;
  align-items:   flex-start;
  gap:           0.45rem;
  padding:       0.55rem 0.75rem;
  border-radius: 8px;
  background:    var(--vp-c-red-soft, #fef2f2);
  color:         var(--vp-c-red-1, #e53e3e);
  font-size:     0.845rem;
  line-height:   1.45;
}

/* ── Context filter bar ──────────────────────────────────────────────────────── */
.ask-panel-filters {
  display:       flex;
  align-items:   center;
  gap:           0.4rem;
  padding:       0.42rem 0.75rem;
  border-bottom: 1px solid var(--vp-c-divider);
  flex-shrink:   0;
  flex-wrap:     wrap;
  background:    var(--vp-c-bg);
}

.apf-pill {
  display:       inline-flex;
  align-items:   center;
  gap:           0.22rem;
  padding:       0.2rem 0.3rem 0.2rem 0.45rem;
  border:        1px solid var(--vp-c-divider);
  border-radius: 6px;
  background:    var(--vp-c-bg-soft);
  color:         var(--vp-c-text-2);
  font-size:     0.755rem;
  cursor:        pointer;
  min-width:     0;
  transition:    border-color 0.15s, background 0.15s, color 0.15s;
}
.apf-pill:hover,
.apf-pill:focus-within { border-color: var(--vp-c-brand-1); color: var(--vp-c-text-1); }

.apf-pill--active {
  border-color: var(--vp-c-brand-1);
  background:   var(--vp-c-brand-soft);
  color:        var(--vp-c-brand-1);
}

.apf-icon {
  flex-shrink: 0;
  opacity:     0.6;
}
.apf-pill--active .apf-icon { opacity: 1; }

.apf-select-wrap {
  position:    relative;
  display:     flex;
  align-items: center;
  min-width:   0;
}

.apf-select {
  appearance:         none;
  -webkit-appearance: none;
  border:             none;
  background:         transparent;
  color:              inherit;
  font-size:          inherit;
  font-family:        inherit;
  font-weight:        500;
  cursor:             pointer;
  outline:            none;
  padding:            0 14px 0 0;
  margin:             0;
  max-width:          150px;
  min-width:          0;
}

.apf-chevron {
  position:       absolute;
  right:          0;
  opacity:        0.45;
  pointer-events: none;
}
.apf-pill--active .apf-chevron { opacity: 0.7; }

.apf-clear {
  display:         flex;
  align-items:     center;
  justify-content: center;
  width:           14px;
  height:          14px;
  border:          none;
  background:      none;
  color:           inherit;
  cursor:          pointer;
  padding:         0;
  border-radius:   50%;
  flex-shrink:     0;
  margin-left:     0.08rem;
  opacity:         0.65;
  transition:      opacity 0.12s, background 0.12s;
}
.apf-clear:hover { opacity: 1; background: color-mix(in srgb, currentColor 12%, transparent); }

.apf-nudge {
  width:       100%;
  margin:      0.1rem 0 0;
  padding:     0 0.15rem;
  font-size:   0.7rem;
  color:       var(--vp-c-text-3);
  line-height: 1.4;
}

/* ── Footer / input ───────────────────────────────────────────────────────────── */
.ask-panel-footer {
  display:     flex;
  align-items: flex-end;
  gap:         0.5rem;
  padding:     0.6rem 0.75rem;
  border-top:  1px solid var(--vp-c-divider);
  flex-shrink: 0;
  background:  var(--vp-c-bg);
}

.ap-input {
  flex:          1;
  border:        1px solid var(--vp-c-divider);
  border-radius: 10px;
  padding:       0.5rem 0.7rem;
  font-size:     0.875rem;
  font-family:   inherit;
  background:    var(--vp-c-bg-soft);
  color:         var(--vp-c-text-1);
  resize:        none;
  outline:       none;
  line-height:   1.5;
  max-height:    120px;
  overflow-y:    auto;
  transition:    border-color 0.15s, background 0.15s;
}
.ap-input:focus         { border-color: var(--vp-c-brand-1); background: var(--vp-c-bg); }
.ap-input::placeholder  { color: var(--vp-c-text-3); }
.ap-input:disabled      { opacity: 0.55; cursor: not-allowed; }

.ap-send-btn {
  display:         flex;
  align-items:     center;
  justify-content: center;
  width:           36px;
  height:          36px;
  flex-shrink:     0;
  border:          none;
  border-radius:   10px;
  background:      var(--vp-c-brand-1);
  color:           white;
  cursor:          pointer;
  transition:      opacity 0.15s, background 0.15s;
}
.ap-send-btn:hover:not(:disabled) { background: var(--vp-c-brand-2, var(--vp-c-brand-1)); filter: brightness(1.1); }
.ap-send-btn:disabled             { opacity: 0.38; cursor: not-allowed; }

/* ── Transitions ─────────────────────────────────────────────────────────────── */
/* Desktop: slide in from right */
.panel-slide-enter-active,
.panel-slide-leave-active { transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1); }
.panel-slide-enter-from,
.panel-slide-leave-to     { transform: translateX(100%); }

/* Mobile: slide up from bottom */
.panel-sheet-enter-active,
.panel-sheet-leave-active { transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1); }
.panel-sheet-enter-from,
.panel-sheet-leave-to     { transform: translateY(100%); }

/* Backdrop */
.panel-backdrop-enter-active,
.panel-backdrop-leave-active { transition: opacity 0.25s ease; }
.panel-backdrop-enter-from,
.panel-backdrop-leave-to     { opacity: 0; }
</style>
