<template>
  <div class="home-wrapper">

    <div class="home-hero">
      <div class="home-hero-text">
        <h1 class="home-title">Austin Health EBA Wiki</h1>
        <p class="home-subtitle">
          This is a fork of <a href="https://tebooth92.github.io/eba/" target="_blank" rel="noopener noreferrer">@tebooth92's</a> searchable reference for the eight Enterprise Agreements covering the Victorian public health sector.
          Use the search bar above, browse by EBA below, or explore by topic.
        </p>
        <div class="home-hero-actions">
          <a href="/pay-rates" class="home-btn home-btn-primary">💰 Pay Rates</a>
          <a href="/topics/" class="home-btn home-btn-secondary">🏷️ Browse by Topic</a>
          <a href="/about/how-to-search" class="home-btn home-btn-secondary">🔍 How to Search</a>
        </div>
      </div>
      <div class="home-hero-image">
        <div class="image-container">
          <div class="image-bg"></div>
          <img src="/logo.png" alt="Austin Health EBA Wiki" class="image-src" />
        </div>
      </div>
    </div>

    <div class="home-section-label">Enterprise Agreements</div>

    <div class="home-card-grid">
      <a v-for="card in ebaCards" :key="card.link" :href="card.link" class="home-card">
        <article class="box">
          <div class="icon" :style="{ color: card.color, backgroundColor: card.bg }" v-html="card.icon"></div>
          <h2 class="title">{{ card.title }}</h2>
          <p class="details">{{ card.desc }}</p>
        </article>
      </a>
    </div>

    <div class="home-section-label">Reference</div>

    <div class="home-card-grid home-card-grid--slim">
      <a v-for="card in refCards" :key="card.link" :href="card.link" class="home-card">
        <article class="box">
          <div class="icon" :style="{ color: card.color, backgroundColor: card.bg }" v-html="card.icon"></div>
          <h2 class="title">{{ card.title }}</h2>
          <p class="details">{{ card.desc }}</p>
        </article>
      </a>
    </div>

    <div class="home-disclaimer">
    <strong>
    <svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:-2px;margin-right:5px;" aria-hidden="true">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/>
    <line x1="12" y1="17" x2="12.01" y2="17"/>
    </svg>
    Disclaimer: Currency &amp; Accuracy
    </strong>
      <p>This wiki summarises Victorian Public Health Sector Enterprise Agreement clauses for general reference only and does not constitute legal advice. Before acting on or providing advice based on any content here, users must consult the full text of the applicable signed Enterprise Agreement. The administrators accept no liability for outcomes arising from reliance on summaries alone.</p>
    </div>

  </div>
</template>

<script setup>
const s = (path) => `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`

const icons = {
  brain:         s('<path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z"/><path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z"/><path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4"/><path d="M17.599 6.5a3 3 0 0 0 .399-1.375"/><path d="M6.003 5.125A3 3 0 0 0 6.401 6.5"/><path d="M3.477 10.896a4 4 0 0 1 .585-.396"/><path d="M19.938 10.5a4 4 0 0 1 .585.396"/><path d="M6 18a4 4 0 0 1-1.967-.516"/><path d="M19.967 17.484A4 4 0 0 1 18 18"/>'),
  heartpulse:    s('<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/><path d="M3.22 12H9.5l1.5-3 2 4.5 1.5-3h6.28"/>'),
  briefcase:     s('<rect width="20" height="14" x="2" y="7" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/>'),
  flask:         s('<path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/><path d="M8.5 2h7"/><path d="M7 16h10"/>'),
  graduationcap: s('<path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z"/><path d="M22 10v6"/><path d="M6 12.5V16a6 3 0 0 0 12 0v-3.5"/>'),
  stethoscope:   s('<path d="M11 2v2a4 4 0 0 0 4 4h0a4 4 0 0 0 4-4V2"/><path d="M8 2v2a7 7 0 0 0 7 7h0"/><path d="M5 14a7 7 0 0 0 7 7h0a7 7 0 0 0 7-7v-3"/><circle cx="19" cy="11" r="2"/>'),
  handheart:     s('<path d="M11 14H9a2 2 0 0 1-2-2v-1a2 2 0 0 1 2-2h1a2 2 0 0 0 2-2V6a2 2 0 0 1 2-2 1 1 0 0 1 1 1v.5a2 2 0 0 0 2 2H19a1 1 0 0 1 1 1v7.5a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-1a1 1 0 0 1 1-1h2"/><path d="M18 9h.01"/><path d="m15.5 11.5 1 1 2-2"/>'),
  cpu:           s('<rect width="16" height="16" x="4" y="4" rx="2"/><rect width="6" height="6" x="9" y="9" rx="1"/><path d="M15 2v2"/><path d="M15 20v2"/><path d="M2 15h2"/><path d="M2 9h2"/><path d="M20 15h2"/><path d="M20 9h2"/><path d="M9 2v2"/><path d="M9 20v2"/>'),
  baby:          s('<path d="M9 12h.01"/><path d="M15 12h.01"/><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5"/><path d="M19 6.3a9 9 0 0 1 1.8 3.9 2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1"/>'),
  dollar:        s('<circle cx="12" cy="12" r="10"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 18V6"/>'),
  tags:          s('<path d="m15 5 6.3 6.3a2.4 2.4 0 0 1 0 3.4L17 19"/><path d="M9.586 5.586A2 2 0 0 0 8.172 5H3a1 1 0 0 0-1 1v5.172a2 2 0 0 0 .586 1.414L8.29 18.29a2.426 2.426 0 0 0 3.42 0l4.58-4.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="6.5" cy="9.5" r=".5" fill="currentColor"/>'),
  searchcode:    s('<path d="m13 13.5 2-2.5-2-2.5"/><path d="m21 21-4.3-4.3"/><path d="M9 8.5 7 11l2 2.5"/><circle cx="11" cy="11" r="8"/>'),
  archive:       s('<rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/>'),
}

const ebaCards = [
  { icon: icons.brain,         color: '#7C3AED', bg: '#7C3AED1A', title: 'Mental Health Services',                          desc: '2024–2028 · Salary Circular 880',    link: '/ebas/mental-health' },
  { icon: icons.heartpulse,    color: '#E11D48', bg: '#E11D481A', title: 'Nurses and Midwives',                             desc: '2024–2028 · Salary Circular 870',    link: '/ebas/nurses-midwives' },
  { icon: icons.briefcase,     color: '#3B82F6', bg: '#3B82F61A', title: 'Health Allied & Managers Admin',                  desc: '2021–2025 · Salary Circular 858',    link: '/ebas/has-managers-admin' },
  { icon: icons.flask,         color: '#059669', bg: '#0596691A', title: 'Medical Scientists, Pharmacists & Psychologists', desc: '2021–2025 · Salary Circular 873',    link: '/ebas/mspp' },
  { icon: icons.graduationcap, color: '#D97706', bg: '#D977061A', title: 'Doctors in Training',                             desc: '2022–2026 · Salary Circular 875',    link: '/ebas/doctors-in-training' },
  { icon: icons.stethoscope,   color: '#0891B2', bg: '#0891B21A', title: 'Medical Specialists',                             desc: '2022–2026',                          link: '/ebas/medical-specialists' },
  { icon: icons.handheart,     color: '#EA580C', bg: '#EA580C1A', title: 'Allied Health Professionals',                     desc: '2021–2026 · Salary Circular 877',    link: '/ebas/allied-health' },
  { icon: icons.cpu,           color: '#4F46E5', bg: '#4F46E51A', title: 'Biomedical Engineers',                            desc: '2025–2028 · Salary Circular 872',    link: '/ebas/biomedical-engineers' },
  { icon: icons.baby,          color: '#DB2777', bg: '#DB27771A', title: "Children's Services Award",                       desc: '2010 (Modern Award)',                link: '/ebas/childrens-services' },
]

const refCards = [
  { icon: icons.dollar,     color: '#16A34A', bg: '#16A34A1A', title: 'Pay Rates Directory', desc: 'Quick-reference wage tables across all EBAs', link: '/pay-rates' },
  { icon: icons.tags,       color: '#7C3AED', bg: '#7C3AED1A', title: 'Browse by Topic',     desc: 'Every clause grouped by topic',               link: '/topics/' },
  { icon: icons.searchcode, color: '#0284C7', bg: '#0284C71A', title: 'Advanced Search',     desc: 'Filter by EBA, topic, or keyword',            link: '/search.html' },
  { icon: icons.archive,    color: '#78716C', bg: '#78716C1A', title: 'Archive',             desc: 'Expired and superseded agreements',           link: '/archive' },
]
</script>
