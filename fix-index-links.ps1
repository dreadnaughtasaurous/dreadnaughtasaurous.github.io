# fix-index-links.ps1
# ─────────────────────────────────────────────────────────────────────────────
# WHAT THIS DOES:
#   Finds every category index .md file across all EBAs (e.g. allowances.md,
#   wages.md, leave.md, remuneration.md, application-operation.md, etc.)
#   and fixes their internal links to correctly point into the matching subfolder.
#
# HOW IT WORKS (dynamic discovery - no hardcoded category list):
#   For each .md file found under docs\ebas:
#     1. Check if a folder of the same base name exists alongside it
#     2. If yes, scan the file for bare links like [Text](slug/)
#     3. Prepend ./foldername/ to any link that doesn't already have a path prefix
#
# SAFE TO RE-RUN: Already-fixed links (starting with ./) are skipped.
# ─────────────────────────────────────────────────────────────────────────────

$docsRoot    = "C:\Projects\EBAdb\docs\ebas"
$filesFixed  = 0
$linksFixed  = 0
$filesSkipped = 0

Write-Host ""
Write-Host "========================================" -ForegroundColor White
Write-Host "  EBA Index Link Fixer" -ForegroundColor White
Write-Host "========================================" -ForegroundColor White
Write-Host ""

# Get every .md file under the ebas folder, excluding index.md files
# (index.md files don't link into subfolders this way)
$allMdFiles = Get-ChildItem -Path $docsRoot -Recurse -Filter "*.md" |
    Where-Object { $_.Name -ne "index.md" }

foreach ($file in $allMdFiles) {

    # Derive the expected sibling folder name from the .md filename
    # e.g. allowances.md → look for allowances\ in the same directory
    $siblingFolder = Join-Path $file.DirectoryName $file.BaseName

    # Only process files that have a matching sibling folder
    if (-not (Test-Path $siblingFolder -PathType Container)) {
        continue
    }

    # This is a category index file — read its lines
    $lines       = Get-Content $file.FullName -Encoding UTF8
    $newLines    = [System.Collections.Generic.List[string]]::new()
    $fileChanged = $false
    $prefix      = $file.BaseName   # e.g. "allowances", "wages", "remuneration"

    foreach ($line in $lines) {

        # Only target lines that look like markdown list links:
        #   - [Some Text](slug/)   or   - [Some Text](slug)
        # The slug must start with a word character (letter, digit)
        # meaning it has NO existing path prefix (no ./ or ../ or http)
        if ($line -match '^\s*-\s*\[.*\]\([A-Za-z0-9]') {

            # Prepend ./prefix/ to the link target
            # Regex: find ]( followed immediately by a word character
            $newLine = $line -replace '\]\(([A-Za-z0-9])', "](./$prefix/`$1"

            $newLines.Add($newLine)

            if ($newLine -ne $line) {
                $linksFixed++
                $fileChanged = $true
            }

        } else {
            $newLines.Add($line)
        }
    }

    if ($fileChanged) {
        # Write back with UTF-8 encoding (no BOM) to preserve file format
        [System.IO.File]::WriteAllLines($file.FullName, $newLines)
        Write-Host "  FIXED  : $($file.FullName)" -ForegroundColor Green
        $filesFixed++
    } else {
        Write-Host "  SKIPPED: $($file.FullName) (no bare links found)" -ForegroundColor DarkGray
        $filesSkipped++
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor White
Write-Host "  COMPLETE" -ForegroundColor Cyan
Write-Host "  Files modified : $filesFixed" -ForegroundColor Green
Write-Host "  Files skipped  : $filesSkipped" -ForegroundColor DarkGray
Write-Host "  Links fixed    : $linksFixed" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor White
Write-Host ""