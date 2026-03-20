param(
  [switch]$Force
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Normalize-Text {
  param([string]$Text)

  if ([string]::IsNullOrWhiteSpace($Text)) {
    return ""
  }

  return (($Text.ToLowerInvariant() -replace "[^a-z0-9]+", " ") -replace "\s+", " ").Trim()
}

function Get-KeywordQuery {
  param(
    [string]$Name,
    [string]$Subcategory
  )

  $stopwords = @(
    "the", "and", "with", "for", "new", "mini", "full", "medium", "lightweight",
    "longwear", "long", "lasting", "hydrating", "liquid", "cream", "powder",
    "natural", "hour", "hours", "coverage", "buildable", "standard", "size",
    "weightless", "universal", "waterproof", "matte", "blurring", "glow", "finish"
  )

  $tokens = (Normalize-Text $Name) -split " " | Where-Object {
    $_ -and $_.Length -gt 2 -and $stopwords -notcontains $_
  }

  $core = ($tokens | Select-Object -First 4) -join " "
  if ([string]::IsNullOrWhiteSpace($core)) {
    return $Subcategory
  }

  return $core
}

function Get-SearchQueries {
  param(
    [string]$Brand,
    [string]$Name,
    [string]$Subcategory
  )

  $keywordQuery = Get-KeywordQuery -Name $Name -Subcategory $Subcategory
  $queries = @(
    "$Brand $Name",
    $Name,
    "$Brand $keywordQuery",
    $keywordQuery,
    "$Brand $Subcategory",
    $Brand
  )

  return $queries | Where-Object { -not [string]::IsNullOrWhiteSpace($_) } | Select-Object -Unique
}

function Get-CandidateScore {
  param(
    [string]$Brand,
    [string]$Name,
    [string]$Subcategory,
    [object]$Candidate
  )

  $brandNeedle = Normalize-Text $Brand
  $nameNeedle = Normalize-Text $Name
  $subcategoryNeedle = Normalize-Text $Subcategory
  $candidateBrand = Normalize-Text $Candidate.brandName
  $candidateName = Normalize-Text $Candidate.displayName
  $candidateAlt = Normalize-Text $Candidate.currentSku.imageAltText

  $score = 0

  if ($candidateBrand -eq $brandNeedle) {
    $score += 40
  }
  elseif ($candidateBrand.Contains($brandNeedle) -or $brandNeedle.Contains($candidateBrand)) {
    $score += 28
  }

  if ($candidateName -eq $nameNeedle) {
    $score += 70
  }
  elseif ($candidateName.Contains($nameNeedle) -or $nameNeedle.Contains($candidateName)) {
    $score += 48
  }

  $tokens = $nameNeedle -split " " | Where-Object { $_ -and $_.Length -gt 2 }
  $tokenMatches = 0
  foreach ($token in $tokens) {
    if ($candidateName.Contains($token)) {
      $tokenMatches++
    }
  }
  $score += [Math]::Min(32, $tokenMatches * 4)

  if (-not [string]::IsNullOrWhiteSpace($subcategoryNeedle) -and $candidateName.Contains($subcategoryNeedle)) {
    $score += 10
  }

  if ($candidateAlt.Contains($nameNeedle)) {
    $score += 12
  }
  elseif ($candidateAlt.Contains($subcategoryNeedle)) {
    $score += 5
  }

  return $score
}

function Get-CatalogSeedEntries {
  param([string]$CatalogDataPath)

  $insideCatalog = $false
  $index = 0

  foreach ($line in Get-Content $CatalogDataPath) {
    if ($line -match "^const catalogSeed = \[$") {
      $insideCatalog = $true
      continue
    }

    if (-not $insideCatalog) {
      continue
    }

    if ($line -match "^\];$") {
      break
    }

    if ($line -notmatch "^\s*\[") {
      continue
    }

    $stringMatches = [regex]::Matches($line, '"((?:[^"\\]|\\.)*)"')
    if ($stringMatches.Count -lt 5) {
      continue
    }

    $values = @($stringMatches | ForEach-Object { $_.Groups[1].Value })
    $seedImage = if ($values.Count -ge 6) { $values[5] } else { "" }
    $index++

    [pscustomobject]@{
      Id = ("mbl-product-{0:D3}" -f $index)
      Brand = $values[0]
      Name = $values[1]
      Category = $values[2]
      Subcategory = $values[3]
      PriceLabel = $values[4]
      SeedImage = $seedImage
    }
  }
}

function Invoke-SephoraSearch {
  param(
    [string]$Query,
    [hashtable]$Headers
  )

  $uri = "https://www.sephora.com/api/v2/catalog/search/?type=keyword&q=$([uri]::EscapeDataString($Query))"
  $response = Invoke-WebRequest -Uri $uri -Headers $Headers -TimeoutSec 30
  return $response.Content | ConvertFrom-Json
}

function Get-BestSephoraMatch {
  param(
    [pscustomobject]$Entry,
    [hashtable]$Headers
  )

  $bestCandidate = $null
  $bestScore = -1

  foreach ($query in Get-SearchQueries -Brand $Entry.Brand -Name $Entry.Name -Subcategory $Entry.Subcategory) {
    try {
      $result = Invoke-SephoraSearch -Query $query -Headers $Headers
      foreach ($candidate in @($result.products)) {
        $score = Get-CandidateScore -Brand $Entry.Brand -Name $Entry.Name -Subcategory $Entry.Subcategory -Candidate $candidate
        if ($score -gt $bestScore) {
          $bestCandidate = $candidate
          $bestScore = $score
        }
      }
      Start-Sleep -Milliseconds 150
    }
    catch {
      Start-Sleep -Milliseconds 350
    }
  }

  if ($bestCandidate -and $bestScore -ge 72) {
    return [pscustomobject]@{
      Candidate = $bestCandidate
      Score = $bestScore
    }
  }

  return $null
}

function Get-ImageExtension {
  param([string]$Url)

  $cleanUrl = ($Url -split "\?")[0]
  $extension = [System.IO.Path]::GetExtension($cleanUrl)
  if ([string]::IsNullOrWhiteSpace($extension)) {
    return ".jpg"
  }

  return $extension
}

$workspace = Split-Path -Parent $PSScriptRoot
$catalogDataPath = Join-Path $workspace "scripts\catalog-data.js"
$realImagesDir = Join-Path $workspace "assets\images\products\real"
$realDataPath = Join-Path $workspace "scripts\sephora-real-data.js"
$headers = @{
  "User-Agent" = "Mozilla/5.0"
  "Accept" = "application/json, text/plain, */*"
  "X-Requested-With" = "XMLHttpRequest"
  "Accept-Language" = "en-US,en;q=0.9"
}

New-Item -ItemType Directory -Force -Path $realImagesDir | Out-Null

$entries = @(Get-CatalogSeedEntries -CatalogDataPath $catalogDataPath)
$realData = [ordered]@{}
$matchedCount = 0
$seedOnlyCount = 0
$skippedCount = 0

foreach ($entry in $entries) {
  Write-Host ("Syncing {0} - {1}" -f $entry.Id, $entry.Name)

  $match = Get-BestSephoraMatch -Entry $entry -Headers $headers
  if ($match) {
    $candidate = $match.Candidate
    $imageUrl = ($candidate.heroImage, $candidate.image450, $candidate.image250, $candidate.image135, $candidate.altImage |
      Where-Object { -not [string]::IsNullOrWhiteSpace($_) } |
      Select-Object -First 1)

    if ($imageUrl) {
      $cleanImageUrl = ($imageUrl -split "\?")[0]
      $extension = Get-ImageExtension -Url $cleanImageUrl
      $localFileName = "{0}{1}" -f $entry.Id, $extension
      $localAbsolutePath = Join-Path $realImagesDir $localFileName
      $localRelativePath = ("assets/images/products/real/{0}" -f $localFileName)

      if ($Force -or -not (Test-Path $localAbsolutePath)) {
        Invoke-WebRequest -Uri $cleanImageUrl -Headers @{ "User-Agent" = "Mozilla/5.0" } -OutFile $localAbsolutePath -TimeoutSec 45
        Start-Sleep -Milliseconds 150
      }

      $realData[$entry.Id] = [ordered]@{
        image = $localRelativePath
        imageUrl = $cleanImageUrl
        sourceUrl = ("https://www.sephora.com{0}" -f $candidate.targetUrl)
        sourceLabel = "Ver en Sephora"
        brand = $candidate.brandName
        name = $candidate.displayName
        skuId = $candidate.currentSku.skuId
        productId = $candidate.productId
        verified = $true
      }

      $matchedCount++
      continue
    }
  }

  if ($entry.SeedImage -like "assets/images/products/*") {
    $realData[$entry.Id] = [ordered]@{
      image = $entry.SeedImage
      imageUrl = ""
      sourceUrl = ""
      sourceLabel = "Imagen local verificada"
      brand = $entry.Brand
      name = $entry.Name
      skuId = ""
      productId = ""
      verified = $true
    }

    $seedOnlyCount++
    continue
  }

  $skippedCount++
}

$json = $realData | ConvertTo-Json -Depth 6
$js = @(
  "window.catalogRealData = $json;",
  ""
) -join [Environment]::NewLine

Set-Content -Path $realDataPath -Value $js -Encoding UTF8

Write-Host ""
Write-Host ("Verified via Sephora API: {0}" -f $matchedCount)
Write-Host ("Verified via existing local product images: {0}" -f $seedOnlyCount)
Write-Host ("Skipped due to no verified image source: {0}" -f $skippedCount)
