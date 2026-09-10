# Sequential Vitest: one project/file (or test) per process so GHA RSS stays bounded.
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

function Get-HeavySmokeTestNames([string]$FileName) {
    switch -Regex ($FileName) {
        '^critical-flows-auth\.smoke\.test\.tsx?$' {
            return @(
                "signs in, shows dashboard greeting, signs out",
                "surfaces the backend error message and keeps the user on the login screen"
            )
        }
        '^g21-routing\.smoke\.test\.tsx?$' {
            return @(
                "RECEPTION can open Practice-Tickets (integrated practice tasks) without access denied"
            )
        }
        default { return @() }
    }
}

function Invoke-SmokeFile([System.IO.FileInfo]$File) {
    # 6144 leaves headroom on 7GB GHA Windows runners (process peaked ~3GB before OOM at 3072).
    $env:NODE_OPTIONS = "--max-old-space-size=6144"
    $names = @(Get-HeavySmokeTestNames -FileName $File.Name)

    if ($names.Count -gt 0) {
        $n = 0
        foreach ($name in $names) {
            $n++
            Write-Host "── smoke heavy $n/$($names.Count): $($File.Name) :: $name"
            npx vitest run --project smoke --pool=forks --maxWorkers=1 --fileParallelism=false --no-watch `
                --testTimeout=120000 -t "$name" -- $File.FullName
            if ($LASTEXITCODE -ne 0) {
                throw "vitest smoke test failed: $($File.Name) / $name (exit $LASTEXITCODE)"
            }
        }
    }
    else {
        Write-Host "── smoke: $($File.FullName)"
        npx vitest run --project smoke --pool=forks --maxWorkers=1 --fileParallelism=false --no-watch `
            --testTimeout=120000 -- $File.FullName
        if ($LASTEXITCODE -ne 0) {
            throw "vitest smoke file failed: $($File.Name) (exit $LASTEXITCODE)"
        }
    }
}

function Invoke-SmokePerFile {
    Write-Host "::group::vitest project=smoke (per-file / per-test for App mounts)"
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
