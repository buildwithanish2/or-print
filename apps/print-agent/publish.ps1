param(
  [string]$Version = "1.0.2",
  [string]$OutputDirectory = "apps/api/public/downloads"
)

$ErrorActionPreference = "Stop"
$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "../..")).Path
Set-Location $repoRoot

function Get-Sha256([string]$FilePath) {
  $stream = [System.IO.File]::OpenRead($FilePath)
  $sha = [System.Security.Cryptography.SHA256]::Create()
  try { return [System.BitConverter]::ToString($sha.ComputeHash($stream)).Replace('-', '').ToLowerInvariant() }
  finally { $stream.Dispose(); $sha.Dispose() }
}

if ($Version -notmatch '^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$') {
  throw "Version must be a semantic version such as 1.2.3."
}

$agentProject = "apps/print-agent/PrintQRAgent/PrintQRAgent.csproj"
$installerProject = "apps/print-agent/AnishNovaInstaller/AnishNovaInstaller.csproj"
$agentPublish = "apps/print-agent/PrintQRAgent/bin/Release/net8.0-windows/win-x64/publish/PrintQRAgent.exe"
$output = if ([System.IO.Path]::IsPathRooted($OutputDirectory)) { $OutputDirectory } else { Join-Path $repoRoot $OutputDirectory }
$output = [System.IO.Path]::GetFullPath($output)
New-Item -ItemType Directory -Force -Path $output | Out-Null

$publishArgs = @("publish", $agentProject, "-c", "Release", "-r", "win-x64", "--self-contained", "true", "-p:PublishSingleFile=true", "-p:IncludeNativeLibrariesForSelfExtract=true", "-p:EnableCompressionInSingleFile=true", "-p:Version=$Version")
& dotnet @publishArgs
if ($LASTEXITCODE -ne 0) { throw "Windows print agent publish failed with exit code $LASTEXITCODE." }
if (!(Test-Path -LiteralPath $agentPublish)) { throw "The published print agent payload is missing." }
$agentHash = Get-Sha256 $agentPublish

$installerArgs = @("publish", $installerProject, "-c", "Release", "-r", "win-x64", "--self-contained", "true", "-p:PublishSingleFile=true", "-p:IncludeNativeLibrariesForSelfExtract=true", "-p:EnableCompressionInSingleFile=true", "-p:Version=$Version", "-p:AgentPayloadSha256=$agentHash", "-o", $output)
& dotnet @installerArgs
if ($LASTEXITCODE -ne 0) { throw "Windows installer publish failed with exit code $LASTEXITCODE." }

$installer = Join-Path $output "AnishNovaPrintAgent-Setup.exe"
$binary = Join-Path $output "PrintQRAgent.exe"
if (!(Test-Path -LiteralPath $installer)) { throw "The installer publish did not produce the expected setup executable." }
Copy-Item -LiteralPath $agentPublish -Destination $binary -Force

foreach ($artifact in @($installer, $binary)) {
  $info = Get-Item -LiteralPath $artifact
  $stream = [System.IO.File]::OpenRead($artifact)
  try {
    if ($stream.ReadByte() -ne 0x4D -or $stream.ReadByte() -ne 0x5A) { throw "Artifact is not a Windows PE executable: $($info.Name)" }
  } finally { $stream.Dispose() }
  if ($info.Length -lt 1MB) { throw "Artifact is unexpectedly small: $($info.Name)" }
}

$versionedInstaller = Join-Path $output "AnishNovaPrintAgent-Setup-$Version.exe"
$versionedBinary = Join-Path $output "PrintQRAgent-$Version.exe"
Copy-Item -LiteralPath $installer -Destination $versionedInstaller -Force
Copy-Item -LiteralPath $binary -Destination $versionedBinary -Force

foreach ($artifactPath in @($installer, $binary)) {
  $fileVersion = [System.Diagnostics.FileVersionInfo]::GetVersionInfo($artifactPath).FileVersion
  if (!$fileVersion -or !$fileVersion.StartsWith("$Version.", [System.StringComparison]::Ordinal)) {
    throw "Artifact version does not match requested release ${Version}: $([System.IO.Path]::GetFileName($artifactPath))"
  }
}

$manifest = [ordered]@{
  latestVersion = $Version
  minimumSupportedVersion = $Version
  mandatory = $false
  releaseDate = (Get-Date).ToUniversalTime().ToString("yyyy-MM-dd")
  channel = "stable"
  releaseNotes = @("Windows x64 self-contained release.", "Verified installer payload and improved paired startup reliability.")
  installer = [ordered]@{ fileName = "AnishNovaPrintAgent-Setup.exe"; fileSize = (Get-Item $installer).Length; sha256 = (Get-Sha256 $installer) }
  binary = [ordered]@{ fileName = "PrintQRAgent.exe"; fileSize = (Get-Item $binary).Length; sha256 = (Get-Sha256 $binary) }
}
$manifestPath = Join-Path $output "agent-release.json"
$manifestTemporaryPath = "$manifestPath.tmp"
$manifest | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $manifestTemporaryPath -Encoding utf8
Move-Item -LiteralPath $manifestTemporaryPath -Destination $manifestPath -Force
Write-Host "Published AnishNova Print Agent $Version (win-x64)."
Write-Host "Installer: $installer ($((Get-Item $installer).Length) bytes, SHA256 $($manifest.installer.sha256))"
Write-Host "Agent: $binary ($((Get-Item $binary).Length) bytes, SHA256 $($manifest.binary.sha256))"
& node "apps/api/scripts/verify-agent-release.cjs" $Version $output
if ($LASTEXITCODE -ne 0) { throw "Print agent artifact verification failed with exit code $LASTEXITCODE." }
