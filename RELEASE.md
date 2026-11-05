Aegis 0.2.2

- DeepSeek now investigates the computer itself. The investigation prompt runs as a one-shot task on DeepSeek Harness (dsh headless): the model executes read-only commands inside a local sandbox, cites the exact commands and output, and writes the report. A full run on a developer Mac took about 15 minutes and 19 model steps; expect several minutes at least. The previous single-request summary is gone.
- The installer now also installs the dsh runtime (about 90 MB download, verified by SHA-256) into ~/.aegis/dsh, so the first scan does not download anything.
- The prompt is an editable file: `aegis prompt` opens it, `aegis prompt --show` prints it, `aegis prompt --reset` restores the built-in text. Plain `aegis` runs the scan with whatever is saved.
- The HTML report the model returns (bare or inside a code block, since the sandbox refuses its own file write) is extracted, stripped of scripts and external references, and saved beside the local report as a separate file. 0.2.1 only recognised bare HTML.
- DeepSeek receives raw command output in this mode; see the README. `--local` still skips DeepSeek entirely.
- macOS 15+ Apple Silicon / Intel and Windows x64. Chinese, English and Indonesian.

Existing installations: run the install command again once to add the runtime; the binary alone will download it on first scan.

macOS binaries are ad-hoc signed, not Apple-notarized; Windows binaries are unsigned. SHA256SUMS contains release hashes.
