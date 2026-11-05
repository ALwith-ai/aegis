$ErrorActionPreference = 'Stop'
if ([Environment]::Is64BitOperatingSystem -eq $false -or $env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { throw 'Windows x64 required' }
$repo = 'alwith-ai/aegis'
$asset = 'aegis-windows-x64.exe'
$stage = Join-Path ([IO.Path]::GetTempPath()) ('aegis-' + [Guid]::NewGuid())
New-Item -ItemType Directory -Path $stage | Out-Null
try {
    $release = Invoke-RestMethod "https://api.github.com/repos/$repo/releases/latest"
    if ($release.tag_name -notmatch '^v\d+\.\d+\.\d+$') { throw 'Invalid release' }
    $base = "https://github.com/$repo/releases/download/$($release.tag_name)"
    $file = Join-Path $stage $asset
    & curl.exe --fail --location --progress-bar "$base/$asset" --output $file
    if ($LASTEXITCODE -ne 0) { throw 'Download failed' }
    Invoke-WebRequest "$base/SHA256SUMS" -OutFile (Join-Path $stage 'SHA256SUMS')
    $line = Get-Content (Join-Path $stage 'SHA256SUMS') | Where-Object { $_ -match "\s+$([regex]::Escape($asset))$" }
    if (-not $line) { throw 'Checksum absent' }
    $expected = ($line -split '\s+')[0]
    if ((Get-FileHash $file -Algorithm SHA256).Hash.ToLower() -ne $expected.ToLower()) { throw 'Checksum mismatch' }
    $installDir = if ($env:AEGIS_INSTALL_DIR) { $env:AEGIS_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA 'Programs\Aegis' }
    New-Item -ItemType Directory -Force -Path $installDir | Out-Null
    Move-Item $file (Join-Path $installDir 'aegis.exe') -Force
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    if (($userPath -split ';') -notcontains $installDir) { [Environment]::SetEnvironmentVariable('Path', "$installDir;$userPath", 'User') }
    $env:Path = "$installDir;$env:Path"
    Write-Host 'Installed. Run: aegis'
} finally { Remove-Item -LiteralPath $stage -Recurse -Force }
