import DefaultTheme from 'vitepress/theme'
import './style.css'
import HomeCards from './components/HomeCards.vue'
import PayTable from './components/PayTable.vue'
import { h } from 'vue'
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

      // doc-before: toolbar row with AskThisPage and CopyButton.
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
              'justify-content: flex-end',
              'gap: 0.5rem',
              'margin-bottom: 1rem',
            ].join('; ')
          },
          [
            h(AskThisPage),
            h(CopyButton),
          ]
        )
      ),

      'layout-bottom': () => h(KeyboardHelp),
      'doc-after':     () => h(RelatedClauses),
    })
  },
  enhanceApp({ app }) {
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
    app.component('AnalyticsDashboard', AnalyticsDashboard)

  // ── Analytics beacon ───────────────────────────────────────────────────
    // Fires on every client-side page navigation.
    // Sends a pageview event and upserts the session record.
    // Session ID is generated once per browser tab and stored in sessionStorage.
    // No cookies, no persistent tracking, no IP addresses.
    // -----------------------------------------------------------------------
    const ANALYTICS_URL = 'https://eba-analytics-worker.irresistibl.workers.dev'

    // Generate or retrieve session ID for this browser tab
    function getSessionId() {
      const key = 'eba-session-id'
      let id = sessionStorage.getItem(key)
      if (!id) {
        // Simple random ID — not a full ULID but sufficient for session tracking
        id = Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
        sessionStorage.setItem(key, id)
        sessionStorage.setItem('eba-session-started', new Date().toISOString())
        sessionStorage.setItem('eba-session-pagecount', '0')
      }
      return id
    }

    // Parse browser name from UA — mirrors worker-side logic
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

    // Parse device type from UA — mirrors worker-side logic
    function getDevice() {
      const ua = navigator.userAgent
      if (/tablet|ipad|playbook|silk/i.test(ua))                           return 'tablet'
      if (/mobile|iphone|ipod|android.*mobile|blackberry|iemobile/i.test(ua)) return 'mobile'
      return 'desktop'
    }

    // Extract EBA folder name from path — e.g. /ebas/allied-health/... → allied-health
    function getEbaFromPath(path) {
      const parts = path.split('/').filter(Boolean)
      return parts[0] === 'ebas' && parts[1] ? parts[1] : ''
    }

    // Extract section name from path — e.g. /ebas/allied-health/allowances/... → allowances
    function getSectionFromPath(path) {
      const parts = path.split('/').filter(Boolean)
      return parts[0] === 'ebas' && parts[2] ? parts[2] : ''
    }

    // Fire-and-forget beacon — analytics must never break navigation
    function sendBeacon(endpoint, payload) {
      try {
        fetch(`${ANALYTICS_URL}${endpoint}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).catch(() => {})
      } catch { /* silent fail */ }
    }

    router.afterEach((to) => {
      // Skip non-browser environments (SSR/build time)
      if (typeof window === 'undefined') return

      const path      = to.path
      const sessionId = getSessionId()
      const started   = sessionStorage.getItem('eba-session-started') || new Date().toISOString()
      const now       = new Date().toISOString()

      // Increment page count for this session
      const pageCount = parseInt(sessionStorage.getItem('eba-session-pagecount') || '0', 10) + 1
      sessionStorage.setItem('eba-session-pagecount', String(pageCount))

      // Referrer is the previous page path (stored from last navigation)
      const referrer = sessionStorage.getItem('eba-last-path') || ''
      sessionStorage.setItem('eba-last-path', path)

      // Send pageview event
      sendBeacon('/log/pageview', {
        path,
        eba:       getEbaFromPath(path),
        section:   getSectionFromPath(path),
        title:     document.title || '',
        sessionId,
        referrer,
      })

      // Upsert session record
      sendBeacon('/log/session', {
        sessionId,
        pageCount,
        started,
        lastSeen: now,
      })
    })
  }
}