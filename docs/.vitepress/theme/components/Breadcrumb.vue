<template>
  <ClientOnly>

    <nav
      v-if="segments.length > 0"
      class="doc-breadcrumb bc-full"
      aria-label="Breadcrumb"
      data-pagefind-ignore
    >
      <a href="/" class="bc-crumb bc-link" aria-label="Home">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.2"
             stroke-linecap="round" stroke-linejoin="round"
             aria-hidden="true">
          <path d="M3 9.5L12 3l9 6.5V20a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z"/>
          <polyline points="9 21 9 12 15 12 15 21"/>
        </svg>
      </a>

      <template v-for="(seg, i) in segments" :key="i">
        <svg class="bc-sep" width="12" height="12" viewBox="0 0 24 24"
             fill="none" stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round"
             aria-hidden="true">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
        <a v-if="seg.href" :href="seg.href" class="bc-crumb bc-link">{{ seg.label }}</a>
        <span v-else class="bc-crumb bc-current" aria-current="page">{{ seg.label }}</span>
      </template>
    </nav>

    <nav
      v-if="parentSegment"
      class="bc-back-nav"
      aria-label="Back navigation"
      data-pagefind-ignore
    >
      <a :href="parentSegment.href" class="bc-back">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round"
             aria-hidden="true">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        <span>{{ parentSegment.label }}</span>
      </a>
    </nav>

  </ClientOnly>
</template>

<script setup>
import { computed } from 'vue'
import { useData, useRoute } from 'vitepress'

const { frontmatter } = useData()
const route           = useRoute()

const NESTED_EBAS = new Set(['has-managers-admin', 'mental-health'])

const SLUG_LABELS = {
  'common-terms':           'Common Terms',
  'health-allied-services': 'Health & Allied Services',
  'managers-admin':         'Managers & Admin',
  'health-professionals':   'Health Professionals',
  'management-admin':       'Management & Admin',
  'rpn-pen-mho':            'RPN / PEN / MHO',
  'support-services':       'Support Services',
  'allowances':             'Allowances',
  'appendices':             'Appendices',
  'classification-staffing':'Classification & Staffing',
  'consultation-disputes':  'Consultation & Disputes',
  'education-pd':           'Education & PD',
  'employment':             'Employment',
  'employment-types':       'Employment Types',
  'hours-of-work':          'Hours of Work',
  'leave':                  'Leave',
  'ohs':                    'OHS',
  'preliminary':            'Preliminary',
  'union-matters':          'Union Matters',
  'wages':                  'Wages',
  'workplace-rights':       'Workplace Rights',
  'accident-pay-allowances':'Accident Pay & Allowances',
  'classification-salaries':'Classification & Salaries',
  'clinical-supervision':   'Clinical Supervision',
  'disputes':               'Disputes',
  'operation':              'Operation',
  'schedules':              'Schedules',
  'transport':              'Transport',
  'union-rights':           'Union Rights',
  'workforce-management':   'Workforce Management',
  'accommodation':          'Accommodation',
  'doctor-employment':      'Doctor Employment',
  'remuneration':           'Remuneration',
  'application-operation':  'Application & Operation',
  'resources':              'Resources',
  'staffing':               'Staffing',
  'letter-of-employment':   'Letter of Employment',
  'safe-patient-care':      'Safe Patient Care',
}

function humanise(slug) {
  if (SLUG_LABELS[slug]) return SLUG_LABELS[slug]
  return slug.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function stripClauseNumber(title) {
  if (!title) return ''
  return title.replace(/^\d+[A-Za-z]?\.?\s+/, '')
}

const segments = computed(() => {
  const path  = route.path.replace(/\.html$/, '').replace(/\/$/, '')
  const parts = path.split('/').filter(Boolean)

  if (parts[0] !== 'ebas') return []
  const ebaFolder = parts[1]
  if (!ebaFolder) return []

  const isNested = NESTED_EBAS.has(ebaFolder)
  const ebaName  = frontmatter.value?.eba || humanise(ebaFolder)
  const ebaHref  = `/ebas/${ebaFolder}/`

  if (parts.length === 2) {
    return [{ label: ebaName, href: null }]
  }

  if (!isNested) {
    const sectionSlug  = parts[2]
    const clauseSlug   = parts[3]
    const sectionLabel = humanise(sectionSlug)
    const sectionHref  = `/ebas/${ebaFolder}/${sectionSlug}/`

    if (!clauseSlug) {
      return [
        { label: ebaName,      href: ebaHref },
        { label: sectionLabel, href: null    },
      ]
    }
    return [
      { label: ebaName,      href: ebaHref     },
      { label: sectionLabel, href: sectionHref },
      { label: stripClauseNumber(frontmatter.value?.title || clauseSlug), href: null },
    ]
  }

  const streamSlug   = parts[2]
  const sectionSlug  = parts[3]
  const clauseSlug   = parts[4]
  const streamLabel  = humanise(streamSlug)
  const streamHref   = `/ebas/${ebaFolder}/${streamSlug}/`

  if (!sectionSlug) {
    return [
      { label: ebaName,     href: ebaHref },
      { label: streamLabel, href: null    },
    ]
  }

  const sectionLabel = humanise(sectionSlug)
  const sectionHref  = `/ebas/${ebaFolder}/${streamSlug}/${sectionSlug}/`

  if (!clauseSlug) {
    return [
      { label: ebaName,      href: ebaHref    },
      { label: streamLabel,  href: streamHref },
      { label: sectionLabel, href: null       },
    ]
  }

  return [
    { label: ebaName,      href: ebaHref      },
    { label: streamLabel,  href: streamHref   },
    { label: sectionLabel, href: sectionHref  },
    { label: stripClauseNumber(frontmatter.value?.title || clauseSlug), href: null },
  ]
})

const parentSegment = computed(() =>
  [...segments.value].reverse().find(s => s.href !== null) ?? null
)
</script>

<style scoped>
.bc-crumb {
  font-size:     0.78rem;
  white-space:   nowrap;
  overflow:      hidden;
  text-overflow: ellipsis;
  line-height:   1.2;
}

.bc-full {
  display:     flex;
  align-items: center;
  gap:         0.2rem;
  flex:        1;
  min-width:   0;
  overflow:    hidden;
}

.bc-link {
  color:           var(--vp-c-text-2);
  text-decoration: none;
  display:         inline-flex;
  align-items:     center;
  border-radius:   3px;
  padding:         0.1rem 0.15rem;
  max-width:       18ch;
  transition:      color 0.15s, background 0.15s;
}

.bc-link:hover {
  color:      var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

.bc-current {
  color:       var(--vp-c-text-1);
  font-weight: 500;
  max-width:   24ch;
}

.bc-sep {
  color:       var(--vp-c-text-3);
  flex-shrink: 0;
}

.bc-back-nav {
  display:    none;
  flex:       1;
  min-width:  0;
  overflow:   hidden;
}

.bc-back {
  display:         inline-flex;
  align-items:     center;
  gap:             0.2rem;
  font-size:       0.78rem;
  color:           var(--vp-c-text-2);
  text-decoration: none;
  white-space:     nowrap;
  overflow:        hidden;
  text-overflow:   ellipsis;
  max-width:       28ch;
  border-radius:   3px;
  padding:         0.1rem 0.15rem;
  transition:      color 0.15s, background 0.15s;
}

.bc-back:hover {
  color:      var(--vp-c-brand-1);
  background: var(--vp-c-brand-soft);
}

@media (min-width: 900px) {
  .bc-full     { display: flex; }
  .bc-back-nav { display: none; }
}

@media (max-width: 899px) {
  .bc-full     { display: none; }
  .bc-back-nav { display: flex; }
}
</style>