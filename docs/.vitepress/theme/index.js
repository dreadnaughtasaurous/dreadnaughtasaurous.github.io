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
  }
}