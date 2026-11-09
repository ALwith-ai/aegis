$ErrorActionPreference = 'Stop'
function Get-AegisDownload([string]$Uri, [string]$Destination) {
    & curl.exe --fail --location --progress-bar --retry 4 --retry-all-errors --retry-delay 1 --retry-max-time 300 --connect-timeout 15 --max-time 900 $Uri --output $Destination
    if ($LASTEXITCODE -ne 0) { throw 'Download failed after retries' }
}
if ([Environment]::Is64BitOperatingSystem -eq $false -or $env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { throw 'Windows x64 required' }
$repo = 'ALwith-ai/aegis'
$credentialsDir = Join-Path $env:USERPROFILE '.config\aegis'
$credentialsFile = Join-Path $credentialsDir 'credentials.json'
if ($env:AEGIS_TOKEN) {
    if ($env:AEGIS_TOKEN -notmatch '^[a-zA-Z0-9_-]+$') { throw 'Invalid AEGIS_TOKEN format' }
} elseif (-not (Test-Path -LiteralPath $credentialsFile)) { throw 'Pass your credential as AEGIS_TOKEN in the installation command.' }
$asset = 'aegis-windows-x64.exe'
$stage = Join-Path ([IO.Path]::GetTempPath()) ('aegis-' + [Guid]::NewGuid())
New-Item -ItemType Directory -Path $stage | Out-Null
try {
    Get-AegisDownload "https://github.com/$repo/releases/latest/download/VERSION" (Join-Path $stage 'VERSION')
    $tag = (Get-Content -Raw (Join-Path $stage 'VERSION')).Trim()
    if ($tag -notmatch '^v\d+\.\d+\.\d+$') { throw 'Invalid release' }
    $base = "https://github.com/$repo/releases/download/$tag"
    $file = Join-Path $stage $asset
    Get-AegisDownload "$base/$asset" $file
    Get-AegisDownload "$base/SHA256SUMS" (Join-Path $stage 'SHA256SUMS')
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
        Get-AegisDownload "$runtimeBase/$runtimeAsset" $runtimeFile
        Get-AegisDownload "$runtimeBase/SHA256SUMS" (Join-Path $stage 'RUNTIME_SHA256SUMS')
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
    if ($env:AEGIS_TOKEN) {
        New-Item -ItemType Directory -Force -Path $credentialsDir | Out-Null
        $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User
        $acl = New-Object Security.AccessControl.DirectorySecurity
        $acl.SetOwner($sid)
        $acl.SetAccessRuleProtection($true, $false)
        $rule = New-Object Security.AccessControl.FileSystemAccessRule($sid, 'FullControl', 'ContainerInherit,ObjectInherit', 'None', 'Allow')
        $acl.AddAccessRule($rule)
        Set-Acl -LiteralPath $credentialsDir -AclObject $acl
        $temporaryCredential = Join-Path $credentialsDir ('.credentials-' + [Guid]::NewGuid())
        $json = @{ token = $env:AEGIS_TOKEN } | ConvertTo-Json -Compress
        [IO.File]::WriteAllText($temporaryCredential, $json, [Text.UTF8Encoding]::new($false))
        Move-Item -LiteralPath $temporaryCredential -Destination $credentialsFile -Force
    }
    Write-Host 'Installed and configured. Run: aegis'
} finally { Remove-Item -LiteralPath $stage -Recurse -Force }
