# Build medoc-keygen on Windows (requires cmake + vcpkg libsodium).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Src = Join-Path $Root "installer\medoc-keygen"
$Build = Join-Path $Src "build"

if (-not $env:VCPKG_ROOT) {
    Write-Error "Set VCPKG_ROOT and install libsodium: vcpkg install libsodium:x64-windows"
}

$Toolchain = Join-Path $env:VCPKG_ROOT "scripts\buildsystems\vcpkg.cmake"
cmake -S $Src -B $Build -DCMAKE_TOOLCHAIN_FILE=$Toolchain
cmake --build $Build --config Release

$Out = Join-Path $Root "installer\dist"
New-Item -ItemType Directory -Force -Path $Out | Out-Null
Copy-Item (Join-Path $Build "Release\medoc-keygen.exe") (Join-Path $Out "medoc-keygen-windows-x86_64.exe")
Copy-Item (Join-Path $Build "Release\medoc-keygen-verify.exe") (Join-Path $Out "medoc-keygen-verify-windows-x86_64.exe")
Write-Host "Built installer\dist\medoc-keygen-windows-x86_64.exe"
