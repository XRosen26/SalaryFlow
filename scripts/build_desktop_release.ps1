param()

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$releaseRoot = Join-Path $projectRoot 'release'
$resolvedRelease = [IO.Path]::GetFullPath($releaseRoot).TrimEnd('\')
$expectedRelease = [IO.Path]::GetFullPath((Join-Path $projectRoot 'release')).TrimEnd('\')
if (-not $resolvedRelease.Equals($expectedRelease, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Unexpected release path: $resolvedRelease"
}

Push-Location $projectRoot
try {
  if (Test-Path -LiteralPath $resolvedRelease) {
    Remove-Item -LiteralPath $resolvedRelease -Recurse -Force
  }
  $env:ELECTRON_BUILDER_CACHE = Join-Path $projectRoot '.local\electron-builder-cache'
  & npm.cmd run dist
  if ($LASTEXITCODE -ne 0) { throw 'Windows package build failed' }

  $setup = Get-ChildItem -LiteralPath $releaseRoot -File -Filter 'SalaryFlow-Setup-*.exe' | Select-Object -First 1
  $portable = Get-ChildItem -LiteralPath $releaseRoot -File -Filter 'SalaryFlow-Portable-*.exe' | Select-Object -First 1
  if (-not $setup -or -not $portable) { throw 'Missing installer or portable artifact' }

  $hashLines = Get-ChildItem -LiteralPath $releaseRoot -File -Filter '*.exe' | Sort-Object Name | ForEach-Object {
    "{0}  {1}" -f (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash, $_.Name
  }
  $hashLines | Set-Content -LiteralPath (Join-Path $releaseRoot 'SHA256SUMS.txt') -Encoding ascii
  Get-ChildItem -LiteralPath $releaseRoot -File | Select-Object Name, Length, LastWriteTime
} finally {
  Pop-Location
}
