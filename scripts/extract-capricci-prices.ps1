param([Parameter(Mandatory=$true)][string]$WorkbookPath)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$appRoot = Split-Path -Parent $PSScriptRoot
$reference = Get-Content -Raw -LiteralPath (Join-Path $appRoot 'app/data/capricci-finance-20260901.json') | ConvertFrom-Json
$beforeHash = (Get-FileHash -LiteralPath $WorkbookPath).Hash.ToLowerInvariant()
# A re-saved XLSX may have a different package hash. Validate every code/menu
# coordinate against the existing reference before accepting price evidence.
$archive = [System.IO.Compression.ZipFile]::OpenRead($WorkbookPath)
try {
  function Read-PriceXml([string]$entry) {
    $reader = [System.IO.StreamReader]::new($archive.GetEntry($entry).Open())
    try { return [xml]$reader.ReadToEnd() } finally { $reader.Dispose() }
  }
  $book = Read-PriceXml 'xl/workbook.xml'
  $relations = Read-PriceXml 'xl/_rels/workbook.xml.rels'
  $shared = Read-PriceXml 'xl/sharedStrings.xml'
  $strings = @($shared.sst.si | ForEach-Object { $_.InnerText })
  $sheet = $book.workbook.sheets.sheet | Where-Object { $_.name -eq 'Category' }
  $relId = $sheet.GetAttribute('id','http://schemas.openxmlformats.org/officeDocument/2006/relationships')
  $target = ($relations.Relationships.Relationship | Where-Object { $_.Id -eq $relId }).Target
  $entryPath = if ($target.StartsWith('/')) { $target.TrimStart('/') } else { 'xl/' + $target }
  $xml = Read-PriceXml $entryPath
  $cells = @{}
  foreach ($row in $xml.worksheet.sheetData.row) { foreach ($cell in $row.c) { $cells[[string]$cell.r] = $cell } }
  function Cell-Text([string]$address) {
    $cell = $cells[$address]
    if ($null -eq $cell) { return $null }
    if ($cell.t -eq 's') { return $strings[[int]$cell.v] }
    if ($cell.t -eq 'inlineStr') { return $cell.is.InnerText }
    return $cell.v
  }
  if ((Cell-Text 'F3') -ne 'Code' -or (Cell-Text 'I3') -ne 'Selling Price') { throw 'Unexpected Category price/code headers' }
  $rows = @($reference.mapping | ForEach-Object {
    $sourceRow = $_.sourceRow
    $code = Cell-Text "F$sourceRow"
    if ($code -ne $_.itemCode) { throw "ItemCode mismatch at F$sourceRow" }
    $menu = Cell-Text "G$sourceRow"
    if (([string]$menu).Trim() -ne ([string]$_.menu).Trim()) { throw "Menu mismatch at G$sourceRow" }
    $address = "I$sourceRow"
    $raw = Cell-Text $address
    $numeric = 0.0
    $valid = $null -ne $raw -and $cells[$address].t -ne 'e' -and [double]::TryParse([string]$raw, [System.Globalization.NumberStyles]::Number, [System.Globalization.CultureInfo]::InvariantCulture, [ref]$numeric) -and [double]::IsFinite($numeric) -and $numeric -ge 0
    [pscustomobject][ordered]@{ itemCode = [string]$code; sourceRow = [int]$sourceRow; menu = $_.menu; cell = $address; price = $(if ($valid) { $numeric } else { $null }); rawPrice = $raw; formula = $(if ($cells[$address].f -is [System.Xml.XmlElement]) { $cells[$address].f.InnerText } else { $cells[$address].f }) }
  })
} finally { $archive.Dispose() }
if ((Get-FileHash -LiteralPath $WorkbookPath).Hash.ToLowerInvariant() -ne $beforeHash) { throw 'Reference changed while extracting' }
$payload = [ordered]@{
  source = [ordered]@{ filename = [System.IO.Path]::GetFileName($WorkbookPath); sha256 = $beforeHash; mappingReferenceSha256 = $reference.source.sha256; verifiedCodeMenuRows = $rows.Count; sheet = 'Category'; codeColumn = 'F'; menuColumn = 'G'; priceColumn = 'I'; headerCell = 'I3'; currency = 'THB' }
  rows = $rows
}
# Generated evidence only; never save, edit, or recalculate the workbook.
[System.IO.File]::WriteAllText((Join-Path $appRoot 'app/data/capricci-menu-prices.json'), ($payload | ConvertTo-Json -Depth 7) + "`n", [System.Text.UTF8Encoding]::new($false))
$firstRows = @($rows | Group-Object itemCode | ForEach-Object { $_.Group[0] })
[ordered]@{ mappingRows = $rows.Count; uniqueCodes = $firstRows.Count; numericPrices = @($firstRows | Where-Object { $null -ne $_.price }).Count; missingPrices = @($firstRows | Where-Object { $null -eq $_.price }).Count; formulaPrices = @($rows | Where-Object { $_.formula }).Count; samples = @($rows | Select-Object -First 3); duplicatePriceConflicts = @($rows | Group-Object itemCode | Where-Object { @($_.Group.price | Select-Object -Unique).Count -gt 1 } | Select-Object -ExpandProperty Name) } | ConvertTo-Json -Depth 5
