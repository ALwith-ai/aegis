# aegis

Read-only terminal security investigation for macOS 15+ (Apple Silicon / Intel) and Windows x64. 中文 · English · Bahasa Indonesia.

## Install and configure in one command

Replace `YOUR_TOKEN` with your own credential. Installation saves it locally and does not start an investigation.

macOS:

```sh
curl -fsSL https://raw.githubusercontent.com/ALwith-ai/aegis/main/install.sh | AEGIS_TOKEN='YOUR_TOKEN' sh
```

Windows PowerShell:

```powershell
$env:AEGIS_TOKEN='YOUR_TOKEN'; irm https://raw.githubusercontent.com/ALwith-ai/aegis/main/install.ps1 | iex
```

Then run `aegis`. No shared password or scan confirmation menu. The installer detects the Mac architecture and displays download progress. If a new shell path was needed, reopen the terminal once.

Credentials are saved in `~/.config/aegis/credentials.json`: mode 600 on macOS, a user-only directory ACL on Windows. `AEGIS_TOKEN` overrides the saved value. The one-line command can remain in your shell history; naming it TOKEN does not encrypt it. No credential is embedded in the executable or needed by CI. Reinstalling with a different token replaces the local credential. Keep credentials private.

## Use

```sh
aegis
aegis --lang zh
aegis --lang en
aegis --lang id
aegis --edit-prompt
aegis --reset-prompt
aegis --check-config
```

The system language is selected automatically. Custom prompts stay local. Existing installations can use `aegis --reset-prompt` to adopt the latest built-in investigation prompt. Startup checks for updates automatically; use `--no-auto-update` to skip. Install and update requests use direct Release assets, not the rate-limited GitHub REST API.

## What it does

Aegis runs DeepSeek Harness with a read-only sandbox to inspect processes, persistence, signatures and logs. The engine sends command output to DeepSeek to reason about the investigation. Reports are saved locally as HTML (or text if the engine returns no HTML), alongside `run.json`. It is an investigation tool, not a replacement for endpoint protection; it does not automatically disinfect, quarantine or remove threats.

Each investigation uses its own engine home under `~/.aegis/dsh/runs/`. Windows session logs use uncompressed JSONL. Session-log sharing errors, timeouts and child-process failures stop the investigation with a nonzero exit and retain local diagnostics. This reduces conflicts and bounds failures; it cannot guarantee that third-party DLP will never lock a file. It never disables DLP or deletes evidence. Timeout cleanup targets only the investigation engine and its own child processes.

macOS builds are ad-hoc signed, not Apple-notarized. Windows builds are unsigned. Company policy may require IT approval. Signature checks cannot prove that a software license is valid; inaccessible checks must be reported as unknown.

## Develop and release

```sh
bun install
bun link
aegis-dev
bun run check
bun test
```

Source, CI and Releases live in this repository. Push a `vX.Y.Z` tag matching `package.json` to build and test all three platforms, then publish with the repository's built-in GitHub token. No cross-repository token or API credential is required. Never commit `.env`, credentials, reports, runtime logs or binary build caches.

The bundled runtime assets are pinned to `dsh-runtime-0.2.1rc2` and checksum-verified. The upstream runtime's licenses remain applicable. GitHub Actions additionally tests the installer and local credential configuration on macOS and Windows.
