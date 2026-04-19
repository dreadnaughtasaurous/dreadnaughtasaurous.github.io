import DefaultTheme from 'vitepress/theme'
import './style.css'
import HomeCards from './components/HomeCards.vue'
import PayTable from './components/PayTable.vue'
import { h } from 'vue'
import SearchPage from './components/SearchPage.vue'
import SearchModal from './components/SearchModal.vue'

export default {
  extends: DefaultTheme,
  Layout() {
    return h(DefaultTheme.Layout, null, {
      'nav-bar-content-before': () => h(SearchModal),
    })
  },
  enhanceApp({ app }) {
    app.component('SearchPage', SearchPage)
    app.component('SearchModal', SearchModal)
    app.component('PayTable', PayTable)
    app.component('HomeCards', HomeCards)
  }
}