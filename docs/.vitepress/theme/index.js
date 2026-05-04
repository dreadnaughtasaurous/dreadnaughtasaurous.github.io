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

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'nav-bar-content-before': () => h(SearchModal),
    })
  },
  enhanceApp({ app }) {
    app.use(NolebaseGitChangelogPlugin)
    app.component('SearchPage', SearchPage)
    app.component('SearchModal', SearchModal)
    app.component('PayTable', PayTable)
    app.component('HomeCards', HomeCards)
    app.component('FileAttachment', FileAttachment)
  }
}