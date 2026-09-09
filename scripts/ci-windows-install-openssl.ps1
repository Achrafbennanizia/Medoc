# Install OpenSSL for libsqlite3-sys `bundled-sqlcipher` on Windows GHA.
# Writes OPENSSL_DIR / OPENSSL_LIB_DIR / OPENSSL_INCLUDE_DIR to GITHUB_ENV
# without a UTF-8 BOM (PowerShell Out-File -Encoding utf8 can prepend BOM and
# break env key names so cargo still sees OPENSSL_DIR as unset).

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

# Also export into this process (and child steps via GITHUB_ENV).
$env:OPENSSL_DIR = $dir
$env:OPENSSL_LIB_DIR = $libDir
$env:OPENSSL_INCLUDE_DIR = $incDir

$lines = @(
    "OPENSSL_DIR=$dir"
    "OPENSSL_LIB_DIR=$libDir"
    "OPENSSL_INCLUDE_DIR=$incDir"
)

# ASCII append avoids BOM; GitHub Actions docs use shell redirection for this reason.
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
[System.IO.File]::AppendAllLines($env:GITHUB_ENV, $lines, $utf8NoBom)
$lines | ForEach-Object { Write-Host $_ }

if (Test-Path -LiteralPath $binDir) {
    [System.IO.File]::AppendAllText(
        $env:GITHUB_PATH,
        "$binDir$([Environment]::NewLine)",
        $utf8NoBom
    )
}

if (-not $env:OPENSSL_DIR) {
    throw "OPENSSL_DIR was not set after install"
}
if (-not (Test-Path -LiteralPath (Join-Path $env:OPENSSL_DIR "include\openssl\ssl.h"))) {
    throw "OPENSSL_DIR does not contain OpenSSL headers: $($env:OPENSSL_DIR)"
}

Write-Host "Windows OpenSSL ready for SQLCipher."
