# Install OpenSSL for libsqlite3-sys `bundled-sqlcipher` on Windows GHA.
# Writes OPENSSL_DIR / OPENSSL_LIB_DIR / OPENSSL_INCLUDE_DIR to GITHUB_ENV.

$ErrorActionPreference = "Stop"

if (-not $env:VCPKG_INSTALLATION_ROOT) {
    throw "VCPKG_INSTALLATION_ROOT is not set (expected on windows-latest runners)"
}

Write-Host "Installing openssl:x64-windows via vcpkg..."
& vcpkg install openssl:x64-windows
if ($LASTEXITCODE -ne 0) {
    throw "vcpkg install openssl:x64-windows failed with exit $LASTEXITCODE"
}

$dir = Join-Path $env:VCPKG_INSTALLATION_ROOT "installed\x64-windows"
$header = Join-Path $dir "include\openssl\ssl.h"
if (-not (Test-Path -LiteralPath $header)) {
    throw "OpenSSL headers not found at $header"
}

$libDir = Join-Path $dir "lib"
$incDir = Join-Path $dir "include"
$binDir = Join-Path $dir "bin"

@(
    "OPENSSL_DIR=$dir"
    "OPENSSL_LIB_DIR=$libDir"
    "OPENSSL_INCLUDE_DIR=$incDir"
) | ForEach-Object {
    $_ | Out-File -FilePath $env:GITHUB_ENV -Append -Encoding utf8
    Write-Host $_
}

if (Test-Path -LiteralPath $binDir) {
    "PATH=$binDir;$env:PATH" | Out-File -FilePath $env:GITHUB_PATH -Append -Encoding utf8
}

Write-Host "Windows OpenSSL ready for SQLCipher."
