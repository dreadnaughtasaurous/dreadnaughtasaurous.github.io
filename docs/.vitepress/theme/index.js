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
    }
  }
}