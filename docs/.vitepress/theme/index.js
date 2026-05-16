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

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'nav-bar-content-before': () => h(SearchModal),

      // doc-before: a single toolbar row containing CopyButton (icon, left-pushed
      // via margin-left: auto) and AskThisPage (gradient button, takes remaining
      // space on the right).
      // data-pagefind-body is on the outer wrapper so Pagefind still scopes
      // correctly. The toolbar itself carries data-pagefind-ignore so the button
      // labels are never indexed.
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
    app.component('SearchPage',   SearchPage)
    app.component('SearchModal',  SearchModal)
    app.component('PayTable',     PayTable)
    app.component('HomeCards',    HomeCards)
    app.component('FileAttachment', FileAttachment)
    app.component('CopyButton',   CopyButton)
    app.component('KeyboardHelp', KeyboardHelp)
    app.component('AskThisPage',  AskThisPage)
    app.component('RelatedClauses', RelatedClauses)
  }
}