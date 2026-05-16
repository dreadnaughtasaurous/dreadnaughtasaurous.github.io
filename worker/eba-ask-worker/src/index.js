// eba-ask-worker/src/index.js
// v9: Adds Cloudflare KV response caching keyed by content hash.
//     Cache key = SHA-256(clauseTitle + ebaName + pagePathname) — computed
//     client-side and sent as `contentHash` in the POST body.
//     Cache TTL: 30 days. Cache is bypassed and re-written on miss.
//     Also adds support for the AskThisPage contextual button:
//     the request body may now include `{ question, contentHash }`.
//     All EBA_PAGE_MAP paths, SYSTEM_PROMPT, and AI provider functions
//     are carried forward unchanged from v8.

const CORS_ORIGIN = 'https://dreadnaughtasaurous.github.io';
const CORS_ALLOWED = new Set([
  CORS_ORIGIN,
  'http://localhost:5173',
  'http://localhost:4173',
]);
const GITHUB_RAW_BASE = 'https://raw.githubusercontent.com/dreadnaughtasaurous/dreadnaughtasaurous.github.io/main/docs';

// Cache TTL: 30 days in seconds
const CACHE_TTL_SECONDS = 60 * 60 * 24 * 30;

// ─── EBA PAGE MAP ─────────────────────────────────────────────────────────────
// Each entry maps keyword + topic signals to one or more raw GitHub Markdown paths.
// Paths are relative to /docs — e.g. 'ebas/nurses-midwives/hours-of-work/49-overtime.md'
// ALL paths verified from vp-hash-map-keys-2.txt (May 2026).
const EBA_PAGE_MAP = [

  // ── NURSES & MIDWIVES ────────────────────────────────────────────────────
  {
    keywords: ['nurse', 'midwi', 'anmf'],
    topic: ['overtime'],
    paths: ['ebas/nurses-midwives/hours-of-work/49-overtime.md']
  },
  {
    keywords: ['nurse', 'midwi', 'anmf'],
    topic: ['public holiday', 'holiday'],
    paths: ['ebas/nurses-midwives/leave/56-public-holidays.md']
  },
  {
    keywords: ['nurse', 'midwi', 'anmf'],
    topic: ['overtime', 'public holiday', 'holiday'],
    paths: [
      'ebas/nurses-midwives/hours-of-work/49-overtime.md',
      'ebas/nurses-midwives/leave/56-public-holidays.md',
    ]
  },
  {
    keywords: ['nurse', 'midwi', 'anmf'],
    topic: ['wage', 'salary', 'pay rate', 'pay'],
    paths: ['ebas/nurses-midwives/wages/26-salary-and-increments.md']
  },
  {
    keywords: ['nurse', 'midwi', 'anmf'],
    topic: ['allowance'],
    paths: ['ebas/nurses-midwives/allowances/30-allowances.md']
  },
  {
    keywords: ['nurse', 'midwi', 'anmf'],
    topic: ['annual leave'],
    paths: ['ebas/nurses-midwives/leave/57-annual-leave.md']
  },
  {
    keywords: ['nurse', 'midwi', 'anmf'],
    topic: ['personal leave', 'sick leave', 'carer'],
    paths: ['ebas/nurses-midwives/leave/61-personal-sick-carer-s-leave.md']
  },
  {
    keywords: ['nurse', 'midwi', 'anmf'],
    topic: ['parental leave', 'maternity', 'paternity'],
    paths: ['ebas/nurses-midwives/leave/68-parental-leave.md']
  },
  {
    keywords: ['nurse', 'midwi', 'anmf'],
    topic: ['long service leave'],
    paths: ['ebas/nurses-midwives/leave/69-long-service-leave.md']
  },
  {
    keywords: ['nurse', 'midwi', 'anmf'],
    topic: ['family violence'],
    paths: ['ebas/nurses-midwives/leave/66-family-violence-leave.md']
  },
  {
    keywords: ['nurse', 'midwi', 'anmf'],
    topic: ['compassionate leave', 'bereavement'],
    paths: ['ebas/nurses-midwives/leave/64-compassionate-leave.md']
  },
  {
    keywords: ['nurse', 'midwi', 'anmf'],
    topic: ['shift', 'saturday', 'sunday', 'weekend', 'penalty rate'],
    paths: ['ebas/nurses-midwives/hours-of-work/48-special-rates-for-saturdays-and-sundays.md']
  },
  {
    keywords: ['nurse', 'midwi', 'anmf'],
    topic: ['hours', 'hours of work', 'ordinary hours'],
    paths: ['ebas/nurses-midwives/hours-of-work/42-hours-of-work.md']
  },
  {
    keywords: ['nurse', 'midwi', 'anmf'],
    topic: ['recall', 'call back'],
    paths: ['ebas/nurses-midwives/hours-of-work/50-recall-return-to-workplace.md']
  },
  {
    keywords: ['nurse', 'midwi', 'anmf'],
    topic: ['on call', 'on-call'],
    paths: ['ebas/nurses-midwives/hours-of-work/51-on-call.md']
  },
  {
    keywords: ['nurse', 'midwi', 'anmf'],
    topic: ['night shift', 'permanent night'],
    paths: ['ebas/nurses-midwives/hours-of-work/42a-permanent-night-shift.md']
  },
  {
    keywords: ['nurse', 'midwi', 'anmf'],
    topic: ['roster'],
    paths: ['ebas/nurses-midwives/hours-of-work/45-rosters.md']
  },
  {
    keywords: ['nurse', 'midwi', 'anmf'],
    topic: ['accrued day off', 'ado'],
    paths: ['ebas/nurses-midwives/hours-of-work/43-accrued-days-off.md']
  },
  {
    keywords: ['nurse', 'midwi', 'anmf'],
    topic: ['break', 'meal break', 'rest break'],
    paths: ['ebas/nurses-midwives/hours-of-work/44-breaks.md']
  },
  {
    keywords: ['nurse', 'midwi', 'anmf'],
    topic: ['redundancy'],
    paths: ['ebas/nurses-midwives/consultation-disputes/12-redundancy-and-associated-entitlements.md']
  },
  {
    keywords: ['nurse', 'midwi', 'anmf'],
    topic: ['dispute'],
    paths: ['ebas/nurses-midwives/consultation-disputes/13-dispute-resolution-procedure.md']
  },
  {
    keywords: ['nurse', 'midwi', 'anmf'],
    topic: ['classification', 'grade', 'enrolled nurse', 'registered nurse'],
    paths: ['ebas/nurses-midwives/classification-staffing/83-registered-nurses-and-midwives-classification.md']
  },
  {
    keywords: ['nurse', 'midwi', 'anmf'],
    topic: ['professional development', 'pd leave', 'study leave'],
    paths: ['ebas/nurses-midwives/education-pd/75-professional-development-leave.md']
  },
  {
    keywords: ['nurse', 'midwi', 'anmf'],
    topic: ['higher duties', 'higher duty'],
    paths: ['ebas/nurses-midwives/allowances/35-higher-duties.md']
  },
  {
    keywords: ['nurse', 'midwi', 'anmf'],
    topic: ['superannuation', 'super'],
    paths: ['ebas/nurses-midwives/wages/28-superannuation.md']
  },
  {
    keywords: ['nurse', 'midwi', 'anmf'],
    topic: ['salary packaging', 'salary sacrifice'],
    paths: ['ebas/nurses-midwives/wages/29-salary-packaging.md']
  },
  {
    keywords: ['nurse', 'midwi', 'anmf'],
    topic: ['qualification allowance'],
    paths: ['ebas/nurses-midwives/allowances/31-qualification-allowance.md']
  },
  {
    keywords: ['nurse', 'midwi', 'anmf'],
    topic: ['shift allowance'],
    paths: ['ebas/nurses-midwives/allowances/34-shift-allowance.md']
  },
  {
    keywords: ['nurse', 'midwi', 'anmf'],
    topic: ['flexible working', 'flexible arrangement'],
    paths: ['ebas/nurses-midwives/consultation-disputes/16-flexible-working-arrangements.md']
  },
  {
    keywords: ['nurse', 'midwi', 'anmf'],
    topic: ['part time', 'part-time'],
    paths: ['ebas/nurses-midwives/employment-types/18-part-time-employment.md']
  },
  {
    keywords: ['nurse', 'midwi', 'anmf'],
    topic: ['casual'],
    paths: ['ebas/nurses-midwives/employment-types/19-casual-employment.md']
  },
  {
    keywords: ['nurse', 'midwi', 'anmf'],
    topic: ['termination', 'notice period', 'notice of termination'],
    paths: ['ebas/nurses-midwives/employment-types/23-notice-period-before-termination.md']
  },
  {
    keywords: ['nurse', 'midwi', 'anmf'],
    topic: ['ohs', 'occupational health', 'safety', 'workplace violence'],
    paths: ['ebas/nurses-midwives/ohs/107-ohs.md']
  },
  {
    keywords: ['nurse', 'midwi', 'anmf'],
    topic: [],
    paths: ['ebas/nurses-midwives.md']
  },

  // ── ALLIED HEALTH ─────────────────────────────────────────────────────────
  {
    keywords: ['allied health', 'allied'],
    topic: ['overtime'],
    paths: ['ebas/allied-health/hours-of-work/52-overtime.md']
  },
  {
    keywords: ['allied health', 'allied'],
    topic: ['public holiday', 'holiday'],
    paths: ['ebas/allied-health/leave/58-public-holidays.md']
  },
  {
    keywords: ['allied health', 'allied'],
    topic: ['overtime', 'public holiday', 'holiday'],
    paths: [
      'ebas/allied-health/hours-of-work/52-overtime.md',
      'ebas/allied-health/leave/58-public-holidays.md',
    ]
  },
  {
    keywords: ['allied health', 'allied'],
    topic: ['annual leave'],
    paths: ['ebas/allied-health/leave/59-annual-leave.md']
  },
  {
    keywords: ['allied health', 'allied'],
    topic: ['personal leave', 'sick leave', 'carer'],
    paths: ['ebas/allied-health/leave/62-personal-leave-including-carer-s-leave.md']
  },
  {
    keywords: ['allied health', 'allied'],
    topic: ['parental leave', 'maternity', 'paternity'],
    paths: ['ebas/allied-health/leave/70-parental-leave.md']
  },
  {
    keywords: ['allied health', 'allied'],
    topic: ['long service leave'],
    paths: ['ebas/allied-health/leave/72-long-service-leave.md']
  },
  {
    keywords: ['allied health', 'allied'],
    topic: ['family violence'],
    paths: ['ebas/allied-health/leave/66-family-violence-leave.md']
  },
  {
    keywords: ['allied health', 'allied'],
    topic: ['compassionate leave', 'bereavement'],
    paths: ['ebas/allied-health/leave/67-compassionate-leave.md']
  },
  {
    keywords: ['allied health', 'allied'],
    topic: ['shift', 'saturday', 'sunday', 'weekend', 'penalty rate'],
    paths: ['ebas/allied-health/hours-of-work/51-rates-for-saturdays-and-sundays.md']
  },
  {
    keywords: ['allied health', 'allied'],
    topic: ['wage', 'salary', 'pay rate', 'pay'],
    paths: ['ebas/allied-health/appendices/2-wage-rates.md']
  },
  {
    keywords: ['allied health', 'allied'],
    topic: ['allowance'],
    paths: ['ebas/allied-health/allowances/33-increases-to-allowances.md']
  },
  {
    keywords: ['allied health', 'allied'],
    topic: ['hours', 'hours of work', 'ordinary hours'],
    paths: ['ebas/allied-health/hours-of-work/47-hours-of-work.md']
  },
  {
    keywords: ['allied health', 'allied'],
    topic: ['recall', 'call back'],
    paths: ['ebas/allied-health/hours-of-work/53-recall-return-to-workplace.md']
  },
  {
    keywords: ['allied health', 'allied'],
    topic: ['on call', 'on-call'],
    paths: ['ebas/allied-health/hours-of-work/54-recall-no-return-to-workplace.md']
  },
  {
    keywords: ['allied health', 'allied'],
    topic: ['roster'],
    paths: ['ebas/allied-health/hours-of-work/50-roster.md']
  },
  {
    keywords: ['allied health', 'allied'],
    topic: ['accrued day off', 'ado'],
    paths: ['ebas/allied-health/hours-of-work/48-accrued-days-off.md']
  },
  {
    keywords: ['allied health', 'allied'],
    topic: ['break', 'meal break', 'rest break'],
    paths: ['ebas/allied-health/hours-of-work/49-breaks.md']
  },
  {
    keywords: ['allied health', 'allied'],
    topic: ['redundancy'],
    paths: ['ebas/allied-health/employment/25-redundancy-and-related-entitlements.md']
  },
  {
    keywords: ['allied health', 'allied'],
    topic: ['dispute'],
    paths: ['ebas/allied-health/consultation-disputes/14-dispute-resolution-procedure.md']
  },
  {
    keywords: ['allied health', 'allied'],
    topic: ['classification', 'grade', 'reclassification'],
    paths: ['ebas/allied-health/classification-staffing/86-classification-and-reclassification.md']
  },
  {
    keywords: ['allied health', 'allied'],
    topic: ['professional development', 'pd leave', 'study leave'],
    paths: ['ebas/allied-health/education-pd/79-professional-development-leave.md']
  },
  {
    keywords: ['allied health', 'allied'],
    topic: ['higher duties', 'higher duty'],
    paths: ['ebas/allied-health/allowances/37-higher-duties-allowance.md']
  },
  {
    keywords: ['allied health', 'allied'],
    topic: ['superannuation', 'super'],
    paths: ['ebas/allied-health/wages/30-superannuation.md']
  },
  {
    keywords: ['allied health', 'allied'],
    topic: ['salary packaging', 'salary sacrifice'],
    paths: ['ebas/allied-health/wages/31-salary-packaging.md']
  },
  {
    keywords: ['allied health', 'allied'],
    topic: ['shift allowance'],
    paths: ['ebas/allied-health/allowances/38-shift-work-allowance.md']
  },
  {
    keywords: ['allied health', 'allied'],
    topic: ['flexible working', 'flexible arrangement'],
    paths: ['ebas/allied-health/workplace-rights/96-flexible-working-arrangements.md']
  },
  {
    keywords: ['allied health', 'allied'],
    topic: ['working from home', 'remote work', 'wfh'],
    paths: ['ebas/allied-health/workplace-rights/95-working-from-home.md']
  },
  {
    keywords: ['allied health', 'allied'],
    topic: ['part time', 'part-time'],
    paths: ['ebas/allied-health/employment/19-part-time-employment.md']
  },
  {
    keywords: ['allied health', 'allied'],
    topic: ['casual'],
    paths: ['ebas/allied-health/employment/20-casual-employment.md']
  },
  {
    keywords: ['allied health', 'allied'],
    topic: ['termination', 'notice period', 'notice of termination'],
    paths: ['ebas/allied-health/employment/24-termination-of-employment.md']
  },
  {
    keywords: ['allied health', 'allied'],
    topic: ['sole allowance', 'sole practitioner'],
    paths: ['ebas/allied-health/allowances/34-sole-allowance.md']
  },
  {
    keywords: ['allied health', 'allied'],
    topic: ['ohs', 'occupational health', 'safety', 'workplace violence'],
    paths: ['ebas/allied-health/ohs/97-ohs-preliminary.md']
  },
  {
    keywords: ['allied health', 'allied'],
    topic: [],
    paths: ['ebas/allied-health.md']
  },

  // ── BIOMEDICAL ENGINEERS ──────────────────────────────────────────────────
  {
    keywords: ['biomedical', 'biomed'],
    topic: ['overtime'],
    paths: ['ebas/biomedical-engineers/hours-of-work/46-overtime.md']
  },
  {
    keywords: ['biomedical', 'biomed'],
    topic: ['public holiday', 'holiday'],
    paths: ['ebas/biomedical-engineers/leave/50-public-holidays.md']
  },
  {
    keywords: ['biomedical', 'biomed'],
    topic: ['overtime', 'public holiday', 'holiday'],
    paths: [
      'ebas/biomedical-engineers/hours-of-work/46-overtime.md',
      'ebas/biomedical-engineers/leave/50-public-holidays.md',
    ]
  },
  {
    keywords: ['biomedical', 'biomed'],
    topic: ['annual leave'],
    paths: ['ebas/biomedical-engineers/leave/51-annual-leave.md']
  },
  {
    keywords: ['biomedical', 'biomed'],
    topic: ['personal leave', 'sick leave', 'carer'],
    paths: ['ebas/biomedical-engineers/leave/54-personal-carer-s-leave.md']
  },
  {
    keywords: ['biomedical', 'biomed'],
    topic: ['parental leave', 'maternity', 'paternity'],
    paths: ['ebas/biomedical-engineers/leave/61-parental-leave.md']
  },
  {
    keywords: ['biomedical', 'biomed'],
    topic: ['long service leave'],
    paths: ['ebas/biomedical-engineers/leave/63-long-service-leave.md']
  },
  {
    keywords: ['biomedical', 'biomed'],
    topic: ['family violence'],
    paths: ['ebas/biomedical-engineers/leave/56-family-violence-leave.md']
  },
  {
    keywords: ['biomedical', 'biomed'],
    topic: ['shift', 'saturday', 'sunday', 'weekend', 'penalty rate'],
    paths: ['ebas/biomedical-engineers/hours-of-work/45-rates-for-saturdays-sundays.md']
  },
  {
    keywords: ['biomedical', 'biomed'],
    topic: ['wage', 'salary', 'pay rate', 'pay'],
    paths: ['ebas/biomedical-engineers/wages/26-wages-and-allowances.md']
  },
  {
    keywords: ['biomedical', 'biomed'],
    topic: ['allowance'],
    paths: ['ebas/biomedical-engineers/allowances/33-higher-qualifications-allowance.md']
  },
  {
    keywords: ['biomedical', 'biomed'],
    topic: ['hours', 'hours of work', 'ordinary hours'],
    paths: ['ebas/biomedical-engineers/hours-of-work/40-hours-of-work.md']
  },
  {
    keywords: ['biomedical', 'biomed'],
    topic: ['recall', 'on call', 'on-call', 'call back'],
    paths: ['ebas/biomedical-engineers/hours-of-work/47-recall.md']
  },
  {
    keywords: ['biomedical', 'biomed'],
    topic: ['roster'],
    paths: ['ebas/biomedical-engineers/hours-of-work/44-rosters.md']
  },
  {
    keywords: ['biomedical', 'biomed'],
    topic: ['accrued day off', 'ado'],
    paths: ['ebas/biomedical-engineers/hours-of-work/41-accrued-days-off.md']
  },
  {
    keywords: ['biomedical', 'biomed'],
    topic: ['break', 'meal break'],
    paths: ['ebas/biomedical-engineers/hours-of-work/42-meal-breaks.md']
  },
  {
    keywords: ['biomedical', 'biomed'],
    topic: ['classification', 'grade', 'reclassification'],
    paths: ['ebas/biomedical-engineers/classification-staffing/80-classification-and-reclassification.md']
  },
  {
    keywords: ['biomedical', 'biomed'],
    topic: ['professional development', 'pd leave', 'study leave'],
    paths: ['ebas/biomedical-engineers/education-pd/72-professional-development-leave.md']
  },
  {
    keywords: ['biomedical', 'biomed'],
    topic: ['higher duties', 'higher duty'],
    paths: ['ebas/biomedical-engineers/allowances/35-higher-duties-allowance.md']
  },
  {
    keywords: ['biomedical', 'biomed'],
    topic: ['superannuation', 'super'],
    paths: ['ebas/biomedical-engineers/wages/30-superannuation.md']
  },
  {
    keywords: ['biomedical', 'biomed'],
    topic: ['redundancy'],
    paths: ['ebas/biomedical-engineers/employment/24-redundancy-and-associated-entitlements.md']
  },
  {
    keywords: ['biomedical', 'biomed'],
    topic: ['flexible working', 'flexible arrangement'],
    paths: ['ebas/biomedical-engineers/workplace-rights/85-flexible-working-arrangements.md']
  },
  {
    keywords: ['biomedical', 'biomed'],
    topic: ['working from home', 'remote work', 'wfh'],
    paths: ['ebas/biomedical-engineers/workplace-rights/86-working-from-home.md']
  },
  {
    keywords: ['biomedical', 'biomed'],
    topic: [],
    paths: ['ebas/biomedical-engineers.md']
  },

  // ── CHILDREN'S SERVICES ───────────────────────────────────────────────────
  {
    keywords: ["children's services", 'childrens services', 'children', 'childcare'],
    topic: ['overtime', 'penalty'],
    paths: ['ebas/childrens-services/hours-of-work/23-overtime-and-penalty-rates.md']
  },
  {
    keywords: ["children's services", 'childrens services', 'children', 'childcare'],
    topic: ['public holiday', 'holiday'],
    paths: ['ebas/childrens-services/leave/27-public-holidays.md']
  },
  {
    keywords: ["children's services", 'childrens services', 'children', 'childcare'],
    topic: ['overtime', 'public holiday', 'holiday', 'penalty'],
    paths: [
      'ebas/childrens-services/hours-of-work/23-overtime-and-penalty-rates.md',
      'ebas/childrens-services/leave/27-public-holidays.md',
    ]
  },
  {
    keywords: ["children's services", 'childrens services', 'children', 'childcare'],
    topic: ['annual leave'],
    paths: ['ebas/childrens-services/leave/24-annual-leave.md']
  },
  {
    keywords: ["children's services", 'childrens services', 'children', 'childcare'],
    topic: ['personal leave', 'sick leave', 'carer', 'compassionate'],
    paths: ['ebas/childrens-services/leave/25-personal-carer-s-leave-and-compassionate-leave.md']
  },
  {
    keywords: ["children's services", 'childrens services', 'children', 'childcare'],
    topic: ['parental leave', 'maternity', 'paternity'],
    paths: ['ebas/childrens-services/leave/25a-parental-leave-and-related-entitlements.md']
  },
  {
    keywords: ["children's services", 'childrens services', 'children', 'childcare'],
    topic: ['family violence'],
    paths: ['ebas/childrens-services/leave/28-family-and-domestic-violence-leave.md']
  },
  {
    keywords: ["children's services", 'childrens services', 'children', 'childcare'],
    topic: ['wage', 'salary', 'pay rate', 'pay', 'minimum wage'],
    paths: ['ebas/childrens-services/wages/14-minimum-wages.md']
  },
  {
    keywords: ["children's services", 'childrens services', 'children', 'childcare'],
    topic: ['allowance'],
    paths: ['ebas/childrens-services/wages/15-allowances.md']
  },
  {
    keywords: ["children's services", 'childrens services', 'children', 'childcare'],
    topic: ['classification'],
    paths: ['ebas/childrens-services/wages/13-classifications.md']
  },
  {
    keywords: ["children's services", 'childrens services', 'children', 'childcare'],
    topic: ['hours', 'hours of work', 'ordinary hours', 'roster'],
    paths: ['ebas/childrens-services/hours-of-work/21-ordinary-hours-of-work-and-rostering.md']
  },
  {
    keywords: ["children's services", 'childrens services', 'children', 'childcare'],
    topic: ['break'],
    paths: ['ebas/childrens-services/hours-of-work/22-breaks.md']
  },
  {
    keywords: ["children's services", 'childrens services', 'children', 'childcare'],
    topic: ['flexible working', 'flexible arrangement'],
    paths: ['ebas/childrens-services/hours-of-work/23a-requests-for-flexible-working-arrangements.md']
  },
  {
    keywords: ["children's services", 'childrens services', 'children', 'childcare'],
    topic: ['redundancy'],
    paths: ['ebas/childrens-services/employment/12-redundancy.md']
  },
  {
    keywords: ["children's services", 'childrens services', 'children', 'childcare'],
    topic: ['dispute'],
    paths: ['ebas/childrens-services/consultation-disputes/9-dispute-resolution.md']
  },
  {
    keywords: ["children's services", 'childrens services', 'children', 'childcare'],
    topic: ['superannuation', 'super'],
    paths: ['ebas/childrens-services/wages/20-superannuation.md']
  },
  {
    keywords: ["children's services", 'childrens services', 'children', 'childcare'],
    topic: [],
    paths: ['ebas/childrens-services.md']
  },

  // ── MSPP ──────────────────────────────────────────────────────────────────
  {
    keywords: ['mspp', 'medical scientist', 'pharmacist', 'psychologist', 'perfusionist'],
    topic: ['overtime'],
    paths: ['ebas/mspp/hours-of-work/59-overtime.md']
  },
  {
    keywords: ['mspp', 'medical scientist', 'pharmacist', 'psychologist', 'perfusionist'],
    topic: ['public holiday', 'holiday'],
    paths: ['ebas/mspp/leave/80-public-holidays.md']
  },
  {
    keywords: ['mspp', 'medical scientist', 'pharmacist', 'psychologist', 'perfusionist'],
    topic: ['overtime', 'public holiday', 'holiday'],
    paths: [
      'ebas/mspp/hours-of-work/59-overtime.md',
      'ebas/mspp/leave/80-public-holidays.md',
    ]
  },
  {
    keywords: ['mspp', 'medical scientist', 'pharmacist', 'psychologist', 'perfusionist'],
    topic: ['annual leave'],
    paths: ['ebas/mspp/leave/61-annual-leave.md']
  },
  {
    keywords: ['mspp', 'medical scientist', 'pharmacist', 'psychologist', 'perfusionist'],
    topic: ['personal leave', 'sick leave', 'carer'],
    paths: ['ebas/mspp/leave/64-personal-carer-s-leave.md']
  },
  {
    keywords: ['mspp', 'medical scientist', 'pharmacist', 'psychologist', 'perfusionist'],
    topic: ['parental leave', 'maternity', 'paternity'],
    paths: ['ebas/mspp/leave/70-parental-leave.md']
  },
  {
    keywords: ['mspp', 'medical scientist', 'pharmacist', 'psychologist', 'perfusionist'],
    topic: ['long service leave'],
    paths: ['ebas/mspp/leave/67-long-service-leave.md']
  },
  {
    keywords: ['mspp', 'medical scientist', 'pharmacist', 'psychologist', 'perfusionist'],
    topic: ['family violence'],
    paths: ['ebas/mspp/leave/82-family-violence-leave.md']
  },
  {
    keywords: ['mspp', 'medical scientist', 'pharmacist', 'psychologist', 'perfusionist'],
    topic: ['professional development', 'pd leave'],
    paths: ['ebas/mspp/leave/73-professional-development-leave.md']
  },
  {
    keywords: ['mspp', 'medical scientist', 'pharmacist', 'psychologist', 'perfusionist'],
    topic: ['study leave'],
    paths: ['ebas/mspp/leave/72-study-leave.md']
  },
  {
    keywords: ['mspp', 'medical scientist', 'pharmacist', 'psychologist', 'perfusionist'],
    topic: ['wage', 'salary', 'pay rate', 'pay', 'remuneration'],
    paths: ['ebas/mspp/schedules/2-rates-of-pay-and-allowances.md']
  },
  {
    keywords: ['mspp', 'medical scientist', 'pharmacist', 'psychologist', 'perfusionist'],
    topic: ['allowance'],
    paths: ['ebas/mspp/accident-pay-allowances/92-telephone-allowance.md']
  },
  {
    keywords: ['mspp', 'medical scientist', 'pharmacist', 'psychologist', 'perfusionist'],
    topic: ['hours', 'hours of work', 'ordinary hours'],
    paths: ['ebas/mspp/hours-of-work/55-hours-of-work.md']
  },
  {
    keywords: ['mspp', 'medical scientist', 'pharmacist', 'psychologist', 'perfusionist'],
    topic: ['shift'],
    paths: ['ebas/mspp/hours-of-work/56-shift-work.md']
  },
  {
    keywords: ['mspp', 'medical scientist', 'pharmacist', 'psychologist', 'perfusionist'],
    topic: ['recall', 'on call', 'on-call', 'call back'],
    paths: ['ebas/mspp/hours-of-work/60-on-call-re-call.md']
  },
  {
    keywords: ['mspp', 'medical scientist', 'pharmacist', 'psychologist', 'perfusionist'],
    topic: ['roster'],
    paths: ['ebas/mspp/hours-of-work/57-employee-rosters.md']
  },
  {
    keywords: ['mspp', 'medical scientist', 'pharmacist', 'psychologist', 'perfusionist'],
    topic: ['classification', 'grade', 'reclassification'],
    paths: ['ebas/mspp/classification-salaries/51-salaries-and-allowances.md']
  },
  {
    keywords: ['mspp', 'medical scientist', 'pharmacist', 'psychologist', 'perfusionist'],
    topic: ['higher duties', 'higher duty'],
    paths: ['ebas/mspp/classification-salaries/52-higher-duties.md']
  },
  {
    keywords: ['mspp', 'medical scientist', 'pharmacist', 'psychologist', 'perfusionist'],
    topic: ['superannuation', 'super'],
    paths: ['ebas/mspp/classification-salaries/54-superannuation.md']
  },
  {
    keywords: ['mspp', 'medical scientist', 'pharmacist', 'psychologist', 'perfusionist'],
    topic: ['redundancy'],
    paths: ['ebas/mspp/employment/32-redundancy-and-associated-entitlements.md']
  },
  {
    keywords: ['mspp', 'medical scientist', 'pharmacist', 'psychologist', 'perfusionist'],
    topic: ['dispute'],
    paths: ['ebas/mspp/disputes/11-disputes-settling-procedures.md']
  },
  {
    keywords: ['mspp', 'medical scientist', 'pharmacist', 'psychologist', 'perfusionist'],
    topic: ['workload'],
    paths: ['ebas/mspp/workforce-management/33-workload.md']
  },
  {
    keywords: ['mspp', 'medical scientist', 'pharmacist', 'psychologist', 'perfusionist'],
    topic: ['flexible working', 'flexible arrangement'],
    paths: ['ebas/mspp/employment/27-flexible-working-arrangements.md']
  },
  {
    keywords: ['mspp', 'medical scientist', 'pharmacist', 'psychologist', 'perfusionist'],
    topic: [],
    paths: ['ebas/mspp.md']
  },

  // ── DOCTORS IN TRAINING ───────────────────────────────────────────────────
  {
    keywords: ['doctor in training', 'doctors in training', 'dit', 'resident', 'registrar', 'intern', 'house officer'],
    topic: ['overtime'],
    paths: ['ebas/doctors-in-training/hours-of-work/36-overtime.md']
  },
  {
    keywords: ['doctor in training', 'doctors in training', 'dit', 'resident', 'registrar', 'intern', 'house officer'],
    topic: ['public holiday', 'holiday'],
    paths: ['ebas/doctors-in-training/leave/63-public-holidays.md']
  },
  {
    keywords: ['doctor in training', 'doctors in training', 'dit', 'resident', 'registrar', 'intern', 'house officer'],
    topic: ['overtime', 'public holiday', 'holiday'],
    paths: [
      'ebas/doctors-in-training/hours-of-work/36-overtime.md',
      'ebas/doctors-in-training/leave/63-public-holidays.md',
    ]
  },
  {
    keywords: ['doctor in training', 'doctors in training', 'dit', 'resident', 'registrar', 'intern', 'house officer'],
    topic: ['wage', 'salary', 'pay rate', 'pay', 'remuneration'],
    paths: ['ebas/doctors-in-training/remuneration/42-remuneration-and-remuneration-increases.md']
  },
  {
    keywords: ['doctor in training', 'doctors in training', 'dit', 'resident', 'registrar', 'intern', 'house officer'],
    topic: ['annual leave'],
    paths: ['ebas/doctors-in-training/leave/60-annual-leave.md']
  },
  {
    keywords: ['doctor in training', 'doctors in training', 'dit', 'resident', 'registrar', 'intern', 'house officer'],
    topic: ['personal leave', 'sick leave', 'carer'],
    paths: ['ebas/doctors-in-training/leave/61-personal-sick-carer-s-leave.md']
  },
  {
    keywords: ['doctor in training', 'doctors in training', 'dit', 'resident', 'registrar', 'intern', 'house officer'],
    topic: ['parental leave', 'maternity', 'paternity'],
    paths: ['ebas/doctors-in-training/leave/67-parental-leave.md']
  },
  {
    keywords: ['doctor in training', 'doctors in training', 'dit', 'resident', 'registrar', 'intern', 'house officer'],
    topic: ['long service leave'],
    paths: ['ebas/doctors-in-training/leave/68-long-service-leave.md']
  },
  {
    keywords: ['doctor in training', 'doctors in training', 'dit', 'resident', 'registrar', 'intern', 'house officer'],
    topic: ['family violence'],
    paths: ['ebas/doctors-in-training/leave/71-family-violence-leave.md']
  },
  {
    keywords: ['doctor in training', 'doctors in training', 'dit', 'resident', 'registrar', 'intern', 'house officer'],
    topic: ['compassionate leave', 'bereavement'],
    paths: ['ebas/doctors-in-training/leave/64-compassionate-leave.md']
  },
  {
    keywords: ['doctor in training', 'doctors in training', 'dit', 'resident', 'registrar', 'intern', 'house officer'],
    topic: ['hours', 'hours of work', 'ordinary hours'],
    paths: ['ebas/doctors-in-training/hours-of-work/33-hours-of-work.md']
  },
  {
    keywords: ['doctor in training', 'doctors in training', 'dit', 'resident', 'registrar', 'intern', 'house officer'],
    topic: ['on call', 'on-call'],
    paths: ['ebas/doctors-in-training/hours-of-work/38-on-call.md']
  },
  {
    keywords: ['doctor in training', 'doctors in training', 'dit', 'resident', 'registrar', 'intern', 'house officer'],
    topic: ['recall', 'call back'],
    paths: ['ebas/doctors-in-training/hours-of-work/39-recall-return-to-workplace.md']
  },
  {
    keywords: ['doctor in training', 'doctors in training', 'dit', 'resident', 'registrar', 'intern', 'house officer'],
    topic: ['roster'],
    paths: ['ebas/doctors-in-training/hours-of-work/35-rosters.md']
  },
  {
    keywords: ['doctor in training', 'doctors in training', 'dit', 'resident', 'registrar', 'intern', 'house officer'],
    topic: ['penalty', 'shift', 'penalty rate'],
    paths: ['ebas/doctors-in-training/hours-of-work/37-penalty-payments.md']
  },
  {
    keywords: ['doctor in training', 'doctors in training', 'dit', 'resident', 'registrar', 'intern', 'house officer'],
    topic: ['allowance', 'rotation allowance'],
    paths: ['ebas/doctors-in-training/allowances/52-rotation-allowances.md']
  },
  {
    keywords: ['doctor in training', 'doctors in training', 'dit', 'resident', 'registrar', 'intern', 'house officer'],
    topic: ['higher duties', 'higher duty'],
    paths: ['ebas/doctors-in-training/allowances/51-higher-duties.md']
  },
  {
    keywords: ['doctor in training', 'doctors in training', 'dit', 'resident', 'registrar', 'intern', 'house officer'],
    topic: ['superannuation', 'super'],
    paths: ['ebas/doctors-in-training/remuneration/43-superannuation.md']
  },
  {
    keywords: ['doctor in training', 'doctors in training', 'dit', 'resident', 'registrar', 'intern', 'house officer'],
    topic: ['salary packaging', 'salary sacrifice'],
    paths: ['ebas/doctors-in-training/remuneration/44-salary-packaging.md']
  },
  {
    keywords: ['doctor in training', 'doctors in training', 'dit', 'resident', 'registrar', 'intern', 'house officer'],
    topic: ['redundancy'],
    paths: ['ebas/doctors-in-training/consultation-disputes/11-redundancy-and-associated-entitlements.md']
  },
  {
    keywords: ['doctor in training', 'doctors in training', 'dit', 'resident', 'registrar', 'intern', 'house officer'],
    topic: ['dispute'],
    paths: ['ebas/doctors-in-training/consultation-disputes/12-dispute-resolution-procedure.md']
  },
  {
    keywords: ['doctor in training', 'doctors in training', 'dit', 'resident', 'registrar', 'intern', 'house officer'],
    topic: ['professional development', 'cme', 'education', 'training'],
    paths: ['ebas/doctors-in-training/education-pd/47-continuing-medical-education-allowance.md']
  },
  {
    keywords: ['doctor in training', 'doctors in training', 'dit', 'resident', 'registrar', 'intern', 'house officer'],
    topic: ['rotation', 'hospital rotation'],
    paths: ['ebas/doctors-in-training/doctor-employment/24-rotations-between-hospitals.md']
  },
  {
    keywords: ['doctor in training', 'doctors in training', 'dit', 'resident', 'registrar', 'intern', 'house officer'],
    topic: ['workload'],
    paths: ['ebas/doctors-in-training/hours-of-work/41-workload-management-and-review.md']
  },
  {
    keywords: ['doctor in training', 'doctors in training', 'dit', 'resident', 'registrar', 'intern', 'house officer'],
    topic: ['flexible working', 'flexible arrangement'],
    paths: ['ebas/doctors-in-training/consultation-disputes/15-flexible-working-arrangements.md']
  },
  {
    keywords: ['doctor in training', 'doctors in training', 'dit', 'resident', 'registrar', 'intern', 'house officer'],
    topic: [],
    paths: ['ebas/doctors-in-training.md']
  },

  // ── MEDICAL SPECIALISTS ───────────────────────────────────────────────────
  {
    keywords: ['medical specialist', 'specialist', 'smo', 'visiting medical officer', 'vmo', 'consultant'],
    topic: ['public holiday', 'holiday'],
    paths: ['ebas/medical-specialists/leave/56-public-holidays.md']
  },
  {
    keywords: ['medical specialist', 'specialist', 'smo', 'visiting medical officer', 'vmo', 'consultant'],
    topic: ['hours', 'hours of work', 'on call', 'on-call', 'roster'],
    paths: ['ebas/medical-specialists/hours-of-work/28-hours-of-work-full-time-doctors.md']
  },
  {
    keywords: ['medical specialist', 'specialist', 'smo', 'visiting medical officer', 'vmo', 'consultant'],
    topic: ['fractional', 'part time', 'part-time'],
    paths: ['ebas/medical-specialists/hours-of-work/29-hours-of-work-fractional-doctors.md']
  },
  {
    keywords: ['medical specialist', 'specialist', 'smo', 'visiting medical officer', 'vmo', 'consultant'],
    topic: ['on call', 'on-call'],
    paths: ['ebas/medical-specialists/hours-of-work/26-on-call-full-time-doctors.md']
  },
  {
    keywords: ['medical specialist', 'specialist', 'smo', 'visiting medical officer', 'vmo', 'consultant'],
    topic: ['recall', 'call back'],
    paths: ['ebas/medical-specialists/hours-of-work/27-recall-full-time-doctors.md']
  },
  {
    keywords: ['medical specialist', 'specialist', 'smo', 'visiting medical officer', 'vmo', 'consultant'],
    topic: ['wage', 'salary', 'pay rate', 'pay', 'remuneration'],
    paths: ['ebas/medical-specialists/wages/31-remuneration-and-remuneration-increases.md']
  },
  {
    keywords: ['medical specialist', 'specialist', 'smo', 'visiting medical officer', 'vmo', 'consultant'],
    topic: ['shift', 'penalty', 'penalty rate'],
    paths: ['ebas/medical-specialists/wages/36-shift-penalty-payments.md']
  },
  {
    keywords: ['medical specialist', 'specialist', 'smo', 'visiting medical officer', 'vmo', 'consultant'],
    topic: ['annual leave'],
    paths: ['ebas/medical-specialists/leave/47-annual-leave.md']
  },
  {
    keywords: ['medical specialist', 'specialist', 'smo', 'visiting medical officer', 'vmo', 'consultant'],
    topic: ['personal leave', 'sick leave', 'carer'],
    paths: ['ebas/medical-specialists/leave/49-personal-carer-s-leave.md']
  },
  {
    keywords: ['medical specialist', 'specialist', 'smo', 'visiting medical officer', 'vmo', 'consultant'],
    topic: ['parental leave', 'maternity', 'paternity'],
    paths: ['ebas/medical-specialists/leave/54-parental-leave.md']
  },
  {
    keywords: ['medical specialist', 'specialist', 'smo', 'visiting medical officer', 'vmo', 'consultant'],
    topic: ['long service leave'],
    paths: ['ebas/medical-specialists/leave/55-long-service-leave.md']
  },
  {
    keywords: ['medical specialist', 'specialist', 'smo', 'visiting medical officer', 'vmo', 'consultant'],
    topic: ['family violence'],
    paths: ['ebas/medical-specialists/leave/60-family-violence-leave.md']
  },
  {
    keywords: ['medical specialist', 'specialist', 'smo', 'visiting medical officer', 'vmo', 'consultant'],
    topic: ['compassionate leave', 'bereavement'],
    paths: ['ebas/medical-specialists/leave/50-compassionate-leave.md']
  },
  {
    keywords: ['medical specialist', 'specialist', 'smo', 'visiting medical officer', 'vmo', 'consultant'],
    topic: ['sabbatical'],
    paths: ['ebas/medical-specialists/leave/57-sabbatical-leave.md']
  },
  {
    keywords: ['medical specialist', 'specialist', 'smo', 'visiting medical officer', 'vmo', 'consultant'],
    topic: ['cme', 'continuing medical education', 'professional development'],
    paths: ['ebas/medical-specialists/leave/59-continuing-medical-education-leave.md']
  },
  {
    keywords: ['medical specialist', 'specialist', 'smo', 'visiting medical officer', 'vmo', 'consultant'],
    topic: ['allowance'],
    paths: ['ebas/medical-specialists/allowances/41-continuing-medical-education-support.md']
  },
  {
    keywords: ['medical specialist', 'specialist', 'smo', 'visiting medical officer', 'vmo', 'consultant'],
    topic: ['higher duties', 'higher duty'],
    paths: ['ebas/medical-specialists/allowances/44a-manager-allowance.md']
  },
  {
    keywords: ['medical specialist', 'specialist', 'smo', 'visiting medical officer', 'vmo', 'consultant'],
    topic: ['superannuation', 'super'],
    paths: ['ebas/medical-specialists/wages/32-superannuation.md']
  },
  {
    keywords: ['medical specialist', 'specialist', 'smo', 'visiting medical officer', 'vmo', 'consultant'],
    topic: ['salary packaging', 'salary sacrifice'],
    paths: ['ebas/medical-specialists/wages/33-salary-packaging.md']
  },
  {
    keywords: ['medical specialist', 'specialist', 'smo', 'visiting medical officer', 'vmo', 'consultant'],
    topic: ['redundancy'],
    paths: ['ebas/medical-specialists/consultation-disputes/10-redundancy-and-associated-entitlements.md']
  },
  {
    keywords: ['medical specialist', 'specialist', 'smo', 'visiting medical officer', 'vmo', 'consultant'],
    topic: ['dispute'],
    paths: ['ebas/medical-specialists/consultation-disputes/11-dispute-resolution-procedure.md']
  },
  {
    keywords: ['medical specialist', 'specialist', 'smo', 'visiting medical officer', 'vmo', 'consultant'],
    topic: ['workload'],
    paths: ['ebas/medical-specialists/employment/21-workload-management-and-review.md']
  },
  {
    keywords: ['medical specialist', 'specialist', 'smo', 'visiting medical officer', 'vmo', 'consultant'],
    topic: ['private practice'],
    paths: ['ebas/medical-specialists/employment/17-rights-of-private-practice-administration.md']
  },
  {
    keywords: ['medical specialist', 'specialist', 'smo', 'visiting medical officer', 'vmo', 'consultant'],
    topic: ['flexible working', 'flexible arrangement'],
    paths: ['ebas/medical-specialists/consultation-disputes/14-flexible-working-arrangements.md']
  },
  {
    keywords: ['medical specialist', 'specialist', 'smo', 'visiting medical officer', 'vmo', 'consultant'],
    topic: [],
    paths: ['ebas/medical-specialists.md']
  },

  // ── MENTAL HEALTH ─────────────────────────────────────────────────────────
  {
    keywords: ['mental health', 'rpn', 'psychiatric nurse', 'pen', 'mho', 'mental health officer'],
    topic: ['overtime'],
    paths: ['ebas/mental-health/rpn-pen-mho/hours-of-work/89-overtime.md']
  },
  {
    keywords: ['mental health', 'rpn', 'psychiatric nurse', 'pen', 'mho', 'mental health officer'],
    topic: ['public holiday', 'holiday'],
    paths: ['ebas/mental-health/rpn-pen-mho/leave/98-public-holidays.md']
  },
  {
    keywords: ['mental health', 'rpn', 'psychiatric nurse', 'pen', 'mho', 'mental health officer'],
    topic: ['overtime', 'public holiday', 'holiday'],
    paths: [
      'ebas/mental-health/rpn-pen-mho/hours-of-work/89-overtime.md',
      'ebas/mental-health/rpn-pen-mho/leave/98-public-holidays.md',
    ]
  },
  {
    keywords: ['mental health', 'rpn', 'psychiatric nurse', 'pen', 'mho', 'mental health officer'],
    topic: ['wage', 'salary', 'pay rate', 'pay', 'remuneration'],
    paths: ['ebas/mental-health/schedules/02-salaries-and-allowances.md']
  },
  {
    keywords: ['mental health', 'rpn', 'psychiatric nurse', 'pen', 'mho', 'mental health officer'],
    topic: ['annual leave'],
    paths: ['ebas/mental-health/common-terms/leave/38d-annual-leave.md']
  },
  {
    keywords: ['mental health', 'rpn', 'psychiatric nurse', 'pen', 'mho', 'mental health officer'],
    topic: ['personal leave', 'sick leave', 'carer'],
    paths: ['ebas/mental-health/common-terms/leave/38a-personal-leave.md']
  },
  {
    keywords: ['mental health', 'rpn', 'psychiatric nurse', 'pen', 'mho', 'mental health officer'],
    topic: ['parental leave', 'maternity', 'paternity'],
    paths: ['ebas/mental-health/common-terms/leave/50-parental-leave.md']
  },
  {
    keywords: ['mental health', 'rpn', 'psychiatric nurse', 'pen', 'mho', 'mental health officer'],
    topic: ['long service leave'],
    paths: ['ebas/mental-health/common-terms/leave/47-long-service-leave.md']
  },
  {
    keywords: ['mental health', 'rpn', 'psychiatric nurse', 'pen', 'mho', 'mental health officer'],
    topic: ['family violence'],
    paths: ['ebas/mental-health/common-terms/leave/45-family-and-domestic-violence-leave.md']
  },
  {
    keywords: ['mental health', 'rpn', 'psychiatric nurse', 'pen', 'mho', 'mental health officer'],
    topic: ['compassionate leave', 'bereavement'],
    paths: ['ebas/mental-health/common-terms/leave/44-compassionate-leave.md']
  },
  {
    keywords: ['mental health', 'rpn', 'psychiatric nurse', 'pen', 'mho', 'mental health officer'],
    topic: ['hours', 'hours of work', 'ordinary hours'],
    paths: ['ebas/mental-health/rpn-pen-mho/hours-of-work/88-hours-of-work.md']
  },
  {
    keywords: ['mental health', 'rpn', 'psychiatric nurse', 'pen', 'mho', 'mental health officer'],
    topic: ['on call', 'on-call', 'catt'],
    paths: ['ebas/mental-health/rpn-pen-mho/hours-of-work/92-catt-on-call-recall-allowances.md']
  },
  {
    keywords: ['mental health', 'rpn', 'psychiatric nurse', 'pen', 'mho', 'mental health officer'],
    topic: ['recall', 'call back'],
    paths: ['ebas/mental-health/rpn-pen-mho/hours-of-work/91-oncall-recall-non-catt.md']
  },
  {
    keywords: ['mental health', 'rpn', 'psychiatric nurse', 'pen', 'mho', 'mental health officer'],
    topic: ['roster'],
    paths: ['ebas/mental-health/rpn-pen-mho/hours-of-work/94-rosters.md']
  },
  {
    keywords: ['mental health', 'rpn', 'psychiatric nurse', 'pen', 'mho', 'mental health officer'],
    topic: ['night shift', 'permanent night'],
    paths: ['ebas/mental-health/rpn-pen-mho/hours-of-work/90a-permanent-night-shift.md']
  },
  {
    keywords: ['mental health', 'rpn', 'psychiatric nurse', 'pen', 'mho', 'mental health officer'],
    topic: ['shift', 'saturday', 'sunday', 'weekend', 'penalty rate'],
    paths: ['ebas/mental-health/rpn-pen-mho/allowances/83-saturday-and-sunday-work.md']
  },
  {
    keywords: ['mental health', 'rpn', 'psychiatric nurse', 'pen', 'mho', 'mental health officer'],
    topic: ['accrued day off', 'ado'],
    paths: ['ebas/mental-health/rpn-pen-mho/leave/97-accrued-days-off.md']
  },
  {
    keywords: ['mental health', 'rpn', 'psychiatric nurse', 'pen', 'mho', 'mental health officer'],
    topic: ['allowance', 'shift allowance'],
    paths: ['ebas/mental-health/rpn-pen-mho/allowances/84-shift-allowances.md']
  },
  {
    keywords: ['mental health', 'rpn', 'psychiatric nurse', 'pen', 'mho', 'mental health officer'],
    topic: ['higher duties', 'higher duty'],
    paths: ['ebas/mental-health/rpn-pen-mho/allowances/78-higher-duties-allowance.md']
  },
  {
    keywords: ['mental health', 'rpn', 'psychiatric nurse', 'pen', 'mho', 'mental health officer'],
    topic: ['classification', 'grade'],
    paths: ['ebas/mental-health/rpn-pen-mho/classification-staffing/104-classification-structures.md']
  },
  {
    keywords: ['mental health', 'rpn', 'psychiatric nurse', 'pen', 'mho', 'mental health officer'],
    topic: ['professional development', 'pd leave'],
    paths: ['ebas/mental-health/rpn-pen-mho/education-pd/99-professional-development-leave.md']
  },
  {
    keywords: ['mental health', 'rpn', 'psychiatric nurse', 'pen', 'mho', 'mental health officer'],
    topic: ['staffing', 'workload'],
    paths: ['ebas/mental-health/rpn-pen-mho/classification-staffing/101-staffing.md']
  },
  {
    keywords: ['mental health', 'rpn', 'psychiatric nurse', 'pen', 'mho', 'mental health officer'],
    topic: ['redundancy'],
    paths: ['ebas/mental-health/common-terms/consultation-disputes/20-redundancy-and-associated-entitlements.md']
  },
  {
    keywords: ['mental health', 'rpn', 'psychiatric nurse', 'pen', 'mho', 'mental health officer'],
    topic: ['dispute'],
    paths: ['ebas/mental-health/common-terms/consultation-disputes/22-disputes-resolution-procedure.md']
  },
  {
    keywords: ['mental health', 'rpn', 'psychiatric nurse', 'pen', 'mho', 'mental health officer'],
    topic: ['superannuation', 'super'],
    paths: ['ebas/mental-health/common-terms/wages/32-superannuation.md']
  },
  {
    keywords: ['mental health', 'rpn', 'psychiatric nurse', 'pen', 'mho', 'mental health officer'],
    topic: ['salary packaging', 'salary sacrifice'],
    paths: ['ebas/mental-health/common-terms/wages/31-salary-packaging.md']
  },
  {
    keywords: ['mental health', 'rpn', 'psychiatric nurse', 'pen', 'mho', 'mental health officer'],
    topic: ['flexible working', 'flexible arrangement'],
    paths: ['ebas/mental-health/common-terms/workplace-rights/65-flexible-working-arrangements.md']
  },
  {
    keywords: ['mental health', 'rpn', 'psychiatric nurse', 'pen', 'mho', 'mental health officer'],
    topic: ['ohs', 'occupational health', 'safety', 'workplace violence'],
    paths: ['ebas/mental-health/common-terms/ohs/69-occupational-health-and-safety-workplace-violence.md']
  },
  {
    keywords: ['mental health', 'rpn', 'psychiatric nurse', 'pen', 'mho', 'mental health officer'],
    topic: [],
    paths: ['ebas/mental-health.md']
  },

  // ── HAS / MANAGERS / ADMIN ────────────────────────────────────────────────
  {
    keywords: ['has', 'health administrative', 'health allied services', 'administrative services', 'admin', 'clerical', 'manager', 'food services', 'cleaning', 'security'],
    topic: ['overtime'],
    paths: [
      'ebas/has-managers-admin/health-allied-services/hours-of-work/25-overtime.md',
      'ebas/has-managers-admin/managers-admin/hours-of-work/10-overtime.md',
    ]
  },
  {
    keywords: ['has', 'health administrative', 'health allied services', 'administrative services', 'admin', 'clerical', 'manager', 'food services', 'cleaning', 'security'],
    topic: ['public holiday', 'holiday'],
    paths: ['ebas/has-managers-admin/common-terms/leave/69-public-holidays.md']
  },
  {
    keywords: ['has', 'health administrative', 'health allied services', 'administrative services', 'admin', 'clerical', 'manager', 'food services', 'cleaning', 'security'],
    topic: ['overtime', 'public holiday', 'holiday'],
    paths: [
      'ebas/has-managers-admin/health-allied-services/hours-of-work/25-overtime.md',
      'ebas/has-managers-admin/common-terms/leave/69-public-holidays.md',
    ]
  },
  {
    keywords: ['has', 'health administrative', 'health allied services', 'administrative services', 'admin', 'clerical', 'manager', 'food services', 'cleaning', 'security'],
    topic: ['wage', 'salary', 'pay rate', 'pay'],
    paths: [
      'ebas/has-managers-admin/common-terms/wages/28-salary-and-allowances-increases.md',
      'ebas/has-managers-admin/schedules/2b-wage-rates-health-allied-services.md',
    ]
  },
  {
    keywords: ['has', 'health administrative', 'health allied services', 'administrative services', 'admin', 'clerical', 'manager', 'food services', 'cleaning', 'security'],
    topic: ['annual leave'],
    paths: ['ebas/has-managers-admin/common-terms/leave/53-annual-leave.md']
  },
  {
    keywords: ['has', 'health administrative', 'health allied services', 'administrative services', 'admin', 'clerical', 'manager', 'food services', 'cleaning', 'security'],
    topic: ['personal leave', 'sick leave', 'carer'],
    paths: ['ebas/has-managers-admin/common-terms/leave/55-personal-leave.md']
  },
  {
    keywords: ['has', 'health administrative', 'health allied services', 'administrative services', 'admin', 'clerical', 'manager', 'food services', 'cleaning', 'security'],
    topic: ['parental leave', 'maternity', 'paternity'],
    paths: ['ebas/has-managers-admin/common-terms/leave/59-parental-leave.md']
  },
  {
    keywords: ['has', 'health administrative', 'health allied services', 'administrative services', 'admin', 'clerical', 'manager', 'food services', 'cleaning', 'security'],
    topic: ['long service leave'],
    paths: ['ebas/has-managers-admin/common-terms/leave/61-long-service-leave.md']
  },
  {
    keywords: ['has', 'health administrative', 'health allied services', 'administrative services', 'admin', 'clerical', 'manager', 'food services', 'cleaning', 'security'],
    topic: ['family violence'],
    paths: ['ebas/has-managers-admin/common-terms/leave/67-family-violence-leave.md']
  },
  {
    keywords: ['has', 'health administrative', 'health allied services', 'administrative services', 'admin', 'clerical', 'manager', 'food services', 'cleaning', 'security'],
    topic: ['compassionate leave', 'bereavement'],
    paths: ['ebas/has-managers-admin/common-terms/leave/56-compassionate-leave.md']
  },
  {
    keywords: ['has', 'health administrative', 'health allied services', 'administrative services', 'admin', 'clerical', 'manager', 'food services', 'cleaning', 'security'],
    topic: ['hours', 'hours of work', 'ordinary hours'],
    paths: ['ebas/has-managers-admin/health-allied-services/hours-of-work/22-hours-of-work.md']
  },
  {
    keywords: ['has', 'health administrative', 'health allied services', 'administrative services', 'admin', 'clerical', 'manager', 'food services', 'cleaning', 'security'],
    topic: ['manager hours', 'manager hours of work'],
    paths: ['ebas/has-managers-admin/managers-admin/hours-of-work/7-hours-of-work.md']
  },
  {
    keywords: ['has', 'health administrative', 'health allied services', 'administrative services', 'admin', 'clerical', 'manager', 'food services', 'cleaning', 'security'],
    topic: ['on call', 'on-call', 'recall', 'call back'],
    paths: ['ebas/has-managers-admin/common-terms/allowances/44-on-call-recall.md']
  },
  {
    keywords: ['has', 'health administrative', 'health allied services', 'administrative services', 'admin', 'clerical', 'manager', 'food services', 'cleaning', 'security'],
    topic: ['roster'],
    paths: ['ebas/has-managers-admin/health-allied-services/hours-of-work/23-rosters-dhsv.md']
  },
  {
    keywords: ['has', 'health administrative', 'health allied services', 'administrative services', 'admin', 'clerical', 'manager', 'food services', 'cleaning', 'security'],
    topic: ['shift', 'saturday', 'sunday', 'weekend', 'penalty rate'],
    paths: ['ebas/has-managers-admin/health-allied-services/hours-of-work/24-weekend-work.md']
  },
  {
    keywords: ['has', 'health administrative', 'health allied services', 'administrative services', 'admin', 'clerical', 'manager', 'food services', 'cleaning', 'security'],
    topic: ['accrued day off', 'ado'],
    paths: ['ebas/has-managers-admin/common-terms/hours-of-work/47-accrued-days-off.md']
  },
  {
    keywords: ['has', 'health administrative', 'health allied services', 'administrative services', 'admin', 'clerical', 'manager', 'food services', 'cleaning', 'security'],
    topic: ['break', 'meal break'],
    paths: ['ebas/has-managers-admin/common-terms/hours-of-work/50-meal-breaks.md']
  },
  {
    keywords: ['has', 'health administrative', 'health allied services', 'administrative services', 'admin', 'clerical', 'manager', 'food services', 'cleaning', 'security'],
    topic: ['allowance', 'shift allowance'],
    paths: ['ebas/has-managers-admin/common-terms/allowances/45-shiftwork.md']
  },
  {
    keywords: ['has', 'health administrative', 'health allied services', 'administrative services', 'admin', 'clerical', 'manager', 'food services', 'cleaning', 'security'],
    topic: ['higher duties', 'higher duty', 'in charge'],
    paths: ['ebas/has-managers-admin/health-allied-services/allowances/9-higher-duties.md']
  },
  {
    keywords: ['has', 'health administrative', 'health allied services', 'administrative services', 'admin', 'clerical', 'manager', 'food services', 'cleaning', 'security'],
    topic: ['classification', 'grade'],
    paths: ['ebas/has-managers-admin/common-terms/classification-staffing/75-classifications.md']
  },
  {
    keywords: ['has', 'health administrative', 'health allied services', 'administrative services', 'admin', 'clerical', 'manager', 'food services', 'cleaning', 'security'],
    topic: ['professional development', 'study leave', 'education'],
    paths: ['ebas/has-managers-admin/managers-admin/education-pd/12-study-leave.md']
  },
  {
    keywords: ['has', 'health administrative', 'health allied services', 'administrative services', 'admin', 'clerical', 'manager', 'food services', 'cleaning', 'security'],
    topic: ['superannuation', 'super'],
    paths: ['ebas/has-managers-admin/common-terms/wages/31-superannuation.md']
  },
  {
    keywords: ['has', 'health administrative', 'health allied services', 'administrative services', 'admin', 'clerical', 'manager', 'food services', 'cleaning', 'security'],
    topic: ['salary packaging', 'salary sacrifice'],
    paths: ['ebas/has-managers-admin/common-terms/wages/32-salary-packaging.md']
  },
  {
    keywords: ['has', 'health administrative', 'health allied services', 'administrative services', 'admin', 'clerical', 'manager', 'food services', 'cleaning', 'security'],
    topic: ['redundancy'],
    paths: ['ebas/has-managers-admin/common-terms/employment-types/26-redundancy-and-associated-entitlements.md']
  },
  {
    keywords: ['has', 'health administrative', 'health allied services', 'administrative services', 'admin', 'clerical', 'manager', 'food services', 'cleaning', 'security'],
    topic: ['dispute'],
    paths: ['ebas/has-managers-admin/common-terms/consultation-disputes/17-dispute-resolution-procedure.md']
  },
  {
    keywords: ['has', 'health administrative', 'health allied services', 'administrative services', 'admin', 'clerical', 'manager', 'food services', 'cleaning', 'security'],
    topic: ['flexible working', 'flexible arrangement'],
    paths: ['ebas/has-managers-admin/common-terms/classification-staffing/79-requests-for-flexible-working-arrangements.md']
  },
  {
    keywords: ['has', 'health administrative', 'health allied services', 'administrative services', 'admin', 'clerical', 'manager', 'food services', 'cleaning', 'security'],
    topic: ['ohs', 'occupational health', 'safety'],
    paths: ['ebas/has-managers-admin/common-terms/ohs/80-occupational-health-safety.md']
  },
  {
    keywords: ['has', 'health administrative', 'health allied services', 'administrative services', 'admin', 'clerical', 'manager', 'food services', 'cleaning', 'security'],
    topic: [],
    paths: ['ebas/has-managers-admin.md']
  },

];

// ─── PATH SCORING ─────────────────────────────────────────────────────────────

function scoreAndSelectPaths(question) {
  const q = question.toLowerCase();
  const pathScores = new Map();

  for (const entry of EBA_PAGE_MAP) {
    const keywordMatch = entry.keywords.some(kw => q.includes(kw));
    if (!keywordMatch) continue;

    const topicMatch = entry.topic.length === 0 || entry.topic.some(t => q.includes(t));
    if (!topicMatch) continue;

    const kwScore = entry.keywords.filter(kw => q.includes(kw)).length;
    const topicScore = entry.topic.filter(t => q.includes(t)).length * 2;
    const score = kwScore + topicScore;

    for (const path of entry.paths) {
      pathScores.set(path, (pathScores.get(path) || 0) + score);
    }
  }

  return [...pathScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([path]) => path);
}

// ─── MARKDOWN FETCHER ─────────────────────────────────────────────────────────

async function fetchMarkdown(path) {
  const url = `${GITHUB_RAW_BASE}/${path}`;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'EBA-Ask-Worker/1.0' },
      cf: { cacheTtl: 3600, cacheEverything: true }
    });
    if (!res.ok) return null;

    const raw = await res.text();
    const stripped = raw.replace(/^---[\s\S]*?---\n?/, '');
    const text = stripped
      .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
      .replace(/^#{1,6}\s+/gm, '')
      .replace(/\*\*/g, '')
      .replace(/\*/g, '')
      .replace(/`/g, '')
      .replace(/^\s*[-*>]\s*/gm, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (text.length < 100) return null;
    return { path, url, text: text.slice(0, 6000) };
  } catch {
    return null;
  }
}

// ─── SYSTEM PROMPT ────────────────────────────────────────────────────────────
// Optimised for both general Ask AI questions and the AskThisPage contextual
// button. The two-question sub-structure in the user message ("what it says"
// and "what it means for employees") anchors all models — including the smaller
// Cerebras llama3.1-8b — to concrete, actionable output rather than vague
// paraphrase. The explicit 300-word cap prevents the 8B model from rambling
// into uncertain territory where hallucination risk rises.

const SYSTEM_PROMPT = `You are the EBA Reference Assistant for the Austin Health EBA Wiki — a structured knowledge base covering Enterprise Bargaining Agreements (EBAs) in the Victorian public health sector.

You answer questions about EBA entitlements — wages, allowances, leave, hours of work, penalty rates, and conditions — for healthcare workers covered by these EBAs: Allied Health Professionals, Biomedical Engineers, Children's Services, Doctors in Training, Health Allied/Managers/Admin (HAS), Medical Specialists, Mental Health, Medical Scientists/Pharmacists/Psychologists (MSPP), and Nurses & Midwives.

## Source Discipline — Non-Negotiable
Answer using ONLY the source content provided below each question. Rules:
- Quote clause numbers, penalty rates, allowance amounts, and conditions exactly as they appear in the sources. Never round, estimate, or paraphrase figures.
- If the sources do not contain enough information to fully answer, say so explicitly: "I cannot confirm this from the provided wiki content." Then direct the user to the relevant wiki page.
- Never invent, estimate, or infer any figures, rates, or clause numbers not explicitly stated in the provided sources.
- If a clause number is referenced in the text but its content is not in the provided sources, flag it: "(Clause N is referenced but its content was not retrieved — verify directly on the wiki)."

## On Mistakes
If you realise mid-response that an earlier statement was incorrect, issue an Update: block immediately: "Update: The figure stated above is incorrect. The correct figure is [X] per [EBA Name, Clause N]." Make corrections transparent — never silently overwrite.

## Response Structure: BLUF + Tree-of-Thought
Structure every response as follows:

1. BLUF (1–2 sentences): The direct answer. What the entitlement is, in plain terms.
2. Detail: The relevant clause text. Use numbered steps for procedural entitlements. Use tables for rate comparisons across classifications or years.
3. Branches (where relevant): If the answer depends on conditions, present each branch explicitly — e.g., "If full-time: ... If part-time: ... If casual: ..."
4. Sources: Compact list of cited clauses — clause number, EBA name, one-line summary of what it covers.

## Citation Format
After every factual claim, include a source reference: [EBA Name, Clause N] or [EBA Name, Appendix N] or [EBA Name, Schedule N].
Example: "Casual employees receive a 25% casual loading [Allied Health EBA, Clause 12]."
End every response with a Sources section listing each cited clause and a one-line description.

## Brain Mode
When you provide expert synthesis or interpretation of how clauses interact (beyond quoting the text directly), wrap it in 🧠 ... 🧠. Do not include source citations inside the 🧠 block — place them in Sources.

## Tone
Confident and direct. No apologies, no AI disclaimers, no hedging. Plain language — explain legal terminology on first use. Non-moralising. No repetition. Keep answers under 300 words where possible.

## Thin Evidence
If the provided sources are insufficient: state what you know, label the gap clearly ("Evidence gap: I cannot confirm [X] from the provided content"), and suggest a next step (e.g., "Check Clause N directly in the [EBA Name] PDF on the wiki").

## Scope
If a question falls outside EBA coverage (Fair Work Act procedures, unfair dismissal, WorkCover), acknowledge it: "This falls outside EBA coverage — consult [Fair Work Commission / WorkSafe Victoria / your union delegate]." Do not provide legal advice.`;

// ─── AI PROVIDER FUNCTIONS ────────────────────────────────────────────────────

function buildMessages(question, pages) {
  const context = pages
    .map((p, i) => `--- Source ${i + 1} (${p.path}) ---\n${p.text}`)
    .join('\n\n');
  return [
    { role: 'system', content: SYSTEM_PROMPT },
    {
      role: 'user',
      content: `QUESTION: ${question}\n\nSOURCES:\n${context}\n\n` +
      `FORMAT REQUIREMENTS (mandatory):\n` +
      `- First line must be: **BLUF:** your one-sentence answer.\n` +
      `- Every section label must use bold: **Detail:** **Branches:** **Sources:**\n` +
      `- Clause numbers must be bold: e.g. **Clause 49** not plain text.\n` +
      `- Percentages and dollar amounts must be bold: e.g. **250%** or **$45.60**.\n` +
      `- Use bullet lists with - for all list items. Example:\n` +
      `  - First item\n` +
      `  - Second item\n` +
      `- Separate every section with a blank line.\n` +
      `- Never write a section label without ** on both sides.\n` +
      `- Never return a wall of text — every section must be visually distinct.`
    }
  ];
}

// Tier 1: Cerebras — llama3.1-8b — 1,000,000 tokens/day free
async function askCerebras(apiKey, question, pages) {
  const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'llama3.1-8b',
      temperature: 0.1,
      max_tokens: 1024,
      messages: buildMessages(question, pages)
    })
  });
  if (!res.ok) throw new Error(`Cerebras ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Cerebras returned no content');
  return { text, provider: 'Cerebras (llama3.1-8b)' };
}

// Tier 2: Groq — llama-3.3-70b-versatile — ~14,400 req/day free
async function askGroq(apiKey, question, pages) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0.1,
      max_tokens: 1024,
      messages: buildMessages(question, pages)
    })
  });
  if (!res.ok) throw new Error(`Groq ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Groq returned no content');
  return { text, provider: 'Groq (llama-3.3-70b-versatile)' };
}

// Tier 3: Gemini — gemini-2.5-flash-lite — 1,000 req/day free
async function askGemini(apiKey, question, pages) {
  const context = pages
    .map((p, i) => `--- Source ${i + 1} (${p.path}) ---\n${p.text}`)
    .join('\n\n');
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{
        role: 'user',
        parts: [{ text: `QUESTION: ${question}\n\nSOURCES:\n${context}` }]
      }],
      generationConfig: { maxOutputTokens: 1024, temperature: 0.1 }
    })
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${await res.text()}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini returned no content');
  return { text, provider: 'Gemini (gemini-2.5-flash-lite)' };
}

// Tier 4: Cloudflare Workers AI — llama-3.1-8b — native binding, no API key
async function askCloudflareAI(ai, question, pages) {
  const messages = buildMessages(question, pages);
  const res = await ai.run('@cf/meta/llama-3.1-8b-instruct-fp8-fast', {
    messages,
    max_tokens: 1024
  });
  const text = typeof res === 'string'
    ? res
    : res?.response ?? res?.choices?.[0]?.message?.content;
  if (!text) throw new Error('Cloudflare AI returned no content');
  return { text, provider: 'Cloudflare Workers AI (llama-3.1-8b)' };
}

// ─── CORS HELPERS ─────────────────────────────────────────────────────────────

function corsHeaders(origin) {
  const allowed = CORS_ALLOWED.has(origin) ? origin : CORS_ORIGIN;
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };
}

function jsonResponse(body, status, origin) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) }
  });
}

// ─── KV CACHE HELPERS ─────────────────────────────────────────────────────────

/**
 * Validates that a contentHash is a well-formed SHA-256 hex string.
 * This prevents cache poisoning from malformed or injected hash values.
 */
function isValidHash(hash) {
  return typeof hash === 'string' && /^[0-9a-f]{64}$/.test(hash);
}

/**
 * Reads a cached AI response from KV by content hash.
 * Returns the parsed cached object or null on miss/error.
 */
async function readCache(kv, contentHash) {
  try {
    const cached = await kv.get(`ai:${contentHash}`, { type: 'json' });
    return cached ?? null;
  } catch {
    return null;
  }
}

/**
 * Writes an AI response to KV with a 30-day TTL.
 * Fires-and-forgets — a write failure never blocks the response.
 */
async function writeCache(kv, contentHash, payload) {
  try {
    await kv.put(
      `ai:${contentHash}`,
      JSON.stringify(payload),
      { expirationTtl: CACHE_TTL_SECONDS }
    );
  } catch {
    // Non-fatal — cache miss on next request is acceptable
  }
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(origin) });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405, headers: corsHeaders(origin) });
    }

    let question, contentHash;
    try {
      const body = await request.json();
      question    = (body.question || '').trim();
      contentHash = body.contentHash || null;
    } catch {
      return jsonResponse({ error: 'Invalid JSON body.' }, 400, origin);
    }

    if (!question || question.length < 5) {
      return jsonResponse({ error: 'Question is too short.' }, 400, origin);
    }

    // ── KV Cache Read ────────────────────────────────────────────────────────
    // Only attempt cache lookup when a valid content hash is provided.
    // The hash is computed client-side as SHA-256(title + eba + pathname).
    if (contentHash && isValidHash(contentHash) && env.EBA_AI_CACHE) {
      const cached = await readCache(env.EBA_AI_CACHE, contentHash);
      if (cached) {
        // Serve from edge cache — no LLM call needed
        return jsonResponse({ ...cached, cached: true }, 200, origin);
      }
    }

    // ── Step 1: Score and select relevant EBA pages ──────────────────────────
    const paths = scoreAndSelectPaths(question);

    if (paths.length === 0) {
      return jsonResponse({
        answer: 'I could not identify which EBA or topic your question relates to. Try including the EBA name (e.g. "Nurses and Midwives EBA") and a specific topic (e.g. "overtime", "public holiday", "wages").'
      }, 200, origin);
    }

    // ── Step 2: Fetch Markdown content from GitHub Raw ───────────────────────
    const pageResults = await Promise.all(paths.map(fetchMarkdown));
    const pages = pageResults.filter(Boolean);

    if (pages.length === 0) {
      return jsonResponse({
        answer: `I matched your question to EBA content but could not retrieve it. Please visit the wiki directly:\n\nhttps://dreadnaughtasaurous.github.io/${paths[0].replace('.md', '.html')}`
      }, 200, origin);
    }

    // ── Step 3: Try each AI provider in tier order ───────────────────────────
    const attempts = [];
    let aiResult = null;

    // Tier 1: Cerebras
    if (env.CEREBRAS_API_KEY) {
      try {
        aiResult = await askCerebras(env.CEREBRAS_API_KEY, question, pages);
      } catch (err) {
        attempts.push({ provider: 'Cerebras', error: err.message });
      }
    } else {
      attempts.push({ provider: 'Cerebras', error: 'CEREBRAS_API_KEY not configured' });
    }

    // Tier 2: Groq
    if (!aiResult && env.GROQ_API_KEY) {
      try {
        aiResult = await askGroq(env.GROQ_API_KEY, question, pages);
      } catch (err) {
        attempts.push({ provider: 'Groq', error: err.message });
      }
    } else if (!aiResult) {
      attempts.push({ provider: 'Groq', error: 'GROQ_API_KEY not configured' });
    }

    // Tier 3: Gemini
    if (!aiResult && env.GEMINI_API_KEY) {
      try {
        aiResult = await askGemini(env.GEMINI_API_KEY, question, pages);
      } catch (err) {
        attempts.push({ provider: 'Gemini', error: err.message });
      }
    } else if (!aiResult) {
      attempts.push({ provider: 'Gemini', error: 'GEMINI_API_KEY not configured' });
    }

    // Tier 4: Cloudflare Workers AI
    if (!aiResult && env.AI) {
      try {
        aiResult = await askCloudflareAI(env.AI, question, pages);
      } catch (err) {
        attempts.push({ provider: 'Cloudflare AI', error: err.message });
      }
    } else if (!aiResult) {
      attempts.push({ provider: 'Cloudflare AI', error: 'AI binding not configured in wrangler.jsonc' });
    }

    // All providers failed
    if (!aiResult) {
      return jsonResponse({
        error: 'All AI providers are currently unavailable. Please try again shortly.',
        attempts
      }, 503, origin);
    }

    // ── Step 4: Build response payload and write to KV cache ─────────────────
    const responsePayload = {
      answer:   aiResult.text,
      provider: aiResult.provider,
      sources:  pages.map(p => `https://dreadnaughtasaurous.github.io/${p.path.replace('.md', '.html')}`)
    };

    // Write to KV only when a valid content hash was supplied (i.e. the request
    // came from the AskThisPage button with a deterministic prompt). General
    // free-form Ask AI questions are not cached because their phrasing varies
    // too much for the hash to be a reliable cache key.
    if (contentHash && isValidHash(contentHash) && env.EBA_AI_CACHE) {
      await writeCache(env.EBA_AI_CACHE, contentHash, responsePayload);
    }

    return jsonResponse(responsePayload, 200, origin);
  }
};