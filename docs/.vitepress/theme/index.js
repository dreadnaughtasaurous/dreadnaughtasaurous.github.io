import DefaultTheme from 'vitepress/theme'
import './style.css'
import HomeCards from './components/HomeCards.vue'
import PayTable from './components/PayTable.vue'
import { h, Fragment } from 'vue'
import SearchModal from './components/SearchModal.vue'
import { NolebaseGitChangelogPlugin } from '@nolebase/vitepress-plugin-git-changelog/client'
import '@nolebase/vitepress-plugin-git-changelog/client/style.css'
import FileAttachment from './components/FileAttachment.vue'
import CopyButton from './components/CopyButton.vue'
import KeyboardHelp from './components/KeyboardHelp.vue'
import RelatedClauses from './components/RelatedClauses.vue'
import LegislationPanel from './components/LegislationPanel.vue'
import AskThisPage from './components/AskThisPage.vue'
import AccessibilityControls from './components/AccessibilityControls.vue'
import AnalyticsDashboard from './components/AnalyticsDashboard.vue'
import ClausePanel from './components/ClausePanel.vue'
import Breadcrumb from './components/Breadcrumb.vue'
import BookmarkButton from './components/BookmarkButton.vue'
import GuidedTour from './components/GuidedTour.vue'
import ClausePageTour from './components/ClausePageTour.vue'
import MobileNav from './components/MobileNav.vue'
import SidebarFilter from './components/SidebarFilter.vue'
import ScrollToTop from './components/ScrollToTop.vue'
import CommandPalette from './components/CommandPalette.vue'
import GlossaryTooltip from './components/GlossaryTooltip.vue'

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

      // sidebar-nav-before: injected at the very top of .VPSidebar, above all
      // nav items. SidebarFilter renders a compact text input that filters all
      // clause pages across every EBA using sidebar.js data directly.
      // ClientOnly is handled inside SidebarFilter.vue itself.
      'sidebar-nav-before': () => h(SidebarFilter),

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
              'align-items: flex-start',
              'justify-content: space-between',
              'gap: 0.5rem',
              'margin-bottom: 1rem',
            ].join('; ')
          },
          [
            h(Breadcrumb),
            h('div', { style: 'display:flex;align-items:center;gap:0.5rem;flex-shrink:0' }, [
              h(AskThisPage,   { 'data-tour': 'ask-this-page-btn' }),
              h(CopyButton,    { 'data-tour': 'copy-btn' }),
              h(BookmarkButton, { 'data-tour': 'bookmark-btn' }),
            ]),
          ]
        )
      ),

      // layout-bottom: always-mounted overlay components that are event-driven.
      // Fragment is required — VitePress slot functions must return a single VNode.
      'layout-bottom': () => h(Fragment, null, [h(KeyboardHelp), h(ClausePanel), h(GuidedTour), h(ClausePageTour), h(MobileNav), h(ScrollToTop), h(CommandPalette), h(GlossaryTooltip)]),

      'doc-after': () => h(Fragment, null, [h(RelatedClauses), h(LegislationPanel)]),
    })
  },
  enhanceApp({ app, router }) {
    app.use(NolebaseGitChangelogPlugin)
    app.component('SearchModal',           SearchModal)
    app.component('PayTable',              PayTable)
    app.component('HomeCards',             HomeCards)
    app.component('FileAttachment',        FileAttachment)
    app.component('CopyButton',            CopyButton)
    app.component('KeyboardHelp',          KeyboardHelp)
    app.component('AskThisPage',           AskThisPage)
    app.component('RelatedClauses',        RelatedClauses)
    app.component('LegislationPanel',      LegislationPanel)
    app.component('AccessibilityControls', AccessibilityControls)
    app.component('AnalyticsDashboard',    AnalyticsDashboard)
    app.component('ClausePanel',           ClausePanel)
    app.component('Breadcrumb',            Breadcrumb)
    app.component('BookmarkButton',        BookmarkButton)
    app.component('GuidedTour',            GuidedTour)
    app.component('ClausePageTour',        ClausePageTour)
    app.component('MobileNav',             MobileNav)
    app.component('SidebarFilter',         SidebarFilter)
    app.component('CommandPalette',        CommandPalette)

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
        if (!toPath.startsWith('/ebas/')) return
        const normTo      = toPath.replace(/\/$/, '').replace(/\.html$/, '')
        const normCurrent = window.location.pathname.replace(/\/$/, '').replace(/\.html$/, '')
        if (normTo === normCurrent) return
        const activeEl = document.activeElement
        const inVpDoc  = activeEl && activeEl.closest('.vp-doc')
        if (!inVpDoc) return
        const inPanel = activeEl && activeEl.closest('.clause-panel')
        if (inPanel) return
        window.dispatchEvent(
          new CustomEvent('open-clause-panel', { detail: { url: toPath } })
        )
        return false
      }
    }

    // ── Search highlight engine ────────────────────────────────────────────
    // Triggered by ?highlight=<encoded-phrase> appended to the URL by
    // handleResultClick() in SearchModal.vue.
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
      window.addEventListener('DOMContentLoaded', () => {
        applySearchHighlight()
        highlightActivePayColumns()
      })
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

      if (words.length === 0) {
        cleanHighlightParam()
        return
      }

      // Wait for VitePress to finish rendering the page content before walking.
      // requestAnimationFrame gives the Vue render cycle one frame to complete.
      requestAnimationFrame(() => {
        const docEl = document.querySelector('.vp-doc')
        if (!docEl) { cleanHighlightParam(); return }

        // Walk every text node under .vp-doc and score it
        const walker = document.createTreeWalker(docEl, NodeFilter.SHOW_TEXT)
        let bestNode  = null
        let bestScore = 0
        let node

        while ((node = walker.nextNode())) {
          const text = node.textContent.toLowerCase()
          let score  = 0
          for (const word of words) {
            if (text.includes(word)) score++
          }
          if (score > bestScore) {
            bestScore = score
            bestNode  = node
          }
        }

        if (!bestNode || bestScore === 0) { cleanHighlightParam(); return }

        // Scroll the best matching node's parent into view
        const target = bestNode.parentElement
        if (!target) { cleanHighlightParam(); return }

        const rect    = target.getBoundingClientRect()
        const offset  = 90 // clears the sticky VitePress nav bar
        const scrollY = window.scrollY + rect.top - offset
        window.scrollTo({ top: scrollY, behavior: 'smooth' })

        // Wrap with a <mark> for the CSS fade animation
        const mark = document.createElement('mark')
        mark.className = 'search-highlight'
        target.parentNode?.insertBefore(mark, target)
        mark.appendChild(target)

        // Remove the mark and clean the URL after 3.5s
        setTimeout(() => {
          const parent = mark.parentNode
          if (parent) {
            while (mark.firstChild) parent.insertBefore(mark.firstChild, mark)
            parent.removeChild(mark)
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

    // ── Pay table column highlighter ──────────────────────────────────────
    // Scans every .pay-table-wrap table on the current page.
    // For each table, reads the <th class="pt-rate"> cells to find date headers
    // formatted as 'D MMM YYYY'. Compares each against today to find the
    // highest-indexed date that is on or before now — that is the active column.
    // Stamps the class 'pt-col-current' onto the matching <th> and every <td>
    // in the same column position, so CSS can apply the highlight tint.
    //
    // Idempotent: strips any existing pt-col-current classes before re-running,
    // so calling this multiple times on the same page is safe.
    //
    // Non-date <th class="pt-rate"> cells (e.g. plain "Rate" headers) are
    // silently skipped — the Date constructor returns NaN for non-date strings
    // and we guard against that explicitly.

    function highlightActivePayColumns() {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // Strip any existing highlights first (idempotency)
      document.querySelectorAll('.pt-col-current').forEach(el => {
        el.classList.remove('pt-col-current')
      })

      // Process every pay-table-wrap table on the page
      document.querySelectorAll('.pay-table-wrap table').forEach(table => {
        const headerRow = table.querySelector('thead tr')
        if (!headerRow) return

        const allHeaders = Array.from(headerRow.querySelectorAll('th'))

        // Build a map of column index → parsed date, only for pt-rate headers
        // whose text content parses as a valid D MMM YYYY date.
        let bestColIdx  = -1
        let bestDate    = null

        allHeaders.forEach((th, colIdx) => {
          if (!th.classList.contains('pt-rate')) return
          const text = th.textContent.trim()
          const d    = new Date(text)
          // NaN check: an unparseable string (e.g. "Rate") gives NaN
          if (isNaN(d.getTime())) return
          d.setHours(0, 0, 0, 0)
          if (d <= today) {
            if (bestDate === null || d >= bestDate) {
              bestDate   = d
              bestColIdx = colIdx
            }
          }
        })

        // Nothing found (all dates in the future, or no date headers) — skip
        if (bestColIdx === -1) return

        // Highlight the header cell
        allHeaders[bestColIdx].classList.add('pt-col-current')

        // Highlight every body cell in the same column position.
        // We use column index not class — a row may have cells without pt-rate
        // (e.g. pt-class, pt-code) so we must count by position.
        table.querySelectorAll('tbody tr').forEach(row => {
          const cells = Array.from(row.querySelectorAll('td'))
          if (cells[bestColIdx]) {
            cells[bestColIdx].classList.add('pt-col-current')
          }
        })
      })
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
      // Re-run pay column highlighter after every SPA navigation —
      // the .vp-doc content is replaced on each route change so the
      // DOM walker must run fresh against the new page's tables.
      requestAnimationFrame(() => highlightActivePayColumns())
    }
  }
}
