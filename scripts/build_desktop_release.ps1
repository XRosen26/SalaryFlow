param()

$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$buildRoot = Join-Path ([IO.Path]::GetTempPath()) ('SalaryFlowDesktopBuild-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $buildRoot | Out-Null

$excluded = @('.git', '.cache', '.local', 'dist', 'mobile', 'node_modules', 'release', 'test-results')
Get-ChildItem -LiteralPath $projectRoot -Force | Where-Object { $excluded -notcontains $_.Name } | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination $buildRoot -Recurse -Force
}

Push-Location $buildRoot
try {
  & npm.cmd ci
  if ($LASTEXITCODE -ne 0) { throw 'npm ci failed' }

  $env:ELECTRON_BUILDER_CACHE = Join-Path $buildRoot '.cache\electron-builder'
  & npm.cmd run dist
  if ($LASTEXITCODE -ne 0) { throw 'Windows package build failed' }

  $builtRelease = Join-Path $buildRoot 'release'
  $setup = Get-ChildItem -LiteralPath $builtRelease -File -Filter 'SalaryFlow-Setup-*.exe' | Select-Object -First 1
  $portable = Get-ChildItem -LiteralPath $builtRelease -File -Filter 'SalaryFlow-Portable-*.exe' | Select-Object -First 1
  if (-not $setup -or -not $portable) { throw 'Missing installer or portable artifact' }

  $releaseRoot = Join-Path $projectRoot 'release'
  $resolvedRelease = [IO.Path]::GetFullPath($releaseRoot).TrimEnd('\')
  $expectedRelease = [IO.Path]::GetFullPath((Join-Path $projectRoot 'release')).TrimEnd('\')
  if (-not $resolvedRelease.Equals($expectedRelease, [StringComparison]::OrdinalIgnoreCase)) {
    throw "Unexpected release path: $resolvedRelease"
  }
  if (Test-Path -LiteralPath $resolvedRelease) {
    Remove-Item -LiteralPath $resolvedRelease -Recurse -Force
  }
  New-Item -ItemType Directory -Path $resolvedRelease | Out-Null

  Copy-Item -LiteralPath $setup.FullName -Destination (Join-Path $resolvedRelease $setup.Name)
  Copy-Item -LiteralPath $portable.FullName -Destination (Join-Path $resolvedRelease $portable.Name)
  $hashLines = Get-ChildItem -LiteralPath $resolvedRelease -File -Filter '*.exe' | Sort-Object Name | ForEach-Object {
    "{0}  {1}" -f (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash, $_.Name
  }
  $hashLines | Set-Content -LiteralPath (Join-Path $resolvedRelease 'SHA256SUMS.txt') -Encoding ascii
  Write-Output "Temporary build directory: $buildRoot"
  Get-ChildItem -LiteralPath $resolvedRelease -File | Select-Object Name, Length, LastWriteTime
} finally {
  Pop-Location
}
