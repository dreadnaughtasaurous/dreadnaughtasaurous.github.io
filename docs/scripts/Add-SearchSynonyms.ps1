<#
.SYNOPSIS
    Injects EBA-specific search synonyms into VitePress markdown front matter
    as a hidden <div> container that Pagefind indexes but visitors never see.

    Strategy: per-filename dictionary (slug → precise keywords).
    The numeric prefix (e.g. "35-") is stripped before lookup so that
    "35-higher-qualifications-allowance" and "117-qualification-allowance"
    both resolve to the same slug key "higher-qualifications-allowance" /
    "qualification-allowance" as appropriate.

    Run with -DryRun to preview changes without modifying any files.

.PARAMETER DryRun
    If set, prints what would be changed but makes no file modifications.

.EXAMPLE
    # Preview all changes
    .\Add-SearchSynonyms.ps1 -DryRun

    # Apply all changes
    .\Add-SearchSynonyms.ps1

    # Preview a single EBA only
    .\Add-SearchSynonyms.ps1 -DryRun -EbaFilter allied-health

    # Apply a single EBA only
    .\Add-SearchSynonyms.ps1 -EbaFilter nurses-midwives
#>
param(
    [switch]$DryRun,
    [string]$EbaFilter = ''    # Optional: limit to one EBA folder name
)

# ==============================================================
# PATH CONFIGURATION  -- update if the repo moves
# ==============================================================
$docsRoot = "C:\Projects\EBAdb\docs\ebas"

# ==============================================================
# EBA IDENTITY KEYWORDS
# Injected on every page inside a given EBA folder.
# ==============================================================
$ebaIdentityKeywords = @{
    'allied-health'        = 'AHP allied health professional physiotherapist OT occupational therapist social worker podiatrist radiographer speech pathologist dietitian pharmacist orthotist prosthetist genetic counsellor medical physicist clinical perfusionist audiologist'
    'biomedical-engineers' = 'biomedical engineer BME biomedical engineering medical equipment hospital engineer clinical engineer technical officer'
    'childrens-services'   = "childrens services childcare worker early childhood educator family day care ECE kindergarten before school after school outside school hours care OSHC children's"
    'doctors-in-training'  = 'DIT doctor intern resident registrar medical officer HMO RMO PHO junior doctor trainee doctor prevocational postgraduate year PGY1 PGY2'
    'has-managers-admin'   = 'HAS HASMA health administrative services manager administrative worker clerical officer administration health manager patient services officer'
    'medical-specialists'  = 'medical specialist consultant specialist doctor VMO visiting medical officer staff specialist salaried specialist attending specialist'
    'mental-health'        = 'mental health worker psychiatric nurse mental health nurse community mental health AMHS authorised mental health practitioner psychosocial disability support'
    'mspp'                 = 'MSPP medical scientists pharmacists psychologists medical scientist pharmacist psychologist laboratory scientist clinical psychologist research scientist hospital pharmacist'
    'nurses-midwives'      = 'nurse midwife nursing staff RN EN registered nurse enrolled nurse midwifery NUM nurse unit manager ANUM associate nurse unit manager CNS clinical nurse specialist CNE clinical nurse educator CNC clinical nurse consultant'
}

# ==============================================================
# PER-FILENAME TOPIC KEYWORD DICTIONARY
#
# KEY   = filename slug with numeric prefix REMOVED and .md REMOVED.
#         e.g.  "35-higher-qualifications-allowance.md"  → "higher-qualifications-allowance"
#               "117-qualification-allowance.md"          → "qualification-allowance"
#
# VALUE = precise space-separated keywords for that specific page topic.
#
# Rules:
#   - Keywords must be specific to THIS page's topic only.
#   - Do NOT add unrelated terms (e.g. do not add "superannuation"
#     to an allowance page just because they are in the same EBA section).
#   - Section-level index pages (allowances.md, leave.md, etc.) may have
#     broader keywords because they are genuine landing pages.
# ==============================================================
$filenameKeywords = @{

    # -------------------------------------------------------
    # SECTION-LEVEL / CATEGORY INDEX PAGES
    # -------------------------------------------------------
    'index'                    = 'index overview contents agreement title arrangement preliminary'
    'preliminary'              = 'preliminary commencement coverage application scope parties definitions arrangement'
    'operation'                = 'commencement period operation date coverage application'
    'application-operation'    = 'application commencement period of operation coverage parties'
    'common-terms'             = 'definitions common terms interpretation meaning'
    'allowances'               = 'allowance allowances payment reimbursement additional pay entitlement'
    'accident-pay-allowances'  = 'accident pay make-up pay compensation allowances'
    'appendices'               = 'appendix appendices attachment schedules'
    'schedules'                = 'schedule schedules appendix wage rates classification'
    'classification-salaries'  = 'classification salary wages pay point grade structure'
    'classification-staffing'  = 'classification staffing reclassification grade structure'
    'clinical-supervision'     = 'clinical supervision supervisor supervision requirements'
    'consultation-disputes'    = 'consultation dispute resolution grievance procedure'
    'disputes'                 = 'dispute resolution grievance procedure settling disputes'
    'doctor-employment'        = 'doctor employment engagement contract period'
    'education-pd'             = 'education professional development training in-service'
    'employment'               = 'employment engagement types of employment'
    'employment-types'         = 'types of employment full-time part-time casual fixed-term'
    'health-allied-services'   = 'health allied services HAS classification wages'
    'health-professionals'     = 'health professionals classification wages allowances'
    'hours-of-work'            = 'hours of work ordinary hours roster overtime breaks shifts'
    'leave'                    = 'leave entitlement annual leave personal leave sick leave parental leave'
    'letter-of-employment'     = 'letter of employment appointment offer engagement'
    'management-admin'         = 'management administrative officers classification'
    'managers-admin'           = 'managers administrative workers classification wages'
    'ohs'                      = 'occupational health safety OHS WHS workplace safety'
    'remuneration'             = 'remuneration salary wages pay allowances'
    'resources'                = 'resources reference documents forms'
    'rpn-pen-mho'              = 'registered psychiatric nurse RPN psychiatric enrolled nurse PEN mental health officer MHO'
    'safe-patient-care'        = 'safe patient care staffing levels nurse-to-patient ratios'
    'staffing'                 = 'staffing levels staff numbers nurse-to-patient ratio safe staffing'
    'support-services'         = 'support services classification wages'
    'transport'                = 'transport travelling allowance vehicle fares'
    'union-matters'            = 'union membership union rights ANMF HACSU HSUA enterprise agreement industrial'
    'union-rights'             = 'union rights workplace delegates access union representative'
    'wages'                    = 'wages salary pay rates remuneration pay increase'
    'workforce-management'     = 'workforce management staffing employment'
    'workplace-rights'         = 'workplace rights employee rights flexible working anti-discrimination'
    'accommodation'            = 'accommodation board lodging housing'

    # -------------------------------------------------------
    # PRELIMINARY / AGREEMENT STRUCTURE
    # -------------------------------------------------------
    'agreement-title'                           = 'agreement title name EBA enterprise agreement'
    'title'                                     = 'agreement title name'
    'arrangement'                               = 'arrangement table of contents index clauses'
    'arrangement-of-the-agreement'              = 'arrangement table of contents index clauses'
    'commencement-and-transitional'             = 'commencement transitional date period operation'
    'commencement-date-and-period-of-operation' = 'commencement date period of operation start date expiry'
    'date-and-period-of-operation'              = 'commencement date period of operation start date expiry'
    'period-of-operation'                       = 'period of operation commencement expiry date'
    'coverage'                                  = 'coverage application who it covers employees'
    'coverage-of-agreement'                     = 'coverage application who it covers employees'
    'incidence-coverage'                        = 'incidence coverage application who it covers'
    'incidence-and-application'                 = 'incidence application coverage'
    'incidence-and-operation-of-this-agreement' = 'incidence operation coverage application'
    'relationship-to-previous-industrial-instruments' = 'relationship previous awards agreements transitional'
    'relationship-to-previous-industrial-instruments-and' = 'relationship previous awards agreements NES transitional'
    'relationship-to-previous-industrial-instruments-and-the' = 'relationship previous awards agreements NES'
    'relationship-with-award-and-previous-certified' = 'relationship award previous certified agreement'
    'relationship-to-previous-awards-agreements-and-the-nes' = 'relationship previous awards NES'
    'application-and-relationship-to-the-nes'  = 'application NES National Employment Standards relationship'
    'application-of-the-nes'                   = 'application NES National Employment Standards'
    'access-to-the-award-and-the-national-employment-standards' = 'access award NES National Employment Standards'
    'the-national-employment-standards-and-this-award' = 'NES National Employment Standards award'
    'nature-of-relationship'                   = 'relationship parties employer employee'
    'savings-clause'                            = 'savings clause preservation existing conditions'
    'savings'                                  = 'savings clause preservation conditions'
    'saving-of-local-agreements'               = 'saving local agreements preservation'
    'no-extra-claims'                          = 'no extra claims industrial peace commitment'
    'no-further-claims'                        = 'no further claims industrial peace'
    'best-practice-employment-commitment'      = 'best practice employment commitment industrial relations union'
    'best-practice-employment-commitment-committee' = 'best practice employment committee union consultative'
    'best-practice-employment-commitment-committee-and' = 'best practice employment committee'
    'posting-of-agreement'                     = 'posting agreement display copy availability'
    'copy-of-agreement'                        = 'copy agreement access availability notice board'
    'multi-cultural-awareness'                 = 'multicultural awareness diversity cultural'
    'division-into-sections-and-schedules'     = 'sections schedules structure arrangement'
    'list-of-employers'                        = 'list employers health services covered'
    'list-of-employers-health-services'        = 'list employers health services covered'
    'employer-parties'                         = 'employer parties health services covered'
    'employers-covered'                        = 'employers covered health services'
    'statewide-industry-panel'                 = 'statewide industry panel SIP union employer committee'
    'implementation-committees'               = 'implementation committees union employer consultative'
    'health-service-obligations'               = 'health service obligations employer responsibilities'
    'transfer-of-business'                     = 'transfer of business transmission sale change ownership'
    'anti-discrimination'                      = 'anti-discrimination equal opportunity diversity EEO'
    'gender-based-discrimination'              = 'gender based discrimination sex discrimination equal opportunity'
    'individual-flexibility-arrangement'       = 'individual flexibility arrangement IFA vary terms'
    'individual-flexibility-arrangements'      = 'individual flexibility arrangements IFA vary terms'
    'individual-flexible-working-arrangements' = 'individual flexible working arrangements vary hours'
    'multi-cultural'                           = 'multicultural awareness cultural diversity'
    'climate-change-mitigation-and-sustainability' = 'climate change sustainability environmental'
    'signatories'                              = 'signatories parties signing agreement'
    'definitions'                              = 'definitions interpretation meaning terms'
    'definitions-and-interpretation'           = 'definitions interpretation meaning terms'
    'definitions-specific-to-this-part-of-this-agreement' = 'definitions specific section interpretation'
    'definitions-specific-to-section-4-of-this-agreement' = 'definitions section 4 interpretation'
    'definitions-specific-to-section-5-of-this-agreement' = 'definitions section 5 interpretation'
    'definitions-specific-to-section-2'        = 'definitions section 2 interpretation'
    'division-into-sections'                   = 'sections schedules structure arrangement'
    'application-of-section-2'                = 'application section 2 scope'
    'application-of-section-3'                = 'application section 3 scope'
    'application-of-section-4'                = 'application section 4 scope'
    'application-of-this-section'             = 'application section scope'
    'transitional-provisions'                 = 'transitional provisions commencement existing conditions'
    'this-clause-is-deliberately-blank'       = 'blank deliberately omitted reserved'
    'this-clause-has-deliberately-been-left-blank' = 'blank deliberately omitted reserved'
    'clause-intentionally-omitted'            = 'omitted blank reserved clause'
    'not-used'                                = 'not used blank omitted reserved'
    'not-used-blank'                          = 'not used blank omitted reserved'
    'maintenance-of-public-sector-employment' = 'public sector employment maintenance commitment'
    'incidental-and-peripheral-duties'        = 'incidental peripheral duties beyond classification'
    'promotion-of-local-workforce'            = 'local workforce promotion priority employment'
    'employee-retention'                      = 'employee retention retention commitment'
    'best-practice-royal-childrens-hospital'  = 'best practice Royal Childrens Hospital RCH'
    'st-vincents-health-melbourne-ltd-general-conditions-agreeme' = 'St Vincents Health Melbourne general conditions'
    'alfred-health-general-conditions'        = 'Alfred Health general conditions agreement'
    'alfred-health-austin-health-royal-melbourne-hospital-clinica' = 'Alfred Health Austin Health Royal Melbourne Hospital'
    'royal-womens-hospital-royal-childrens-hospital-general-emp'  = 'Royal Womens Hospital Royal Childrens Hospital employment'
    'eastern-health-turning-point-research-and-education-employee' = 'Eastern Health Turning Point research education employment'

    # -------------------------------------------------------
    # WAGES / SALARY / REMUNERATION / SUPERANNUATION
    # -------------------------------------------------------
    'wage-rates'                                = 'wage rates pay rates salary rates classification pay'
    'wages-and-allowances'                      = 'wages allowances pay rates salary'
    'salaries-and-allowances'                   = 'salaries allowances pay rates'
    'rates-of-pay-and-allowances'               = 'rates of pay allowances salary'
    'remuneration-and-remuneration-increases'   = 'remuneration pay increase salary increase'
    'salary-and-allowances-increases'           = 'salary increase allowances increase pay rise'
    'wage-rates-managers-and-administrative-workers' = 'wage rates managers administrative workers pay'
    'wage-rates-health-allied-services'        = 'wage rates health allied services pay'
    'allowances-and-top-of-band-payments'      = 'allowances top of band payment ceiling pay'
    'increases-to-allowances'                  = 'increases allowances pay rise adjustment'
    'wages-review'                             = 'wages review pay review adjustment'
    'minimum-wages'                            = 'minimum wages base pay rates'
    'minimum-wage'                             = 'minimum wage base rate of pay'
    'experience-payments'                      = 'experience payments pay progression years of service'
    'salary'                                   = 'salary pay rate remuneration base pay'
    'payment-of-wages'                         = 'payment of wages payroll pay cycle frequency'
    'payment-of-wages-allowances-employee-records-and' = 'payment wages allowances employee records'
    'payment-of-wages-employee-records-and-related-matters' = 'payment wages employee records payroll'
    'recovery-of-overpayments'                 = 'recovery overpayment wages debt repayment'
    'overpayment-of-wages-royal-childrens-hospital' = 'overpayment wages recovery Royal Childrens Hospital'
    'underpayment-of-wages'                    = 'underpayment wages recovery back pay remedy'
    'additional-payment-of-wages-provisions'   = 'additional payment wages provisions'
    'annualised-salaries-royal-childrens-hospital' = 'annualised salary Royal Childrens Hospital salary absorption all inclusive salary rolled up salary flat salary'
    'superannuation'                           = 'superannuation super employer contribution SGC retirement'
    'salary-packaging'                         = 'salary packaging novated lease pre-tax benefits FBT packaging'
    'accident-pay'                             = 'accident pay workers compensation make-up pay injury payment'
    'accident-make-up-pay'                     = 'accident make-up pay workers compensation injury supplement'
    'compensation-make-up-pay'                 = 'compensation make-up pay workers compensation injury'
    'workers-compensation-make-up-pay'         = 'workers compensation make-up pay accident pay injury'
    'top-of-band-payment'                      = 'top of band payment ceiling salary maximum pay grade'
    'patience-in-bargaining-payment'           = 'patience in bargaining payment once-off wage'
    'skills-and-incentive-payment'             = 'skills incentive payment bonus once-off'
    'once-off-retention-payment'               = 'once-off retention payment bonus loyalty'
    'overlapping-pay-points-between-grades'    = 'overlapping pay points between grades salary progression'
    'progression-through-pay-points'           = 'progression through pay points salary advancement increment'
    'progression-of-medical-scientists-from-grade-1-to-grade-2-at' = 'progression medical scientists grade 1 grade 2'
    'supported-wage-system-for-employees-with-a-disability' = 'supported wage system disability employment'
    'supported-wage-system-for-employees-with-a' = 'supported wage system disability employment'
    'doctors-in-training-remuneration-allowances-and-deductions' = 'remuneration allowances deductions doctors in training'
    'specialists-remuneration-and-allowances'  = 'specialists remuneration allowances pay'
    'commuted-allowance'                       = 'commuted allowance consolidated payment specialists'
    'remuneration-allowances'                  = 'remuneration allowances pay rates specialists'
    'lump-sum-payment-mho-only'               = 'lump sum payment mental health officer MHO'
    'conversion-of-unused-sick-leave-to-annual-leave' = 'conversion sick leave annual leave unused'
    'time-and-wages-records-royal-childrens-hospital' = 'time wages records Royal Childrens Hospital'
    'wage-skill-group-translation'             = 'wage skill group translation reclassification transitional'

    # -------------------------------------------------------
    # SPECIFIC ALLOWANCES (per-page precision)
    # -------------------------------------------------------
    'higher-qualifications-allowance'          = 'higher qualifications allowance post-graduate qualification incentive advanced qualification HQA'
    'higher-education-recognition-allowance'   = 'higher education recognition allowance tertiary qualification HERA'
    'qualification-allowance'                  = 'qualification allowance post-graduate certificate degree payment'
    'management-higher-qualifications-allowances' = 'management higher qualifications allowances managerial qualification payment'
    'classification-descriptors-and-higher-qualification-allowanc' = 'classification descriptors higher qualification allowance HQA'
    'higher-duties-allowance'                  = 'higher duties allowance acting up acting position temporary promotion'
    'higher-duties'                            = 'higher duties acting up acting in position temporary promotion allowance'
    'in-charge-allowances'                     = 'in charge allowance supervisor in-charge responsibility'
    'in-charge-allowance'                      = 'in charge allowance supervisor in-charge responsibility'
    'sole-allowance'                           = 'sole allowance only qualified staff only practitioner payment'
    'sole-midwife-allowance'                   = 'sole midwife allowance only midwife payment'
    'nauseous-work-allowance'                  = 'nauseous work allowance unpleasant duties dirty work payment'
    'nauseous-allowance'                       = 'nauseous allowance unpleasant duties payment'
    'meal-allowance'                           = 'meal allowance food payment overtime meal reimbursement'
    'meal-allowances'                          = 'meal allowances food payment overtime meal reimbursement'
    'telephone-allowance'                      = 'telephone allowance phone reimbursement mobile phone cost'
    'childcare-reimbursement'                  = 'childcare reimbursement child care costs overtime out-of-hours'
    'childcare-costs'                          = 'childcare costs reimbursement child care'
    'child-care-costs'                         = 'child care costs reimbursement childcare'
    'child-care-costs-reimbursement-out-of-hours-work' = 'child care costs reimbursement out of hours overtime'
    'childcare-costs-reimbursement'            = 'childcare costs reimbursement'
    'uniform-allowance'                        = 'uniform allowance clothing laundry uniform reimbursement'
    'uniform-and-laundry-allowance'            = 'uniform laundry allowance clothing reimbursement'
    'uniform-and-protective-clothing'          = 'uniform protective clothing laundry allowance'
    'uniforms-and-protective-clothing'         = 'uniforms protective clothing laundry allowance'
    'uniforms'                                 = 'uniforms clothing laundry allowance'
    'laundry-allowance'                        = 'laundry allowance uniform cleaning reimbursement'
    'shift-allowance'                          = 'shift allowance shift work penalty payment evening night'
    'shift-allowances'                         = 'shift allowances shift work penalty payment evening night'
    'shift-work-allowance'                     = 'shift work allowance penalty payment evening night weekend'
    'shift-work-allowances'                    = 'shift work allowances penalty payment evening night'
    'saturday-and-sunday-work'                 = 'Saturday Sunday weekend penalty rates ordinary hours'
    'special-rates-for-saturdays-and-sundays'  = 'Saturday Sunday special rates weekend penalty'
    'rates-for-saturdays-sundays'              = 'Saturday Sunday rates penalty weekend'
    'rates-for-saturdays-and-sundays'          = 'Saturday Sunday rates penalty weekend'
    'special-rates-for-saturdays-sundays'      = 'Saturday Sunday special rates weekend'
    'on-call'                                  = 'on call availability recall standby allowance available allowance being on call held on call after hours call'
    'on-call-recall'                           = 'on call recall standby availability allowance'
    'on-call-rostered-overtime'                = 'on call rostered overtime recall allowance'
    'oncall-recall-non-catt'                   = 'on call recall non-CATT allowance standby'
    'catt-on-call-recall-allowances'           = 'CATT on call recall allowances crisis assessment treatment team'
    'on-call-recall-allowance-non-catt'        = 'on call recall allowance non-CATT standby'
    'on-call-re-call'                          = 'on call recall standby allowance'
    'recall-return-to-workplace'               = 'recall return to workplace callback callout'
    'recall-without-returning-to-workplace'    = 'recall without return workplace telephone callback'
    'recall-no-return-to-workplace'            = 'recall no return to workplace telephone callback'
    'recall-return'                            = 'recall return callback callout allowance'
    'recall-no-return'                         = 'recall no return telephone callback allowance'
    'recall-full-time-doctors'                 = 'recall full time doctors callback callout payment'
    'on-call-full-time-doctors'                = 'on call full time doctors standby availability'
    'telephone-calls-to-doctors-outside-of-working-hours' = 'telephone calls doctors outside hours callback payment'
    'four-clear-days-allowance'                = 'four clear days allowance rest break rotation'
    'change-of-shift-allowance'                = 'change of shift allowance roster alteration payment rostering notice short notice roster change changed shift shift swap'
    'change-of-shift-allowance-pen-and-mho'    = 'change of shift allowance PEN MHO psychiatric enrolled nurse mental health officer'
    'change-of-shift-allowance-preservation-ens-only' = 'change of shift allowance preservation enrolled nurses'
    'change-of-roster-allowance'               = 'change of roster allowance alteration payment rostering notice short notice roster change roster alteration'
    'change-of-ward-allowance'                 = 'change of ward allowance transfer payment'
    'travel-payment'                           = 'travel payment reimbursement transport cost'
    'travelling-allowance'                     = 'travelling allowance travel reimbursement vehicle private car'
    'travelling-allowances'                    = 'travelling allowances travel reimbursement vehicle'
    'travelling-and-reimbursement'             = 'travelling reimbursement travel payment expenses'
    'travelling-and-relocation'                = 'travelling relocation allowance moving expenses'
    'travelling-and-relocation-allowance'      = 'travelling relocation allowance moving expenses'
    'travelling-transport-and-fares'           = 'travelling transport fares reimbursement'
    'relocation'                               = 'relocation moving expenses allowance'
    'removal-expenses'                         = 'removal expenses relocation moving costs reimbursement'
    'vehicle-allowance'                        = 'vehicle allowance car allowance private vehicle use reimbursement'
    'tool-allowance'                           = 'tool allowance tools equipment reimbursement'
    'tool-allowance-chefs-and-cooks-only'      = 'tool allowance chefs cooks kitchen equipment'
    'tow-motor-driver-allowance'               = 'tow motor driver allowance forklift driver payment'
    'certificate-allowance-pathology-technicians' = 'certificate allowance pathology technicians qualification payment'
    'patient-transport-officer-certificate-allowance' = 'patient transport officer certificate allowance qualification payment'
    'security-officer-certificate-allowance'   = 'security officer certificate allowance qualification payment'
    'seniors-allowance'                        = 'seniors allowance senior employee long service payment'
    'senior-allowance-mho'                     = 'senior allowance mental health officer MHO'
    'educational-incentive-allowance'          = 'educational incentive allowance education qualification payment'
    'district-allowances'                      = 'district allowance rural remote location payment'
    'rural-and-isolated-practice-allowance'    = 'rural isolated practice allowance remote area payment RIPA'
    'cooking-trade-proficiency-payments'       = 'cooking trade proficiency payments chef cook qualification'
    'supervisor-allowance-medical-technician-and-renal' = 'supervisor allowance medical technician renal'
    'peter-maccallum-cancer-centre-allowance'  = 'Peter MacCallum Cancer Centre allowance oncology payment'
    'reimbursement-of-road-tolls'              = 'reimbursement road tolls toll costs travel expenses'
    'reimbursement-of-expenses-dhsv'           = 'reimbursement expenses DHSV Dental Health Services Victoria'
    'insurance-allowance'                      = 'insurance allowance indemnity professional liability'
    'damaged-clothing-allowance'               = 'damaged clothing allowance torn clothing incident payment'
    'mobile-phone-or-reimbursement-of-cost'    = 'mobile phone reimbursement telephone cost'
    'provision-of-mobile-phone-or-reimbursement-of-cost' = 'mobile phone reimbursement provision telephone'
    'hyperbaric-allowance'                     = 'hyperbaric allowance hyperbaric chamber pressure payment'
    'lead-apron-allowance'                     = 'lead apron allowance radiation protection X-ray payment'
    'designated-location-bonus'                = 'designated location bonus hard to fill remote rural payment'
    'multi-skilling-allowance-patient-services-assistants' = 'multi-skilling allowance patient services assistants'
    'rotation-allowance'                       = 'rotation allowance rotating positions payment'
    'rotation-allowances'                      = 'rotation allowances rotating positions payment'
    'deductions-for-board-and-lodging'         = 'deductions board lodging accommodation costs'
    'reimbursement-of-professional-development-leave' = 'reimbursement professional development leave expenses costs'
    'continuing-medical-education-allowance'   = 'continuing medical education allowance CME payment specialist'
    'interpreter-allowances'                   = 'interpreter allowance language translation bilingual payment'
    'working-away-from-home'                   = 'working away from home travel remote site allowance'
    'board-and-lodging'                        = 'board lodging accommodation deductions'
    'allowances-related-to-overtime'           = 'allowances related to overtime penalty meal recall'
    'allowances-related-to-overtime-and-on-call' = 'allowances overtime on call penalty recall'
    'manager-allowance'                        = 'manager allowance management responsibility payment'
    'sleepover-allowance'                      = 'sleepover allowance overnight residential care payment'
    'code-black-and-or-code-grey-response'     = 'code black code grey security emergency response allowance'
    'allowances-health-allied'                 = 'allowances health allied services'

    # -------------------------------------------------------
    # HOURS OF WORK / ROSTERS / OVERTIME / BREAKS
    # -------------------------------------------------------
    'ordinary-hours-of-work-and-rostering'     = 'ordinary hours of work rostering shift patterns'
    'roster'                                   = 'roster rostering shift rotation working schedule'
    'rosters'                                  = 'rosters rostering shift schedule design rotation'
    'roster-design-safe-hours-of-work'         = 'roster design safe hours of work fatigue management'
    'accrued-days-off'                         = 'accrued days off ADO 38-hour week accumulation day off'
    'ados'                                     = 'accrued days off ADO 38-hour week day off accumulation'
    'make-up-time'                             = 'make-up time flexible hours compensatory time'
    'overtime'                                 = 'overtime additional hours penalty double time time-and-a-half'
    'overtime-in-lieu'                         = 'overtime in lieu time off in lieu TOIL compensatory leave'
    'reasonable-additional-hours'              = 'reasonable additional hours extra work beyond ordinary hours'
    'rest-period-after-overtime'               = 'rest period after overtime ten hour break fatigue'
    'rest-period-after-overtime-recall'        = 'rest period after overtime recall ten hour break'
    'rest-period-after-overtime-recall-ten-hour-break' = 'rest period overtime recall ten hour break fatigue'
    'rest-period-after-excessive-hours'        = 'rest period excessive hours fatigue management'
    'ten-hour-break'                           = 'ten hour break 10 hour break fatigue rest period overtime'
    'ten-hour-break-between-overtime-recall'   = 'ten hour break between overtime recall fatigue'
    'breaks'                                   = 'breaks meal break rest period tea break interval'
    'meal-interval'                            = 'meal interval break rest period overtime crib break lunch break half hour break'
    'meal-break'                               = 'meal break rest interval food break crib break lunch break dinner break supper break tea break half hour break'
    'meal-breaks'                              = 'meal breaks rest intervals food breaks crib break lunch break dinner break half hour break'
    'meal-intervals-and-rest-intervals'        = 'meal intervals rest intervals breaks'
    'rest-breaks'                              = 'rest breaks relief interval'
    'rest-and-meal-breaks'                     = 'rest meal breaks relief interval'
    'tea-breaks'                               = 'tea break rest interval morning afternoon break'
    'shiftwork'                                = 'shift work shiftwork rotating shifts evening night'
    'shift-work'                               = 'shift work rotating shifts evening night penalty'
    'saturday'                                 = 'Saturday weekend penalty rates'
    'sunday'                                   = 'Sunday weekend penalty rates'
    'public-holidays'                          = 'public holidays holiday penalty rate double time Christmas Easter'
    'daylight-saving'                          = 'daylight saving time clock change shift adjustment'
    'daylight-savings'                         = 'daylight saving time clock change shift adjustment'
    'minimum-engagement'                       = 'minimum engagement minimum hours call-in casual shift'
    'right-to-disconnect'                      = 'right to disconnect after hours contact unreasonable demands'
    'wash-up-time'                             = 'wash-up time preparation clean-up end of shift'
    'biometric-timekeeping'                    = 'biometric timekeeping fingerprint time recording'
    'safe-hours-of-work'                       = 'safe hours of work fatigue rostering safety'
    'continuous-duty-full-time-doctors'        = 'continuous duty full time doctors on call hours'
    'hours-of-work-full-time-doctors'          = 'hours of work full time doctors working hours rostering'
    'hours-of-work-fractional-doctors'         = 'hours of work fractional doctors part time working hours'
    'fractional-allocation-fractional-doctors' = 'fractional allocation fractional doctors part-time hours'
    'supplementary-roster'                     = 'supplementary roster additional shifts extra work'
    'supplementary-roster-and-additional-shifts' = 'supplementary roster additional shifts extra work'
    'right-to-disconnect-supplementary-roster' = 'right to disconnect supplementary roster additional'
    'accrued-days-off-non-catt'               = 'accrued days off non-CATT ADO'
    'permanent-night-shift'                    = 'permanent night shift night duty rostering'
    'night-shift-rostering-principles-other-than-permanent-night' = 'night shift rostering principles permanent night'
    'safe-rostering-and-fatigue'               = 'safe rostering fatigue management hours work'
    '24-7-rostering'                           = '24/7 rostering around the clock seven day roster'
    'training-time'                            = 'training time paid training mandatory education hours'
    'avoidance-and-management-of-short-shifts' = 'avoidance short shifts minimum engagement roster'
    'discretionary-backfill-for-certain-absences' = 'discretionary backfill absences replacement'
    'unplanned-absences'                       = 'unplanned absences sick call-in replacement backfill'
    'planned-and-unplanned-absences'           = 'planned unplanned absences replacement backfill'
    'proposals-to-vary-specific-matters'       = 'proposals vary specific matters roster hours flexibility'
    'consultation-about-changes-to-rosters-or-hours-of-work' = 'consultation changes rosters hours work'
    'consultation-about-changes-to-rosters-or-hours-or-work' = 'consultation changes rosters hours work'
    'employee-right-to-disconnect'             = 'employee right to disconnect after hours contact'
    'portfolio-work-in-paid-time'              = 'portfolio work paid time professional development'
    '10-hour-break-not-given'                  = '10 hour break not given failure rest period compensation'
    '10-hour-break-consultation-transitional'  = '10 hour break consultation transitional'

    # -------------------------------------------------------
    # LEAVE (ALL TYPES)
    # -------------------------------------------------------
    'annual-leave'                             = 'annual leave holidays recreation leave four weeks'
    'cashing-out-of-annual-leave'              = 'cashing out annual leave payment instead of leave'
    'excess-annual-leave'                      = 'excess annual leave excessive accrual management'
    'excessive-leave-accrual'                  = 'excessive leave accrual management direction to take leave'
    'purchased-leave'                          = 'purchased leave buy additional leave extra annual leave'
    'personal-leave'                           = 'personal leave sick leave carers leave illness sick day calling in sick unwell off sick medical certificate'
    'personal-carer-s-leave'                   = 'personal carer leave sick leave illness caring family sick day calling in sick unwell medical certificate carer'
    'personal-leave-including-carer-s-leave'   = 'personal leave carer leave sick illness caring family'
    'personal-sick-carer-s-leave'              = 'personal sick carer leave illness family'
    'carer-s-leave'                            = 'carer leave family responsibilities illness caring'
    'personal-leave-pool'                      = 'personal leave pool shared sick leave team illness'
    'caring-responsibilities-casual-employees' = 'caring responsibilities casual employees leave'
    'casual-employment-caring-responsibilities' = 'casual employment caring responsibilities leave'
    'compassionate-leave'                      = 'compassionate leave bereavement death family grief'
    'long-service-leave'                       = 'long service leave LSL entitlement years of service'
    'parental-leave'                           = 'parental leave maternity paternity adoption birth family'
    'parental-leave-and-related-entitlements'  = 'parental leave maternity paternity related entitlements'
    'ending-employment-during-parental-leave'  = 'ending employment during parental leave resignation'
    'pre-natal-leave'                          = 'pre-natal leave antenatal prenatal pregnancy appointment'
    'prenatal-leave'                           = 'prenatal leave antenatal pregnancy appointment'
    'pre-natal-leave-and-assisted-reproduction' = 'prenatal leave assisted reproduction IVF fertility treatment'
    'pre-adoption-leave'                       = 'pre-adoption leave adoption unpaid leave'
    'breastfeeding'                            = 'breastfeeding lactation room facilities nursing mothers'
    'breast-feeding-facilities'                = 'breastfeeding facilities lactation room nursing mothers'
    'study-leave'                              = 'study leave education exam tertiary course leave'
    'examination-leave'                        = 'examination leave exam sit test assessment'
    'professional-development-leave'           = 'professional development leave conference education CPD'
    'conference-seminar-leave'                 = 'conference seminar leave attendance professional development'
    'blood-donors-leave'                       = 'blood donors leave donation Red Cross community service'
    'blood-donor-leave'                        = 'blood donor leave donation Red Cross community service'
    'jury-service'                             = 'jury service jury duty court summons absence leave'
    'jury-service-leave'                       = 'jury service leave jury duty court absence'
    'family-violence-leave'                    = 'family violence leave domestic violence safety leave'
    'family-and-domestic-violence-leave'       = 'family domestic violence leave safety protection'
    'gender-transition-leave'                  = 'gender transition leave gender affirmation leave'
    'gender-affirmation-leave'                 = 'gender affirmation leave gender transition'
    'gender-affirmation'                       = 'gender affirmation leave transition'
    'cultural-and-ceremonial-leave'            = 'cultural ceremonial leave ATSI Aboriginal Torres Strait Islander'
    'ceremonial-leave'                         = 'ceremonial leave cultural ATSI Aboriginal community obligations'
    'community-service-leave'                  = 'community service leave volunteer emergency jury'
    'special-disaster-leave'                   = 'special disaster leave emergency natural disaster bushfire flood'
    'absences-on-defence-leave'                = 'absences defence leave military reserve service ADF'
    'absences-on-defence-service'              = 'absences defence service military ADF reserve'
    'leave-to-engage-in-voluntary-emergency-management' = 'voluntary emergency management leave SES CFA MFB bushfire'
    'leave-to-engage-in-emergency-relief-activities' = 'emergency relief activities leave volunteer'
    'leave-without-pay'                        = 'leave without pay unpaid absence LWOP'
    'discretionary-leave-without-pay-royal-childrens' = 'discretionary leave without pay Royal Childrens Hospital'
    'excessive-leave'                          = 'excessive leave accrual management'
    'sabbatical-leave'                         = 'sabbatical leave extended leave research professional renewal'
    'twelve-month-career-breaks'               = '12 month career break extended leave sabbatical'
    'leave-not-applying-to-casuals'            = 'leave not applying casuals exclusions'
    'annual-leave-loading-full-time-doctors'   = 'annual leave loading full time doctors holiday loading'
    'reproductive-health-leave'                = 'reproductive health leave fertility treatment IVF reproductive'
    'rehabilitation-leave'                     = 'rehabilitation leave return to work injury'
    'foster-and-kinship-care'                  = 'foster kinship care leave carer'
    'continuing-medical-education-leave'       = 'continuing medical education leave CME specialist'
    'replacement-of-doctors-when-on-leave'     = 'replacement doctors leave locum cover'
    'aboriginal-healthcare-worker-traineeship-mental-health' = 'Aboriginal healthcare worker traineeship mental health'
    'unpaid-pre-adoption-leave'                = 'unpaid pre-adoption leave adoption'
    'breastfeeding-casual'                     = 'breastfeeding casual employees lactation'
    'long-service-leave-standard'             = 'long service leave LSL entitlement'

    # -------------------------------------------------------
    # PROFESSIONAL DEVELOPMENT / EDUCATION / TRAINING
    # -------------------------------------------------------
    'education-and-training'                   = 'education training mandatory in-service professional development'
    'education-and-training-royal-childrens-hospital' = 'education training Royal Childrens Hospital in-service'
    'in-service-education-training-royal-childrens-hospital' = 'in-service education training Royal Childrens Hospital'
    'in-service-education-and-training-royal-childrens' = 'in-service education training Royal Childrens'
    'in-service'                               = 'in-service education training mandatory paid'
    'continuing-medical-education-support'     = 'continuing medical education CME support allowance specialist'
    'continuing-medical-education-standard-claim-form' = 'continuing medical education standard claim form CME'
    'clinical-supervision-for-allied-health-professionals-not' = 'clinical supervision allied health professionals'
    'discipline-specific-supervision-only-llews' = 'discipline specific supervision LLEW limited registration'
    'clinical-supervision-of-psychologists'    = 'clinical supervision psychologists supervision requirements'
    'psychologist-supervisor-training'         = 'psychologist supervisor training qualification'
    'trainee-supervision'                      = 'trainee supervision supervisor training oversight'
    'supervision-and-management'               = 'supervision management oversight responsibility'
    'staff-appraisal'                          = 'staff appraisal performance review annual review'
    'individual-performance-measures-royal-childrens' = 'individual performance measures Royal Childrens Hospital'
    'professional-development-leave-royal-childrens' = 'professional development leave Royal Childrens Hospital'
    'literacy-and-numeracy'                    = 'literacy numeracy basic skills support'
    'health-professionals-medicare-study-leave' = 'health professionals Medicare study leave'
    'supporting-professional-development'      = 'supporting professional development education training'
    'registration-leave'                       = 'professional registration leave AHPRA renewal'
    'additional-professional-registration-leave' = 'additional professional registration leave AHPRA'
    'internal-training'                        = 'internal training mandatory in-service paid hours'

    # -------------------------------------------------------
    # TYPES OF EMPLOYMENT / ENGAGEMENT
    # -------------------------------------------------------
    'types-of-employment'                      = 'types of employment full-time part-time casual fixed-term modes'
    'modes-of-employment'                      = 'modes of employment full-time part-time casual'
    'full-time-employment'                     = 'full-time employment 38 hours ordinary hours permanent'
    'part-time-employment'                     = 'part-time employment fewer hours regular pro-rata'
    'casual-employment'                        = 'casual employment irregular no guarantee of hours engagement'
    'casual-conversion'                        = 'casual conversion permanent part-time regular systematic'
    'fixed-term-employment'                    = 'fixed-term employment contract specific term project'
    'fixed-term-contract-conversion'           = 'fixed-term contract conversion permanent ongoing'
    'secure-employment'                        = 'secure employment job security permanent ongoing'
    'redundancy'                               = 'redundancy retrenchment redundancy pay severance payout redundancy payout termination payout job loss fired let go made redundant'
    'redundancy-and-associated-entitlements'   = 'redundancy retrenchment redundancy pay severance entitlements payout termination payment job loss let go made redundant'
    'redundancy-and-related-entitlements'      = 'redundancy retrenchment pay severance related entitlements'
    'additional-consultation-and-redundancy-and-associated-entitl' = 'consultation redundancy associated entitlements'
    'termination-of-employment'                = 'termination of employment dismissal resignation notice period stand down stood down suspension without pay suspended'
    'termination-of-employment-notice-of-termination' = 'termination employment notice period dismissal'
    'notice-period-before-termination'         = 'notice period termination dismissal resignation'
    'notice-of-termination'                    = 'notice of termination dismissal resignation end employment'
    'transition-to-retirement'                 = 'transition to retirement flexible work phased retirement'
    'letter-of-appointment'                    = 'letter of appointment offer engagement commencement'
    'letter-of-offer'                          = 'letter of offer appointment engagement commencement'
    'letter-of-appointment-employment-arrangements' = 'letter of appointment employment arrangements'
    'certificate-of-service'                   = 'certificate of service reference employment record'
    'redeployment-former-s97-employees'        = 'redeployment former section 97 employees'
    'probation'                                = 'probation probationary period new employment assessment'
    'period-of-employment'                     = 'period of employment duration contract term'
    'regular-part-time-employment'             = 'regular part-time employment permanent fewer hours'
    'part-time-review-of-hours'                = 'part-time review hours increase reduce'
    'request-to-reduce-ordinary-hours'         = 'request reduce ordinary hours flexible part-time'
    'termination'                              = 'termination employment end dismissal resignation'
    'additional-staffing'                      = 'additional staffing extra staff levels backfill'
    'advertisement-of-positions'               = 'advertisement positions vacancy advertising recruitment'
    'advertising-and-filling-vacancies'        = 'advertising vacancies filling positions recruitment'
    'recruitment-to-vacant-position'           = 'recruitment vacant position advertising filling'
    'orientation-on-appointment'               = 'orientation appointment induction new employee'
    'orientation-association-notification'     = 'orientation association notification union induction'
    'trainee-scientists'                        = 'trainee scientists laboratory traineeship'
    'trainees'                                 = 'trainees traineeship apprentice student employment'
    'national-training-wage'                   = 'national training wage NTW apprentice trainee'
    'school-based-apprentices'                 = 'school-based apprentices apprenticeship training'
    'apprentices'                              = 'apprentices apprenticeship trades training'
    'juniors'                                  = 'junior employees youth rates under 21 age rates'
    'trainee-enrolled-nurses'                  = 'trainee enrolled nurses TEN traineeship'
    'notification-of-classification'           = 'notification classification reclassification grade advice'
    'probationary'                             = 'probationary period new employee assessment'
    'doctor-responsibilities'                  = 'doctor responsibilities duties professional obligations'
    'private-practice-rights'                  = 'private practice rights privileges specialists'
    'rights-of-private-practice-administration' = 'rights private practice administration specialists'
    'rotations-between-hospitals'              = 'rotations between hospitals sites training'
    'rotation-to-a-general-practice-training-program' = 'rotation general practice training program GP'
    'continuous-duty-doctors'                  = 'continuous duty full time doctors on call'

    # -------------------------------------------------------
    # STAFFING / CLASSIFICATION / RECLASSIFICATION
    # -------------------------------------------------------
    'classification'                           = 'classification grade level structure reclassification pay point'
    'classifications'                          = 'classifications grades levels structure pay points'
    'classification-definitions'               = 'classification definitions descriptors grades criteria'
    'classification-and-reclassification'      = 'classification reclassification grade change progression'
    'classification-structures'                = 'classification structures grades levels hierarchy'
    'classification-structure'                 = 'classification structure grades hierarchy'
    'classification-standards'                 = 'classification standards criteria assessment grade'
    'classification-decisions'                 = 'classification decisions determinations grade assessment'
    'reclassification'                         = 'reclassification grade change promotion assessment'
    'progression'                              = 'progression pay progression advancement increment'
    'workload-management'                      = 'workload management workload review safe staffing'
    'workload-management-and-review'           = 'workload management review safe staffing'
    'workload-allocation-and-safe-staffing'    = 'workload allocation safe staffing levels'
    'workload'                                 = 'workload safe staffing management review'
    'safe-rostering-fatigue'                   = 'safe rostering fatigue management hours'
    'skill-mix'                                = 'skill mix staffing ratios qualification mix'
    'backfill'                                 = 'backfill replacement staff absence cover'
    'advertising-vacancies'                    = 'advertising vacancies positions filling recruitment'
    'vacancies'                                = 'vacancies positions advertising filling'
    'replacement-positions'                    = 'replacement positions backfill cover absence'
    'contractors-and-labour-hire'              = 'contractors labour hire agency staff outsourcing'
    'agency-staff'                             = 'agency staff labour hire contractors outsourcing'
    'secure-employment-agency-staff-and-bank-employees' = 'secure employment agency staff bank employees'
    'deputy-director-of-nursing'               = 'deputy director of nursing DDN senior nursing management'
    'staffing-anum-amum-and-above'             = 'staffing ANUM AMUM above charge nurse management'
    'out-of-hours-supervisor'                  = 'out of hours supervisor after hours coordinator'
    'demand-escalation-policy'                 = 'demand escalation policy capacity surge response'
    'community-mental-health-discipline-mix'   = 'community mental health discipline mix staffing ratios'
    'community-mental-health-engagement-worker' = 'community mental health engagement worker CMHEW'
    'community-workload-management-system-cwms' = 'community workload management system CWMS'
    'crisis-team-workload-management-system-ctwms' = 'crisis team workload management system CTWMS'
    'community-health-teams-staffing-establishment' = 'community health teams staffing establishment'
    'minimum-staffing-levels'                  = 'minimum staffing levels safe patient care ratios'
    'interaction-with-the-safe-patient-care-act' = 'safe patient care act interaction staffing ratios'
    'allied-health-manager-structure'          = 'allied health manager structure management classification'
    'pharmacist-staffing-levels'               = 'pharmacist staffing levels SHPA ratios'
    'shpa-ratios-pharmacist-staffing-levels'   = 'SHPA ratios pharmacist staffing levels pharmacy workforce'
    'review-of-pharmacy-technician-structure'  = 'review pharmacy technician structure classification'
    'dual-part-time-appointments'              = 'dual part-time appointments multiple positions'
    'job-rotation'                             = 'job rotation clinical services enhancement rotation'
    'internal-locum-conversion'                = 'internal locum conversion employment'
    'ward-clerk-staffing'                      = 'ward clerk staffing levels administration'
    'senior-midwife-and-liaison-midwife'       = 'senior midwife liaison midwife classification'
    'proposals-to-vary'                        = 'proposals to vary roster hours flexibility'
    'undergraduate-employment-models'          = 'undergraduate employment models student nurse'
    'commencing-grades-nursing'                = 'commencing grades nursing new graduate first year'
    'nurse-to-patient'                         = 'nurse to patient ratio safe patient care staffing'

    # -------------------------------------------------------
    # CLASSIFICATION DETAILS (specific professions)
    # -------------------------------------------------------
    'registered-nurses-and-midwives-classification' = 'registered nurses midwives classification RN grades'
    'enrolled-nurses-classification'           = 'enrolled nurses classification EN grade structure'
    'mental-health-officers-classifications'   = 'mental health officers MHO classification grades'
    'registered-psychiatric-nursing-classifications' = 'registered psychiatric nursing RPN classifications'
    'psychiatric-enrolled-nurse-classifications' = 'psychiatric enrolled nurse PEN classifications'
    'ruson-rusom-classifications'              = 'RUSON RUSOM classifications undergraduate student nurse'
    'trainee-enrolled-nurse-classifications'   = 'trainee enrolled nurse TEN classifications'
    'classification-definitions-applying-to-health-professionals' = 'classification definitions health professionals AHP'
    'support-services-employee-classifications' = 'support services employee classifications hotel services'
    'management-and-administrative-officers-classifications' = 'management administrative officers classifications'
    'classification-structure-health-allied-services' = 'classification structure health allied services'
    'classification-structure-managers-and-administrative-workers' = 'classification structure managers administrative workers'
    'translation-arrangements-for-registered-nurses-midwives' = 'translation arrangements registered nurses midwives'
    'translation-of-managers-and-administrative-workers' = 'translation managers administrative workers'
    'transition-to-new-instrument-technician-structure' = 'transition instrument technician structure classification'
    'transition-to-new-theatre-technician-structure' = 'transition theatre technician structure classification'
    'introduction-of-revised-food-services-classification' = 'revised food services classification hotel services'
    'introduction-of-revised-general-services-classification' = 'revised general services classification hotel'
    'introduction-of-revised-pathology-collector-structure' = 'revised pathology collector structure classification'
    'introduction-of-revised-allied-health-assistant' = 'revised allied health assistant classification structure'
    'introduction-of-revised-health-care-worker' = 'revised health care worker classification'
    'introduction-of-lifestyle-assistant-and-complimentary' = 'lifestyle assistant complementary therapy classification'
    'translation-of-all-other-employees'       = 'translation all other employees classification transitional'
    'medical-scientists-merit-reclassification-guidelines' = 'medical scientists merit reclassification guidelines'
    'medical-scientists-classification-descriptors' = 'medical scientists classification descriptors criteria'
    'classification-salaries-wages'            = 'classification salaries wages pay rates grade'
    'classifications-and-wages'                = 'classifications wages pay rates grade structure'
    'classifications-definitions-and-wages'    = 'classifications definitions wages pay rates'

    # -------------------------------------------------------
    # SPECIFIC CLASSIFICATION PAGES (professions by name)
    # -------------------------------------------------------
    'audiologists'                             = 'audiologist audiology classification grade structure'
    'clinical-perfusionists'                   = 'clinical perfusionists perfusion classification'
    'dietitians'                               = 'dietitian dietetics classification grade'
    'genetic-counsellors'                      = 'genetic counsellors genetics classification grade'
    'medical-physicists'                       = 'medical physicists physics classification grade'
    'pharmacists'                              = 'pharmacist pharmacy classification grade structure'
    'psychologists'                            = 'psychologist psychology clinical classification grade'
    'royal-childrens-hospital-clinical-perfusionists' = 'Royal Childrens Hospital clinical perfusionists classification'
    'ruson-rusom'                              = 'RUSON RUSOM undergraduate student nurse midwife'

    # -------------------------------------------------------
    # OHS / WORKPLACE SAFETY
    # -------------------------------------------------------
    'occupational-health-and-safety-workplace-violence' = 'occupational health safety workplace violence aggression OHS'
    'ohs-preliminary'                          = 'OHS occupational health safety preliminary overview'
    'ohs-risk-management'                      = 'OHS risk management hazard identification assessment'
    'industry-ohs-working-group'               = 'industry OHS working group committee'
    'incident-reporting-investigation-and-prevention' = 'incident reporting investigation prevention safety'
    'designated-work-groups'                   = 'designated work groups DWG OHS representative'
    'hsrs'                                     = 'health and safety representatives HSR OHS DWG'
    'occupational-violence-and-aggression-prevention-and' = 'occupational violence aggression prevention OVA'
    'workers-compensation-rehabilitation-and-return-to-work' = 'workers compensation rehabilitation return to work'
    'workers-compensation-rehabilitation-and-return-to' = 'workers compensation rehabilitation return to work'
    'home-visit-safety'                        = 'home visit safety community worker lone worker'
    'facilities'                               = 'facilities amenities staff room equipment'
    'amenities'                                = 'amenities facilities staff room lockers equipment'
    'prevention-of-gendered-violence-including-sexual' = 'prevention gendered violence sexual harassment'
    'prevention-of-gendered-violence-including-sexual-harassment' = 'prevention gendered violence sexual harassment'
    'fitness-for-work'                         = 'fitness for work impairment drug alcohol assessment'
    'prevention-and-management-of-workplace-bullying' = 'prevention management workplace bullying harassment'
    'bullying'                                 = 'bullying workplace harassment prevention management'
    'exposure-to-hazardous-substances'         = 'exposure hazardous substances chemicals safety protection'
    'no-restraint-of-patients'                 = 'no restraint patients restraint policy'
    'royal-commission-working-group'           = 'Royal Commission mental health working group'
    'reasonable-adjustments-for-employees-with-a-disability' = 'reasonable adjustments employees disability'
    'reasonable-adjustments'                   = 'reasonable adjustments disability workplace support'
    'hazardous-weather-conditions'             = 'hazardous weather conditions extreme heat safety'
    'oh-s-department-placement'                = 'OHS department placement health safety'
    'health-and-safety-rehabilitation-and-workcover' = 'health safety rehabilitation WorkCover compensation'
    'not-used-blank-ohs'                       = 'not used blank OHS reserved'

    # -------------------------------------------------------
    # DISPUTES / CONSULTATION / PERFORMANCE / CONDUCT
    # -------------------------------------------------------
    'dispute-resolution-procedure'             = 'dispute resolution procedure grievance formal complaint steps'
    'disputes-settling-procedures'             = 'disputes settling procedures grievance steps'
    'independent-dispute-resolution-panel'     = 'independent dispute resolution panel IDRP arbitration'
    'alternative-dispute-resolution-procedure' = 'alternative dispute resolution ADR mediation'
    'consultation'                             = 'consultation change major workplace change staff consultation'
    'consultation-about-major-workplace-change' = 'consultation major workplace change restructure'
    'managing-conduct-and-performance-discipline' = 'managing conduct performance discipline process'
    'managing-conduct-and-performance'         = 'managing conduct performance discipline'
    'disciplinary-procedure'                   = 'disciplinary procedure formal discipline conduct'
    'discipline'                               = 'discipline disciplinary process conduct formal'
    'performance-management'                   = 'performance management review appraisal improvement plan'
    'anti-discrimination-procedure'            = 'anti-discrimination equal opportunity diversity'
    'performance-management-dhsv'              = 'performance management DHSV Dental Health Services Victoria'
    'doctor-records'                           = 'doctor records file employment documentation'

    # -------------------------------------------------------
    # UNION / INDUSTRIAL MATTERS
    # -------------------------------------------------------
    'union-matters-section'                    = 'union matters membership rights industrial ANMF HACSU'
    'paid-union-meetings'                      = 'paid union meetings staff meetings industrial'
    'payroll-deduction-of-union-dues'          = 'payroll deduction union dues fees membership'
    'access-to-computers'                      = 'access computers union representatives communication'
    'workplace-delegates-rights'               = 'workplace delegates rights union representative access'
    'climate-change'                           = 'climate change sustainability environmental commitment'
    'worker-wellbeing-and-employment-support-officers' = 'worker wellbeing employment support officers'
    'statewide-industry-panel-reference'       = 'statewide industry panel reference union employer'
    'best-practice-employment-committee'       = 'best practice employment committee union consultative'

    # -------------------------------------------------------
    # FLEXIBLE WORKING / EMPLOYEE RIGHTS / WORK FROM HOME
    # -------------------------------------------------------
    'flexible-working-arrangements'            = 'flexible working arrangements flexible hours requests work life balance'
    'requests-for-flexible-working-arrangements' = 'requests flexible working arrangements flexible hours'
    'working-from-home'                        = 'working from home remote work WFH telecommuting'
    'working-from-home-royal-childrens-hospital' = 'working from home Royal Childrens Hospital remote'
    'access-to-employee-file'                  = 'access employee file personnel records right to view'
    'police-check-certificate'                 = 'police check criminal history clearance certificate'
    'working-with-children-check'              = 'Working With Children Check WWCC clearance'
    'employment-checks-applicable-from-24-june-2024' = 'employment checks applicable from 24 June 2024'
    'employment-checks'                        = 'employment checks criminal police WWCC clearance'
    'staffing-flexibility-dhsv'                = 'staffing flexibility DHSV Dental Health Services Victoria'
    'rights-of-private-practice'               = 'rights private practice privileges VMO specialists'

    # -------------------------------------------------------
    # APPENDICES / SCHEDULES (specific named documents)
    # -------------------------------------------------------
    'list-of-employers-appendix'               = 'list employers health services appendix schedule'
    'salaries-and-allowances-appendix'         = 'salaries allowances appendix schedule wage rates'
    'information-required-for-letter-of-appointment' = 'information letter of appointment required details'
    'role-statement-mental-health-clinical-educator' = 'role statement mental health clinical educator'
    'clinical-nurse-midwife-specialist-criteria' = 'clinical nurse midwife specialist criteria CNS CMS'
    'pcns-and-rpn-2-advanced-application-process' = 'PCNS RPN2 advanced application process clinical nurse'
    'indicative-position-description-for-after-hours-coordinator' = 'position description after hours coordinator'
    'template-certificate-of-service'          = 'template certificate of service document form'
    'certificate-of-service-appendix'          = 'certificate of service document appendix form'
    'letter-of-appointment-appendix'           = 'letter of appointment template appendix form'
    'letter-of-offer-appendix'                 = 'letter of offer template appendix form'
    'campus-categories'                        = 'campus categories health service sites locations'
    'health-service-categories'                = 'health service categories classification sites'
    'num-mum-matrix'                           = 'NUM MUM matrix nurse unit manager midwifery unit manager'
    'agreement-to-take-annual-leave-in-advance' = 'agreement annual leave in advance form template'
    'agreement-to-cash-out-annual-leave'       = 'agreement cash out annual leave form template'
    'agreement-for-time-off-instead-of-payment-for-overtime' = 'agreement time off lieu overtime TOIL form'
    'supported-wage-system'                    = 'supported wage system disability employment'
    'national-training-wage-appendix'          = 'national training wage NTW apprentice trainee schedule'
    'school-based-apprentices-appendix'        = 'school-based apprentices schedule training'
    'wage-rates-health-allied'                 = 'wage rates health allied services schedule'
    'allowances-health-allied-appendix'        = 'allowances health allied services schedule'
    'wage-rates-managers'                      = 'wage rates managers administrative workers schedule'
    'allowances-managers'                      = 'allowances managers administrative workers schedule'
    'workplace-trainer-careers-advisor'        = 'workplace trainer careers advisor classification'
    'worker-wellbeing-officer'                 = 'worker wellbeing officer role classification'
    'aboriginal-employment-support-officer'    = 'Aboriginal employment support officer classification'
    'disability-employment-support-officer'    = 'disability employment support officer classification'
    'veteran-employment-support-officer'       = 'veteran employment support officer classification'
    'anti-discrimination-appendix'             = 'anti-discrimination schedule appendix'
    'rostering-protocols-exemption-agreement'  = 'rostering protocols exemption agreement schedule'
    'clinical-services-enhancement-job-rotation' = 'clinical services enhancement job rotation schedule'
    'alfred-health-austin-health-royal-melbourne' = 'Alfred Health Austin Health Royal Melbourne Hospital'
    'dental-assistants-working-in-mobile-dental-programs' = 'dental assistants mobile dental programs'
    'chief-executive-officers'                 = 'chief executive officers CEO classification employment'
    'post-registration-students'               = 'post registration students classification employment'
    'victorian-maternal-and-child-health-nurse-student' = 'Victorian maternal child health nurse student'

    # -------------------------------------------------------
    # SPECIFIC LESS-COMMON CLAUSES
    # -------------------------------------------------------
    'additional-staffing-commitments'          = 'additional staffing extra staff commitment levels'
    'technology-in-cleaning'                   = 'technology cleaning equipment modernisation'
    'best-practice-of-rostering'               = 'best practice rostering scheduling principles'
    'clinical-support-time'                    = 'clinical support time paid professional activities'
    'funded-ratio'                             = 'funded ratio staffing level funding'
    'funded-staffing-ratios'                   = 'funded staffing ratios levels funding'
    'nurse-education-and-training'             = 'nurse education training CPD mandatory in-service'
    'midwifery-continuity-of-care-models'      = 'midwifery continuity of care models MGP caseload'
    'endorsed-midwife'                         = 'endorsed midwife prescribing authorised midwifery'
    'higher-education-recognition'             = 'higher education recognition postgraduate degree payment'
    'workforce-skills-capability-and-mobility' = 'workforce skills capability mobility flexibility'
    'superannuation-additional'                = 'superannuation additional employer contribution'
    'rostering-exemption'                      = 'rostering exemption agreement specific site'
    'anti-discrimination-commitment'           = 'anti-discrimination equal opportunity diversity'
    'pharmacist-weekend-ordinary-hours'        = 'pharmacist weekend ordinary hours Saturday Sunday'
    'savings-and-no-extra-claims'              = 'savings no extra claims industrial peace'
    'worker-wellbeing'                         = 'worker wellbeing employee assistance mental health support'
    'ward-clerk'                               = 'ward clerk administration clerical classification'
    'rural-satellite-telephones'               = 'rural satellite telephones remote communication'
    'rural-four-wheel-drive-all-wheel-drive'   = 'rural four wheel drive 4WD allowance vehicle'
    'birth-certificate'                        = 'birth certificate parental leave documentation'
    'reimbursement-of-professional-development' = 'reimbursement professional development expenses costs'
    'fbt'                                      = 'FBT fringe benefits tax salary packaging'
    'facilities-when-on-rotation'              = 'facilities when on rotation site amenities'
    'lump-sum'                                 = 'lump sum payment once-off compensation'
    'study-assistance'                         = 'study assistance financial support education'
    'examination'                              = 'examination leave sit exam assessment'
    'clinical-perfusionists-special'           = 'clinical perfusionists special conditions classification'
    'post-graduate'                            = 'post-graduate qualification degree allowance payment'
    'disability'                               = 'disability reasonable adjustments supported employment'
    'safety-officers'                          = 'safety officers OHS representatives DWG'
    'no-amalgamation-of-wards'                 = 'no amalgamation wards without ANMF agreement'
    'anti-amalgamation'                        = 'anti-amalgamation wards ANMF agreement'
    'midwifery-group-practice'                 = 'midwifery group practice MGP caseload continuity of care'
    'continuity-of-care'                       = 'continuity of care midwifery caseload model'
    'aged-care'                                = 'aged care residential nursing classification'
    'age-care-conditions'                      = 'aged care conditions nursing classification'
    'mental-health-officer'                    = 'mental health officer MHO classification grade'
    'practice-allowance'                       = 'practice allowance clinical payment professional'
    'dental-assistants'                        = 'dental assistants classification dental health'
    'radiographers-special'                    = 'radiographers special conditions classification'
    'nuclear-medicine'                         = 'nuclear medicine radiographer classification'
    'food-services'                            = 'food services hotel services classification'
    'health-care-worker'                       = 'health care worker classification HCW aide'
    'pathology-collector'                      = 'pathology collector classification phlebotomist'
    'endorsement-midwife'                      = 'endorsed midwife prescribing authorised'
    'management-training'                      = 'management training leadership development'
    'clinical-nurse-specialist'                = 'clinical nurse specialist CNS classification advanced practice'
    'personal-development'                     = 'personal development professional growth career'
    'lifestyle-assistant'                      = 'lifestyle assistant classification activities residential'
    'complimentary-therapist'                  = 'complementary therapist classification wellness'
    'nurse-education'                          = 'nurse education in-service training RN EN CPD'
    'education-coordinator'                    = 'education coordinator clinical educator classification'
    'classification-descriptors'               = 'classification descriptors criteria grade assessment'
    'merit-reclassification'                   = 'merit reclassification assessment promotion grade'
    'annualised-salary'                        = 'annualised salary consolidated annual payment'
    'bank-employees'                           = 'bank employees casual pool supplementary roster'
    'backfill-commitment'                      = 'backfill commitment replacement absence cover'
    'four-clear-days'                          = 'four clear days rest period allowance compensation'
    'hyperbaric'                               = 'hyperbaric chamber pressure treatment allowance'
    'home-visit'                               = 'home visit community safety lone worker'
    'non-catt'                                 = 'non-CATT on call recall community mental health'
    'change-of-ward'                           = 'change of ward transfer allowance payment'
    'sleepover'                                = 'sleepover residential overnight care allowance'
    'telephone-calls'                          = 'telephone calls after hours callback payment'
    'reimbursement'                            = 'reimbursement expenses costs payment recovery'
    'protected-industrial-action'              = 'protected industrial action strike enterprise bargaining'
    'clinical-perfusionist-rch'               = 'clinical perfusionists Royal Childrens Hospital'
    'health-service-seniority'                 = 'health service seniority redundancy priority'
    'staff-replacement'                        = 'staff replacement backfill absence cover'
    'best-practice-committee'                  = 'best practice committee consultative union employer'
    'access-to-information'                    = 'access information employee rights records'
    'personal-information'                     = 'personal information privacy records access'
    'breastfeeding-room'                       = 'breastfeeding room lactation facilities mothers'
    'flexible-hours'                           = 'flexible hours arrangements work-life balance roster'
    'primary-carer'                            = 'primary carer parental leave birth adoption'
    'secondary-carer'                          = 'secondary carer parental leave partner'
    'pay-protection'                           = 'pay protection salary maintenance redeployment'
    'redeployment'                             = 'redeployment redundancy alternative position'
    'workforce-skills'                         = 'workforce skills development capability mobility'
    'skills-capability'                        = 'skills capability workforce development training'
    'health-service-seniority-redundancy'      = 'health service seniority redundancy priority selection'
    'working-conditions'                       = 'working conditions physical environment OHS'
    'staff-rest-rooms'                         = 'staff rest rooms amenities facilities'
    'interpreter'                              = 'interpreter language translation bilingual services'
    'blood-donor'                              = 'blood donor leave Red Cross donation'
    'bereavement'                              = 'bereavement compassionate leave death family grief'
    'defence-service'                          = 'defence service military ADF reserve leave'
    'emergency-management'                     = 'emergency management volunteer SES CFA leave'
    'ceremonial'                               = 'ceremonial leave ATSI cultural obligations'
    'domestic-violence'                        = 'domestic violence family violence leave safety'
    'gender-transition'                        = 'gender transition affirmation leave support'
    'climate-sustainability'                   = 'climate change sustainability environmental commitment'
    'best-practice-committee-and'              = 'best practice employment commitment committee'
    'ohs-working-group'                        = 'OHS working group industry committee safety'
    'safety-representatives'                   = 'safety representatives HSR OHS designated work group'
    'aggression-prevention'                    = 'aggression prevention occupational violence safety'
    'workcover'                                = 'WorkCover workers compensation rehabilitation'
    'independent-panel'                        = 'independent dispute resolution panel arbitration'
    'rostering-change'                         = 'rostering change consultation hours alteration'
    'overtime-recall'                          = 'overtime recall callback callout penalty payment'
    'no-amalgamation-of-wards-without-agreement-of-anmf-and' = 'no amalgamation wards without ANMF agreement'
    'senior-midwife'                           = 'senior midwife classification advanced midwifery'
    'liaison-midwife'                          = 'liaison midwife classification role'

    # -------------------------------------------------------
    # SPECIFIC NAMED APPENDIX / SCHEDULE / FORM PAGES
    # -------------------------------------------------------
    'wage-rates-appendix'                      = 'wage rates appendix schedule salary table'
    'wages-and-allowances-appendix'            = 'wages allowances appendix schedule'
    'classification-schedule'                  = 'classification schedule appendix grade structure'
    'allowances-schedule'                      = 'allowances schedule appendix payment list'
    'form-template'                            = 'form template document application'
    'application-form'                         = 'application form document template'
    'claim-form'                               = 'claim form document template application'
    'contract-template'                        = 'contract template agreement document'
    'fixed-term-template'                      = 'fixed-term contract template document'
    'leave-form'                               = 'leave form application request document'
    'professional-development-form'            = 'professional development form claim expenses'
    'professional-development-expenses-standard-claim-form' = 'professional development expenses standard claim form'
    'medical-superintendent'                   = 'medical superintendent specialist classification senior'
    'aged-care-nursing'                        = 'aged care nursing classification residential'
    'community-health'                         = 'community health classification worker roles'
    'continuing-care'                          = 'continuing care nursing residential classification'
    'palliative-care'                          = 'palliative care nursing classification end of life'
    'emergency-department'                     = 'emergency department ED classification nursing specialist'
    'intensive-care'                           = 'intensive care ICU CCU classification nursing'
    'operating-theatre'                        = 'operating theatre perioperative classification nursing'
    'neonatal'                                 = 'neonatal NICU special care nursery classification'
    'midwifery-classification'                 = 'midwifery classification grades NUM MUM'
    'graduate-nurse'                           = 'graduate nurse new graduate first year RN classification'
    'graduate-program'                         = 'graduate program new graduate nurse traineeship'

    # -------------------------------------------------------
    # WAGES / SALARY INCREASES (CORRECTED SLUGS)
    # -------------------------------------------------------
    'wages-and-wage-increases'                     = 'wage increase pay rise salary adjustment percentage CPI circular'


    # -------------------------------------------------------
    # SPECIFIC NAMED ALLOWANCES (CORRECTED SLUGS)
    # -------------------------------------------------------
    'community-allowance'                          = 'community allowance community health off-site payment'
    'first-aid-allowance'                          = 'first aid allowance first aider qualification payment'
    'clinical-leader-allowance'                    = 'clinical leader allowance leadership responsibility payment'

    # -------------------------------------------------------
    # TERMINATION / END OF EMPLOYMENT (CORRECTED SLUGS)
    # -------------------------------------------------------

    'notice-of-termination-employer'               = 'notice of termination employer dismissal period weeks retrenchment'
    'notice-of-termination-employee'               = 'notice of termination employee resignation period weeks'

    # -------------------------------------------------------
    # MENTAL HEALTH EBA — AMHS / CATT SPECIFIC (CORRECTED SLUGS)
    # -------------------------------------------------------

    'authorised-mental-health-practitioner'        = 'authorised mental health practitioner AMHP powers obligations mental health act'

    # -------------------------------------------------------
    # WAGE TABLES / PAY POINTS / CLASSIFICATION STRUCTURE (CORRECTED SLUGS)
    # -------------------------------------------------------

    'salary-absorption'                            = 'salary absorption annualised maintained consolidated pay'

    # -------------------------------------------------------
    # INFORMAL HR LANGUAGE — cross-page workplace synonyms
    # These map colloquial HR terms to their formal EBA equivalents
    # so searches using everyday language surface the right pages.
    # -------------------------------------------------------
    'stand-down'                               = 'stand down stood down suspension without pay suspended sent home no work available direction not to attend'
    'rostering-notice'                         = 'rostering notice change of shift notice short notice roster change changed roster altered shift'
    'sick-leave'                               = 'sick leave personal leave sick day calling in sick unwell medical certificate illness absence'
    'crib-break'                               = 'crib break meal break lunch break dinner break half hour break rest interval meal interval'
    'redundancy-payout'                        = 'redundancy payout redundancy pay severance payment termination payment made redundant job loss retrenchment'
    'on-call-allowance'                        = 'on call allowance availability allowance standby allowance after hours call held on call being on call recall'
    'overtime-payment'                         = 'overtime payment double time time and a half additional hours penalty rates extra hours payment'
    'penalty-rates'                            = 'penalty rates overtime shift allowance Saturday Sunday weekend public holiday higher rates'
    'unfair-dismissal'                         = 'unfair dismissal wrongful termination dismissal without cause performance management discipline'
    'public-holiday-pay'                       = 'public holiday pay penalty rate double time Christmas Easter statutory holiday'
    'shift-loading'                            = 'shift loading shift allowance evening night penalty shift work payment'
    'acting-up'                                = 'acting up higher duties allowance temporary promotion acting in position higher duties'
    'maternity-leave'                          = 'maternity leave parental leave birth mother primary carer pregnancy birth leave'
    'paternity-leave'                          = 'paternity leave parental leave partner secondary carer father birth'
    'superannuation-rate'                      = 'superannuation rate super employer contribution SGC percentage retirement'
    'pay-rise'                                 = 'pay rise wage increase salary increase remuneration increase pay increase'
    'classification-review'                    = 'classification review reclassification grade change assessment level review'
    'written-warning'                          = 'written warning disciplinary process conduct performance formal warning discipline'
    'employee-assistance'                      = 'employee assistance EAP counselling support mental health wellbeing'
    'flexible-work'                            = 'flexible work flexible working arrangements flexible hours part time work from home'
    'domestic-violence-leave'                  = 'domestic violence leave family violence leave safety leave protection'
    'unfair-roster'                            = 'unfair roster rostering dispute consultation change of roster workload'
    'lunch-break'                              = 'lunch break meal break crib break half hour break rest interval food break'
    'timesheet'                                = 'timesheet time recording payroll wages records biometric timekeeping'
    'overpaid'                                 = 'overpaid overpayment recovery wages debt repayment'
    'underpaid'                                = 'underpaid underpayment back pay remedy wages recovery'
    'salary-sacrifice'                         = 'salary sacrifice salary packaging novated lease pre-tax benefits FBT'

}

# ==============================================================
# HELPER: Strip numeric prefix from filename slug
# "35-higher-qualifications-allowance" → "higher-qualifications-allowance"
# "102A-staff-replacement"             → "staff-replacement"
# "38G-reproductive-health-leave"      → "reproductive-health-leave"
# ==============================================================
function Remove-NumericPrefix {
    param([string]$Slug)
    # Matches optional digits + optional uppercase letters (e.g. 38G, 102A), then a hyphen
    return $Slug -replace '^[0-9]+[A-Z]?-', ''
}

function Remove-SlugWords {
    param(
        [string]$Combined,
        [string]$Slug
    )
    $slugWords = $Slug -split '-' | Where-Object { $_.Length -gt 2 }
    foreach ($word in $slugWords) {
        $Combined = $Combined -replace "(?i)\b$([regex]::Escape($word))\b", ''
    }
    $Combined = $Combined -replace '(?<!\w)-\w+', ''
    $Combined = $Combined -replace '\w+-(?!\w)', ''
    $Combined = $Combined -replace '\s+-\s*', ' '
    $Combined = $Combined -replace '\s{2,}', ' '
    return $Combined.Trim()
}

# ==============================================================
# HELPER: Remove words that appear in the filename slug from the
# combined synonyms string. This prevents Pagefind from
# excerpting the synonyms blob when the user searches for the
# clause title itself.
#
# e.g. slug "higher-duties-allowance" → strip tokens
#      "higher", "duties", "allowance" from $combined.
#
# Matching is case-insensitive, whole-word only (word boundaries).
# ==============================================================

# ==============================================================
# HELPER: Determine EBA identity for a given file path
# ==============================================================
function Get-EbaLabel {
    param([string]$FilePathLower)
    foreach ($key in $ebaIdentityKeywords.Keys) {
        if ($FilePathLower -like "*/$key/*" -or $FilePathLower -like "*\$key\*") {
            return $key
        }
    }
    return ''
}

# ==============================================================
# HELPER: Look up topic keywords for a filename slug
# Tries exact slug first, then slug with numeric prefix removed.
# ==============================================================
function Get-TopicKeywords {
    param([string]$Filename)

    # Strip .md extension
    $slug = [System.IO.Path]::GetFileNameWithoutExtension($Filename).ToLower()

    # 1. Exact match (covers slugs that have no numeric prefix, e.g. section pages)
    if ($filenameKeywords.ContainsKey($slug)) {
        return $filenameKeywords[$slug]
    }

    # 2. Strip numeric prefix and try again
    $stripped = Remove-NumericPrefix -Slug $slug
    if ($filenameKeywords.ContainsKey($stripped)) {
        return $filenameKeywords[$stripped]
    }

    # 3. No match
    return ''
}

# ==============================================================
# HELPER: Inject or update the hidden synonym <div> in a file.
#
# The <div> is placed immediately after the closing front matter
# fence (---) and before the page content. It is styled with
# display:none so visitors never see it, but Pagefind indexes it
# because data-pagefind-body is on the parent .vp-doc container.
#
# If a synonym div already exists it is replaced in-place.
# ==============================================================
function Set-SynonymDiv {
    param(
        [string]$FilePath,
        [string]$Keywords
    )

    $content = Get-Content -Path $FilePath -Raw -Encoding UTF8

    $divOpen  = '<div class="pagefind-synonyms" style="display:none" aria-hidden="true">'
    $divClose = '</div>'
    $divBlock = "$divOpen`n$Keywords`n$divClose"

    # Pattern: match existing synonym div block (greedy within the div tags)
    $existingDivPattern = '<div class="pagefind-synonyms"[^>]*>[\s\S]*?<\/div>'

    if ($content -match [regex]::Escape($divOpen).Replace('\n','[\r\n]')) {
        # Replace existing div
        $newContent = [regex]::Replace($content, $existingDivPattern, $divBlock)
    } elseif ($content -match '(?s)^---\r?\n.*?\r?\n---\r?\n') {
        # File has front matter -- insert div immediately after closing ---
        $newContent = [regex]::Replace($content, '(^---\r?\n[\s\S]*?\r?\n---\r?\n)', "`$1`n$divBlock`n")
    } else {
        # No front matter -- prepend div (unusual; log for investigation)
        $newContent = "$divBlock`n`n$content"
    }

    if (-not $DryRun) {
        Set-Content -Path $FilePath -Value $newContent -Encoding UTF8 -NoNewline
    }

    return $newContent -ne $content
}

# ==============================================================
# MAIN
# ==============================================================
if ($DryRun) {
    Write-Host "`nDRY RUN -- NO FILES MODIFIED`n" -ForegroundColor Yellow
}

if (-not (Test-Path $docsRoot)) {
    Write-Error "docsRoot not found: $docsRoot -- check the path at the top of this script."
    exit 1
}

$files = Get-ChildItem -Path $docsRoot -Recurse -Filter "*.md"

# Apply EBA filter if specified
if ($EbaFilter) {
    $files = $files | Where-Object { $_.FullName -like "*\$EbaFilter\*" }
    Write-Host "Filter applied: EBA = $EbaFilter" -ForegroundColor Cyan
}

$processed = 0
$updated   = 0
$skipped   = 0
$noMatch   = 0

foreach ($file in $files) {

    $filePathLower  = $file.FullName.ToLower().Replace('\','/')
    $ebaLabel       = Get-EbaLabel -FilePathLower $filePathLower
    $ebaKeywords    = if ($ebaLabel) { $ebaIdentityKeywords[$ebaLabel] } else { '' }
    $topicKeywords  = Get-TopicKeywords -Filename $file.Name

    if (-not $ebaKeywords -and -not $topicKeywords) {
        Write-Host "SKIP (no match) $($file.Name)" -ForegroundColor DarkGray
        $noMatch++
        continue
    }

    $combined = $ebaKeywords.Trim()
    $strippedSlug = Remove-NumericPrefix -Slug ([System.IO.Path]::GetFileNameWithoutExtension($file.Name).ToLower())
    $combined = Remove-SlugWords -Combined $combined -Slug $strippedSlug

    if ($DryRun) {
        Write-Host "WOULD UPDATE  $($file.Name)" -ForegroundColor Cyan
        Write-Host "  EBA     : $ebaLabel" -ForegroundColor Green
        Write-Host "  Topic   : $topicKeywords" -ForegroundColor Yellow
        Write-Host "  COMBINED: $combined" -ForegroundColor White
        Write-Host ""
        $processed++
    } else {
        $changed = Set-SynonymDiv -FilePath $file.FullName -Keywords $combined
        if ($changed) {
            Write-Host "UPDATED   $($file.Name)" -ForegroundColor Green
            $updated++
        } else {
            Write-Host "NO CHANGE $($file.Name)" -ForegroundColor DarkGray
            $skipped++
        }
        $processed++
    }
}

Write-Host "`n--- SUMMARY ---" -ForegroundColor Yellow
Write-Host "Total .md files found : $($files.Count)"
Write-Host "Processed (has match) : $processed"
if ($DryRun) {
    Write-Host "Would update          : $processed"
} else {
    Write-Host "Updated (changed)     : $updated"
    Write-Host "No change needed      : $skipped"
}
Write-Host "Skipped (no match)    : $noMatch"

if ($DryRun) {
    Write-Host "`nRe-run without -DryRun to apply changes." -ForegroundColor Yellow
}