/**
 * eba-registry.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for all EBA metadata used across the wiki.
 *
 * Consumers (current + planned):
 *   SearchModal.vue      — ebaColors, ebaList, ebaSlugLabels
 *   EBAStatusStrip.vue   — EBA_REGISTRY, getEBAStatus
 *   EBAExplorer.vue      — EBA_REGISTRY
 *   Browse grid          — EBA_REGISTRY
 *
 * ── Adding a newly ratified agreement ────────────────────────────────────────
 * 1. Add a new entry with the correct family, nominalExpiry, and archived:false.
 * 2. Do NOT edit the old entry — getEBAStatus() detects the newer sibling
 *    automatically and returns 'superseded' for the older entry.
 *
 * ── Archiving a superseded agreement ─────────────────────────────────────────
 * 1. Set archived: true on the old entry.
 * 2. Update indexPath to /ebas/archived/<slug>/.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Days before nominal expiry at which the amber 'Expiring Soon' chip appears. */
const EXPIRING_SOON_DAYS = 180

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

export const EBA_REGISTRY = [
  {
    slug:          'allied-health',
    name:          'Allied Health Professionals 2021-2026',
    shortName:     'Allied Health',
    family:        'allied-health',
    nominalExpiry: '2026-02-28',
    isModernAward: false,
    color:         '#EA580C',
    bg:            '#EA580C1A',
    indexPath:     '/ebas/allied-health/',
    pdfPath:       '/attachments/allied-health/allied-health-eba-2021-2026.pdf',
    pdfExternal:   false,
    archived:      false,
  },
  {
    slug:          'biomedical-engineers',
    name:          'Biomedical Engineers 2025-2028',
    shortName:     'Biomedical Engineers',
    family:        'biomedical-engineers',
    nominalExpiry: '2028-07-31',
    isModernAward: false,
    color:         '#4F46E5',
    bg:            '#4F46E51A',
    indexPath:     '/ebas/biomedical-engineers/',
    // ⚠ Verify: on-disk filename reads 2024-2028 but EBA title is 2025-2028.
    pdfPath:       '/attachments/biomedical-engineers/biomedical-engineers-eba-2024-2028.pdf',
    pdfExternal:   false,
    archived:      false,
  },
  {
    slug:          'childrens-services',
    // Must match the Pagefind filter value stored at index time — do not change.
    name:          "Children's Services Award 2010",
    shortName:     "Children's Services",
    family:        'childrens-services',
    nominalExpiry: null,       // Modern Awards carry no nominal expiry date.
    isModernAward: true,
    color:         '#DB2777',
    bg:            '#DB27771A',
    indexPath:     '/ebas/childrens-services/',
    pdfPath:       'https://awards.fairwork.gov.au/MA000120.html',
    pdfExternal:   true,
    archived:      false,
  },
  {
    slug:          'doctors-in-training',
    name:          'Doctors in Training 2022-2026',
    shortName:     'Doctors in Training',
    family:        'doctors-in-training',
    nominalExpiry: '2026-02-28',
    isModernAward: false,
    color:         '#D97706',
    bg:            '#D977061A',
    indexPath:     '/ebas/doctors-in-training/',
    pdfPath:       '/attachments/doctors-in-training/doctors-in-training-eba-2022-2026.pdf',
    pdfExternal:   false,
    archived:      false,
  },
  {
    slug:          'has-managers-admin',
    // Ampersand is intentional — matches the Pagefind filter value in the index.
    name:          'Health Allied & Managers Admin 2021-2025',
    shortName:     'HAS Managers & Admin',
    family:        'has-managers-admin',
    nominalExpiry: '2025-06-30',
    isModernAward: false,
    color:         '#3B82F6',
    bg:            '#3B82F61A',
    indexPath:     '/ebas/has-managers-admin/',
    pdfPath:       '/attachments/has-managers-admin/has-managers-admin-eba-2021-2025.pdf',
    pdfExternal:   false,
    archived:      false,
  },
  {
    slug:          'medical-specialists',
    name:          'Medical Specialists 2022-2026',
    shortName:     'Medical Specialists',
    family:        'medical-specialists',
    nominalExpiry: '2026-02-28',
    isModernAward: false,
    color:         '#0891B2',
    bg:            '#0891B21A',
    indexPath:     '/ebas/medical-specialists/',
    pdfPath:       '/attachments/medical-specialists/medical-specialists-eba-2022-2026.pdf',
    pdfExternal:   false,
    archived:      false,
  },
  {
    slug:          'mental-health',
    name:          'Mental Health Services 2024-2028',
    shortName:     'Mental Health',
    family:        'mental-health',
    nominalExpiry: '2028-12-30',
    isModernAward: false,
    color:         '#7C3AED',
    bg:            '#7C3AED1A',
    indexPath:     '/ebas/mental-health/',
    pdfPath:       '/attachments/mental-health/mental-health-eba-2024-2028.pdf',
    pdfExternal:   false,
    archived:      false,
  },
  {
    slug:          'mspp',
    name:          'Medical Scientists, Pharm & Psych 2021-2025',
    shortName:     'Medical Scientists',
    family:        'mspp',
    nominalExpiry: '2025-11-30',
    isModernAward: false,
    color:         '#059669',
    bg:            '#0596691A',
    indexPath:     '/ebas/mspp/',
    pdfPath:       '/attachments/mspp/mspp-eba-2021-2025.pdf',
    pdfExternal:   false,
    archived:      false,
  },
  {
    slug:          'nurses-midwives',
    name:          'Nurses and Midwives 2024-2028',
    shortName:     'Nurses & Midwives',
    family:        'nurses-midwives',
    nominalExpiry: '2028-04-30',
    isModernAward: false,
    color:         '#E11D48',
    bg:            '#E11D481A',
    indexPath:     '/ebas/nurses-midwives/',
    pdfPath:       '/attachments/nurses-midwives/nurses-midwives-eba-2024-2028.pdf',
    pdfExternal:   false,
    archived:      false,
  },
]

// ─────────────────────────────────────────────────────────────────────────────
// Status calculation
// ─────────────────────────────────────────────────────────────────────────────

/**
 * getEBAStatus — pure function, no Vue dependency, safe to call in SSR context.
 *
 * Returns one of five string literals:
 *   'modern-award'   — isModernAward: true; reviewed by FWC, no expiry concept
 *   'current'        — nominalExpiry is more than EXPIRING_SOON_DAYS away
 *   'expiring'       — nominalExpiry is within EXPIRING_SOON_DAYS (amber warning)
 *   'renegotiation'  — past nominalExpiry; no newer sibling in same family yet
 *   'superseded'     — a newer non-archived entry exists in the same family
 *
 * Supersession is automatic: adding a new entry with the same family value
 * and a later nominalExpiry is all that is needed — no flag to set manually.
 *
 * @param  {object} entry  A single EBA_REGISTRY entry
 * @returns {string}
 */
export function getEBAStatus(entry) {
  if (entry.isModernAward) return 'modern-award'

  const today        = new Date()
  const expiry       = new Date(entry.nominalExpiry)
  const daysToExpiry = Math.floor((expiry - today) / 86_400_000)

  const superseded = EBA_REGISTRY.some(
    e =>  e.family !== undefined  &&
          e.family === entry.family &&
          e.slug   !== entry.slug   &&
          !e.archived               &&
          new Date(e.nominalExpiry) > expiry
  )

  if (superseded)                         return 'superseded'
  if (daysToExpiry < 0)                   return 'renegotiation'
  if (daysToExpiry <= EXPIRING_SOON_DAYS) return 'expiring'
  return 'current'
}

// ─────────────────────────────────────────────────────────────────────────────
// Backward-compatible derived exports
// These replace the inline constants previously defined inside SearchModal.vue.
// Shapes are identical to the originals — no internal changes to SearchModal
// are needed beyond swapping the import.
// ─────────────────────────────────────────────────────────────────────────────

/** Keyed by full EBA name — consumed by ebaStyle() in SearchModal.vue */
export const ebaColors = Object.fromEntries(
  EBA_REGISTRY.map(e => [e.name, { color: e.color, bg: e.bg }])
)

/** Ordered array of full EBA names — consumed by the EBA filter dropdown */
export const ebaList = EBA_REGISTRY
  .filter(e => !e.archived)
  .map(e => e.name)

/** Slug → short display label — consumed by ebaSlugLabels in SearchModal.vue */
export const ebaSlugLabels = Object.fromEntries(
  EBA_REGISTRY.map(e => [e.slug, e.shortName])
)