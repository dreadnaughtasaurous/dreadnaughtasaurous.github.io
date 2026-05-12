<template>
  <div class="copy-btn-wrap">
    <button
      class="copy-btn"
      :class="{ 'copy-btn--success': copied, 'copy-btn--error': hasError }"
      :disabled="copying"
      :aria-label="buttonTitle"
      :title="buttonTitle"
      @click="copyContents"
    >
        <!-- Idle: copy icon (svgrepo.com/svg/522391/copy) -->
        <svg v-if="!copied && !hasError" width="16" height="16" viewBox="0 0 24 24"
            fill="none" stroke="currentColor" stroke-width="2"
            stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M16 2H8C6.9 2 6 2.9 6 4V18C6 19.1 6.9 20 8 20H18C19.1 20 20 19.1 20 18V6L16 2Z"/>
        <path d="M16 2V6H20"/>
        <path d="M4 6H3C2.4 4 2 4.6 2 5V21C2 21.6 2.4 22 3 22H15C15.6 22 16 21.6 16 21V20"/>
        </svg>
      <!-- Success: animated tick icon -->
      <svg v-if="copied" class="icon-tick" width="16" height="16" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" stroke-width="2.5"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <polyline points="20 6 9 17 4 12"/>
      </svg>
      <!-- Error: X icon -->
      <svg v-if="hasError" width="16" height="16" viewBox="0 0 24 24"
           fill="none" stroke="currentColor" stroke-width="2.5"
           stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <line x1="18" y1="6" x2="6" y2="18"/>
        <line x1="6" y1="6" x2="18" y2="18"/>
      </svg>
    </button>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'

const copied   = ref(false)
const hasError = ref(false)
const copying  = ref(false)

const buttonTitle = computed(() => {
  if (copied.value)   return 'Copied!'
  if (hasError.value) return 'Copy failed — try again'
  return 'Copy page contents'
})

async function copyContents() {
  copying.value  = true
  hasError.value = false
  copied.value   = false

  try {
    const container = document.querySelector('.vp-doc')
    if (!container) throw new Error('Could not find .vp-doc content container')

    const clone = container.cloneNode(true)

    // Remove elements that should not appear in the Jira ticket
    const selectorsToRemove = [
      '.copy-btn-wrap',
      '#print-btn',
      '.edit-link',
      '.pager',
      '.vp-nolebase-git-changelog',
      '.nolebase-git-changelog',
      '[class*="git-changelog"]',
      '[class*="GitChangelog"]',
      'h2#changelog',
      '.header-anchor',
      '.lang',
      '.line-numbers-wrapper',
    ]
    selectorsToRemove.forEach(sel =>
      clone.querySelectorAll(sel).forEach(el => el.remove())
    )

    // Remove changelog h2 and all following siblings
    const changelogH2 = clone.querySelector('h2[id="changelog"]')
    if (changelogH2) {
      let next = changelogH2.nextElementSibling
      while (next) {
        const toRemove = next
        next = next.nextElementSibling
        toRemove.remove()
      }
      changelogH2.remove()
    }

    const html = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.6;color:#172b4d;">
        ${clone.innerHTML}
      </div>`

    const plainText = clone.innerText || clone.textContent || ''

    if (navigator.clipboard && window.ClipboardItem) {
      await navigator.clipboard.write([
        new ClipboardItem({
          'text/html':  new Blob([html],      { type: 'text/html'  }),
          'text/plain': new Blob([plainText], { type: 'text/plain' }),
        })
      ])
    } else {
      await navigator.clipboard.writeText(plainText)
    }

    copied.value  = true
    copying.value = false
    setTimeout(() => { copied.value = false }, 2500)

  } catch (err) {
    console.error('[CopyButton] clipboard write failed:', err)
    hasError.value = true
    copying.value  = false
    setTimeout(() => { hasError.value = false }, 3000)
  }
}
</script>

<style scoped>
.copy-btn-wrap {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1rem;
}

.copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  padding: 0;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg-soft);
  border: 1px solid var(--vp-c-divider);
  border-radius: 6px;
  cursor: pointer;
  transition:
    background  150ms ease,
    color       150ms ease,
    border-color 150ms ease,
    transform   150ms ease;
}

.copy-btn:hover:not(:disabled) {
  background: var(--vp-c-bg-mute);
  color: var(--vp-c-text-1);
  border-color: var(--vp-c-brand);
}

.copy-btn:active:not(:disabled) {
  transform: scale(0.92);
}

.copy-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

/* ── Success state ── */
.copy-btn--success {
  color:        #22863a !important;
  border-color: #34d058 !important;
  background:   #f0fff4 !important;
}

/* Tick draws in via stroke-dashoffset animation */
.icon-tick {
  stroke-dasharray: 30;
  stroke-dashoffset: 30;
  animation: draw-tick 250ms ease forwards;
}

@keyframes draw-tick {
  to { stroke-dashoffset: 0; }
}

/* ── Error state ── */
.copy-btn--error {
  color:        #cb2431 !important;
  border-color: #f97583 !important;
  background:   #fff5f5 !important;
}
</style>