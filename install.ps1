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
    # DeepSeek Harness runtime (the investigation engine): pinned release tag, SHA256SUMS, tar.exe extraction.
    $runtimeVersion = '0.2.1rc2'
    $runtimeDir = Join-Path $env:USERPROFILE ".aegis\dsh\$runtimeVersion"
    if (-not (Test-Path (Join-Path $runtimeDir '.complete'))) {
        $runtimeAsset = "dsh-runtime-$runtimeVersion-windows-x64.tar.gz"
        $runtimeBase = "https://github.com/$repo/releases/download/dsh-runtime-$runtimeVersion"
        $runtimeFile = Join-Path $stage $runtimeAsset
        & curl.exe --fail --location --progress-bar "$runtimeBase/$runtimeAsset" --output $runtimeFile
        if ($LASTEXITCODE -ne 0) { throw 'Runtime download failed' }
        Invoke-WebRequest "$runtimeBase/SHA256SUMS" -OutFile (Join-Path $stage 'RUNTIME_SHA256SUMS')
        $runtimeLine = Get-Content (Join-Path $stage 'RUNTIME_SHA256SUMS') | Where-Object { $_ -match "\s+$([regex]::Escape($runtimeAsset))$" }
        if (-not $runtimeLine) { throw 'Runtime checksum absent' }
        if ((Get-FileHash $runtimeFile -Algorithm SHA256).Hash.ToLower() -ne (($runtimeLine -split '\s+')[0]).ToLower()) { throw 'Runtime checksum mismatch' }
        New-Item -ItemType Directory -Force -Path $runtimeDir | Out-Null
        & tar.exe -xzf $runtimeFile -C $runtimeDir
        if ($LASTEXITCODE -ne 0) { throw 'Runtime extraction failed' }
        Set-Content -Path (Join-Path $runtimeDir '.complete') -Value $runtimeVersion -NoNewline
    }
    $installDir = if ($env:AEGIS_INSTALL_DIR) { $env:AEGIS_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA 'Programs\Aegis' }
    New-Item -ItemType Directory -Force -Path $installDir | Out-Null
    Move-Item $file (Join-Path $installDir 'aegis.exe') -Force
    $userPath = [Environment]::GetEnvironmentVariable('Path', 'User')
    if (($userPath -split ';') -notcontains $installDir) { [Environment]::SetEnvironmentVariable('Path', "$installDir;$userPath", 'User') }
    $env:Path = "$installDir;$env:Path"
    Write-Host 'Installed. Run: aegis'
} finally { Remove-Item -LiteralPath $stage -Recurse -Force }
