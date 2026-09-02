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

# Binaries are placed in the build root or in subdirectories depending on CMake version
$KeygenExe = Join-Path $Build "Release\medoc-keygen.exe"
if (-not (Test-Path $KeygenExe)) {
    $KeygenExe = Join-Path $Build "medoc-keygen.exe"
}
$KeygenVerifyExe = Join-Path $Build "Release\medoc-keygen-verify.exe"
if (-not (Test-Path $KeygenVerifyExe)) {
    $KeygenVerifyExe = Join-Path $Build "medoc-keygen-verify.exe"
}

if (-not (Test-Path $KeygenExe)) {
    Write-Error "medoc-keygen.exe not found in $Build or $Build/Release"
}
if (-not (Test-Path $KeygenVerifyExe)) {
    Write-Error "medoc-keygen-verify.exe not found in $Build or $Build/Release"
}

Copy-Item $KeygenExe (Join-Path $Out "medoc-keygen-windows-x86_64.exe")
Copy-Item $KeygenVerifyExe (Join-Path $Out "medoc-keygen-verify-windows-x86_64.exe")
Write-Host "Built installer\dist\medoc-keygen-windows-x86_64.exe"
