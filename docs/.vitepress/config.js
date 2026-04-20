import { defineConfig } from 'vitepress'
import sidebar from './sidebar.js'
import { GitChangelog, GitChangelogMarkdownSection } from '@nolebase/vitepress-plugin-git-changelog/vite'

export default defineConfig({
  base: '/',
  title: 'EBAdb',
  description: 'A searchable reference for the eight Enterprise Bargaining Agreements covering the Victorian public health sector',
  ignoreDeadLinks: true,

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