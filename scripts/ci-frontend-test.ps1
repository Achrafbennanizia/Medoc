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

function Test-IsAppMountSmoke([string]$FileName) {
    return $FileName -match '^(critical-flows-auth|g21-routing)\.smoke\.test\.tsx?$'
}

function Invoke-SmokeFile([System.IO.FileInfo]$File) {
    $env:NODE_OPTIONS = "--max-old-space-size=4096"
    if (Test-IsAppMountSmoke -FileName $File.Name) {
        # Full <App /> collect alone exceeds ~6GB — describe.skipIf still transforms the import.
        Write-Host "── smoke skip (App mount OOM on CI runners): $($File.Name)"
        return
    }
    Write-Host "── smoke: $($File.FullName)"
    npx vitest run --project smoke --pool=forks --maxWorkers=1 --fileParallelism=false --no-watch `
        --testTimeout=120000 -- $File.FullName
    if ($LASTEXITCODE -ne 0) {
        throw "vitest smoke file failed: $($File.Name) (exit $LASTEXITCODE)"
    }
}

function Invoke-SmokePerFile {
    Write-Host "::group::vitest project=smoke (per-file; App mounts skipped on CI)"
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
        Write-Host "── smoke file $i/$($files.Count)"
        Invoke-SmokeFile -File $f
    }
    Write-Host "::endgroup::"
}

Invoke-VitestProject -Project "node" -HeapMb 4096
Invoke-SmokePerFile
Invoke-VitestProject -Project "mvp-unit" -HeapMb 4096
