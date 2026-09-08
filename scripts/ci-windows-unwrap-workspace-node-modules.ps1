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

foreach ($rel in $paths) {
    if (-not (Test-Path -LiteralPath $rel)) {
        continue
    }
    $item = Get-Item -LiteralPath $rel -Force
    Write-Host "Removing workspace node_modules link: $rel (LinkType=$($item.LinkType))"
    # rmdir removes a junction/symlink directory entry without deleting the target.
    cmd /c "rmdir `"$($item.FullName)`"" | Out-Null
    if (Test-Path -LiteralPath $rel) {
        Remove-Item -LiteralPath $rel -Recurse -Force -ErrorAction SilentlyContinue
    }
    if (Test-Path -LiteralPath $rel) {
        Write-Error "Failed to remove $rel"
        exit 1
    }
}

Write-Host "Windows workspace node_modules unwrap complete."
