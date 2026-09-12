param(
  [ValidateSet('Debug','Release')]
  [string]$Configuration = 'Release',
  [ValidateSet('arm64-v8a','x86_64')]
  [string]$Architecture = 'arm64-v8a'
)

$ErrorActionPreference = 'Stop'
$mobileRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$resolvedBuild = Join-Path 'C:\' ('sfa-' + [Guid]::NewGuid().ToString('N').Substring(0, 8))
New-Item -ItemType Directory -Path $resolvedBuild | Out-Null

$excluded = @('node_modules', 'android', 'ios', '.expo', '.expo-export-check', 'release')
Get-ChildItem -LiteralPath $mobileRoot -Force | Where-Object { $excluded -notcontains $_.Name } | ForEach-Object {
  Copy-Item -LiteralPath $_.FullName -Destination $resolvedBuild -Recurse -Force
}

Push-Location $resolvedBuild
try {
  & npm.cmd ci
  if ($LASTEXITCODE -ne 0) { throw 'npm ci 失败' }

  $env:NODE_ENV = 'production'
  & npx.cmd expo prebuild --platform android --clean --no-install
  if ($LASTEXITCODE -ne 0) { throw 'Expo Android 预构建失败' }

  $jdkCandidates = @(
    $env:JAVA_HOME,
    'D:\Software\Android Studio\jbr',
    'C:\Program Files\Eclipse Adoptium\jdk-17.0.20.101-hotspot'
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
  $jdk = $jdkCandidates | Select-Object -First 1
  if (-not $jdk) { throw '未找到 JDK 17；优先检查 D:\Software\Android Studio\jbr 或 JAVA_HOME' }
  $sdkCandidates = @(
    $env:ANDROID_HOME,
    $env:ANDROID_SDK_ROOT,
    (Join-Path $env:LOCALAPPDATA 'Android\Sdk')
  ) | Where-Object { $_ -and (Test-Path -LiteralPath $_) }
  $androidSdk = $sdkCandidates | Select-Object -First 1
  if (-not $androidSdk) { throw '未找到 Android SDK；请设置 ANDROID_HOME' }
  $env:JAVA_HOME = $jdk
  $env:ANDROID_HOME = $androidSdk
  $env:ANDROID_SDK_ROOT = $androidSdk

  Push-Location (Join-Path $resolvedBuild 'android')
  try {
    $gradleTask = 'assemble' + $Configuration
    & .\gradlew.bat $gradleTask "-PreactNativeArchitectures=$Architecture" --no-parallel --max-workers=1
    if ($LASTEXITCODE -ne 0) { throw 'Gradle APK 构建失败' }
  } finally {
    Pop-Location
  }

  $variant = $Configuration.ToLowerInvariant()
  $builtApk = Join-Path $resolvedBuild "android\app\build\outputs\apk\$variant\app-$variant.apk"
  if (-not (Test-Path -LiteralPath $builtApk)) { throw "未找到构建产物：$builtApk" }
  $releaseRoot = Join-Path $mobileRoot 'release'
  New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null
  Get-ChildItem -LiteralPath $releaseRoot -File -ErrorAction SilentlyContinue | Where-Object { $_.Extension -in '.apk', '.sha256' } | Remove-Item -Force
  $outputApk = Join-Path $releaseRoot "SalaryFlow-Android-0.2.0-preview-$Architecture.apk"
  Copy-Item -LiteralPath $builtApk -Destination $outputApk -Force
  $hash = (Get-FileHash -LiteralPath $outputApk -Algorithm SHA256).Hash
  "$hash  $(Split-Path -Leaf $outputApk)" | Set-Content -LiteralPath "$outputApk.sha256" -Encoding ascii
  Write-Output "APK: $outputApk"
  Write-Output "SHA256: $hash"
} finally {
  Pop-Location
}
