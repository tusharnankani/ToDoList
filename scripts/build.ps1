<#
.SYNOPSIS
    Runs the tests and packages the app into dist/todolist-<version>.zip.
.PARAMETER SkipTests
    Package without installing dependencies or running the test suite.
#>
[CmdletBinding()]
param(
    [switch]$SkipTests
)

$ErrorActionPreference = 'Stop'

$root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
Set-Location $root

$version = (Get-Content (Join-Path $root 'package.json') -Raw | ConvertFrom-Json).version
if (-not $version) { throw 'No version found in package.json' }

function Invoke-Npm {
    param([string[]]$NpmArgs)
    & npm @NpmArgs
    if ($LASTEXITCODE -ne 0) { throw "npm $($NpmArgs -join ' ') failed with exit code $LASTEXITCODE" }
}

if (-not $SkipTests) {
    if (-not (Test-Path (Join-Path $root 'node_modules'))) {
        if (Test-Path (Join-Path $root 'package-lock.json')) { Invoke-Npm @('ci') } else { Invoke-Npm @('install') }
    }
    Invoke-Npm @('test')
}

$name = "todolist-$version"
$dist = Join-Path $root 'dist'
$stage = Join-Path $dist $name
$zipPath = Join-Path $dist "$name.zip"

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
if (Test-Path $zipPath) { Remove-Item $zipPath -Force }
New-Item -ItemType Directory -Path $stage -Force | Out-Null

$include = @(
    'index.html', 'JS', 'CSS', 'backend', 'db',
    'package.json', 'package-lock.json', 'README.md', 'LICENSE',
    'Dockerfile', 'docker-compose.yml', '.dockerignore'
)
foreach ($item in $include) {
    $source = Join-Path $root $item
    if (Test-Path $source) {
        Copy-Item $source -Destination $stage -Recurse -Force
    }
}
New-Item -ItemType Directory -Path (Join-Path $stage 'assets') -Force | Out-Null
Copy-Item (Join-Path $root 'assets\favicon.png') -Destination (Join-Path $stage 'assets') -Force

# Never ship a local database file.
Get-ChildItem (Join-Path $stage 'db') -Filter '*.sqlite*' -ErrorAction SilentlyContinue | Remove-Item -Force

# Build the zip by hand: Compress-Archive in Windows PowerShell 5.1 writes backslash entry names.
Add-Type -AssemblyName System.IO.Compression
Add-Type -AssemblyName System.IO.Compression.FileSystem
$stream = [System.IO.File]::Open($zipPath, [System.IO.FileMode]::Create)
try {
    $archive = New-Object System.IO.Compression.ZipArchive($stream, [System.IO.Compression.ZipArchiveMode]::Create)
    try {
        Get-ChildItem $stage -Recurse -File | ForEach-Object {
            $relative = $_.FullName.Substring($stage.Length).TrimStart('\', '/').Replace('\', '/')
            [void][System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
                $archive, $_.FullName, "$name/$relative", [System.IO.Compression.CompressionLevel]::Optimal)
        }
    } finally {
        $archive.Dispose()
    }
} finally {
    $stream.Dispose()
}

Remove-Item $stage -Recurse -Force
Write-Host "Created $zipPath"
