<template>
  <ClientOnly>
    <Teleport to="body">
      <!-- Always-present dim backdrop — covers full screen on every step.
           On steps with a spotlight target the spotlight's box-shadow creates
           the cutout illusion (transparent hole over the target element).
           On centred steps (no target) the backdrop dims the whole page. -->
      <Transition name="gt-fade">
        <div
          v-if="active"
          class="gt-backdrop"
          :class="{ 'gt-backdrop--no-dim': spotlightStyle !== null }"
          @click.self="onBackdropClick"
          aria-hidden="true"
        ></div>
      </Transition>

      <!-- Spotlight cutout — rendered ABOVE the backdrop as a sibling,
           using box-shadow to dim everything except the target area.
           Placed after backdrop in DOM so it renders on top of it. -->
      <Transition name="gt-fade">
        <div
          v-if="active && spotlightStyle"
          class="gt-spotlight"
          :style="spotlightStyle"
          aria-hidden="true"
        ></div>
      </Transition>

      <!-- Tour tooltip — always on top -->
      <Transition name="gt-pop">
        <div
          v-if="active"
          class="gt-tooltip"
          :style="tooltipStyle"
          role="dialog"
          aria-modal="true"
          :aria-label="`Tour step ${stepIndex + 1} of ${steps.length}: ${currentStep.headline}`"
        >
          <!-- Header row -->
          <div class="gt-header">
            <span class="gt-badge">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>
              Tour
            </span>
            <span class="gt-step-counter">{{ stepIndex + 1 }} / {{ steps.length }}</span>
            <button class="gt-skip" @click="finish" aria-label="Skip tour">Skip tour</button>
          </div>

          <!-- Progress dots -->
          <div class="gt-dots" role="tablist" aria-label="Tour progress">
            <button
              v-for="(s, i) in steps"
              :key="i"
              class="gt-dot"
              :class="{ 'gt-dot--active': i === stepIndex, 'gt-dot--done': i < stepIndex }"
              @click="goTo(i)"
              :aria-label="`Go to step ${i + 1}: ${s.headline}`"
              :aria-current="i === stepIndex ? 'step' : null"
              role="tab"
            ></button>
          </div>

          <!-- Content -->
          <div class="gt-body">
            <div class="gt-icon" v-html="currentStep.icon"></div>
            <h3 class="gt-headline">{{ currentStep.headline }}</h3>
            <p class="gt-copy" v-html="currentStep.copy"></p>

            <!-- Mode cards for Ask AI step -->
            <div v-if="currentStep.modes" class="gt-mode-cards">
              <div v-for="m in currentStep.modes" :key="m.label" class="gt-mode-card">
                <span class="gt-mode-icon" v-html="m.icon"></span>
                <div>
                  <strong class="gt-mode-label">{{ m.label }}</strong>
                  <span class="gt-mode-desc">{{ m.desc }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Nav row -->
          <div class="gt-nav">
            <button
              v-if="stepIndex > 0"
              class="gt-btn gt-btn--ghost"
              @click="prev"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>
              Back
            </button>
            <span v-else></span>

            <button
              v-if="stepIndex < steps.length - 1"
              class="gt-btn gt-btn--primary"
              @click="next"
            >
              Next
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6"/></svg>
            </button>
            <button
              v-else
              class="gt-btn gt-btn--done"
              @click="finish"
            >
              Done
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12"/></svg>
            </button>
          </div>

          <!-- Caret / pointer arrow -->
          <div
            v-if="caretSide"
            class="gt-caret"
            :class="`gt-caret--${caretSide}`"
          ></div>
        </div>
      </Transition>
    </Teleport>
  </ClientOnly>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, nextTick, watch } from 'vue'

// ─── Storage key ──────────────────────────────────────────────────────────────
const TOUR_KEY = 'eba-tour-complete'

// ─── Step definitions ─────────────────────────────────────────────────────────
// target:        CSS selector for spotlight. null = centred overlay (no spotlight).
// openModal:     dispatch open-search before positioning tooltip.
// afterOpen:     extra delay (ms) after modal opens before positioning tooltip.
// keepModalOpen: do NOT close modal when leaving this step.
// closeModal:    actively close modal on this step.
// caretHint:     preferred tooltip side ('top'|'bottom'|'left'|'right'|'auto').
const steps = [
  {
    target: null,
    headline: 'Welcome to the EBA Wiki',
    icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,
    copy: 'Your complete reference for all Victorian public health EBAs — <strong>9 agreements</strong> fully indexed and cross-referenced. This short tour highlights the key features. It takes under a minute.',
  },
  {
    // On mobile the sidebar is behind a hamburger — handled in positionTooltip.
    target: '.VPSidebar',
    mobileTarget: '.VPLocalNav button.menu',
    headline: 'Navigate by EBA',
    icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,
    copy: 'The sidebar lists every EBA and its sections. On mobile, tap the <strong>menu button</strong> (top-left) to open it. Expand any EBA to browse clauses directly.',
    caretHint: 'right',
    mobileCaret: 'right',
  },
  {
    target: '.sf-input-row',
    mobileTarget: '.VPLocalNav button.menu',
    headline: 'Filter the sidebar',
    icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`,
    copy: 'Type in the sidebar filter to instantly narrow the clause list by name. Press <kbd>F</kbd> at any time to focus it without clicking. Useful when you know part of a clause title and want to jump straight to it without opening full search.',
    caretHint: 'right',
    mobileCaret: 'right',
  },
  {
    target: '.search-trigger',
    headline: 'Search any clause',
    icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>`,
    copy: 'Press <kbd>/</kbd> to open full-text search across all clauses, or to ask a question to the AI assistant.',
    caretHint: 'bottom',
  },
  {
    // Step 4: open modal, spotlight the filter row, tooltip BELOW the filters.
    // caretHint 'top' means the caret points upward (tooltip is below target).
    target: '.search-filters',
    headline: 'Filter by EBA and topic',
    icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>`,
    copy: 'Narrow results to a single EBA, a topic (wages, leave, overtime…), or both. Use <kbd>Shift</kbd>+<kbd>F1</kbd>–<kbd>F9</kbd> as keyboard shortcuts to jump straight to a specific EBA.',
    openModal: true,
    afterOpen: 400,
    caretHint: 'bottom',  // tooltip appears BELOW the filter row — caret points up at it
    keepModalOpen: true,
  },
  {
    // Step 6: spotlight the Suggested operators section — modal is still open from step 5.
    // caretHint 'top' = tooltip appears ABOVE the target; caret points downward at it.
    target: '[data-tour="operator-hints"]',
    headline: 'Power up your search',
    icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>`,
    copy: 'The <strong>Suggested</strong> panel shows operator shortcuts. Type <code>:</code> to begin, <code>eba:</code> to filter by EBA, <code>topic:</code> to filter by topic, or combine them for precision searching.',
    keepModalOpen: true,
    caretHint: 'top',
    mobileCaretHint: 'top',
    mobileH: 360,
  },
  {
    // Step 7: close the modal (auto-fired by next() detecting keepModalOpen→none transition),
    // then spotlight the Ask AI nav button.
    target: '.ask-ai-nav-btn',
    headline: 'Ask the AI assistant',
    icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/></svg>`,
    copy: 'Click the <strong>Ask AI</strong> button in the navigation bar to open the AI pane — available from any page, at any time.',
    caretHint: 'bottom',
  },
  {
    // Step 8: open the AskPanel via custom event, then spotlight the filter pills.
    // fallbackTarget: if ask-panel-filters is hidden (scope=page), spotlight the panel itself.
    target: '.ask-panel-filters',
    fallbackTarget: '.ask-panel',
    headline: 'Set your context first',
    icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"/></svg>`,
    copy: 'Always select your <strong>EBA</strong> and <strong>employment type</strong> before asking a question. This significantly improves the accuracy of AI answers.',
    openAskPanel: true,
    afterOpen: 500,
    keepAskPanelOpen: true,
    caretHint: 'left',
    mobileCaretHint: 'bottom',
  },
  
  {
    // On mobile the appearance toggle is inside the hamburger menu.
    target: '.VPNavBar .theme-switch-wrap',
    targetPad: 4,
    mobileTarget: '.VPNavBarHamburger',
    mobileOpensMenu: true,
    mobileSecondaryTarget: '.VPNavScreen .theme-switch-wrap',
    headline: 'Dark mode',
    icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,
    copy: 'Toggle between light and dark mode. On desktop it\'s the sun/moon icon in the nav bar. On mobile, open the <strong>menu</strong> (top-right) to find it.',
    caretHint: 'bottom',
    mobileCaret: 'bottom',
  },
  {
    target: '.a11y-btn',
    headline: 'Accessibility & reading tools',
    icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="21" x2="4" y2="14"/><line x1="4" y1="10" x2="4" y2="3"/><line x1="12" y1="21" x2="12" y2="12"/><line x1="12" y1="8" x2="12" y2="3"/><line x1="20" y1="21" x2="20" y2="16"/><line x1="20" y1="12" x2="20" y2="3"/><line x1="1" y1="14" x2="7" y2="14"/><line x1="9" y1="8" x2="15" y2="8"/><line x1="17" y1="16" x2="23" y2="16"/></svg>`,
    copy: 'Click <strong>Aa</strong> to open the accessibility panel. Eight settings are available: <strong>text size</strong> (normal → large → extra large), <strong>line spacing</strong>, <strong>letter spacing</strong>, <strong>OpenDyslexic font</strong>, <strong>highlight links</strong>, <strong>high contrast</strong>, <strong>reduce motion</strong>, and <strong>reading mode</strong> — which hides the sidebar and nav for distraction-free browsing. All settings persist across page navigation.',
    caretHint: 'bottom',
  },
  {
    target: null,
    headline: "You're all set!",
    icon: `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>`,
    copy: 'Open any clause page and a short <strong>clause page tour</strong> will appear automatically — it covers bookmarks, copy, related clauses, and more.',
  },
]

// ─── State ────────────────────────────────────────────────────────────────────
const active         = ref(false)
const stepIndex      = ref(0)
const tooltipStyle   = ref({ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' })
const spotlightStyle = ref(null)
const caretSide      = ref(null)

const currentStep = computed(() => steps[stepIndex.value])

// ─── Lifecycle ────────────────────────────────────────────────────────────────
onMounted(() => {
  if (typeof localStorage === 'undefined') return
  if (!localStorage.getItem(TOUR_KEY)) {
    setTimeout(() => { active.value = true; positionTooltip() }, 800)
  }
  window.addEventListener('resize', onResize)
  window.addEventListener('keydown', onKeydown)
})

onUnmounted(() => {
  window.removeEventListener('resize', onResize)
  window.removeEventListener('keydown', onKeydown)
})

// ─── Keyboard handler ─────────────────────────────────────────────────────────
// IMPORTANT: Escape is NOT used to advance/dismiss while on modal-open steps,
// because dispatching Escape to close the modal would also trigger this handler.
// Instead, modal closure uses a dedicated 'close-search' CustomEvent.
function onKeydown(e) {
  if (!active.value) return
  if (e.key === 'ArrowRight') { e.preventDefault(); next() }
  if (e.key === 'ArrowLeft')  { e.preventDefault(); prev() }
  // Only allow Escape to finish when the modal is NOT open for the tour —
  // prevents the tour's Escape handler from firing when the modal itself is open.
  if (e.key === 'Escape' && !currentStep.value.keepModalOpen && !currentStep.value.openModal && !currentStep.value.keepAskPanelOpen) {
    e.preventDefault()
    finish()
  }
}

function onResize() {
  if (active.value) positionTooltip()
}

// ─── Navigation ──────────────────────────────────────────────────────────────
async function next() {
  if (stepIndex.value >= steps.length - 1) { finish(); return }

  const leaving  = steps[stepIndex.value]
  const arriving = steps[stepIndex.value + 1]

  if (leaving.keepModalOpen && !arriving.openModal && !arriving.keepModalOpen) {
    dispatchClose()
    await sleep(300)
  }

  if (leaving.keepAskPanelOpen && !arriving.keepAskPanelOpen) {
    dispatchCloseAskPanel()
    await sleep(300)
  }

  // Close any mobile menu opened by the current step before moving on
  if (leaving.mobileOpensMenu || leaving.mobileOpensSidebar) {
    closeMobileMenuIfOpen()
    await sleep(300)
  }

  stepIndex.value++
  await nextTick()
  await positionTooltip()
}

async function prev() {
  if (stepIndex.value <= 0) return
  const leaving  = steps[stepIndex.value]
  const arriving = steps[stepIndex.value - 1]
  // Going back from a modal step — close if target step doesn't need modal
  if (leaving.keepModalOpen && !arriving.openModal && !arriving.keepModalOpen) {
    dispatchClose()
    await sleep(300)
  }
  if (leaving.keepAskPanelOpen && !arriving.keepAskPanelOpen) {
    dispatchCloseAskPanel()
    await sleep(300)
  }
  stepIndex.value--
  await nextTick()
  await positionTooltip()
}

async function goTo(i) {
  stepIndex.value = i
  await nextTick()
  await positionTooltip()
}

function finish() {
  dispatchClose()
  dispatchCloseAskPanel()
  closeMobileMenuIfOpen()
  active.value = false
  try { localStorage.setItem(TOUR_KEY, '1') } catch { /* ignore */ }
}

// Close the VitePress mobile nav if it was opened by the tour.
// Checks for the open state class VitePress adds to the menu button.
function closeMobileMenuIfOpen() {
  const btn = document.querySelector('.VPNavBarHamburger, .VPNavBarMenuButton')
  if (btn && btn.classList.contains('active')) btn.click()
}

function onBackdropClick() {
  if (!currentStep.value.keepModalOpen && !currentStep.value.openModal && !currentStep.value.keepAskPanelOpen) {
    finish()
  }
}

// ─── Modal control helpers ────────────────────────────────────────────────────
function dispatchOpen() {
  window.dispatchEvent(new CustomEvent('open-search', { detail: {} }))
}
function dispatchOpenAskPanel() {
  window.dispatchEvent(new CustomEvent('open-ask-panel', { detail: {} }))
}
function dispatchCloseAskPanel() {
  window.dispatchEvent(new CustomEvent('close-ask-panel'))
}

// Use a dedicated 'close-search' CustomEvent instead of simulating Escape.
// SearchModal listens for this event in its onMounted handler.
// This prevents the tour's own Escape keydown handler from firing when we
// programmatically close the modal during a step transition.
function dispatchClose() {
  window.dispatchEvent(new CustomEvent('close-search'))
}

// ─── Mobile detection ────────────────────────────────────────────────────────
// VitePress hides the sidebar and nav appearance toggle on mobile (< 960px)
// and puts them behind a hamburger menu instead.
function isMobile() { return window.innerWidth < 960 }

// Mobile button helpers — selectors confirmed via DevTools at 390px viewport.
// .VPNavBar button.button:not([aria-label]) = top-left "More" (opens sidebar)
// .VPNavBarHamburger = top-right hamburger (opens nav screen with appearance toggle)

// ─── Tooltip positioning ──────────────────────────────────────────────────────
const TOOLTIP_W        = 360
const TOOLTIP_H_APPROX = 280   // conservative max — Ask AI step has mode cards
const MARGIN           = 16

async function positionTooltip() {
  const step = currentStep.value

  if (step.openModal) {
    dispatchOpen()
    await sleep(step.afterOpen ?? 400)
  }

  if (step.openAskPanel) {
    dispatchOpenAskPanel()
    await sleep(step.afterOpen ?? 500)
  }

  if (step.closeModal) {
    dispatchClose()
    await sleep(350)
  }

  // Constants used by both mobile and desktop positioning paths
  const PAD = 6
  const GAP = 14

  // No target → centred on screen, full-screen dim backdrop, no spotlight
  if (!step.target) {
    spotlightStyle.value = null
    caretSide.value      = null
    tooltipStyle.value   = {
      position:  'fixed',
      top:       '50%',
      left:      '50%',
      transform: 'translate(-50%, -50%)',
      width:     `${TOOLTIP_W}px`,
    }
    return
  }

  // ── Mobile path: step has a mobileTarget and we are on a narrow viewport ──
  if (isMobile() && step.mobileTarget) {
    const mobileEl = document.querySelector(step.mobileTarget)
    if (mobileEl) {
      // Phase 1: spotlight the hamburger button
      const r1 = mobileEl.getBoundingClientRect()
      spotlightStyle.value = {
        position: 'fixed', left: `${r1.left - PAD}px`, top: `${r1.top - PAD}px`,
        width: `${r1.width + PAD * 2}px`, height: `${r1.height + PAD * 2}px`,
        borderRadius: '8px', boxShadow: '0 0 0 9999px rgba(0,0,0,0.52)',
        pointerEvents: 'none', zIndex: '10000',
      }
      caretSide.value = step.mobileCaret ?? 'bottom'
      const centerX1 = r1.left + r1.width / 2
      tooltipStyle.value = {
        position: 'fixed',
        top: `${r1.bottom + GAP}px`,
        left: `${clamp(centerX1 - TOOLTIP_W / 2, MARGIN, window.innerWidth - TOOLTIP_W - MARGIN)}px`,
        width: `${TOOLTIP_W}px`, transform: 'none',
      }

      if (step.mobileOpensSidebar || step.mobileOpensMenu) {
        // Phase 2: click to open, wait, then move spotlight to secondary target
        await sleep(900)  // let user see the hamburger spotlighted first
        mobileEl.click()
        await sleep(450)  // wait for slide-in/open animation

        if (step.mobileSecondaryTarget) {
          // Spotlight the appearance toggle inside the open menu
          const secEl = document.querySelector(step.mobileSecondaryTarget)
          if (secEl) {
            const r2 = secEl.getBoundingClientRect()
            spotlightStyle.value = {
              position: 'fixed', left: `${r2.left - PAD}px`, top: `${r2.top - PAD}px`,
              width: `${r2.width + PAD * 2}px`, height: `${r2.height + PAD * 2}px`,
              borderRadius: '8px', boxShadow: '0 0 0 9999px rgba(0,0,0,0.52)',
              pointerEvents: 'none', zIndex: '10000',
            }
            const centerX2 = r2.left + r2.width / 2
            caretSide.value = 'bottom'
            tooltipStyle.value = {
              position: 'fixed',
              top: `${r2.bottom + GAP}px`,
              left: `${clamp(centerX2 - TOOLTIP_W / 2, MARGIN, window.innerWidth - TOOLTIP_W - MARGIN)}px`,
              width: `${TOOLTIP_W}px`, transform: 'none',
            }
          }
        }
      }
      return
    }
  }

  let el = document.querySelector(step.target)
  if (!el && step.fallbackTarget) el = document.querySelector(step.fallbackTarget)
  if (!el) {
    // Target not in DOM → centre instead
    spotlightStyle.value = null
    caretSide.value      = null
    tooltipStyle.value   = {
      position:  'fixed',
      top:       '50%',
      left:      '50%',
      transform: 'translate(-50%, -50%)',
      width:     `${TOOLTIP_W}px`,
    }
    return
  }

  // If the element exists but has no dimensions yet (sidebar not yet painted),
  // retry up to 5 times with 100ms gaps before falling back to centred layout.
  let rect = el.getBoundingClientRect()
  if (rect.width === 0 && rect.height === 0) {
    for (let i = 0; i < 5; i++) {
      await sleep(100)
      rect = el.getBoundingClientRect()
      if (rect.width > 0 || rect.height > 0) break
    }
  }
  const vw       = window.innerWidth
  const vh       = window.innerHeight
  const spotPad  = step.targetPad ?? PAD

  // Spotlight: transparent hole via box-shadow spread covering the whole viewport.
  // The spotlight sits ABOVE the backdrop in z-index stacking so its transparent
  // centre reveals the target element while the spread dims everything else.
  // targetPad on a step overrides the default PAD for a looser spotlight fit.
  spotlightStyle.value = {
    position:     'fixed',
    left:         `${rect.left  - spotPad}px`,
    top:          `${rect.top   - spotPad}px`,
    width:        `${rect.width  + spotPad * 2}px`,
    height:       `${rect.height + spotPad * 2}px`,
    borderRadius: '8px',
    boxShadow:    '0 0 0 9999px rgba(0,0,0,0.52)',
    pointerEvents:'none',
    zIndex:       '10000',
  }

  const hint      = (isMobile() && step.mobileCaretHint) ? step.mobileCaretHint : (step.caretHint ?? 'auto')
  let   placement = hint

  if (hint === 'auto') {
    const spaceBelow = vh - rect.bottom
    const spaceAbove = rect.top
    placement = spaceBelow >= TOOLTIP_H_APPROX + MARGIN ? 'bottom'
              : spaceAbove >= TOOLTIP_H_APPROX + MARGIN ? 'top'
              : rect.left  >= TOOLTIP_W + MARGIN        ? 'left'
              : 'right'
  }

  caretSide.value = placement

  const centerX = rect.left + rect.width  / 2
  const centerY = rect.top  + rect.height / 2
  let   top, left

  if (placement === 'bottom') {
    top  = rect.bottom + GAP
    left = clamp(centerX - TOOLTIP_W / 2, MARGIN, vw - TOOLTIP_W - MARGIN)
  } else if (placement === 'top') {
    const tooltipH = (isMobile() && step.mobileH) ? step.mobileH : TOOLTIP_H_APPROX
    top  = rect.top - tooltipH - GAP
    left = clamp(centerX - TOOLTIP_W / 2, MARGIN, vw - TOOLTIP_W - MARGIN)
  } else if (placement === 'right') {
    top  = clamp(centerY - TOOLTIP_H_APPROX / 2, MARGIN, vh - TOOLTIP_H_APPROX - MARGIN)
    left = rect.right + GAP
  } else {
    top  = clamp(centerY - TOOLTIP_H_APPROX / 2, MARGIN, vh - TOOLTIP_H_APPROX - MARGIN)
    left = rect.left - TOOLTIP_W - GAP
  }

  tooltipStyle.value = {
    position:  'fixed',
    top:       `${Math.max(MARGIN, top)}px`,
    left:      `${Math.max(MARGIN, left)}px`,
    width:     `${TOOLTIP_W}px`,
    transform: 'none',
  }
}

function clamp(val, min, max) { return Math.min(Math.max(val, min), max) }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

watch(stepIndex, async () => {
  await nextTick()
  await positionTooltip()
})
</script>

<style scoped>
/* ── Backdrop — always dimmed, full-screen ── */
/* Every tour step gets a greyed-out backdrop. On steps with a spotlight
   target, the spotlight's box-shadow creates a transparent cutout over the
   target element. On centred steps, the backdrop dims the whole page.     */
.gt-backdrop {
  position:       fixed;
  inset:          0;
  z-index:        9999;
  background:     rgba(0, 0, 0, 0.48);
  pointer-events: auto;
}
/* When a spotlight is active, the spotlight's box-shadow does all the dimming.
   The backdrop must be transparent to avoid double-darkening the cutout area. */
.gt-backdrop--no-dim {
  background: transparent;
}

/* ── Spotlight — transparent element whose box-shadow dims everything else ── */
.gt-spotlight {
  position:       fixed;
  z-index:        10000;
  pointer-events: none;
  border-radius:  8px;
  /* box-shadow is set inline via spotlightStyle — covers 9999px in all directions */
  transition: left 0.3s cubic-bezier(0.4, 0, 0.2, 1),
              top  0.3s cubic-bezier(0.4, 0, 0.2, 1),
              width  0.3s cubic-bezier(0.4, 0, 0.2, 1),
              height 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

/* ── Tooltip ── */
.gt-tooltip {
  position:       fixed;
  z-index:        10001;
  width:          360px;
  background:     var(--vp-c-bg);
  border:         1px solid var(--vp-c-divider);
  border-radius:  14px;
  box-shadow:
    0 0 0 1px rgba(74, 42, 114, 0.12),
    0 20px 50px rgba(0, 0, 0, 0.28),
    0 4px 16px rgba(0, 0, 0, 0.12);
  padding:        1.1rem 1.1rem 0.9rem;
  display:        flex;
  flex-direction: column;
  gap:            0.65rem;
  pointer-events: auto;
}

/* ── Header ── */
.gt-header {
  display:     flex;
  align-items: center;
  gap:         0.5rem;
}

.gt-badge {
  display:        inline-flex;
  align-items:    center;
  gap:            0.25rem;
  font-size:      0.65rem;
  font-weight:    700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color:          var(--vp-c-brand-1);
  background:     var(--vp-c-brand-soft);
  border-radius:  4px;
  padding:        0.1rem 0.45rem;
}

.gt-step-counter {
  font-size:   0.72rem;
  color:       var(--vp-c-text-3);
  margin-left: auto;
}

.gt-skip {
  font-size:        0.72rem;
  color:            var(--vp-c-text-3);
  background:       none;
  border:           none;
  cursor:           pointer;
  padding:          0.1rem 0.25rem;
  border-radius:    3px;
  transition:       color 0.12s, background-color 0.12s;
}
.gt-skip:hover {
  color:            var(--vp-c-text-1);
  background-color: var(--vp-c-bg-mute);
}

/* ── Progress dots ── */
.gt-dots {
  display:     flex;
  gap:         0.3rem;
  align-items: center;
}

.gt-dot {
  width:         6px;
  height:        6px;
  border-radius: 50%;
  background:    var(--vp-c-divider);
  border:        none;
  padding:       0;
  cursor:        pointer;
  transition:    all 0.2s ease;
  flex-shrink:   0;
}
.gt-dot--active { width: 18px; border-radius: 3px; background: var(--vp-c-brand-1); }
.gt-dot--done   { background: var(--vp-c-brand-2); opacity: 0.6; }

/* ── Body ── */
.gt-body {
  display:        flex;
  flex-direction: column;
  gap:            0.45rem;
}

.gt-icon    { color: var(--vp-c-brand-1); opacity: 0.85; line-height: 1; }

.gt-headline {
  font-size:   0.95rem;
  font-weight: 700;
  color:       var(--vp-c-text-1);
  margin:      0;
  line-height: 1.3;
}

.gt-copy {
  font-size:   0.82rem;
  color:       var(--vp-c-text-2);
  line-height: 1.6;
  margin:      0;
}

.gt-copy :deep(kbd) {
  display:       inline-block;
  font-size:     0.72rem;
  padding:       0.05rem 0.35rem;
  border:        1px solid var(--vp-c-divider);
  border-radius: 3px;
  background:    var(--vp-c-bg-soft);
  color:         var(--vp-c-text-1);
  font-family:   ui-monospace, monospace;
  line-height:   1.5;
}

.gt-copy :deep(code) {
  font-size:     0.72rem;
  padding:       0.05rem 0.3rem;
  border-radius: 3px;
  background:    var(--vp-c-bg-soft);
  color:         var(--vp-c-brand-1);
  font-family:   ui-monospace, monospace;
}
.gt-copy :deep(strong) { color: var(--vp-c-text-1); font-weight: 600; }

/* ── Mode cards (Ask AI step) ── */
.gt-mode-cards {
  display:        flex;
  flex-direction: column;
  gap:            0.35rem;
  margin-top:     0.1rem;
}

.gt-mode-card {
  display:       flex;
  align-items:   flex-start;
  gap:           0.6rem;
  padding:       0.45rem 0.6rem;
  background:    var(--vp-c-bg-soft);
  border:        1px solid var(--vp-c-divider);
  border-radius: 8px;
}

.gt-mode-icon  { font-size: 0.95rem; line-height: 1; flex-shrink: 0; margin-top: 1px; }
.gt-mode-label { display: block; font-size: 0.77rem; font-weight: 600; color: var(--vp-c-text-1); line-height: 1.3; }
.gt-mode-desc  { display: block; font-size: 0.72rem; color: var(--vp-c-text-3); line-height: 1.4; }

/* ── Nav row ── */
.gt-nav {
  display:         flex;
  align-items:     center;
  justify-content: space-between;
  margin-top:      0.2rem;
  padding-top:     0.6rem;
  border-top:      1px solid var(--vp-c-divider);
}

.gt-btn {
  display:     inline-flex;
  align-items: center;
  gap:         0.3rem;
  padding:     0.38rem 0.85rem;
  font-size:   0.8rem;
  font-weight: 600;
  border-radius: 7px;
  cursor:      pointer;
  border:      none;
  transition:  filter 0.12s, transform 0.1s;
}
.gt-btn:active       { transform: scale(0.96); }
.gt-btn--ghost       { background: var(--vp-c-bg-soft); border: 1px solid var(--vp-c-divider); color: var(--vp-c-text-2); }
.gt-btn--ghost:hover { color: var(--vp-c-text-1); }
.gt-btn--primary       { background: var(--vp-c-brand-1); color: #fff; }
.gt-btn--primary:hover { filter: brightness(1.1); }
.gt-btn--done          { background: #059669; color: #fff; }
.gt-btn--done:hover    { filter: brightness(1.1); }

/* ── Caret ── */
.gt-caret {
  position:   absolute;
  width:      10px;
  height:     10px;
  background: var(--vp-c-bg);
  border:     1px solid var(--vp-c-divider);
  transform:  rotate(45deg);
}
.gt-caret--top    { bottom: -6px; left: 50%; margin-left: -5px; border-top: none;    border-left: none;  }
.gt-caret--bottom { top: -6px;    left: 50%; margin-left: -5px; border-bottom: none; border-right: none; }
.gt-caret--left   { right: -6px;  top: 50%;  margin-top: -5px;  border-bottom: none; border-left: none;  }
.gt-caret--right  { left: -6px;   top: 50%;  margin-top: -5px;  border-top: none;    border-right: none; }

/* ── Transitions ── */
.gt-fade-enter-active, .gt-fade-leave-active { transition: opacity 0.25s ease; }
.gt-fade-enter-from,   .gt-fade-leave-to     { opacity: 0; }

.gt-pop-enter-active { transition: opacity 0.22s ease, transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1); }
.gt-pop-leave-active { transition: opacity 0.15s ease; }
.gt-pop-enter-from   { opacity: 0; transform: scale(0.93) translateY(6px); }
.gt-pop-leave-to     { opacity: 0; }

/* ── Mobile ── */
@media (max-width: 600px) {
  .gt-tooltip { width: calc(100vw - 2rem) !important; left: 1rem !important; transform: none !important; }
  .gt-caret   { display: none; }
}

@media print { .gt-backdrop, .gt-spotlight, .gt-tooltip { display: none !important; } }
</style>