# fix-topics.ps1
# Infers topic tags from filename and folder path, updates front matter on pages
# that have missing or empty topics: []

$ebsRoot = "C:\Projects\tebooth92.github.io\docs\ebas"

# Map keywords in filename/path to topic tags
$topicMap = [ordered]@{
  'annual-leave'            = 'annual-leave'
  'personal-leave'          = 'personal-leave'
  'parental-leave'          = 'parental-leave'
  'long-service-leave'      = 'long-service-leave'
  'purchased-leave'         = 'purchased-leave'
  'study-leave'             = 'study-leave'
  'ceremonial-leave'        = 'ceremonial-leave'
  'gender-affirmation'      = 'gender-affirmation-leave'
  'leave'                   = 'leave'
  'public-holiday'          = 'public-holidays'
  'public-hol'              = 'public-holidays'
  'overtime'                = 'overtime'
  'on-call'                 = 'on-call'
  'shift-work'              = 'shift-work'
  'shift-allowance'         = 'shift-allowances'
  'shift'                   = 'shift-work'
  'allowance'               = 'allowances'
  'higher-duties'           = 'higher-duties'
  'higher-qualif'           = 'higher-qualifications'
  'sole-allowance'          = 'allowances'
  'uniform'                 = 'uniforms'
  'laundry'                 = 'uniforms'
  'travel'                  = 'travel'
  'relocation'              = 'travel'
  'meal'                    = 'meal-allowance'
  'sleepover'               = 'allowances'
  'wage'                    = 'wages'
  'salary'                  = 'salary'
  'remuneration'            = 'remuneration'
  'pay-rate'                = 'pay-rates'
  'hourly-rate'             = 'hourly-rates'
  'penalty'                 = 'penalty-rates'
  'superannuation'          = 'superannuation'
  'salary-packag'           = 'salary-packaging'
  'top-of-band'             = 'top-of-band'
  'cash-payment'            = 'cash-payments'
  'hours-of-work'           = 'hours'
  'hours'                   = 'hours'
  'roster'                  = 'rosters'
  'break'                   = 'breaks'
  'workload'                = 'workload'
  'right-to-disconnect'     = 'right-to-disconnect'
  'flexible'                = 'flexible-work'
  'classification'          = 'classification'
  'staffing'                = 'staffing'
  'termination'             = 'termination'
  'redundan'                = 'redundancy'
  'casual-conver'           = 'casual-conversion'
  'employment'              = 'employment'
  'apprentice'              = 'apprentices'
  'consultation'            = 'consultation'
  'dispute'                 = 'disputes'
  'discipline'              = 'discipline'
  'discrimination'          = 'discrimination'
  'union'                   = 'union-matters'
  'delegate'                = 'delegates'
  'ohs'                     = 'ohs'
  'safe-patient'            = 'ohs'
  'workers-comp'            = 'workers-comp'
  'accident-pay'            = 'accident-pay'
  'accommodation'           = 'accommodation'
  'education'               = 'education-pd'
  'professional-dev'        = 'education-pd'
  'training'                = 'training'
  'governance'              = 'governance'
  'gendered-violence'       = 'gendered-violence'
  'childcare'               = 'childcare'
  'definition'              = 'definitions'
  'common-term'             = 'definitions'
  'preliminary'             = 'preliminary'
  'appendix'                = 'appendices'
  'appendices'              = 'appendices'
  'schedule'                = 'schedules'
}

$updated = 0
$skipped = 0

Get-ChildItem $ebsRoot -Recurse -Filter "*.md" | ForEach-Object {
  $file    = $_.FullName
  $content = Get-Content $file -Raw -Encoding UTF8

    # Skip only if topics already has real values (non-empty array)
    if ($content -match "topics:\s*\['") {
        $skipped++
        return
    }

  # Build topic list from filename + parent folder name
    $baseName = $_.BaseName -replace '^\d+[A-Za-z]?-', ''
  $nameParts = ($baseName + ' ' + $_.Directory.Name).ToLower()
  $tags = @()
  foreach ($keyword in $topicMap.Keys) {
    if ($nameParts -match [regex]::Escape($keyword)) {
      $tag = $topicMap[$keyword]
      if ($tags -notcontains $tag) { $tags += $tag }
    }
  }

  if ($tags.Count -eq 0) {
    $skipped++
    return
  }

  # Format as YAML array: ['tag1', 'tag2']
  $tagStr = "['$($tags -join "', '")']"

  # Update existing empty topics line or insert after eba line
  if ($content -match "topics:\s*\[\]") {
    $newContent = $content -replace "topics:\s*\[\]", "topics: $tagStr"
  } elseif ($content -match "topics:") {
    $newContent = $content -replace "topics:[^\n]*", "topics: $tagStr"
  } else {
    # Insert topics after eba: line
    $newContent = $content -replace "(eba:[^\n]*\n)", "`$1topics: $tagStr`n"
  }

  Set-Content $file -Value $newContent -Encoding UTF8 -NoNewline
  $updated++
}

Write-Host "Updated: $updated files"
Write-Host "Skipped: $skipped files (already had topics or no match found)"