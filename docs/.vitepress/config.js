import { defineConfig } from 'vitepress'
import sidebar from './sidebar.js'

export default defineConfig({
  base: '/',
  title: 'EBAdb',
  description: 'A searchable reference for the eight Enterprise Bargaining Agreements covering the Victorian public health sector',
  ignoreDeadLinks: true,

  // Tell Vite not to bundle pagefind — it's generated post-build
  vite: {
    build: {
      rollupOptions: {
        external: ['/eba/pagefind/pagefind.js'],
      },
    },
  },

  markdown: {
    container: {
      tipLabel: 'Tip',
      warningLabel: 'Warning',
      dangerLabel: 'Danger',
      infoLabel: 'Info',
      detailsLabel: 'Details',
    },
  },

  themeConfig: {
    logo: '/nav-logo.png',
    outline: { level: [2, 3] },
    nav: [
      { text: 'Home', link: '/' },
      { text: 'Pay Rates', link: '/pay-rates' },
      { text: 'EBAs', link: '/ebas/' },
      { text: 'Topics', link: '/topics/' },
      { text: 'Archive', link: '/archive/' },
      { text: 'How to use', link: '/about/how-to-search/' },
    ],
    sidebar,
    editLink: {
      pattern: 'https://github.com/dreadnaughtasaurous/dreadnaughtasaurous.github.io/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },
    socialLinks: [
      { icon: 'github', link: 'https://github.com/dreadnaughtasaurous/dreadnaughtasaurous.github.io' },
    ],
    footer: {
      message: 'EBAdb',
    },
  },
})