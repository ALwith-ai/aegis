# Aegis

**Your terminal security guardian.** Mac / Windows · 中文 / English / Bahasa Indonesia

Aegis performs read-only local security checks and creates an HTML report with evidence and reproduction commands. It never runs inspected programs or automatically repairs the computer.

This repository distributes binaries and installers only. Application source code is private; public availability of binaries does not make the software open source.

## Install

macOS 15+ (Apple Silicon / Intel):

```sh
curl -fsSL https://raw.githubusercontent.com/alwith-ai/aegis/main/install.sh | sh
```

Windows x64 (PowerShell):

```powershell
irm https://raw.githubusercontent.com/alwith-ai/aegis/main/install.ps1 | iex
```

Run `~/.local/bin/aegis` on macOS, or `aegis` on Windows. An access password is required; obtain it from your administrator.

```sh
aegis --lang zh
aegis --lang en
aegis --lang id
aegis --local
aegis --update
```

If `aegis` is not on your Mac PATH, use the full path printed by the installer. The installer does not change your shell files.

## Privacy and scope

Raw processes, history, logs and file content remain local. Before optional DeepSeek analysis, Aegis asks permission and allows preview of the exact sanitized payload. Only local rule IDs, risk levels, evidence references, timestamps, opaque target IDs and signature status are sent. No raw command lines, usernames, hostnames, IPs, filenames, history, logs or keys are included. Analysis uses the Anthropic SDK directly against DeepSeek, without local AI CLIs.

Reports include `终端安全排查报告.html`, `evidence.json`, checksums and, when sent, `ai-payload.json`. Treat local reports as sensitive.

This is an initial release, not a complete forensic or malware-detection product. Signature verification cannot establish software licensing. Missing history and log files alone do not prove deletion. Permission failures, timeouts and traversal limits are reported. No threat-intelligence/geolocation lookup, deleted-file recovery or cross-snapshot connection-duration analysis is performed. Full signature checks can take a long time; use `--signature-timeout 120` to bound each check.

macOS binaries are ad-hoc signed, not Apple-notarized; Windows binaries are not Authenticode signed. OS execution warnings may appear. Checksums are provided in every release.
