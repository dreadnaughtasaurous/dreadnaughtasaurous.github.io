import { defineConfig } from 'vitepress'
import sidebar from './sidebar.js'
import { GitChangelog, GitChangelogMarkdownSection } from '@nolebase/vitepress-plugin-git-changelog/vite'

export default defineConfig({
  cleanUrls: true,
  base: '/',
  title: 'EBAdb',
  description: 'A searchable reference for the eight Enterprise Bargaining Agreements covering the Victorian public health sector',
  ignoreDeadLinks: true,

head: [
    ['link', { rel: 'icon', type: 'image/x-icon', href: '/favicon.ico' }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32x32.png' }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '16x16', href: '/favicon-16x16.png' }],
    ['link', { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' }],
    ['link', { rel: 'manifest', href: '/site.webmanifest' }],
    // ── Pagefind prefetch ──────────────────────────────────────────────────────
    // Tells the browser to fetch the Pagefind JS module and its metadata bundle
    // in the background during idle time, so the HTTP cache is warm before the
    // user ever hovers over the Search button. Eliminates cold-start latency on
    // the first search. pagefind-entry.json is the index metadata (~10–30KB);
    // pagefind.js is the loader module (~5KB). The wasm bundle is NOT prefetched
    // here — it is large (~500KB) and is fetched lazily by pagefind.init() only
    // when the user actually interacts with search.
    ['link', { rel: 'prefetch', href: '/pagefind/pagefind.js',          as: 'script' }],
    ['link', { rel: 'prefetch', href: '/pagefind/pagefind-entry.json',  as: 'fetch',  crossorigin: 'anonymous' }],
  ],

  // Tell Vite not to bundle pagefind — it's generated post-build
  vite: {
    plugins: [
      GitChangelog({
        repoURL: () => 'https://github.com/dreadnaughtasaurous/dreadnaughtasaurous.github.io',
      }),
      GitChangelogMarkdownSection({
        sections: {
          disableContributors: true,
        },
      }),
    ],
    build: {
      rollupOptions: {
        external: ['/pagefind/pagefind.js'],
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
      { text: '🏠 Home',      link: '/' },
      { text: '💰 Pay Rates', link: '/pay-rates' },
      { text: '📄 EBAs',      link: '/ebas/' },
      { text: '🏷️ Topics',    link: '/topics/' },
      {
        text: 'More',
        items: [
          { text: '🗄️ Archive',    link: '/archive/' },
          { text: '❓ How to Use', link: '/about/how-to-search/' },
          { text: '📋 Changelog',  link: '/changelog' },
          { text: '📊 Admin Dashboard', link: '/admin/analytics' }
        ]
      },
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