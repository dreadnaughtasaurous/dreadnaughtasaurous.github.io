<#
.SYNOPSIS
    Injects data-pagefind-meta clause and section tags into EBA wiki pages.

.DESCRIPTION
    Scans all .md files in all 9 EBA folders under docs/ebas/.
    For each file with a numeric/alphanumeric clause prefix in its filename,
    injects two hidden <span> elements immediately after the front matter block:
        <span data-pagefind-meta="clause:Clause N" style="display:none"></span>
        <span data-pagefind-meta="section:Section Name" style="display:none"></span>
    Idempotent: will not double-inject if tags are already present.
    Supports -DryRun to preview without writing files.

.PARAMETER DryRun
    Preview changes without writing to disk.

.PARAMETER EbaFolder
    Optional. Restrict to a single EBA folder name (e.g. "allied-health").

.EXAMPLE
    .\Add-PagefindMeta.ps1 -DryRun
    .\Add-PagefindMeta.ps1 -DryRun -EbaFolder allied-health
    .\Add-PagefindMeta.ps1
    .\Add-PagefindMeta.ps1 -EbaFolder nurses-midwives
#>

[CmdletBinding()]
param(
    [switch]$DryRun,
    [string]$EbaFolder = ""
)

# ─── CONFIGURATION ────────────────────────────────────────────────────────────

$docsRoot   = "C:\Projects\EBAdb\docs\ebas"
$logFile    = "C:\Projects\EBAdb\pagefind-meta-log.txt"

# The 9 EBA folder names
$ebaFolders = @(
    "allied-health",
    "biomedical-engineers",
    "childrens-services",
    "doctors-in-training",
    "has-managers-admin",
    "medical-specialists",
    "mental-health",
    "mspp",
    "nurses-midwives"
)

# ─── SECTION LABEL MAP ────────────────────────────────────────────────────────
# Maps subfolder names (under each EBA folder) to human-readable section labels.
# Derived from the folder naming conventions in the wiki directory structure.
$sectionLabels = @{
    # Common section folder names
    "preliminary"              = "Preliminary"
    "application-operation"    = "Application & Operation"
    "operation"                = "Application & Operation"
    "employment"               = "Employment"
    "employment-types"         = "Types of Employment"
    "remuneration"             = "Remuneration"
    "wages"                    = "Wages & Allowances"
    "allowances"               = "Allowances"
    "hours-of-work"            = "Hours of Work"
    "leave"                    = "Leave"
    "education-pd"             = "Education & Professional Development"
    "consultation-disputes"    = "Consultation & Disputes"
    "union-matters"            = "Union Matters"
    "union-rights"             = "Union Rights"
    "ohs"                      = "Occupational Health & Safety"
    "schedules"                = "Schedules"
    "appendices"               = "Appendices"
    "safe-patient-care"        = "Safe Patient Care"
    "staffing"                 = "Staffing"
    "classification-staffing"  = "Classification & Staffing"
    "classification-salaries"  = "Classification & Salaries"
    "common-terms"             = "Common Terms"
    "disputes"                 = "Disputes"
    "doctor-employment"        = "Doctor Employment"
    "clinical-supervision"     = "Clinical Supervision"
    "health-professionals"     = "Health Professionals"
    "health-allied-services"   = "Health & Allied Services"
    "management-admin"         = "Management & Administration"
    "managers-admin"           = "Managers & Administration"
    "support-services"         = "Support Services"
    "rpn-pen-mho"              = "RPN, PEN & MHO"
    "workforce-management"     = "Workforce Management"
    "workplace-rights"         = "Workplace Rights"
    "transport"                = "Transport"
    "resources"                = "Resources"
    "letter-of-employment"     = "Letter of Employment"
    "index"                    = "Index"
    "accident-pay-allowances"  = "Accident Pay & Allowances"
    "accommodation"            = "Accommodation"
    "about"                    = "About"
}

# ─── HELPERS ──────────────────────────────────────────────────────────────────

# Convert a kebab-case folder name to Title Case as fallback
function ConvertTo-TitleCase([string]$kebab) {
    ($kebab -split '-' | ForEach-Object {
        $_.Substring(0,1).ToUpper() + $_.Substring(1)
    }) -join ' '
}

# Extract clause number from filename.
# Returns e.g. "36", "36A", "10A", "01", "102A" or $null if no numeric prefix.
function Get-ClauseNumber([string]$filename) {
    # Match leading number + optional letter suffix, before the first hyphen
    # Handles: 36-overtime.md, 36A-title.md, 10A-consultation.md, 01-list.md
    if ($filename -match '^(\d+[A-Z]?)-') {
        return $Matches[1]
    }
    # Single-digit files with no slug (e.g. "1-title.md")
    if ($filename -match '^(\d+[A-Z]?)\.md$') {
        return $Matches[1]
    }
    return $null
}

# Determine the section label for a file.
# Uses the immediate parent folder name, mapped through $sectionLabels.
function Get-SectionLabel([string]$filePath) {
    $parentFolder = Split-Path (Split-Path $filePath -Parent) -Leaf
    if ($sectionLabels.ContainsKey($parentFolder)) {
        return $sectionLabels[$parentFolder]
    }
    # Fallback: convert the folder name to Title Case
    return ConvertTo-TitleCase $parentFolder
}

# ─── MAIN ─────────────────────────────────────────────────────────────────────

# Start log
$timestamp   = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
$modeLabel   = if ($DryRun) { "DRY RUN" } else { "LIVE RUN" }
$logLines    = @()
$logLines   += "Add-PagefindMeta.ps1 — $modeLabel — $timestamp"
$logLines   += ("=" * 70)

$injected    = 0
$skipped     = 0
$alreadyHas  = 0
$errors      = 0

# Determine which EBA folders to process
$foldersToProcess = if ($EbaFolder -ne "") {
    if ($ebaFolders -contains $EbaFolder) {
        @($EbaFolder)
    } else {
        Write-Host "ERROR: '$EbaFolder' is not a recognised EBA folder name." -ForegroundColor Red
        Write-Host "Valid folders: $($ebaFolders -join ', ')" -ForegroundColor Yellow
        exit 1
    }
} else {
    $ebaFolders
}

foreach ($eba in $foldersToProcess) {
    $ebaPath = Join-Path $docsRoot $eba
    if (-not (Test-Path $ebaPath)) {
        $msg = "WARN  | EBA folder not found: $ebaPath"
        Write-Host $msg -ForegroundColor Yellow
        $logLines += $msg
        continue
    }

    # Get all .md files recursively within this EBA folder
    $mdFiles = Get-ChildItem -Path $ebaPath -Recurse -Filter "*.md" | Sort-Object FullName

    foreach ($file in $mdFiles) {
        $filename    = $file.Name
        $clauseNum   = Get-ClauseNumber $filename

        # Skip files with no clause number prefix (index pages, overview pages, etc.)
        if ($null -eq $clauseNum) {
            $msg = "SKIP  | No clause prefix — $($file.FullName)"
            $logLines += $msg
            $skipped++
            continue
        }

        $parentFolder = (Split-Path $file.FullName -Parent | Split-Path -Leaf).ToLower()
        $clauseLabel  = switch ($parentFolder) {
            "schedules"  { "Schedule $clauseNum" }
            "appendices" { "Appendix $clauseNum" }
            default      { "Clause $clauseNum"   }
        }
        $sectionLabel = Get-SectionLabel $file.FullName

        # Read the file content
        try {
            $content = Get-Content -Path $file.FullName -Raw -Encoding UTF8
        } catch {
            $msg = "ERROR | Could not read: $($file.FullName) — $_"
            Write-Host $msg -ForegroundColor Red
            $logLines += $msg
            $errors++
            continue
        }

        # Idempotency check — skip if tags already present
        if ($content -match 'data-pagefind-meta="clause:') {
            $msg = "EXIST | Already has meta — $($file.FullName)"
            $logLines += $msg
            $alreadyHas++
            continue
        }

        # Find the end of the front matter block (closing ---)
        # Front matter is the content between the first and second --- lines.
        # We inject immediately after the second ---.
        if ($content -notmatch '(?s)^---\r?\n.*?\r?\n---') {
            $msg = "SKIP  | No front matter found — $($file.FullName)"
            Write-Host $msg -ForegroundColor Yellow
            $logLines += $msg
            $skipped++
            continue
        }

        # Build the two injection lines
        $injectBlock = "`n<span data-pagefind-meta=""clause:$clauseLabel"" style=""display:none""></span>`n<span data-pagefind-meta=""section:$sectionLabel"" style=""display:none""></span>"

        # Insert after the closing --- of front matter.
        # Strategy: replace the FIRST occurrence of a line that is exactly ---
        # at the end of the front matter (i.e., the second --- in the file).
        # We use a regex that matches: start, ---, the closing front-matter ---, then newline.
        $newContent = $content -replace '(?s)(^---\r?\n.*?\r?\n---)', "`$1$injectBlock"

        # Safety check: if replacement didn't change anything, skip
        if ($newContent -eq $content) {
            $msg = "SKIP  | Regex replacement produced no change — $($file.FullName)"
            Write-Host $msg -ForegroundColor Yellow
            $logLines += $msg
            $skipped++
            continue
        }

        $logLines += "INJECT| clause=$clauseLabel | section=$sectionLabel | $($file.FullName)"
        $injected++

        if (-not $DryRun) {
            try {
                [System.IO.File]::WriteAllText($file.FullName, $newContent, [System.Text.Encoding]::UTF8)
            } catch {
                $msg = "ERROR | Could not write: $($file.FullName) — $_"
                Write-Host $msg -ForegroundColor Red
                $logLines += $msg
                $errors++
                $injected--
            }
        }
    }
}

# ─── SUMMARY ──────────────────────────────────────────────────────────────────

$logLines += ""
$logLines += ("=" * 70)
$logLines += "SUMMARY ($modeLabel)"
$logLines += "  Injected  : $injected"
$logLines += "  Already had tags: $alreadyHas"
$logLines += "  Skipped (no prefix / no front matter): $skipped"
$logLines += "  Errors    : $errors"
$logLines += ("=" * 70)

# Write log
$logLines | Out-File -FilePath $logFile -Encoding UTF8

# Print summary to terminal
Write-Host ""
Write-Host "══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Add-PagefindMeta.ps1 — $modeLabel" -ForegroundColor Cyan
Write-Host "══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "  Injected  : $injected" -ForegroundColor Green
Write-Host "  Already had tags: $alreadyHas" -ForegroundColor Gray
Write-Host "  Skipped   : $skipped" -ForegroundColor Yellow
Write-Host "  Errors    : $errors" -ForegroundColor $(if ($errors -gt 0) { "Red" } else { "Gray" })
Write-Host ""
Write-Host "  Log: $logFile" -ForegroundColor Gray
Write-Host "══════════════════════════════════════════" -ForegroundColor Cyan

if ($DryRun) {
    Write-Host ""
    Write-Host "  DRY RUN — no files were modified." -ForegroundColor Yellow
    Write-Host "  Re-run without -DryRun to apply changes." -ForegroundColor Yellow
}