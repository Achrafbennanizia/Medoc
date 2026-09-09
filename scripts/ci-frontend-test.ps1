# Sequential Vitest projects with a single worker — avoids multi-GB heap OOM on GHA.
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $root "apps\practice-host-ui")

if (-not $env:NODE_OPTIONS) {
    $env:NODE_OPTIONS = "--max-old-space-size=4096"
}

foreach ($project in @("node", "smoke", "mvp-unit")) {
    Write-Host "::group::vitest project=$project"
    npx vitest run --project $project --pool=forks --maxWorkers=1 --fileParallelism=false
    if ($LASTEXITCODE -ne 0) {
        throw "vitest project=$project failed with exit $LASTEXITCODE"
    }
    Write-Host "::endgroup::"
}
