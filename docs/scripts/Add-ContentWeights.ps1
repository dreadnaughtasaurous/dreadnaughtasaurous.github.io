<#
.SYNOPSIS
    Injects data-pagefind-weight attributes into high-value EBA wiki pages
    so Pagefind ranks them higher in search results than peripheral clauses.

.DESCRIPTION
    Uses a per-slug weight dictionary (three tiers: 10, 7, 5).
    Numeric filename prefixes are stripped before slug lookup.
    Idempotent: replaces an existing weight div if already present.
    Supports -DryRun to preview without writing files.

.PARAMETER DryRun
    Preview changes without writing to disk.

.PARAMETER EbaFilter
    Optional. Restrict to one EBA folder name (e.g. "nurses-midwives").

.EXAMPLE
    .\Add-ContentWeights.ps1 -DryRun
    .\Add-ContentWeights.ps1
    .\Add-ContentWeights.ps1 -DryRun -EbaFilter nurses-midwives
    .\Add-ContentWeights.ps1 -EbaFilter allied-health
#>
param(
    [switch]$DryRun,
    [string]$EbaFilter = ''
)

# ══════════════════════════════════════════════════════════════════════
# CONFIGURATION
# ══════════════════════════════════════════════════════════════════════
$docsRoot = "C:\Projects\EBAdb\docs\ebas"

# ══════════════════════════════════════════════════════════════════════
# WEIGHT DICTIONARY
# KEY   = filename slug with numeric prefix REMOVED and .md REMOVED
#         e.g. "30-allowances.md" → "allowances"
#              "allowances.md"    → "allowances"
# VALUE = integer weight (10 = highest, 7 = high, 5 = elevated)
#
# Rules:
#   10 → Section index / category landing pages only
#    7 → Wage tables, classification structures, salary schedules
#    5 → Named allowance pages, leave type pages, key clauses
# ══════════════════════════════════════════════════════════════════════
$weightMap = @{

    # ──────────────────────────────────────────────────────────────
    # WEIGHT 10 — Section landing / index pages
    # ──────────────────────────────────────────────────────────────
    'allowances'                               = 10
    'wages'                                    = 10
    'leave'                                    = 10
    'employment'                               = 10
    'employment-types'                         = 10
    'remuneration'                             = 10
    'classification-staffing'                  = 10
    'classification-salaries'                  = 10
    'schedules'                                = 10
    'appendices'                               = 10
    'ohs'                                      = 10
    'education-pd'                             = 10
    'index'                                    = 10
    'preliminary'                              = 10
    'rpn-pen-mho'                              = 10
    'health-professionals'                     = 10
    'health-allied-services'                   = 10
    'support-services'                         = 10
    'doctor-employment'                        = 10
    'accident-pay-allowances'                  = 10
    'workforce-management'                     = 10
    'workplace-rights'                         = 10
    'appendix'                                 = 10

    # ──────────────────────────────────────────────────────────────
    # WEIGHT 7 — Wage tables, classification, salary schedules
    # ──────────────────────────────────────────────────────────────
    'wage-rates'                               = 7
    'wages-and-allowances'                     = 7
    'salaries-and-allowances'                  = 7
    'rates-of-pay-and-allowances'              = 7
    'minimum-wages'                            = 7
    'minimum-wage'                             = 7
    'salary-and-allowances-increases'          = 7
    'wages-and-wage-increases'                 = 7
    'remuneration-and-remuneration-increases'  = 7
    'increases-to-allowances'                  = 7
    'wage-rates-health-allied-services'        = 7
    'wage-rates-managers-and-administrative-workers' = 7
    'allowances-and-top-of-band-payments'      = 7
    'doctors-in-training-remuneration-allowances-and-deductions' = 7
    'specialists-remuneration-and-allowances'  = 7
    'classifications'                          = 7
    'classification-structures'                = 7
    'classification-standards'                 = 7
    'classification-decisions'                 = 7
    'classification-descriptors-and-higher-qualification-allowanc' = 7
    'classification-and-reclassification'      = 7
    'classification-definitions-applying-to-health-professionals'  = 7
    'management-and-administrative-officers-classifications'        = 7
    'support-services-employee-classifications' = 7
    'mental-health-officers-classifications'   = 7
    'registered-psychiatric-nursing-classifications' = 7
    'psychiatric-enrolled-nurse-classifications' = 7
    'progression-through-pay-points'           = 7
    'overlapping-pay-points-between-grades'    = 7
    'experience-payments'                      = 7
    'progression-of-medical-scientists-from-grade-1-to-grade-2-at' = 7
    'superannuation'                           = 7
    'salary-packaging'                         = 7
    'top-of-band-payment'                      = 7
    'commuted-allowance'                       = 7
    'wage-skill-group-translation'             = 7
    'annualised-salaries-royal-childrens-hospital' = 7

    # ──────────────────────────────────────────────────────────────
    # WEIGHT 5 — Named allowances, leave types, key clauses
    # ──────────────────────────────────────────────────────────────
    'annual-leave'                             = 5
    'personal-leave'                           = 5
    'personal-carer-s-leave'                   = 5
    'long-service-leave'                       = 5
    'parental-leave'                           = 5
    'parental-leave-and-related-entitlements'  = 5
    'compassionate-leave'                      = 5
    'study-leave'                              = 5
    'professional-development-leave'           = 5
    'family-violence-leave'                    = 5
    'family-and-domestic-violence-leave'       = 5
    'reproductive-health-leave'                = 5
    'gender-affirmation-leave'                 = 5
    'cultural-and-ceremonial-leave'            = 5
    'community-service-leave'                  = 5
    'jury-service'                             = 5
    'jury-service-leave'                       = 5
    'absences-on-defence-leave'                = 5
    'higher-qualifications-allowance'          = 5
    'higher-duties-allowance'                  = 5
    'higher-duties'                            = 5
    'qualification-allowance'                  = 5
    'higher-education-recognition-allowance'   = 5
    'in-charge-allowances'                     = 5
    'in-charge-allowance'                      = 5
    'sole-allowance'                           = 5
    'nauseous-work-allowance'                  = 5
    'meal-allowance'                           = 5
    'meal-allowances'                          = 5
    'on-call'                                  = 5
    'on-call-recall'                           = 5
    'catt-on-call-recall-allowances'           = 5
    'on-call-recall-allowance-non-catt'        = 5
    'shift-allowance'                          = 5
    'shift-allowances'                         = 5
    'shift-work-allowance'                     = 5
    'shift-work-allowances'                    = 5
    'saturday-and-sunday-work'                 = 5
    'public-holidays'                          = 5
    'accident-pay'                             = 5
    'accident-make-up-pay'                     = 5
    'compensation-make-up-pay'                 = 5
    'overtime'                                 = 5
    'overtime-in-lieu'                         = 5
    'travelling-allowance'                     = 5
    'travelling-allowances'                    = 5
    'vehicle-allowance'                        = 5
    'childcare-reimbursement'                  = 5
    'uniform-allowance'                        = 5
    'uniform-and-laundry-allowance'            = 5
    'telephone-allowance'                      = 5
    'rural-and-isolated-practice-allowance'    = 5
    'lead-apron-allowance'                     = 5
    'damaged-clothing-allowance'               = 5
    'interpreter-allowances'                   = 5
    'educational-incentive-allowance'          = 5
    'district-allowances'                      = 5
    'peter-maccallum-cancer-centre-allowance'  = 5
    'change-of-roster-allowance'               = 5
    'change-of-shift-allowance'                = 5
    'change-of-ward-allowance'                 = 5
    'redundancy-and-associated-entitlements'   = 5
    'redundancy-and-related-entitlements'      = 5
    'termination-of-employment'                = 5
    'notice-of-termination'                    = 5
    'notice-period-before-termination'         = 5
    'casual-employment'                        = 5
    'casual-conversion'                        = 5
    'fixed-term-employment'                    = 5
    'part-time-employment'                     = 5
    'flexible-working-arrangements'            = 5
    'right-to-disconnect'                      = 5
    'employee-right-to-disconnect'             = 5
    'dispute-resolution-procedure'             = 5
    'anti-discrimination'                      = 5
    'individual-flexibility-arrangement'       = 5
    'individual-flexibility-arrangements'      = 5
    'breastfeeding'                            = 5
    'safe-rostering-and-fatigue'               = 5
    'roster-design-safe-hours-of-work'         = 5
    'accrued-days-off'                         = 5
    'workers-compensation-rehabilitation-and-return-to-work'       = 5
    'occupational-violence-and-aggression-prevention-and'          = 5
    'prevention-of-gendered-violence-including-sexual'             = 5
    'workload-management'                      = 5
    'notification-of-classification'           = 5
    'once-off-retention-payment'               = 5
    'skills-and-incentive-payment'             = 5
    'patience-in-bargaining-payment'           = 5
    'lump-sum-payment-mho-only'                = 5
    'managing-conduct-and-performance'         = 5
    'managing-conduct-and-performance-discipline' = 5
    'hours-of-work'                            = 5    
    'union-matters'                            = 5
    'staffing'                                 = 5 
    'clinical-supervision'                     = 5  
    'union-rights'                             = 5
    'consultation-disputes'                    = 5
    'safe-patient-care'                        = 5             
}

# ══════════════════════════════════════════════════════════════════════
# HELPER: Inject or replace the hidden weight <div>
# ══════════════════════════════════════════════════════════════════════
function Set-WeightDiv {
    param(
        [string]$FilePath,
        [int]$Weight
    )

    $divOpen    = "<div class=`"pagefind-weight`" data-pagefind-weight=`"$Weight`" style=`"display:none`" aria-hidden=`"true`">"
    $divClose   = '</div>'
    $divContent = "$divOpen`n$divClose"

    $existingPattern = '<div class="pagefind-weight"[^>]*>[\s\S]*?<\/div>'

    $raw = [System.IO.File]::ReadAllText($FilePath, [System.Text.Encoding]::UTF8)

    if ($raw -match $existingPattern) {
        $newRaw = [regex]::Replace($raw, $existingPattern, $divContent)
    } else {
        # Append before the synonym div if present, otherwise append at end
        $synonymPattern = '<div class="pagefind-synonyms"'
        if ($raw -match $synonymPattern) {
            $newRaw = $raw -replace '(<div class="pagefind-synonyms")', "$divContent`n`$1"
        } else {
            $newRaw = $raw.TrimEnd() + "`n`n$divContent`n"
        }
    }

    if ($newRaw -eq $raw) { return $false }
    [System.IO.File]::WriteAllText($FilePath, $newRaw, [System.Text.Encoding]::UTF8)
    return $true
}

# ══════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════
$allFiles  = Get-ChildItem -Path $docsRoot -Recurse -Filter "*.md"
$total     = $allFiles.Count
$updated   = 0
$noChange  = 0
$noMatch   = 0

foreach ($file in $allFiles) {
    if ($EbaFilter -ne '' -and $file.FullName -notmatch [regex]::Escape($EbaFilter)) {
        continue
    }

    $slug   = $file.BaseName -replace '^\d+[A-Za-z]?-', ''
    $weight = $weightMap[$slug]

    if ($null -eq $weight) {
        $noMatch++
        continue
    }

    if ($DryRun) {
        Write-Host "WOULD WEIGHT ($weight) → $($file.Name)" -ForegroundColor Cyan
        $updated++
        continue
    }

    $changed = Set-WeightDiv -FilePath $file.FullName -Weight $weight
    if ($changed) { $updated++ } else { $noChange++ }
}

Write-Host ""
Write-Host "══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Add-ContentWeights.ps1" -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Total .md files found : $total" -ForegroundColor White
Write-Host "  Weighted (matched)    : $($updated + $noChange)" -ForegroundColor White
Write-Host "  Updated (changed)     : $updated" -ForegroundColor Green
Write-Host "  No change needed      : $noChange" -ForegroundColor Gray
Write-Host "  Skipped (no match)    : $noMatch" -ForegroundColor Yellow
Write-Host ""
if ($DryRun) {
    Write-Host "  DRY RUN — no files modified." -ForegroundColor Yellow
    Write-Host "  Re-run without -DryRun to apply." -ForegroundColor Yellow
}
Write-Host "══════════════════════════════════════════" -ForegroundColor Cyan