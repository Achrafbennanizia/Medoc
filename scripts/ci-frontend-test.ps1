# Sequential Vitest: one project/file per process so GHA RSS stays bounded.
$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
Set-Location (Join-Path $root "apps\practice-host-ui")

function Invoke-VitestProject([string]$Project, [int]$HeapMb = 4096) {
    $env:NODE_OPTIONS = "--max-old-space-size=$HeapMb"
    Write-Host "::group::vitest project=$Project (heap=${HeapMb}m)"
    npx vitest run --project $Project --pool=forks --maxWorkers=1 --fileParallelism=false --no-watch
    if ($LASTEXITCODE -ne 0) {
        throw "vitest project=$Project failed with exit $LASTEXITCODE"
    }
    Write-Host "::endgroup::"
}

function Invoke-SmokePerFile {
    $env:NODE_OPTIONS = "--max-old-space-size=3072"
    Write-Host "::group::vitest project=smoke (per-file)"
    $files = @()
    $files += Get-ChildItem -Path "src" -Recurse -File -Filter "*.smoke.test.ts" -ErrorAction SilentlyContinue
    $files += Get-ChildItem -Path "src" -Recurse -File -Filter "*.smoke.test.tsx" -ErrorAction SilentlyContinue
    $files += Get-ChildItem -Path "..\..\packages" -Recurse -File -Filter "*.smoke.test.ts" -ErrorAction SilentlyContinue
    $files += Get-ChildItem -Path "..\..\packages" -Recurse -File -Filter "*.smoke.test.tsx" -ErrorAction SilentlyContinue
    $files = $files | Sort-Object -Property FullName -Unique
    if ($files.Count -eq 0) {
        throw "No smoke test files found"
    }
    $i = 0
    foreach ($f in $files) {
        $i++
        Write-Host "── smoke $i/$($files.Count): $($f.FullName)"
        npx vitest run --project smoke --pool=forks --maxWorkers=1 --fileParallelism=false --no-watch -- $f.FullName
        if ($LASTEXITCODE -ne 0) {
            throw "vitest smoke file failed: $($f.Name) (exit $LASTEXITCODE)"
        }
    }
    Write-Host "::endgroup::"
}

Invoke-VitestProject -Project "node" -HeapMb 4096
Invoke-SmokePerFile
Invoke-VitestProject -Project "mvp-unit" -HeapMb 4096
