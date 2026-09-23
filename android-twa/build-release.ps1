# Builds and signs the Medha Android app (Trusted Web Activity).
#
#   .\build-release.ps1
#
# Produces, in .\dist\:
#   medha-<version>.aab  -> upload this to Google Play
#   medha-<version>.apk  -> install on a phone for testing (adb install)
#
# The keystore password is prompted for by jarsigner/apksigner, or read from
# the MEDHA_KEYSTORE_PASSWORD environment variable if set (for CI). It is
# never stored in this repo. Signing lives here rather than in app/build.gradle
# because `bubblewrap update` regenerates app/build.gradle.
param(
  [string]$Keystore = ".\upload-keystore.jks",
  [string]$Alias = "upload",
  [string]$JdkHome = "E:\jdk-17",
  [string]$AndroidSdk = "$env:LOCALAPPDATA\Android\Sdk"
)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path $Keystore)) {
  throw "Keystore not found at $Keystore. See README.md -> 'Create the upload key'."
}

$env:JAVA_HOME = $JdkHome
$env:ANDROID_HOME = $AndroidSdk

& .\gradlew.bat --no-daemon bundleRelease assembleRelease
if ($LASTEXITCODE -ne 0) { throw "Gradle build failed" }

$version = (Get-Content .\twa-manifest.json -Raw | ConvertFrom-Json).appVersionName
New-Item -ItemType Directory -Force .\dist | Out-Null
$aab = ".\dist\medha-$version.aab"
$apk = ".\dist\medha-$version.apk"

$jarPass = @(); $apkPass = @()
if ($env:MEDHA_KEYSTORE_PASSWORD) {
  $jarPass = @("-storepass:env", "MEDHA_KEYSTORE_PASSWORD")
  $apkPass = @("--ks-pass", "env:MEDHA_KEYSTORE_PASSWORD")
}

# App bundle: signed with jarsigner, as Google Play expects for .aab uploads.
Copy-Item .\app\build\outputs\bundle\release\app-release.aab $aab -Force
& "$JdkHome\bin\jarsigner.exe" -keystore $Keystore -sigalg SHA256withRSA -digestalg SHA-256 @jarPass $aab $Alias
if ($LASTEXITCODE -ne 0) { throw "Signing the .aab failed" }

# APK: zipalign, then apksigner (v2+ signatures), for sideload testing.
$buildTools = Get-ChildItem "$AndroidSdk\build-tools" -Directory | Sort-Object { [version]($_.Name -replace '[^\d.].*$', '') } | Select-Object -Last 1
& "$($buildTools.FullName)\zipalign.exe" -f -p 4 .\app\build\outputs\apk\release\app-release-unsigned.apk $apk
if ($LASTEXITCODE -ne 0) { throw "zipalign failed" }
& "$($buildTools.FullName)\apksigner.bat" sign --ks $Keystore --ks-key-alias $Alias @apkPass $apk
if ($LASTEXITCODE -ne 0) { throw "Signing the .apk failed" }

Write-Host ""
Write-Host "Done:" -ForegroundColor Green
Write-Host "  $aab  (upload to Play Console)"
Write-Host "  $apk  (adb install for testing)"
