$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$temp = Join-Path ([IO.Path]::GetTempPath()) ('aegis-install-test-' + [Guid]::NewGuid())
New-Item -ItemType Directory -Path $temp | Out-Null
$oldProfile = $env:USERPROFILE; $oldLocal = $env:LOCALAPPDATA; $oldPath = $env:Path
$oldUserPath = [Environment]::GetEnvironmentVariable('Path', 'User')
try {
    $env:USERPROFILE = Join-Path $temp 'home'; $env:LOCALAPPDATA = Join-Path $temp 'local'
    $env:AEGIS_INSTALL_DIR = Join-Path $temp 'bin'
    $env:AEGIS_TOKEN = 'fixture_personal_token_0123456789'
    $runtime = Join-Path $env:USERPROFILE '.aegis\dsh\0.2.1rc2'
    New-Item -ItemType Directory -Force -Path $runtime | Out-Null
    Set-Content (Join-Path $runtime '.complete') '0.2.1rc2'
    $version = (Get-Content (Join-Path $root 'package.json') | ConvertFrom-Json).version
    function Invoke-RestMethod { param($Uri) return "v$version" }
    function curl.exe { $index = [Array]::IndexOf($args, '--output'); Copy-Item (Join-Path $root 'dist\aegis-windows-x64.exe') $args[$index + 1]; $global:LASTEXITCODE = 0 }
    function Invoke-WebRequest { param($Uri, $OutFile) $hash = (Get-FileHash (Join-Path $root 'dist\aegis-windows-x64.exe') -Algorithm SHA256).Hash.ToLower(); [IO.File]::WriteAllText($OutFile, "$hash  aegis-windows-x64.exe`n") }
    & (Join-Path $root 'install.ps1')
    Remove-Item Env:AEGIS_TOKEN
    $credential = Join-Path $env:USERPROFILE '.config\aegis\credentials.json'
    if ((Get-Content $credential | ConvertFrom-Json).token -ne 'fixture_personal_token_0123456789') { throw 'Credential not saved' }
    $env:AEGIS_CREDENTIALS = $credential
    & (Join-Path $env:AEGIS_INSTALL_DIR 'aegis.exe') --check-config
    if ($LASTEXITCODE -ne 0) { throw 'Persisted credential failed' }
    $acl = Get-Acl (Split-Path $credential -Parent)
    if (-not $acl.AreAccessRulesProtected) { throw 'Credential directory inherits permissions' }
    Write-Host 'Windows installation and persistent credential passed.'
} finally {
    $env:USERPROFILE = $oldProfile; $env:LOCALAPPDATA = $oldLocal; $env:Path = $oldPath
    [Environment]::SetEnvironmentVariable('Path', $oldUserPath, 'User')
    Remove-Item Env:AEGIS_TOKEN, Env:AEGIS_CREDENTIALS, Env:AEGIS_INSTALL_DIR -ErrorAction SilentlyContinue
    Remove-Item -LiteralPath $temp -Recurse -Force
}
