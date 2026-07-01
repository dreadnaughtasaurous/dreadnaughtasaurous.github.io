/**
 * eba-index-data.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Per-EBA content data for EBAIndexPage.vue.
 * Keyed by each EBA's slug value from EBA_REGISTRY.
 *
 * ── Rolling out to a new EBA ─────────────────────────────────────────────────
 * Add a new top-level key matching the EBA's slug, then add the
 * commencement, fullTitle, agreementType, fwcRef, employerRep, employeeRep,
 * coverageClassifications, coverageDesc, coverageAppendix, parts[], and
 * quickAccess[] fields. Verify all factual fields against the official EBA PDF.
 * ─────────────────────────────────────────────────────────────────────────────
 */

export const EBA_INDEX_DATA = {

  'allied-health': {

    commencement:  '2022-12-22',
    fullTitle:     'Allied Health Professionals (Victorian Public Sector) (Single Interest Employers) Enterprise Agreement 2021-2026',
    agreementType: 'Single-interest enterprise agreement',
    fwcRef:        'AE518601',
    fwcDecision:   '[2022] FWCFB 239',
    fwcOdn:        'AG2022/5276',

    employerRep: "Victorian Hospitals' Industrial Association (VHIA)",
    employeeRep: 'Health Services Union, Victoria No. 3 Branch, trading as the Victorian Allied Health Professionals Association (VAHPA)',

    coverageClassifications: [],
    coverageDesc:            'Allied health professionals — Victorian public sector employers (Appendix 1)',
    coverageAppendix:        '/ebas/allied-health/appendices/',

    parts: [
      {
        label:       'Part A',
        title:       'Preliminary',
        path:        '/ebas/allied-health/preliminary/',
        icon:        'ti-file-description',
        description: 'Scope, coverage, definitions and how this agreement operates.',
      },
      {
        label:       'Part B',
        title:       'Consultation, Dispute Resolution and Discipline',
        path:        '/ebas/allied-health/consultation-disputes/',
        icon:        'ti-message-2',
        description: 'How workplace changes are consulted on, disputes are resolved, and disciplinary processes work.',
      },
      {
        label:       'Part C',
        title:       'Types of Employment and Termination of Employment',
        path:        '/ebas/allied-health/employment/',
        icon:        'ti-id-badge',
        description: 'Full-time, part-time and casual arrangements, probation, notice periods and redundancy.',
      },
      {
        label:       'Part D',
        title:       'Wages',
        path:        '/ebas/allied-health/wages/',
        icon:        'ti-currency-dollar',
        highlight:   true,
        description: 'Pay rates, annual wage increases, salary packaging and annualised salary arrangements.',
      },
      {
        label:       'Part E',
        title:       'Allowances and Reimbursements',
        path:        '/ebas/allied-health/allowances/',
        icon:        'ti-receipt',
        highlight:   true,
        description: 'On-call, recall, travel, meal, uniform and other allowances payable under this agreement.',
      },
      {
        label:       'Part F',
        title:       'Hours of Work and Related Matters',
        path:        '/ebas/allied-health/hours-of-work/',
        icon:        'ti-clock',
        highlight:   true,
        description: 'Ordinary hours, rostering, overtime rates and time off in lieu arrangements.',
      },
      {
        label:       'Part G',
        title:       'Public Holidays, Leave and Related Matters',
        path:        '/ebas/allied-health/leave/',
        icon:        'ti-calendar',
        highlight:   true,
        description: "Annual leave, personal/carer's leave, parental leave, long service leave and public holiday entitlements.",
      },
      {
        label:       'Part H',
        title:       'Education and Professional Development',
        path:        '/ebas/allied-health/education-pd/',
        icon:        'ti-school',
        description: 'Study leave, professional development allowances and continuing education commitments.',
      },
      {
        label:       'Part I',
        title:       'Union Matters and Best Practice Employment Commitment',
        path:        '/ebas/allied-health/union-matters/',
        icon:        'ti-building-community',
        description: "Union rights, delegate entitlements and the employer's best practice employment commitments.",
      },
      {
        label:       'Part J',
        title:       'Classifications and Staffing',
        path:        '/ebas/allied-health/classification-staffing/',
        icon:        'ti-list-details',
        description: 'Classification structure, grade descriptors, progression criteria and minimum staffing requirements.',
      },
      {
        label:       'Part K',
        title:       'Workplace Rights',
        path:        '/ebas/allied-health/workplace-rights/',
        icon:        'ti-shield-check',
        description: 'Anti-discrimination, flexible working requests and individual flexibility arrangements.',
      },
      {
        label:       'Part L',
        title:       'Occupational Health and Safety',
        path:        '/ebas/allied-health/ohs/',
        icon:        'ti-first-aid-kit',
        description: 'OHS obligations, health and safety representative rights and injury management arrangements.',
      },
      {
        label:       'Appendices',
        title:       'Appendices',
        path:        '/ebas/allied-health/appendices/',
        icon:        'ti-paperclip',
        description: 'Employer list, current pay and allowance rate tables, and standard forms and templates.',
      },
    ],

    quickAccess: [
      { label: 'Current pay rates',           sub: 'Part D · Wages',         path: '/ebas/allied-health/wages/',         icon: 'ti-currency-dollar' },
      { label: 'Allowances & reimbursements',  sub: 'Part E',                 path: '/ebas/allied-health/allowances/',    icon: 'ti-receipt-2' },
      { label: 'Leave entitlements',           sub: 'Part G · Leave',         path: '/ebas/allied-health/leave/',         icon: 'ti-calendar' },
      { label: 'Overtime & hours',             sub: 'Part F · Hours of work', path: '/ebas/allied-health/hours-of-work/', icon: 'ti-clock-hour-4' },
    ],

  },

  'nurses-midwives': {

    commencement:  '2024-11-15',
    fullTitle:     'Nurses and Midwives (Victorian Public Sector) Single Interest Employer Agreement 2024-2028',
    agreementType: 'Single-interest employer agreement',
    fwcRef:        'AE526693',
    fwcDecision:   '',
    fwcOdn:        'AG2024/3737',

    employerRep: "Victorian Hospitals' Industrial Association (VHIA)",
    employeeRep: 'Australian Nursing and Midwifery Federation (ANMF) and Health Services Union (HSU)',

    coverageClassifications: [],
    coverageDesc:            'Nurses, enrolled nurses and midwives — Victorian public sector employers (Appendix 1)',
    coverageAppendix:        '/ebas/nurses-midwives/appendices/',

    parts: [
      {
        label:       'Part A',
        title:       'Preliminary',
        path:        '/ebas/nurses-midwives/preliminary/',
        icon:        'ti-file-description',
        description: 'Scope, coverage, definitions and how this agreement operates.',
      },
      {
        label:       'Part B',
        title:       'Consultation, Disputes, Discipline',
        path:        '/ebas/nurses-midwives/consultation-disputes/',
        icon:        'ti-message-2',
        description: 'How workplace changes are consulted on, disputes are resolved, and disciplinary processes work.',
      },
      {
        label:       'Part C',
        title:       'Employment Types',
        path:        '/ebas/nurses-midwives/employment-types/',
        icon:        'ti-id-badge',
        description: 'Full-time, part-time and casual arrangements, probation, notice periods and redundancy.',
      },
      {
        label:       'Part D',
        title:       'Wages',
        path:        '/ebas/nurses-midwives/wages/',
        icon:        'ti-currency-dollar',
        highlight:   true,
        description: 'Pay rates, annual wage increases and annualised salary arrangements.',
      },
      {
        label:       'Part E',
        title:       'Allowances and Reimbursements',
        path:        '/ebas/nurses-midwives/allowances/',
        icon:        'ti-receipt',
        highlight:   true,
        description: 'On-call, recall, travel, meal, uniform and other allowances payable under this agreement.',
      },
      {
        label:       'Part F',
        title:       'Hours of Work',
        path:        '/ebas/nurses-midwives/hours-of-work/',
        icon:        'ti-clock',
        highlight:   true,
        description: 'Ordinary hours, rostering, overtime rates and time off in lieu arrangements.',
      },
      {
        label:       'Part G',
        title:       'Public Holidays, Leave',
        path:        '/ebas/nurses-midwives/leave/',
        icon:        'ti-calendar',
        highlight:   true,
        description: "Annual leave, personal/carer's leave, parental leave, long service leave and public holiday entitlements.",
      },
      {
        label:       'Part H',
        title:       'Education and Professional Development',
        path:        '/ebas/nurses-midwives/education-pd/',
        icon:        'ti-school',
        description: 'Study leave, professional development allowances and continuing education commitments.',
      },
      {
        label:       'Part I',
        title:       'Union Matters',
        path:        '/ebas/nurses-midwives/union-matters/',
        icon:        'ti-building-community',
        description: "Union rights, delegate entitlements and the employer's best practice employment commitments.",
      },
      {
        label:       'Part J',
        title:       'Classifications and Staffing',
        path:        '/ebas/nurses-midwives/classification-staffing/',
        icon:        'ti-list-details',
        description: 'Classification structure, grade descriptors, progression criteria and minimum staffing requirements.',
      },
      {
        label:       'Part K',
        title:       'Occupational Health and Safety',
        path:        '/ebas/nurses-midwives/ohs/',
        icon:        'ti-first-aid-kit',
        description: 'OHS obligations, health and safety representative rights and injury management arrangements.',
      },
      {
        label:       'Part L',
        title:       'Safe Patient Care',
        path:        '/ebas/nurses-midwives/safe-patient-care/',
        icon:        'ti-stethoscope',
        description: 'Safe patient care obligations, nurse-to-patient ratios and workload management requirements.',
      },
      {
        label:       'Appendices',
        title:       'Appendices',
        path:        '/ebas/nurses-midwives/appendices/',
        icon:        'ti-paperclip',
        description: 'Employer list, current pay and allowance rate tables, and standard forms and templates.',
      },
    ],

    quickAccess: [
      { label: 'Current pay rates',          sub: 'Part D · Wages',         path: '/ebas/nurses-midwives/wages/',         icon: 'ti-currency-dollar' },
      { label: 'Allowances & reimbursements', sub: 'Part E',                 path: '/ebas/nurses-midwives/allowances/',    icon: 'ti-receipt-2' },
      { label: 'Leave entitlements',          sub: 'Part G · Leave',         path: '/ebas/nurses-midwives/leave/',         icon: 'ti-calendar' },
      { label: 'Overtime & hours',            sub: 'Part F · Hours of work', path: '/ebas/nurses-midwives/hours-of-work/', icon: 'ti-clock-hour-4' },
    ],

  },

  'biomedical-engineers': {

    commencement:  '2025-01-28',
    fullTitle:     'Biomedical Engineers (Victorian Public Sector) (Single Interest Employers) Enterprise Agreement 2024-2028',
    agreementType: 'Single-interest employers enterprise agreement',
    fwcRef:        'AE527694',
    fwcDecision:   '[2025] FWCA 233',
    fwcOdn:        'AG2024/4957',

    employerRep: "Victorian Hospitals' Industrial Association (VHIA)",
    employeeRep: 'Association of Professionals Engineers, Scientists & Managers Australia (APESMA)',

    coverageClassifications: [],
    coverageDesc:            'Biomedical engineers — Victorian public sector employers (Appendix 1)',
    coverageAppendix:        '/ebas/biomedical-engineers/appendices/',

    parts: [
      {
        label:       'Part A',
        title:       'Preliminary',
        path:        '/ebas/biomedical-engineers/preliminary/',
        icon:        'ti-file-description',
        description: 'Scope, coverage, definitions and how this agreement operates.',
      },
      {
        label:       'Part B',
        title:       'Consultation, Dispute Resolution and Discipline',
        path:        '/ebas/biomedical-engineers/consultation-disputes/',
        icon:        'ti-message-2',
        description: 'How workplace changes are consulted on, disputes are resolved, and disciplinary processes work.',
      },
      {
        label:       'Part C',
        title:       'Types of Employment, Commencement and End of Employment',
        path:        '/ebas/biomedical-engineers/employment/',
        icon:        'ti-id-badge',
        description: 'Full-time, part-time and casual arrangements, probation, notice periods and redundancy.',
      },
      {
        label:       'Part D',
        title:       'Wages',
        path:        '/ebas/biomedical-engineers/wages/',
        icon:        'ti-currency-dollar',
        highlight:   true,
        description: 'Pay rates, annual wage increases, salary packaging and annualised salary arrangements.',
      },
      {
        label:       'Part E',
        title:       'Allowances and Reimbursements',
        path:        '/ebas/biomedical-engineers/allowances/',
        icon:        'ti-receipt',
        highlight:   true,
        description: 'On-call, recall, travel, meal, uniform and other allowances payable under this agreement.',
      },
      {
        label:       'Part F',
        title:       'Hours of Work and Related Matters',
        path:        '/ebas/biomedical-engineers/hours-of-work/',
        icon:        'ti-clock',
        highlight:   true,
        description: 'Ordinary hours, rostering, overtime rates and time off in lieu arrangements.',
      },
      {
        label:       'Part G',
        title:       'Public Holidays, Leave and Related Matters',
        path:        '/ebas/biomedical-engineers/leave/',
        icon:        'ti-calendar',
        highlight:   true,
        description: "Annual leave, personal/carer's leave, parental leave, long service leave and public holiday entitlements.",
      },
      {
        label:       'Part H',
        title:       'Education and Professional Development',
        path:        '/ebas/biomedical-engineers/education-pd/',
        icon:        'ti-school',
        description: 'Study leave, professional development allowances and continuing education commitments.',
      },
      {
        label:       'Part I',
        title:       'Union Matters and Best Practice Employment Commitment',
        path:        '/ebas/biomedical-engineers/union-matters/',
        icon:        'ti-building-community',
        description: "Union rights, delegate entitlements and the employer's best practice employment commitments.",
      },
      {
        label:       'Part J',
        title:       'Classifications and Staffing',
        path:        '/ebas/biomedical-engineers/classification-staffing/',
        icon:        'ti-list-details',
        description: 'Classification structure, grade descriptors, progression criteria and minimum staffing requirements.',
      },
      {
        label:       'Part K',
        title:       'Workplace Rights',
        path:        '/ebas/biomedical-engineers/workplace-rights/',
        icon:        'ti-shield-check',
        description: 'Anti-discrimination, flexible working requests and individual flexibility arrangements.',
      },
      {
        label:       'Appendices',
        title:       'Appendices',
        path:        '/ebas/biomedical-engineers/appendices/',
        icon:        'ti-paperclip',
        description: 'Employer list, current pay and allowance rate tables, and standard forms and templates.',
      },
    ],

    quickAccess: [
      { label: 'Current pay rates',          sub: 'Part D · Wages',         path: '/ebas/biomedical-engineers/wages/',         icon: 'ti-currency-dollar' },
      { label: 'Allowances & reimbursements', sub: 'Part E',                 path: '/ebas/biomedical-engineers/allowances/',    icon: 'ti-receipt-2' },
      { label: 'Leave entitlements',          sub: 'Part G · Leave',         path: '/ebas/biomedical-engineers/leave/',         icon: 'ti-calendar' },
      { label: 'Overtime & hours',            sub: 'Part F · Hours of work', path: '/ebas/biomedical-engineers/hours-of-work/', icon: 'ti-clock-hour-4' },
    ],

  },

  'medical-specialists': {

    commencement:  '2022-11-03',
    fullTitle:     'Medical Specialists (Victorian Public Health Sector) (AMA Victoria/ASMOF) (Single Interest Employers) Enterprise Agreement 2022-2026',
    agreementType: 'Single-interest employers enterprise agreement',
    fwcRef:        'AE517968',
    fwcDecision:   '',
    fwcOdn:        'AG2022/4441',

    employerRep: "Victorian Hospitals' Industrial Association (VHIA)",
    employeeRep: 'Australian Medical Association (Victoria) (AMA Victoria) and Australian Salaried Medical Officers Federation, Victorian Branch (ASMOF)',

    coverageClassifications: [],
    coverageDesc:            'Medical specialists (consultants) — Victorian public health sector employers (Appendix 1)',
    coverageAppendix:        '/ebas/medical-specialists/appendices/',

    parts: [
      {
        label:       'Part A',
        title:       'Preliminary',
        path:        '/ebas/medical-specialists/preliminary/',
        icon:        'ti-file-description',
        description: 'Scope, coverage, definitions and how this agreement operates.',
      },
      {
        label:       'Part B',
        title:       'Consultation, Dispute Resolution, Discipline and Flexible Working',
        path:        '/ebas/medical-specialists/consultation-disputes/',
        icon:        'ti-message-2',
        description: 'How workplace changes are consulted on, disputes are resolved, and disciplinary processes work.',
      },
      {
        label:       'Part C',
        title:       'Types of Employment, End of Employment and Related Matters',
        path:        '/ebas/medical-specialists/employment/',
        icon:        'ti-id-badge',
        description: 'Full-time, part-time and casual arrangements, probation, notice periods and redundancy.',
      },
      {
        label:       'Part D',
        title:       'Hours of Work and Related Matters',
        path:        '/ebas/medical-specialists/hours-of-work/',
        icon:        'ti-clock',
        highlight:   true,
        description: 'Ordinary hours, rostering, overtime rates and time off in lieu arrangements.',
      },
      {
        label:       'Part E',
        title:       'Wages and Related Matters',
        path:        '/ebas/medical-specialists/wages/',
        icon:        'ti-currency-dollar',
        highlight:   true,
        description: 'Pay rates, annual wage increases and salary arrangements.',
      },
      {
        label:       'Part F',
        title:       'Allowances and Related Matters',
        path:        '/ebas/medical-specialists/allowances/',
        icon:        'ti-receipt',
        highlight:   true,
        description: 'On-call, recall, travel, meal and other allowances payable under this agreement.',
      },
      {
        label:       'Part G',
        title:       'Accommodation and Facilities',
        path:        '/ebas/medical-specialists/accommodation/',
        icon:        'ti-building',
        description: 'Accommodation entitlements and workplace facilities for medical specialists.',
      },
      {
        label:       'Part H',
        title:       'Public Holidays, Leave and Related Matters',
        path:        '/ebas/medical-specialists/leave/',
        icon:        'ti-calendar',
        highlight:   true,
        description: "Annual leave, personal/carer's leave, parental leave, long service leave and public holiday entitlements.",
      },
      {
        label:       'Part I',
        title:       'Union Matters and Best Practice Employment Commitment',
        path:        '/ebas/medical-specialists/union-matters/',
        icon:        'ti-building-community',
        description: "Union rights, delegate entitlements and the employer's best practice employment commitments.",
      },
      {
        label:       'Appendices',
        title:       'Appendices',
        path:        '/ebas/medical-specialists/appendices/',
        icon:        'ti-paperclip',
        description: 'Employer list, current pay and allowance rate tables, and standard forms and templates.',
      },
    ],

    quickAccess: [
      { label: 'Current pay rates',          sub: 'Part E · Wages',         path: '/ebas/medical-specialists/wages/',         icon: 'ti-currency-dollar' },
      { label: 'Allowances & reimbursements', sub: 'Part F',                 path: '/ebas/medical-specialists/allowances/',    icon: 'ti-receipt-2' },
      { label: 'Leave entitlements',          sub: 'Part H · Leave',         path: '/ebas/medical-specialists/leave/',         icon: 'ti-calendar' },
      { label: 'Overtime & hours',            sub: 'Part D · Hours of work', path: '/ebas/medical-specialists/hours-of-work/', icon: 'ti-clock-hour-4' },
    ],

  },

  'doctors-in-training': {

    commencement:  '2022-11-09',
    fullTitle:     'Doctors in Training (Victorian Public Health Sector) (AMA Victoria/ASMOF) (Single Interest Employers) Enterprise Agreement 2022-2026',
    agreementType: 'Single-interest employers enterprise agreement',
    fwcRef:        'AE518015',
    fwcDecision:   '',
    fwcOdn:        'AG2022/4438',

    employerRep: "Victorian Hospitals' Industrial Association (VHIA)",
    employeeRep: 'AMA Victoria and Australian Salaried Medical Officers Federation (ASMOF)',

    coverageClassifications: [],
    coverageDesc:            'Doctors in Training (HMOs, Registrars and Interns) — Victorian public health sector employers (Appendix 1)',
    coverageAppendix:        '/ebas/doctors-in-training/appendices/',

    parts: [
      {
        label:       'Part A',
        title:       'Preliminary',
        path:        '/ebas/doctors-in-training/preliminary/',
        icon:        'ti-file-description',
        description: 'Scope, coverage, definitions and how this agreement operates.',
      },
      {
        label:       'Part B',
        title:       'Consultation, Dispute Resolution, Discipline and Flexible Working',
        path:        '/ebas/doctors-in-training/consultation-disputes/',
        icon:        'ti-message-2',
        description: 'How workplace changes are consulted on, disputes are resolved, and disciplinary processes work.',
      },
      {
        label:       'Part C',
        title:       'Doctor Employment',
        path:        '/ebas/doctors-in-training/doctor-employment/',
        icon:        'ti-id-badge',
        description: 'Types of engagement, contracts of employment, probation and end of employment arrangements.',
      },
      {
        label:       'Part D',
        title:       'Hours of Work and Related Matters',
        path:        '/ebas/doctors-in-training/hours-of-work/',
        icon:        'ti-clock',
        highlight:   true,
        description: 'Ordinary hours, rostering, overtime rates and fatigue provisions.',
      },
      {
        label:       'Part E',
        title:       'Remuneration and Related Matters',
        path:        '/ebas/doctors-in-training/remuneration/',
        icon:        'ti-currency-dollar',
        highlight:   true,
        description: 'Pay rates, annual wage increases and salary arrangements.',
      },
      {
        label:       'Part F',
        title:       'Education and Professional Development',
        path:        '/ebas/doctors-in-training/education-pd/',
        icon:        'ti-school',
        description: 'Study leave, professional development allowances and continuing education commitments.',
      },
      {
        label:       'Part G',
        title:       'Allowances and Reimbursements',
        path:        '/ebas/doctors-in-training/allowances/',
        icon:        'ti-receipt',
        highlight:   true,
        description: 'On-call, recall, travel, meal and other allowances payable under this agreement.',
      },
      {
        label:       'Part H',
        title:       'Public Holidays, Leave and Related Matters',
        path:        '/ebas/doctors-in-training/leave/',
        icon:        'ti-calendar',
        highlight:   true,
        description: "Annual leave, personal/carer's leave, parental leave, long service leave and public holiday entitlements.",
      },
      {
        label:       'Part I',
        title:       'Accommodation and Facilities',
        path:        '/ebas/doctors-in-training/accommodation/',
        icon:        'ti-building',
        description: 'Accommodation entitlements and workplace facilities for doctors in training.',
      },
      {
        label:       'Part J',
        title:       'Union Matters and Best Practice Employment Commitment',
        path:        '/ebas/doctors-in-training/union-matters/',
        icon:        'ti-building-community',
        description: "Union rights, delegate entitlements and the employer's best practice employment commitments.",
      },
      {
        label:       'Appendices',
        title:       'Appendices',
        path:        '/ebas/doctors-in-training/appendices/',
        icon:        'ti-paperclip',
        description: 'Employer list, current pay and allowance rate tables, and standard forms and templates.',
      },
    ],

    quickAccess: [
      { label: 'Current pay rates',          sub: 'Part E · Remuneration',   path: '/ebas/doctors-in-training/remuneration/',  icon: 'ti-currency-dollar' },
      { label: 'Allowances & reimbursements', sub: 'Part G',                  path: '/ebas/doctors-in-training/allowances/',    icon: 'ti-receipt-2' },
      { label: 'Leave entitlements',          sub: 'Part H · Leave',          path: '/ebas/doctors-in-training/leave/',         icon: 'ti-calendar' },
      { label: 'Overtime & hours',            sub: 'Part D · Hours of work',  path: '/ebas/doctors-in-training/hours-of-work/', icon: 'ti-clock-hour-4' },
    ],

  },

  'mspp': {

    commencement:  '2022-11-28',
    fullTitle:     'Medical Scientists, Pharmacists and Psychologists Victorian Public Sector (Single Interest Employers) Enterprise Agreement 2021-2025',
    agreementType: 'Single-interest employers enterprise agreement',
    fwcRef:        'AE518208',
    fwcDecision:   '',
    fwcOdn:        'AG2022/4538',

    employerRep: "Victorian Hospitals' Industrial Association (VHIA)",
    employeeRep: 'Health Services Union, Victoria No. 2 Branch (HSU)',

    coverageClassifications: [],
    coverageDesc:            'Medical scientists, pharmacists and psychologists — Victorian public health sector employers (Schedule 1)',
    coverageAppendix:        '/ebas/mspp/schedules/',

    parts: [
      {
        label:       'Part 1',
        title:       'Operation of Agreement',
        path:        '/ebas/mspp/operation/',
        icon:        'ti-file-description',
        description: 'Scope, coverage, definitions and how this agreement operates.',
      },
      {
        label:       'Part 2',
        title:       'Dispute Settling',
        path:        '/ebas/mspp/disputes/',
        icon:        'ti-message-2',
        description: 'Procedures for resolving workplace disputes.',
      },
      {
        label:       'Part 3',
        title:       'Union Rights',
        path:        '/ebas/mspp/union-rights/',
        icon:        'ti-building-community',
        description: 'Union rights and delegate entitlements.',
      },
      {
        label:       'Part 4',
        title:       'Employment Relationship and Related Arrangements',
        path:        '/ebas/mspp/employment/',
        icon:        'ti-id-badge',
        description: 'Types of engagement, contracts of employment, probation and end of employment arrangements.',
      },
      {
        label:       'Part 5',
        title:       'Workforce Management',
        path:        '/ebas/mspp/workforce-management/',
        icon:        'ti-users',
        description: 'Workforce planning, change management and related employer obligations.',
      },
      {
        label:       'Part 6',
        title:       'Classification, Salaries and Higher Qualification Allowances',
        path:        '/ebas/mspp/classification-salaries/',
        icon:        'ti-currency-dollar',
        highlight:   true,
        description: 'Classification structure, pay rates and higher qualification allowance entitlements.',
      },
      {
        label:       'Part 7',
        title:       'Hours of Work, Breaks, Overtime, Shiftwork and Weekend Work',
        path:        '/ebas/mspp/hours-of-work/',
        icon:        'ti-clock',
        highlight:   true,
        description: 'Ordinary hours, breaks, overtime, shift penalties and weekend work rates.',
      },
      {
        label:       'Part 8',
        title:       'Leave of Absence and Public Holidays',
        path:        '/ebas/mspp/leave/',
        icon:        'ti-calendar',
        highlight:   true,
        description: "Annual leave, personal/carer's leave, parental leave, long service leave and public holiday entitlements.",
      },
      {
        label:       'Part 9',
        title:       'Transport, Tolls and Vehicle Allowance',
        path:        '/ebas/mspp/transport/',
        icon:        'ti-car',
        description: 'Transport allowances, toll reimbursements and vehicle allowance entitlements.',
      },
      {
        label:       'Part 10',
        title:       'Accident Pay, Clothing and Equipment Allowances',
        path:        '/ebas/mspp/accident-pay-allowances/',
        icon:        'ti-receipt',
        highlight:   true,
        description: 'Accident pay, clothing allowances and equipment reimbursements.',
      },
      {
        label:       'Part 11',
        title:       'Clinical Supervision of Psychologists and Other Matters',
        path:        '/ebas/mspp/clinical-supervision/',
        icon:        'ti-brain',
        description: 'Clinical supervision requirements for psychologists and other miscellaneous provisions.',
      },
      {
        label:       'Schedules',
        title:       'Schedules',
        path:        '/ebas/mspp/schedules/',
        icon:        'ti-paperclip',
        description: 'Classification descriptors, pay and allowance rates, and hospital-specific conditions.',
      },
    ],

    quickAccess: [
      { label: 'Current pay rates',          sub: 'Part 6 · Classification & Salaries', path: '/ebas/mspp/classification-salaries/', icon: 'ti-currency-dollar' },
      { label: 'Allowances & accident pay',   sub: 'Part 10',                            path: '/ebas/mspp/accident-pay-allowances/', icon: 'ti-receipt-2' },
      { label: 'Leave entitlements',          sub: 'Part 8 · Leave',                     path: '/ebas/mspp/leave/',                   icon: 'ti-calendar' },
      { label: 'Overtime & hours',            sub: 'Part 7 · Hours of work',             path: '/ebas/mspp/hours-of-work/',           icon: 'ti-clock-hour-4' },
    ],

  },

  'childrens-services': {

    commencement:  '2010-01-01',
    fullTitle:     "Children's Services Award 2010",
    agreementType: 'Modern award (Fair Work Commission)',
    fwcRef:        'MA000120',
    fwcDecision:   '',
    fwcOdn:        '',

    employerRep: '',
    employeeRep: '',

    coverageClassifications: [],
    coverageDesc:            "Children's services and early childhood education — national modern award",
    coverageAppendix:        null,

    parts: [
      {
        label:       'Part 1',
        title:       'Application and Operation',
        path:        '/ebas/childrens-services/application-operation/',
        icon:        'ti-file-description',
        description: 'Scope, coverage, definitions and how this award operates.',
      },
      {
        label:       'Part 2',
        title:       'Workplace Delegates, Consultation and Dispute Resolution',
        path:        '/ebas/childrens-services/consultation-disputes/',
        icon:        'ti-message-2',
        description: 'Workplace delegate rights, consultation obligations and dispute resolution procedures.',
      },
      {
        label:       'Part 3',
        title:       'Types of Employment and Termination of Employment',
        path:        '/ebas/childrens-services/employment/',
        icon:        'ti-id-badge',
        description: 'Full-time, part-time and casual arrangements, notice periods and redundancy.',
      },
      {
        label:       'Part 4',
        title:       'Minimum Wages and Related Matters',
        path:        '/ebas/childrens-services/wages/',
        icon:        'ti-currency-dollar',
        highlight:   true,
        description: 'Minimum pay rates, allowances and penalty rates payable under this award.',
      },
      {
        label:       'Part 5',
        title:       'Hours of Work and Related Matters',
        path:        '/ebas/childrens-services/hours-of-work/',
        icon:        'ti-clock',
        highlight:   true,
        description: 'Ordinary hours, overtime, shiftwork and break entitlements.',
      },
      {
        label:       'Part 6',
        title:       'Leave and Public Holidays',
        path:        '/ebas/childrens-services/leave/',
        icon:        'ti-calendar',
        highlight:   true,
        description: "Annual leave, personal/carer's leave, parental leave and public holiday entitlements.",
      },
      {
        label:       'Schedules',
        title:       'Schedules',
        path:        '/ebas/childrens-services/schedules/',
        icon:        'ti-paperclip',
        description: 'Classification definitions, pay rates and award-specific provisions.',
      },
    ],

    quickAccess: [
      { label: 'Minimum wages',       sub: 'Part 4 · Wages',          path: '/ebas/childrens-services/wages/',         icon: 'ti-currency-dollar' },
      { label: 'Leave entitlements',  sub: 'Part 6 · Leave',          path: '/ebas/childrens-services/leave/',         icon: 'ti-calendar' },
      { label: 'Hours of work',       sub: 'Part 5',                  path: '/ebas/childrens-services/hours-of-work/', icon: 'ti-clock-hour-4' },
      { label: 'Pay scales',          sub: 'Schedules',               path: '/ebas/childrens-services/schedules/',     icon: 'ti-table' },
    ],

  },

  'has-managers-admin-2021-2025': {

    commencement:  '2022-04-20',
    fullTitle:     'Health and Allied Services, Managers and Administrative Workers (Victorian Public Sector) (Single Interest Employers) Enterprise Agreement 2021-2025',
    agreementType: 'Single-interest employers enterprise agreement',
    fwcRef:        'AE515689',
    fwcDecision:   '[2022] FWCA 1295',
    fwcOdn:        'AG2022/764',

    employerRep: "Victorian Hospitals' Industrial Association (VHIA)",
    employeeRep: 'Health Services Union (HSU) and other bargaining representatives',

    coverageClassifications: [],
    coverageDesc:            'Health and allied services employees, dental assistants, managers and administrative workers — Victorian public health sector (Schedule 1A)',
    coverageAppendix:        '/ebas/archive/has-managers-admin-2021-2025/schedules/',

    parts: [
      {
        label:       'Section 1',
        title:       'Common Terms',
        path:        '/ebas/archive/has-managers-admin-2021-2025/common-terms/',
        icon:        'ti-files',
        highlight:   true,
        description: 'Provisions applicable to all employees — general conditions, hours, leave and dispute resolution.',
      },
      {
        label:       'Section 2',
        title:       'Health & Allied Services Employees and Dental Assistants',
        path:        '/ebas/archive/has-managers-admin-2021-2025/health-allied-services/',
        icon:        'ti-stethoscope',
        highlight:   true,
        description: 'Specific conditions, classifications and wage rates for health and allied services employees and dental assistants.',
      },
      {
        label:       'Section 3',
        title:       'Managers and Administrative Workers',
        path:        '/ebas/archive/has-managers-admin-2021-2025/managers-admin/',
        icon:        'ti-briefcase',
        highlight:   true,
        description: 'Specific conditions, classifications and wage rates for managers and administrative workers.',
      },
      {
        label:       'Schedules',
        title:       'Schedules',
        path:        '/ebas/archive/has-managers-admin-2021-2025/schedules/',
        icon:        'ti-paperclip',
        description: 'Employer list, classification structure, pay and allowance rates.',
      },
    ],

    quickAccess: [
      { label: 'Common terms',              sub: 'Section 1 · All employees',          path: '/ebas/archive/has-managers-admin-2021-2025/common-terms/',        icon: 'ti-clipboard-list' },
      { label: 'Health & Allied Services',  sub: 'Section 2',                          path: '/ebas/archive/has-managers-admin-2021-2025/health-allied-services/', icon: 'ti-stethoscope' },
      { label: 'Managers & Admin',          sub: 'Section 3',                          path: '/ebas/archive/has-managers-admin-2021-2025/managers-admin/',        icon: 'ti-briefcase' },
      { label: 'Pay rates & schedules',     sub: 'Schedules',                          path: '/ebas/archive/has-managers-admin-2021-2025/schedules/',             icon: 'ti-currency-dollar' },
    ],

  },

  'has-managers-admin': {

    commencement:  '2026-07-01',
    fullTitle:     'Health and Allied Services, Managers and Administrative Workers (Victorian Public Sector) (Single Interest Employers) Enterprise Agreement 2025-2027',
    agreementType: 'Single-interest employers enterprise agreement',
    fwcRef:        'AE533226',
    fwcDecision:   '[2026] FWCA 1632',
    fwcOdn:        'AG2026/1323',

    employerRep: "Victorian Hospitals' Industrial Association (VHIA)",
    employeeRep: 'Health Services Union (HSU)',

    coverageClassifications: [],
    coverageDesc:            'Health and allied services employees, dental assistants, managers and administrative workers — Victorian public health sector (Schedule 1A, 77 employers)',
    coverageAppendix:        '/ebas/has-managers-admin-2025-2027/schedules/',

    parts: [
      {
        label:       'Section 1',
        title:       'Common Terms',
        path:        '/ebas/has-managers-admin-2025-2027/common-terms/',
        icon:        'ti-files',
        highlight:   true,
        description: 'Provisions applicable to all employees — general conditions, hours, leave and dispute resolution.',
      },
      {
        label:       'Section 2',
        title:       'Health & Allied Services Employees and Dental Assistants',
        path:        '/ebas/has-managers-admin-2025-2027/health-allied-services/',
        icon:        'ti-stethoscope',
        highlight:   true,
        description: 'Specific conditions, classifications and wage rates for health and allied services employees and dental assistants.',
      },
      {
        label:       'Section 3',
        title:       'Managers and Administrative Workers',
        path:        '/ebas/has-managers-admin-2025-2027/managers-admin/',
        icon:        'ti-briefcase',
        highlight:   true,
        description: 'Specific conditions, classifications and wage rates for managers and administrative workers.',
      },
      {
        label:       'Schedules',
        title:       'Schedules',
        path:        '/ebas/has-managers-admin-2025-2027/schedules/',
        icon:        'ti-paperclip',
        description: 'Employer list, classification structure, pay and allowance rates.',
      },
    ],

    quickAccess: [
      { label: 'Common terms',             sub: 'Section 1 · All employees', path: '/ebas/has-managers-admin-2025-2027/common-terms/',         icon: 'ti-clipboard-list' },
      { label: 'Health & Allied Services', sub: 'Section 2',                 path: '/ebas/has-managers-admin-2025-2027/health-allied-services/', icon: 'ti-stethoscope' },
      { label: 'Managers & Admin',         sub: 'Section 3',                 path: '/ebas/has-managers-admin-2025-2027/managers-admin/',         icon: 'ti-briefcase' },
      { label: 'Pay rates & schedules',    sub: 'Schedules',                 path: '/ebas/has-managers-admin-2025-2027/schedules/',              icon: 'ti-currency-dollar' },
    ],

  },

  'mental-health': {

    commencement:  '2026-03-02',
    fullTitle:     'Victorian Public Mental Health Services Enterprise Agreement 2024-2028',
    agreementType: 'Single-interest enterprise agreement',
    fwcRef:        'AE532110',
    fwcDecision:   '[2026] FWCA 433',
    fwcOdn:        'AG2026/17',

    employerRep: "Victorian Hospitals' Industrial Association (VHIA)",
    employeeRep: 'Australian Nursing and Midwifery Federation (ANMF) and Health and Community Services Union (HACSU)',

    coverageClassifications: [],
    coverageDesc:            'Employees across Victorian public mental health employers — see Schedule 1',
    coverageAppendix:        '/ebas/mental-health/schedules/',

    parts: [
      {
        label:       'Section 1',
        title:       'Common Terms',
        path:        '/ebas/mental-health/common-terms/',
        icon:        'ti-files',
        highlight:   true,
        description: 'Provisions applicable to all employees — general conditions, hours, leave and dispute resolution.',
      },
      {
        label:       'Section 2',
        title:       'RPNs, PENs and Mental Health Officers',
        path:        '/ebas/mental-health/rpn-pen-mho/',
        icon:        'ti-brain',
        highlight:   true,
        description: 'Specific conditions for Registered Psychiatric Nurses, Psychiatric Enrolled Nurses and Mental Health Officers.',
      },
      {
        label:       'Section 3',
        title:       'Health Professionals and LLEW',
        path:        '/ebas/mental-health/health-professionals/',
        icon:        'ti-stethoscope',
        highlight:   true,
        description: 'Specific conditions for health professionals and lived and living experience workers.',
      },
      {
        label:       'Section 4',
        title:       'Support Services Employees',
        path:        '/ebas/mental-health/support-services/',
        icon:        'ti-tools',
        highlight:   true,
        description: 'Specific conditions for support services employees.',
      },
      {
        label:       'Section 5',
        title:       'Management and Administrative Workers',
        path:        '/ebas/mental-health/management-admin/',
        icon:        'ti-briefcase',
        highlight:   true,
        description: 'Specific conditions for management and administrative workers.',
      },
      {
        label:       'Schedules',
        title:       'Schedules',
        path:        '/ebas/mental-health/schedules/',
        icon:        'ti-paperclip',
        description: 'Pay rates, classifications, templates and staffing minimums.',
      },
    ],

    quickAccess: [
      { label: 'Common terms',         sub: 'Section 1 · All employees',   path: '/ebas/mental-health/common-terms/',      icon: 'ti-clipboard-list' },
      { label: 'RPNs, PENs & MHOs',    sub: 'Section 2',                   path: '/ebas/mental-health/rpn-pen-mho/',       icon: 'ti-brain' },
      { label: 'Health Professionals', sub: 'Section 3',                   path: '/ebas/mental-health/health-professionals/', icon: 'ti-stethoscope' },
      { label: 'Pay rates & schedules', sub: 'Schedules',                  path: '/ebas/mental-health/schedules/',         icon: 'ti-currency-dollar' },
    ],

  },

}