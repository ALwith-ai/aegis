# Aegis

**Your terminal security guardian.** Mac / Windows · 中文 / English / Bahasa Indonesia

Aegis performs read-only local security checks, then has DeepSeek investigate the computer through DeepSeek Harness inside a read-only sandbox, and saves HTML reports with evidence and reproduction commands. It never runs inspected programs or automatically repairs the computer.

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

The installer downloads the Aegis binary and the DeepSeek Harness runtime (about 90 MB, both verified by SHA-256). Installation does not launch the scanner. After installation, run `aegis`. An access password is required; obtain it from your administrator. A full run takes several minutes to a quarter of an hour; the progress line shows the step count.

```sh
aegis --lang zh
aegis --lang en
aegis --lang id
aegis --local
aegis --update
aegis --no-auto-update
aegis prompt            # edit the investigation prompt; --show, --path, --reset
```

The installer configures the command automatically. If the installer asks you to reopen your terminal, do so once, then run `aegis`.

Aegis checks for updates at startup, verifies the release checksum and restarts into the new version. Network failures do not block the current version. Use `--no-auto-update` to skip, or set `autoUpdate: false` in configuration.

## Privacy and scope

After password authentication, the local scan runs first and its report is saved. DeepSeek then investigates the computer through DeepSeek Harness: it executes read-only commands inside a local sandbox (Seatbelt on macOS, restricted-token ACL on Windows) and receives their output, so process lists, file paths, user names, logs and similar data from your computer are sent to DeepSeek during that step. Nothing is modified; writes are refused by the sandbox. Use `--local` to skip DeepSeek entirely. The prompt that drives the investigation is a local file managed with `aegis prompt`.

Reports include `终端安全排查报告.html`, `evidence.json`, checksums and, when DeepSeek answers with a document, `DeepSeek 排查报告.html`. Treat local reports as sensitive.

This is an initial release, not a complete forensic or malware-detection product. Signature verification cannot establish software licensing. Missing history and log files alone do not prove deletion. Permission failures, timeouts and traversal limits are reported. No threat-intelligence/geolocation lookup, deleted-file recovery or cross-snapshot connection-duration analysis is performed. Full signature checks can take a long time; use `--signature-timeout 120` to bound each check.

macOS binaries are ad-hoc signed, not Apple-notarized; Windows binaries are not Authenticode signed. OS execution warnings may appear. Checksums are provided in every release.
