<#
.SYNOPSIS
    Fix-TopicTags.ps1 — Corrects over-applied topic tags in EBA front matter.

.PARAMETER DryRun
    If specified, reports changes without writing to disk. Run this first.

.PARAMETER TopicsToFix
    Array of topic names to process. Defaults to all defined topics.

.EXAMPLE
    .\Fix-TopicTags.ps1 -DryRun
    .\Fix-TopicTags.ps1
    .\Fix-TopicTags.ps1 -TopicsToFix "preliminary","hours"
#>

param(
    [switch]$DryRun,
    [string[]]$TopicsToFix = @(
        "preliminary","hours","employment","leave","overtime",
        "wages","allowances","shift-work","classifications",
        "rosters","staffing","consultation","definitions","disputes",
        "flexible-work","on-call","education","annual-leave",
        "parental-leave","personal-leave","breaks","termination",
        "public-holidays","study-leave","workload","superannuation",
        "long-service-leave","training","union-matters","ohs","schedules",
        "appendices","professional-development","discipline"
    )
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$EbasRoot = "C:\Projects\EBAdb\docs\ebas"

# ─────────────────────────────────────────────────────────────────────────────
# ALLOWLIST: slug patterns that legitimately carry each topic tag.
# A page KEEPS the tag if its filename matches ANY pattern in the list.
# Patterns use PowerShell -match (regex).
# ─────────────────────────────────────────────────────────────────────────────
$TopicAllowlist = @{

    "preliminary" = @(
        "^preliminary",
        "^1-title",
        "^2-arrangement",
        "^3-arrangement",
        "^3-definitions",
        "^3-definitions-and-interpretation",
        "^4-coverage",
        "^4-definitions",
        "^4-application",
        "^5-coverage",
        "^5-incidence",
        "^5-access-to-the-award",
        "^5-date-and-period",
        "^6-commencement",
        "^6-application-and-relationship",
        "^6-the-national-employment-standards",
        "^6-definitions",
        "^6-relationship-to-previous",
        "^6-savings",
        "^7-commencement",
        "^7-no-extra-claims",
        "^7-relationship-to-previous",
        "^7-savings",
        "^8-no-extra-claims",
        "^8-copy-of-agreement",
        "^8-posting-of-agreement",
        "^8-relationship-to-previous",
        "^9-no-extra-claims",
        "^9-nature-of-relationship",
        "^10-coverage",
        "^10-anti-discrimination",
        "^11-anti-discrimination",
        "^11-incidence-and-operation",
        "^12-implementation-committees",
        "^13-no-further-claims",
        "^14-copy-of-agreement",
        "^15-savings-clause",
        "^16-anti-discrimination",
        "^17-gender-based-discrimination",
        "application-of-section",
        "savings-clause",
        "incidence-coverage",
        "relationship-to",
        "anti-discrimination",
        "no-extra-claims",
        "copy-of-agreement",
        "commencement",
        "^coverage",
        "^4-division-into-sections",
        "^2-index",
        "^3-index",
        "^index"
    )

    "hours" = @(
        "hours-of-work",
        "ordinary-hours",
        "-hours-of-work",
        "roster",
        "accrued-days-off",
        "^ados",
        "breaks",
        "meal-interval",
        "rest-period",
        "rest-break",
        "rest-and-meal",
        "ten-hour-break",
        "daylight-sav",
        "make-up-time",
        "wash-up-time",
        "overtime",
        "recall",
        "on-call",
        "shift-work",
        "shiftwork",
        "night-shift",
        "penalty-rate",
        "saturday-and-sunday",
        "rates-for-saturdays",
        "special-rates-for-saturdays",
        "minimum-engagement",
        "right-to-disconnect",
        "safe-rostering",
        "reasonable-additional-hours",
        "workload",
        "biometric-timekeeping",
        "training-time",
        "continuous-duty",
        "four-clear-days",
        "supplementary-roster",
        "short-shifts"
    )

    "employment" = @(
        "types-of-employment",
        "full-time-employment",
        "part-time-employment",
        "casual-employment",
        "casual-conversion",
        "fixed-term-employment",
        "termination-of-employment",
        "notice-of-termination",
        "notice-period-before-termination",
        "redundancy",
        "redeployment",
        "transition-to-retirement",
        "secure-employment",
        "period-of-employment",
        "letter-of-appointment",
        "letter-of-offer",
        "certificate-of-service",
        "recruitment-to-vacant",
        "modes-of-employment",
        "best-practice-employment",
        "employee-retention",
        "transfer-of-business",
        "employment-checks",
        "fixed-term-contract-conversion",
        "^10-types-of-employment",
        "^17-secure-employment",
        "^18-part-time-employment",
        "^20-casual-employment"
    )

    "leave" = @(
        "^leave",
        "annual-leave",
        "personal-leave",
        "personal-carer",
        "personal-sick",
        "parental-leave",
        "long-service-leave",
        "study-leave",
        "examination-leave",
        "conference-seminar-leave",
        "compassionate-leave",
        "family-violence-leave",
        "family-and-domestic-violence",
        "ceremonial-leave",
        "blood-donor",
        "leave-to-engage",
        "leave-without-pay",
        "pre-adoption-leave",
        "foster-and-kinship",
        "purchased-leave",
        "sabbatical-leave",
        "reproductive-health-leave",
        "rehabilitation-leave",
        "gender-transition-leave",
        "gender-affirmation-leave",
        "special-disaster-leave",
        "jury-service",
        "leave-not-applying",
        "excessive-leave",
        "community-service-leave",
        "carer-s-leave",
        "carers-leave",
        "caring-responsibilities",
        "continuing-medical-education-leave",
        "fitness-for-work",
        "unplanned-absences",
        "planned-and-unplanned",
        "discretionary-backfill",
        "staff-replacement",
        "backfill",
        "agreement-to-take-annual-leave",
        "agreement-to-cash-out",
        "^f-agreement",
        "^g-agreement",
        "^4-agreement-to-take",
        "^5-agreement-to-take",
        "^5-agreement-to-cash",
        "^6-agreement-to-take",
        "^7-agreement-to-cash"
    )

    "overtime" = @(
        "overtime",
        "recall",
        "rest-period-after-overtime",
        "ten-hour-break",
        "on-call-rostered-overtime",
        "allowances-related-to-overtime",
        "saturday-and-sunday",          
        "rates-for-saturdays",          
        "minimum-engagement",           
        "^h-agreement-for-time-off"
    )

    "wages" = @(
        "wage-rates",
        "minimum-wages",
        "payment-of-wages",
        "pay-rates",
        "rates-of-pay",
        "salary-circular",
        "salary",
        "remuneration",
        "annualised-salaries",
        "classifications-definitions-and-wages",
        "wage-increases",
        "wages-review",
        "once-off-retention-payment",
        "patience-in-bargaining-payment",
        "top-of-band-payment",
        "skills-and-incentive-payment",
        "experience-payments",
        "commuted-allowance",
        "higher-duties",
        "additional-payment-of-wages",
        "^2-wage-rates",
        "^wages"
    )

    "allowances" = @(
        "allowance",
        "allowances",
        "meal-allowance",
        "meal-allowances",
        "shift-allowance",
        "travel-payment",
        "travelling-allowance",
        "relocation",
        "telephone-allowance",
        "rural-and-isolated",
        "lead-apron",
        "hyperbaric",
        "childcare",
        "child-care-costs",
        "qualification-allowance",
        "higher-education-recognition",
        "certificate-allowance",
        "nauseous-work",
        "multi-skilling-allowance",
        "out-of-hours-supervisor",
        "commuted-allowance",
        "change-of-shift",
        "senior-allowance",
        "recall",                       # ADD THIS (recall-return-to-workplace carries allowances)
        "on-call-recall-allowance",
        "catt-on-call",
        "removal-expenses",
        "four-clear-days",
        "working-away-from-home",
        "reimbursement-of-expenses",
        "uniforms",                     # ADD THIS
        "protective-clothing",
        "shiftwork",                    # ADD THIS
        "^[0-9]+-on-call"              # ADD THIS
    )

    "shift-work" = @(
        "shift-work",
        "shiftwork",
        "shift-allowance",
        "change-of-shift",
        "night-shift",
        "saturday-and-sunday",
        "rates-for-saturdays",
        "special-rates-for-saturdays",
        "penalty-rate",
        "penalty-payments",
        "daylight-sav",
        "make-up-time",
        "wash-up-time",
        "supplementary-roster",
        "accrued-days-off",
        "^ados",
        "four-clear-days"
    )

    "classifications" = @(
        "classification",
        "classifications",
        "reclassification",
        "classification-standards",
        "classification-definitions",
        "merit-reclassification",
        "progression",
        "trainee",
        "trainees",
        "undergraduate",
        "commencing-grades",
        "enrolled-nurse-classification",
        "mental-health-officers-classification",
        "psychiatric-enrolled-nurse",
        "wage-skill-group",
        "notification-of-classification",
        "disclosure-of-qualification",
        "allied-health-manager",
        "clinical-perfusionists"
    )

    "rosters" = @(
        "roster",
        "rosters",
        "rostering",
        "accrued-days-off",
        "^ados",
        "safe-rostering",
        "supplementary-roster",
        "biometric-timekeeping"
    )

    "staffing" = @(
        "staffing",
        "backfill",
        "staff-replacement",
        "replacement-positions",
        "workload-management",
        "safe-rostering",
        "contractors-and-labour-hire",
        "undergraduate-employment",
        "agency-staff",
        "bank-employees",
        "community-health-teams-staffing",
        "community-workload",
        "crisis-team-workload"
    )

    "consultation" = @(
        "consultation",
        "consultative",
        "implementation-committees",
        "statewide-industry-panel",
        "best-practice-employment-commitment"
    )

    "definitions" = @(
        "definitions",
        "definitions-and-interpretation",
        "definitions-specific-to",
        "interpretation",
        "^common-terms",                # ADD THIS (hub overview pages in has-managers-admin & mental-health)
        "common-terms$"                 # ADD THIS
    )

    "disputes" = @(
        "dispute",
        "disputes-resolution",
        "disputes-settling"
    )

    "flexible-work" = @(
        "flexible-working",
        "individual-flexibility",
        "right-to-disconnect",
        "working-from-home",
        "breastfeeding",                # ADD THIS
        "requests-for-flexible",
        "individual-flexible-working",
        "climate-change-mitigation",
        "internal-locum-conversion"
    )

    "on-call" = @(
        "on-call",
        "oncall",
        "recall",
        "on-call-rostered-overtime",
        "catt-on-call",
        "on-call-recall",
        "continuous-duty"
    )

    "education" = @(
        "education",
        "in-service-education",
        "study-leave",
        "examination-leave",
        "professional-development",
        "continuing-medical-education",
        "conference-seminar",
        "medicare-study-leave",
        "literacy-and-numeracy",
        "portfolio-work",
        "clinical-support-time"
    )

    "annual-leave" = @(
        "annual-leave",
        "agreement-to-take-annual-leave",
        "agreement-to-cash-out",
        "excessive-leave-accrual",
        "purchased-leave",
        "leave-not-applying-to-casuals",
        "^f-agreement",
        "^g-agreement"
    )

    "parental-leave" = @(
        "parental-leave",
        "pre-adoption-leave",
        "pre-natal",                    # ADD THIS
        "prenatal",                     # ADD THIS
        "foster-and-kinship",
        "reproductive-health-leave",
        "gender-transition-leave",
        "gender-affirmation-leave",
        "ending-employment-during-parental"
    )

    "personal-leave" = @(
        "personal-leave",
        "personal-carer",
        "personal-sick",
        "carer-s-leave",
        "carers-leave",
        "caring-responsibilities",
        "compassionate-leave",
        "family-violence-leave",
        "family-and-domestic-violence",
        "fitness-for-work"
    )

    "breaks" = @(
        "breaks",
        "breastfeeding",                # ADD THIS
        "breast-feeding",               # ADD THIS
        "meal-interval",
        "meal-break",
        "rest-break",
        "rest-period",
        "rest-and-meal",
        "ten-hour-break",
        "tea-break",
        "wash-up-time",
        "make-up-time"
    )

    "termination" = @(
        "termination",
        "notice-of-termination",
        "notice-period-before-termination",
        "redundancy",
        "redeployment",
        "certificate-of-service",
        "letter-of-appointment"
    )

    "public-holidays" = @(
        "public-holidays",
        "daylight-sav"
    )

    "study-leave" = @(
        "study-leave",
        "examination-leave",
        "conference-seminar-leave",
        "continuing-medical-education-leave",
        "medicare-study-leave",
        "sabbatical-leave"
    )

    "workload" = @(
        "workload",
        "workload-allocation",
        "workload-management",
        "community-workload",
        "crisis-team-workload",
        "reasonable-additional-hours"
    )

    "superannuation" = @(
        "superannuation",
        "salary-packaging",
        "deductions-for-board",
        "recovery-of-overpayments",
        "accident-pay",
        "accident-make-up-pay",
        "workers-compensation",
        "compensation-make-up",
        "make-up-pay"
    )

    "long-service-leave" = @(
        "long-service-leave"
    )

    "training" = @(
        "-training",                    # CHANGED (was "training" — too broad, matched doctors-in-training dirs)
        "in-service-education",
        "literacy-and-numeracy",
        "portfolio-work",
        "clinical-support-time",
        "trainee",
        "trainees",
        "continuing-medical-education"
    )

    "union-matters" = @(
        "union",
        "delegates",
        "workplace-delegates",
        "industrial",
        "implementation-committees",
        "consultative",
        "statewide-industry-panel"
    )

    "ohs" = @(
        "ohs",
        "occupational-health",
        "occupational-violence",
        "incident-reporting",
        "hazardous",
        "code-black",
        "code-grey",
        "oh-s",
        "home-visit-safety",
        "hazardous-weather",
        "workplace-violence",
        "safe-rostering",
        "fatigue"
    )

    "schedules" = @(
        "^schedule",
        "schedule-",
        "^h-agreement",
        "^f-agreement",
        "^g-agreement",
        "^a-",
        "^b-",
        "^c-",
        "^d-",
        "^e-",
        "^f-",
        "^g-",
        "^h-"
    )

    "appendices" = @(
        "^appendix",
        "^[0-9]+-wage-rates",
        "^[0-9]+-salary",
        "^[0-9]+-certificate",
        "^[0-9]+-letter-of",
        "^[0-9]+-agreement-to"
    )

    "professional-development" = @(
        "professional-development",
        "continuing-medical-education",
        "conference-seminar-leave",
        "portfolio-work",
        "clinical-support-time",
        "staff-appraisal",
        "study-leave",
        "examination-leave"
    )

    "discipline" = @(
        "discipline",
        "managing-conduct",
        "performance-management",
        "misconduct"
    )
}

# ─────────────────────────────────────────────────────────────────────────────
# HELPER: Parse topics from confirmed format: topics: ['tag1', 'tag2']
# ─────────────────────────────────────────────────────────────────────────────
function Get-TopicsFromLine {
    param([string]$Line)
    # Strip:  topics: [  and  ]  and all single quotes, then split on comma
    $inner = $Line -replace "^\s*topics:\s*\[", "" `
                   -replace "\]\s*$", "" `
                   -replace "'", ""
    return ($inner -split ",") |
        ForEach-Object { $_.Trim() } |
        Where-Object { $_.Length -gt 0 }
}

function Build-TopicsLine {
    param([string[]]$Tags)
    $formatted = ($Tags | ForEach-Object { "'$_'" }) -join ", "
    return "topics: [$formatted]"
}

# ─────────────────────────────────────────────────────────────────────────────
# MAIN PROCESSING
# ─────────────────────────────────────────────────────────────────────────────
$files   = Get-ChildItem -Path $EbasRoot -Recurse -Filter "*.md"
$changed = 0
$skipped = 0
$report  = [System.Collections.Generic.List[PSCustomObject]]::new()

foreach ($file in $files) {

    # Read all lines (handles \r\n cleanly)
    $lines = Get-Content $file.FullName

    # Must start with ---
    if ($lines.Count -lt 3 -or $lines[0].Trim() -ne "---") {
        $skipped++
        continue
    }

    # Find closing --- of front matter
    $fmEnd = -1
    for ($i = 1; $i -lt $lines.Count; $i++) {
        if ($lines[$i].Trim() -eq "---") { $fmEnd = $i; break }
    }
    if ($fmEnd -lt 0) { $skipped++; continue }

    # Find the topics: line index within front matter
    $topicsIdx = -1
    for ($i = 1; $i -lt $fmEnd; $i++) {
        if ($lines[$i] -match "^\s*topics:") { $topicsIdx = $i; break }
    }
    if ($topicsIdx -lt 0) { $skipped++; continue }

    $slug      = $file.BaseName.ToLower()
    $rawTopics = Get-TopicsFromLine $lines[$topicsIdx]

    $keptTopics    = [System.Collections.Generic.List[string]]::new()
    $removedTopics = [System.Collections.Generic.List[string]]::new()
    $modified      = $false

    foreach ($tag in $rawTopics) {
        if ($TopicsToFix -notcontains $tag) {
            $keptTopics.Add($tag)
            continue
        }

        $allowPatterns = $TopicAllowlist[$tag]
        if (-not $allowPatterns) {
            $keptTopics.Add($tag)
            continue
        }

        $matched = $false
        foreach ($pattern in $allowPatterns) {
            if ($slug -match $pattern) { $matched = $true; break }
        }

        if ($matched) {
            $keptTopics.Add($tag)
        } else {
            $removedTopics.Add($tag)
            $modified = $true
        }
    }

    if (-not $modified) { $skipped++; continue }

    $report.Add([PSCustomObject]@{
        File    = $file.FullName.Replace("C:\Projects\EBAdb\docs\ebas\", "")
        Removed = ($removedTopics -join ", ")
        Kept    = ($keptTopics -join ", ")
    })

    if (-not $DryRun) {
        $lines[$topicsIdx] = Build-TopicsLine $keptTopics
        $lines | Set-Content -Path $file.FullName -Encoding UTF8
        $changed++
    }
}

# ─────────────────────────────────────────────────────────────────────────────
# REPORT
# ─────────────────────────────────────────────────────────────────────────────
Write-Host "`n═══════════════════════════════════════════════════════" -ForegroundColor Cyan
if ($DryRun) {
    Write-Host "  DRY RUN — No files were modified" -ForegroundColor Yellow
} else {
    Write-Host "  APPLIED — $changed files modified" -ForegroundColor Green
}
Write-Host "  $($report.Count) files flagged for change" -ForegroundColor White
Write-Host "  $skipped files skipped (no topics line / not front matter)" -ForegroundColor Gray
Write-Host "═══════════════════════════════════════════════════════`n" -ForegroundColor Cyan

if ($report.Count -gt 0) {
    $report | Format-Table File, Removed, Kept -AutoSize -Wrap
} else {
    Write-Host "  No tag corrections required." -ForegroundColor Green
}