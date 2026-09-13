param(
  [ValidateSet('Debug','Release')]
  [string]$Configuration = 'Release',
  [ValidateSet('arm64-v8a','x86_64')]
  [string]$Architecture = 'arm64-v8a'
)

$ErrorActionPreference = 'Stop'
$mobileRoot = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$androidRoot = Join-Path $mobileRoot 'android'

Push-Location $mobileRoot
try {
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

  Push-Location $androidRoot
  try {
    $gradleTask = 'assemble' + $Configuration
    & .\gradlew.bat $gradleTask "-PreactNativeArchitectures=$Architecture" --no-parallel --max-workers=1
    if ($LASTEXITCODE -ne 0) { throw 'Gradle APK 构建失败' }
  } finally {
    Pop-Location
  }

  $variant = $Configuration.ToLowerInvariant()
  $builtApk = Join-Path $androidRoot "app\build\outputs\apk\$variant\app-$variant.apk"
  if (-not (Test-Path -LiteralPath $builtApk)) { throw "未找到构建产物：$builtApk" }
  $releaseRoot = Join-Path $mobileRoot 'release'
  New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null
  Get-ChildItem -LiteralPath $releaseRoot -File -ErrorAction SilentlyContinue | Where-Object { $_.Extension -in '.apk', '.sha256' } | Remove-Item -Force
  $outputApk = Join-Path $releaseRoot "SalaryFlow-Android-0.4.0-preview-$Architecture.apk"
  Copy-Item -LiteralPath $builtApk -Destination $outputApk -Force
  $hash = (Get-FileHash -LiteralPath $outputApk -Algorithm SHA256).Hash
  "$hash  $(Split-Path -Leaf $outputApk)" | Set-Content -LiteralPath "$outputApk.sha256" -Encoding ascii
  Write-Output "APK: $outputApk"
  Write-Output "SHA256: $hash"
} finally {
  Pop-Location
}
