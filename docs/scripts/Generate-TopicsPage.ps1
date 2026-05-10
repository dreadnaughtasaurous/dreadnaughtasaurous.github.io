<#
.SYNOPSIS
    Generate-TopicsPage.ps1
    Scans all EBA markdown files, extracts front matter topics, and
    generates a three-tier sorted topics index page.

.USAGE
    Run from any directory:
    & "C:\Projects\EBAdb\scripts\Generate-TopicsPage.ps1"
#>

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

# ─────────────────────────────────────────────
# CONFIGURATION
# ─────────────────────────────────────────────
$docsRoot   = "C:\Projects\EBAdb\docs"
$ebas_root  = "$docsRoot\ebas"
$outputFile = "$docsRoot\topics\index.md"

# ─────────────────────────────────────────────
# EBA SLUG → DISPLAY NAME MAP
# Update this if you add a new EBA to the wiki.
# ─────────────────────────────────────────────
$ebaDisplayNames = @{
    'allied-health'          = 'Allied Health'
    'biomedical-engineers'   = 'Biomedical Engineers'
    'childrens-services'     = "Children's Services"
    'doctors-in-training'    = 'Doctors In Training'
    'has-managers-admin'     = 'Health Allied & Managers Admin'
    'medical-specialists'    = 'Medical Specialists'
    'mental-health'          = 'Mental Health'
    'mspp'                   = 'Medical Scientists, Pharm & Psych'
    'nurses-midwives'        = 'Nurses & Midwives'
}

# ─────────────────────────────────────────────
# HELPER: Parse YAML front matter from a file
# Returns a hashtable of key → value (strings)
# ─────────────────────────────────────────────
function Get-FrontMatter {
    param([string]$FilePath)

    $lines = Get-Content -Path $FilePath -Encoding UTF8
    $fm = @{}

    # Front matter must start on line 1 with ---
    if ($lines.Count -lt 2 -or $lines[0].Trim() -ne '---') {
        return $fm
    }

    $inFm = $false
    $inTopicsBlock = $false
    $topicsList = [System.Collections.Generic.List[string]]::new()

    foreach ($line in $lines) {
        if ($line.Trim() -eq '---') {
            if (-not $inFm) {
                $inFm = $true
                continue
            } else {
                # End of front matter
                break
            }
        }

        if (-not $inFm) { continue }

        # Detect multi-line topics list (YAML block sequence)
        if ($line -match '^\s*topics\s*:\s*$') {
            $inTopicsBlock = $true
            continue
        }

        # Detect inline topics list: topics: [a, b, c]
        if ($line -match '^\s*topics\s*:\s*\[(.+)\]') {
            $raw = $Matches[1]
            foreach ($t in ($raw -split ',')) {
                $cleaned = $t.Trim().Trim('"').Trim("'")
                if ($cleaned) { $topicsList.Add($cleaned) }
            }
            $inTopicsBlock = $false
            continue
        }

        # Multi-line topics list items
        if ($inTopicsBlock -and $line -match '^\s*-\s+(.+)$') {
            $topicsList.Add($Matches[1].Trim().Trim('"').Trim("'"))
            continue
        }

        # If we hit a new top-level key, topics block has ended
        if ($inTopicsBlock -and $line -match '^\S') {
            $inTopicsBlock = $false
        }

        # Parse other scalar keys (title, clause, etc.)
        if ($line -match '^(\w[\w\-]*)\s*:\s*(.*)$') {
            $key   = $Matches[1].Trim()
            $value = $Matches[2].Trim().Trim('"').Trim("'")
            if ($key -ne 'topics') {
                $fm[$key] = $value
            }
        }
    }

    if ($topicsList.Count -gt 0) {
        $fm['topics'] = $topicsList -join '|'
    }

    return $fm
}

# ─────────────────────────────────────────────
# HELPER: Build the display label for a page link
# Format rules:
#   Appendix / Schedule → strip trailing ": EBA Name" from front matter title,
#                          then append " - EBA"
#   Clause page         → "Title (cl. N) - EBA"
# ─────────────────────────────────────────────
function Get-LinkLabel {
    param(
        [string]$Title,
        [string]$Clause,
        [string]$EbaDisplay,
        [string]$RelPath   # e.g. ebas/allied-health/appendices/1-list-of-employers
    )

    $normPath = $RelPath -replace '\\','/'

    # ── Shared helper: strip the trailing ": <anything>" suffix that
    #    VitePress front matter titles often include, e.g.
    #    "Appendix 2 - Wage Rates: Allied Health EBA"  →  "Appendix 2 - Wage Rates"
    #    Then append " - EbaDisplay"
    function Strip-EbaSuffix {
        param([string]$raw)
        # Remove everything from the last colon onward (": Allied Health EBA" etc.)
        $stripped = $raw -replace '\s*:.*$', ''
        return $stripped.Trim()
    }

    # ── Appendix ──────────────────────────────
    if ($normPath -match '/appendices/') {
        $pageTitle = if ($Title) { Strip-EbaSuffix $Title } else {
            # Fallback: humanise slug
            $slug = ($normPath -split '/')[-1]
            ($slug -replace '^\d+[A-Za-z]?-', '') -replace '-', ' '
        }
        return "$pageTitle - $EbaDisplay"
    }

    # ── Schedule ──────────────────────────────
    if ($normPath -match '/schedules/') {
        $pageTitle = if ($Title) { Strip-EbaSuffix $Title } else {
            $slug = ($normPath -split '/')[-1]
            ($slug -replace '^[\w]+-', '') -replace '-', ' '
        }
        return "$pageTitle - $EbaDisplay"
    }

    # ── Regular clause page ──────────────────
    $pageTitle = if ($Title) { $Title } else { 'Untitled' }
    if ($Clause) {
        return "$pageTitle (cl. $Clause) - $EbaDisplay"
    } else {
        return "$pageTitle - $EbaDisplay"
    }
}

# ─────────────────────────────────────────────
# MAIN: Collect all pages with their topics
# ─────────────────────────────────────────────
Write-Host "Scanning EBA markdown files under: $ebas_root" -ForegroundColor Cyan

$allFiles = Get-ChildItem -Path $ebas_root -Recurse -Filter '*.md' |
    Where-Object { $_.Name -ne 'index.md' }

Write-Host "  Found $($allFiles.Count) files." -ForegroundColor Cyan

# Master collection: topic → list of { EbaDisplay, Label, Url }
$topicMap = @{}

foreach ($file in $allFiles) {
    $fm = Get-FrontMatter -FilePath $file.FullName

    # Skip files with no topics
    if (-not $fm.ContainsKey('topics') -or -not $fm['topics']) { continue }

    # Build the /docs-relative URL  (forward slashes, no .md extension)
    $relFromDocs = $file.FullName.Substring($docsRoot.Length) `
        -replace '\\','/' `
        -replace '\.md$','' `
        -replace '^/',''

    # relFromDocs looks like: ebas/allied-health/wages/32-accident-pay

    # Determine the top-level EBA slug (segment index 1)
    $segments = $relFromDocs -split '/'
    $ebaSlug  = if ($segments.Count -ge 2) { $segments[1] } else { '' }
    $ebaDisplay = if ($ebaDisplayNames.ContainsKey($ebaSlug)) {
        $ebaDisplayNames[$ebaSlug]
    } else {
        # Fallback: title-case the slug
        ($ebaSlug -replace '-',' ') -replace '\b(\w)',{ $_.Value.ToUpper() }
    }

    $title  = if ($fm.ContainsKey('title'))  { $fm['title']  } else { '' }
    $clause = if ($fm.ContainsKey('clause')) { $fm['clause'] } else { '' }
    $url    = "/$relFromDocs/"

    $label = Get-LinkLabel -Title $title -Clause $clause `
                           -EbaDisplay $ebaDisplay -RelPath $relFromDocs

    # Each topic this page belongs to
    $topics = $fm['topics'] -split '\|'

    foreach ($topic in $topics) {
        $t = $topic.Trim()
        if (-not $t) { continue }

        if (-not $topicMap.ContainsKey($t)) {
            $topicMap[$t] = [System.Collections.Generic.List[hashtable]]::new()
        }
        $topicMap[$t].Add(@{
            EbaDisplay = $ebaDisplay
            Label      = $label
            Url        = $url
        })
    }
}

Write-Host "  Collected entries across $($topicMap.Keys.Count) topics." -ForegroundColor Cyan

# ─────────────────────────────────────────────
# BUILD OUTPUT MARKDOWN
# ─────────────────────────────────────────────
$sb = [System.Text.StringBuilder]::new()

$null = $sb.AppendLine('---')
$null = $sb.AppendLine('title: Topics')
$null = $sb.AppendLine('---')
$null = $sb.AppendLine('')
$null = $sb.AppendLine('# Browse by Topic')
$null = $sb.AppendLine('')
$null = $sb.AppendLine('Every clause is tagged with one or more topics from a controlled vocabulary. Use this page to see every clause across every EBA grouped by topic, then by EBA.')
$null = $sb.AppendLine('')

# Sort topics alphabetically
$sortedTopics = $topicMap.Keys | Sort-Object

foreach ($topic in $sortedTopics) {
    $null = $sb.AppendLine("## $topic")
    $null = $sb.AppendLine('')

    # Group entries by EBA, sort EBAs alphabetically
    $byEba = $topicMap[$topic] | Group-Object -Property EbaDisplay |
        Sort-Object -Property Name

    foreach ($ebaGroup in $byEba) {
        $null = $sb.AppendLine("### $($ebaGroup.Name)")
        $null = $sb.AppendLine('')

        # Sort pages alphabetically by label within each EBA
        $sortedPages = $ebaGroup.Group | Sort-Object -Property Label

        foreach ($page in $sortedPages) {
            $null = $sb.AppendLine("- [$($page.Label)]($($page.Url))")
        }
        $null = $sb.AppendLine('')
    }
}

# ─────────────────────────────────────────────
# WRITE OUTPUT FILE
# ─────────────────────────────────────────────
$content = $sb.ToString()
$content | Out-File -FilePath $outputFile -Encoding UTF8 -NoNewline

Write-Host ""
Write-Host "SUCCESS: topics.md written to:" -ForegroundColor Green
Write-Host "  $outputFile" -ForegroundColor Green
Write-Host ""
Write-Host "Topic count : $($sortedTopics.Count)" -ForegroundColor Yellow
Write-Host "Total entries : $(($topicMap.Values | ForEach-Object { $_.Count } | Measure-Object -Sum).Sum)" -ForegroundColor Yellow