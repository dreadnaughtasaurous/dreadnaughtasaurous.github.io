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
    // ── Pagefind preload ───────────────────────────────────────────────────────
    // pagefind.js: modulepreload downloads AND parses the ES module into the
    // browser's module registry during idle time. When initPagefind() later calls
    // import('/pagefind/pagefind.js'), it resolves instantly from the registry
    // rather than triggering a network+parse round-trip.
    // pagefind-entry.json: stays as rel="prefetch" with as="fetch" — it is a JSON
    // data file, not an ES module, so modulepreload does not apply.
    // The WASM bundle (~500KB) is intentionally excluded — it is fetched lazily
    // by pagefind.init() only when the user first opens search.
    ['link', { rel: 'stylesheet', href: 'https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3/dist/tabler-icons.min.css' }],
    ['link', { rel: 'modulepreload', href: '/pagefind/pagefind.js' }],
    ['link', { rel: 'prefetch', href: '/pagefind/pagefind-entry.json', as: 'fetch', crossorigin: 'anonymous' }],
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
       { text: '✨ For You',   link: '/for-you/' },
       {
         text: 'More',
         items: [
           { text: '🏷️ Topics',      link: '/topics/' },
           { text: '❓ How to Use', link: '/about/how-to-use/' },
           { text: '🗄️ Archive',    link: '/archive/' },
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