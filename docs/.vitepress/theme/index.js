import DefaultTheme from 'vitepress/theme'
import './style.css'
import HomeCards from './components/HomeCards.vue'
import PayTable from './components/PayTable.vue'
import { h, Fragment } from 'vue'
import SearchPage from './components/SearchPage.vue'
import SearchModal from './components/SearchModal.vue'
import { NolebaseGitChangelogPlugin } from '@nolebase/vitepress-plugin-git-changelog/client'
import '@nolebase/vitepress-plugin-git-changelog/client/style.css'
import FileAttachment from './components/FileAttachment.vue'
import CopyButton from './components/CopyButton.vue'
import KeyboardHelp from './components/KeyboardHelp.vue'
import RelatedClauses from './components/RelatedClauses.vue'
import AskThisPage from './components/AskThisPage.vue'
import AccessibilityControls from './components/AccessibilityControls.vue'
import AnalyticsDashboard from './components/AnalyticsDashboard.vue'
import ClausePanel from './components/ClausePanel.vue'
import Breadcrumb from './components/Breadcrumb.vue'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'nav-bar-content-before': () => h(SearchModal),

      // AccessibilityControls is placed in nav-bar-content-after.
      // VitePress renders this slot at the far right of .VPNavBarExtra.
      // The actual visual order (dark mode → Aa → book → GitHub) is achieved
      // via CSS flex `order` rules in style.css targeting .VPNavBarExtra children:
      //   .appearance    → order: 1
      //   .a11y-controls → order: 2
      //   .social-links  → order: 3
      'nav-bar-content-after': () => h(AccessibilityControls),

      // doc-before: single toolbar row with Breadcrumb (left) and action
      // buttons (right) separated by space-between.
      // On wide screens (≥ 900px) the full breadcrumb trail fills the left.
      // On narrow screens (< 900px) a compact "← Parent" back-link replaces it.
      // The buttons are wrapped in a div so they stay grouped as a unit.
      'doc-before': () => h(
        'div',
        { 'data-pagefind-body': true, style: 'display:contents' },
        h(
          'div',
          {
            class: 'doc-toolbar',
            'data-pagefind-ignore': true,
            style: [
              'display: flex',
              'align-items: center',
              'justify-content: space-between',
              'gap: 0.5rem',
              'margin-bottom: 1rem',
            ].join('; ')
          },
          [
            h(Breadcrumb),
            h('div', { style: 'display:flex;align-items:center;gap:0.5rem;flex-shrink:0' }, [
              h(AskThisPage),
              h(CopyButton),
            ]),
          ]
        )
      ),

      // layout-bottom: always-mounted overlay components that are event-driven.
      // Fragment is required — VitePress slot functions must return a single VNode.
      'layout-bottom': () => h(Fragment, null, [h(KeyboardHelp), h(ClausePanel)]),

      'doc-after': () => h(RelatedClauses),
    })
  },
  enhanceApp({ app, router }) {
    app.use(NolebaseGitChangelogPlugin)
    app.component('SearchPage',            SearchPage)
    app.component('SearchModal',           SearchModal)
    app.component('PayTable',              PayTable)
    app.component('HomeCards',             HomeCards)
    app.component('FileAttachment',        FileAttachment)
    app.component('CopyButton',            CopyButton)
    app.component('KeyboardHelp',          KeyboardHelp)
    app.component('AskThisPage',           AskThisPage)
    app.component('RelatedClauses',        RelatedClauses)
    app.component('AccessibilityControls', AccessibilityControls)
    app.component('AnalyticsDashboard',    AnalyticsDashboard)
    app.component('ClausePanel',           ClausePanel)
    app.component('Breadcrumb',            Breadcrumb)

    // ── Clause Panel — router interception ─────────────────────────────────
    // onBeforeRouteChange fires inside VitePress's router before any navigation
    // commits. Returning false cancels the navigation entirely.
    //
    // When a navigation targets an /ebas/ clause page that differs from the
    // current page, we cancel it and dispatch a CustomEvent that ClausePanel.vue
    // listens for — opening the panel instead of navigating.
    //
    // Guards applied here:
    //   1. Target must start with /ebas/ (clause pages only)
    //   2. Target must differ from the current page (no same-page interception)
    //   3. The navigation must have originated from a .vp-doc link — we detect
    //      this by checking document.activeElement at the moment of navigation.
    //      If the active element (the link that was just clicked) is inside
    //      .vp-doc, we intercept. If it's in the sidebar or nav, we let through.
    //
    // Note: onBeforeRouteChange receives the destination path as a string.
    // Return false to cancel; return nothing (undefined) to allow.

    if (typeof window !== 'undefined') {
      router.onBeforeRouteChange = (to) => {
        const toPath = typeof to === 'string' ? to : (to.path || '')

        // Only intercept /ebas/ navigations
        if (!toPath.startsWith('/ebas/')) return

        // Normalise both paths for comparison
        const normTo      = toPath.replace(/\/$/, '').replace(/\.html$/, '')
        const normCurrent = window.location.pathname.replace(/\/$/, '').replace(/\.html$/, '')

        // Same-page: let through (anchor scrolls, etc.)
        if (normTo === normCurrent) return

        // Scope guard: only intercept if the click originated inside .vp-doc.
        // document.activeElement is the element that received focus from the
        // click — for a keyboard-accessible link click it will be the <a> itself.
        // For a mouse click, browsers move focus to the clicked element if it is
        // focusable. We walk up from activeElement to check for .vp-doc ancestry.
        // If we cannot confirm the click came from .vp-doc, we let navigation
        // proceed normally (sidebar, nav, Related Clauses panel, etc.).
        const active = document.activeElement
        const inVpDoc = active && active.closest('.vp-doc')
        if (!inVpDoc) return

        // All guards passed — cancel navigation and open the panel instead.
        window.dispatchEvent(
          new CustomEvent('open-clause-panel', { detail: { url: toPath } })
        )

        return false  // cancel the VitePress navigation
      }
    }

    // ── Search highlight engine ────────────────────────────────────────────
    // Triggered by ?highlight=<encoded-phrase> appended to the URL by
    // handleResultClick() in SearchModal.vue and SearchPage.vue.
    //
    // How it works:
    //   1. Read and decode the ?highlight= query parameter from the URL.
    //   2. Use TreeWalker to visit every text node inside .vp-doc.
    //   3. Score each text node by how many query words it contains
    //      (case-insensitive). Pick the highest-scoring node.
    //   4. Scroll that node into view with a 90px top offset to clear the
    //      sticky VitePress nav bar.
    //   5. Wrap the text node's parent element in a <mark class="search-highlight">
    //      so the CSS animation can fade the yellow highlight out.
    //   6. After 3.5s, remove the <mark> wrapper and strip ?highlight= from
    //      the URL via history.replaceState so the address bar stays clean.
    //
    // Why query param not hash:
    //   VitePress's router interprets the hash portion of a URL as a page
    //   anchor and may attempt to scroll to an element with that id. Using
    //   ?highlight= keeps the two systems separate.
    //
    // Why TreeWalker not innerHTML indexOf:
    //   EBA clause pages contain tables, custom containers, and footnotes.
    //   Walking text nodes directly avoids false matches on HTML tag content
    //   and handles split text across sibling nodes gracefully.

    // Run applySearchHighlight on full page loads (when window.location.href
    // was set directly, bypassing the VitePress SPA router).
    // Also runs on SPA navigations via the onAfterRouteChanged call below.
    if (typeof window !== 'undefined') {
      window.addEventListener('DOMContentLoaded', () => applySearchHighlight())
    }

    function applySearchHighlight() {
      // Read the highlight phrase from the current URL
      const params = new URLSearchParams(window.location.search)
      const raw    = params.get('highlight')
      if (!raw) return

      // Decode and split into individual search words (≥ 3 chars each).
      // Short words like "or", "in", "of" would score almost every node —
      // filtering them out keeps the match focused on meaningful terms.
      const phrase = decodeURIComponent(raw).trim()
      const words  = phrase
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length >= 3)

      if (words.length === 0) return

      // Wait for Vue to finish rendering the new page's .vp-doc content.
      // requestAnimationFrame fires after the browser has painted — at this
      // point the DOM is fully updated and text nodes are queryable.
      requestAnimationFrame(() => {
        const docEl = document.querySelector('.vp-doc')
        if (!docEl) return

        // Walk every TEXT_NODE inside .vp-doc
        const walker = document.createTreeWalker(
          docEl,
          NodeFilter.SHOW_TEXT,
          {
            // Skip text nodes inside: headings (h1-h6), the doc toolbar,
            // code blocks, and changelog/related clauses sections — these
            // are structural elements that shouldn't be highlighted.
            acceptNode(node) {
              const parent = node.parentElement
              if (!parent) return NodeFilter.FILTER_REJECT
              const tag = parent.tagName?.toLowerCase() ?? ''

              // Skip headings — they rarely match excerpt text
              if (/^h[1-6]$/.test(tag)) return NodeFilter.FILTER_SKIP

              // Skip code blocks and pre elements
              if (tag === 'code' || tag === 'pre') return NodeFilter.FILTER_SKIP

              // Skip elements marked as pagefind-ignored (doc-toolbar, changelog)
              if (parent.closest('[data-pagefind-ignore]')) return NodeFilter.FILTER_SKIP

              // Skip the related-clauses panel and changelog at page bottom
              if (parent.closest('.related-clauses-panel')) return NodeFilter.FILTER_SKIP
              if (parent.closest('[class*="vp-nolebase-git-changelog"]')) return NodeFilter.FILTER_SKIP

              // Skip whitespace-only nodes
              if (!node.textContent.trim()) return NodeFilter.FILTER_SKIP

              return NodeFilter.FILTER_ACCEPT
            }
          }
        )

        // Score each text node: +1 for each query word found in the node text.
        // We also give a +2 bonus if the node's text contains the full phrase
        // verbatim, which handles short single-word searches more accurately.
        let bestNode  = null
        let bestScore = 0

        let node = walker.nextNode()
        while (node) {
          const text  = node.textContent.toLowerCase()
          let score   = 0
          for (const word of words) {
            if (text.includes(word)) score++
          }
          // Bonus for full phrase match
          if (text.includes(phrase.toLowerCase())) score += 2

          if (score > bestScore) {
            bestScore = score
            bestNode  = node
          }
          node = walker.nextNode()
        }

        // Nothing scored at all — abort silently. This can happen when the
        // search excerpt text comes from synonym injections that aren't
        // present in the visible page content.
        if (!bestNode || bestScore === 0) {
          cleanHighlightParam()
          return
        }

        // Scroll the matched element into view.
        // We scroll the *parent element* (a <p>, <td>, <li> etc.) rather than
        // the text node itself — text nodes don't have scrollIntoView().
        // The 90px offset clears the sticky VitePress nav bar (64px) plus
        // a comfortable visual margin.
        const targetEl = bestNode.parentElement
        if (!targetEl) return

        const rect       = targetEl.getBoundingClientRect()
        const scrollTop  = window.scrollY + rect.top - 90
        window.scrollTo({ top: Math.max(0, scrollTop), behavior: 'smooth' })

        // Wrap the target element's text content in a <mark> for the CSS highlight.
        // We wrap the entire parent element rather than surgically splitting the
        // text node — this avoids issues with partially-matched words breaking
        // the DOM structure inside tables and list items.
        //
        // Guard: only wrap if the element doesn't already contain child elements
        // (e.g. a <td> that contains a nested <strong> or <a>). If it does, we
        // add the class to the parent directly and let CSS highlight the whole block.
        // This prevents the DOM from being broken by inserting a <mark> between
        // an element and its children.
        let markEl

        if (targetEl.children.length === 0) {
          // Simple text node — safe to wrap the whole element
          markEl = document.createElement('mark')
          markEl.className = 'search-highlight'
          targetEl.parentNode.insertBefore(markEl, targetEl)
          markEl.appendChild(targetEl)
        } else {
          // Complex element with children — apply the class directly
          targetEl.classList.add('search-highlight')
          markEl = targetEl
        }

        // Remove the highlight and clean the URL after 3.5 seconds.
        // The CSS animation runs for 3s (0.5s hold + 2.5s fade), so 3.5s gives
        // the fade a moment to fully complete before DOM cleanup.
        setTimeout(() => {
          if (targetEl.children.length === 0 && markEl.tagName === 'MARK') {
            // Unwrap the <mark> by replacing it with the element it contained
            markEl.parentNode.insertBefore(targetEl, markEl)
            markEl.remove()
          } else {
            targetEl.classList.remove('search-highlight')
          }
          cleanHighlightParam()
        }, 3500)
      })
    }

    // Remove ?highlight= from the browser address bar without triggering
    // a navigation. This keeps the URL clean for bookmarking and sharing.
    function cleanHighlightParam() {
      try {
        const url    = new URL(window.location.href)
        const params = url.searchParams
        if (!params.has('highlight')) return
        params.delete('highlight')
        // Reconstruct: keep the path + any remaining params + the hash
        const newUrl = url.pathname + (params.toString() ? '?' + params.toString() : '') + url.hash
        history.replaceState(null, '', newUrl)
      } catch { /* silently ignore — non-critical */ }
    }

    // ── Analytics beacon ───────────────────────────────────────────────────
    // Fires on every client-side page navigation.
    // Sends a pageview event and upserts the session record.
    // Session ID is generated once per browser tab and stored in sessionStorage.
    // No cookies, no persistent tracking, no IP addresses.
    // -----------------------------------------------------------------------
    const ANALYTICS_URL = 'https://eba-analytics-worker.irresistibl.workers.dev'

    function getSessionId() {
      const key = 'eba-session-id'
      let id = sessionStorage.getItem(key)
      if (!id) {
        id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
        sessionStorage.setItem(key, id)
        sessionStorage.setItem('eba-session-started', new Date().toISOString())
        sessionStorage.setItem('eba-session-pagecount', '0')
      }
      return id
    }

    function getBrowser() {
      const ua = navigator.userAgent
      if (/edg\//i.test(ua))           return 'Edge'
      if (/opr\//i.test(ua))           return 'Opera'
      if (/firefox\//i.test(ua))       return 'Firefox'
      if (/chrome\//i.test(ua))        return 'Chrome'
      if (/safari\//i.test(ua))        return 'Safari'
      if (/msie|trident/i.test(ua))    return 'IE'
      return 'Other'
    }

    function getDevice() {
      const ua = navigator.userAgent
      if (/tablet|ipad|playbook|silk/i.test(ua))                              return 'tablet'
      if (/mobile|iphone|ipod|android.*mobile|blackberry|iemobile/i.test(ua)) return 'mobile'
      return 'desktop'
    }

    function getEbaFromPath(path) {
      const parts = path.split('/').filter(Boolean)
      return parts[0] === 'ebas' && parts[1] ? parts[1] : ''
    }

    function getSectionFromPath(path) {
      const parts = path.split('/').filter(Boolean)
      return parts[0] === 'ebas' && parts[2] ? parts[2] : ''
    }

    function sendBeacon(endpoint, payload) {
      try {
        fetch(`${ANALYTICS_URL}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => {})
      } catch { /* silent fail */ }
    }

    if (typeof window !== 'undefined') router.onAfterRouteChanged = (to) => {
      const path      = typeof to === 'string' ? to : (to.path || '')
      const sessionId = getSessionId()
      const started   = sessionStorage.getItem('eba-session-started') || new Date().toISOString()
      const now       = new Date().toISOString()

      const pageCount = parseInt(sessionStorage.getItem('eba-session-pagecount') || '0', 10) + 1
      sessionStorage.setItem('eba-session-pagecount', String(pageCount))

      const referrer = sessionStorage.getItem('eba-last-path') || ''
      sessionStorage.setItem('eba-last-path', path)

      sendBeacon('/log/pageview', {
        path,
        eba:       getEbaFromPath(path),
        section:   getSectionFromPath(path),
        title:     document.title || '',
        sessionId,
        referrer,
      })

      sendBeacon('/log/session', {
        sessionId,
        pageCount,
        started,
        lastSeen: now,
      })

      // SPA navigation path — also attempt highlight in case the user
      // navigates to a ?highlight= URL via back/forward buttons.
      applySearchHighlight()
    }
  }
}