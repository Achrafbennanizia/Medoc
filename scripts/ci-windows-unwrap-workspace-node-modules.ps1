# Removes per-workspace `node_modules` junctions/symlinks created by npm on Windows.
# Node's realpathSync often returns EPERM on those reparse points under GHA, which
# breaks `npm run -w …` lifecycle scripts (eslint/vitest/vite/tauri).
# Deleting the link keeps the root hoist; resolution walks up to repo `node_modules`.

$ErrorActionPreference = "Continue"

$paths = @(
    "apps/practice-host-ui/node_modules",
    "apps/practice-host/node_modules",
    "apps/lan-web-client/node_modules",
    "packages/shared/node_modules",
    "packages/ui/node_modules",
    "packages/app/practice-host/node_modules",
    "packages/server/lan/node_modules",
    "packages/server/company/node_modules"
)

function Remove-ReparseOrDir([string]$rel) {
    if (-not (Test-Path -LiteralPath $rel)) {
        return
    }
    $item = Get-Item -LiteralPath $rel -Force
    Write-Host "Removing workspace node_modules: $rel (LinkType=$($item.LinkType); Attributes=$($item.Attributes))"

    # Prefer deleting the reparse point itself (do not recurse into the hoist target).
    try {
        if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
            # Directory symlink / junction: Delete() removes the link entry only.
            $item.Delete()
        }
        else {
            Remove-Item -LiteralPath $rel -Recurse -Force -ErrorAction Stop
        }
    }
    catch {
        Write-Host "Primary delete failed ($($_.Exception.Message)); trying cmd rmdir / fallbacks"
        cmd.exe /c "rmdir `"$($item.FullName)`"" 2>$null | Out-Null
        if (Test-Path -LiteralPath $rel) {
            # Last resort: .NET API without following the link.
            [System.IO.Directory]::Delete($item.FullName, $false)
        }
    }

    if (Test-Path -LiteralPath $rel) {
        throw "Failed to remove $rel"
    }
}

foreach ($rel in $paths) {
    Remove-ReparseOrDir $rel
}

Write-Host "Windows workspace node_modules unwrap complete."
# Native `cmd` failures must not fail the GHA step after a successful unwrap.
exit 0
