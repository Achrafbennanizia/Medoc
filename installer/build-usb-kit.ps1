# Package USB kit for Windows field deployment.
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

$Out = Join-Path $Root "installer\dist\usb-kit"
New-Item -ItemType Directory -Force -Path (Join-Path $Out "medoc-usb\payloads") | Out-Null

Write-Host "Building medoc-usb-setup..."
cargo build -p medoc-usb-setup --release

Write-Host "Building medoc-server..."
cargo build -p medoc-lan-server --release

$SetupBin = Join-Path $Root "target\release\medoc-usb-setup.exe"
$ServerBin = Join-Path $Root "target\release\medoc-server.exe"

Copy-Item $SetupBin (Join-Path $Out "MedocUsbSetup.exe") -Force
Copy-Item $ServerBin (Join-Path $Out "medoc-usb\payloads\medoc-server.exe") -Force

$BundleDir = Join-Path $Root "apps\practice-host\target\release\bundle"
if (Test-Path $BundleDir) {
    Get-ChildItem -Path $BundleDir -Recurse -Include *.exe,*.msi | ForEach-Object {
        Copy-Item $_.FullName (Join-Path $Out "medoc-usb\payloads\") -Force
    }
}

Write-Host "USB kit ready at $Out"
