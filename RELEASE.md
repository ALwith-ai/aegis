Aegis 0.2.4

- `aegis` calls DeepSeek Harness directly after the password: the prompt goes to dsh headless at once. The local rule scanner is gone.
- Language and prompt editing are menus: the language menu is preselected from the operating system and remembered; the main menu offers the investigation, editing the prompt, restoring the default prompt, or exit. The `--lang` flag and the `prompt` subcommand are removed.
- DeepSeek investigates the computer itself. The investigation prompt runs as a one-shot task on DeepSeek Harness (dsh headless): the model executes read-only commands inside a local sandbox, cites the exact commands and output, and writes the report. A full run on a developer Mac took about 15 minutes and 19 model steps; expect several minutes at least. The previous single-request summary is gone.
- The installer now also installs the dsh runtime (about 90 MB download, verified by SHA-256) into ~/.aegis/dsh, so the first scan does not download anything.
- The prompt is an editable file: `aegis prompt` opens it, `aegis prompt --show` prints it, `aegis prompt --reset` restores the built-in text. Plain `aegis` runs the scan with whatever is saved.
- The report directory holds what DeepSeek returned: `DeepSeek 排查报告.html` (extracted from the answer, scripts and external references removed) or `DeepSeek 排查报告.txt`, plus `run.json` with timing and step count.
- DeepSeek receives raw command output in this mode; see the README.
- macOS 15+ Apple Silicon / Intel and Windows x64. Chinese, English and Indonesian.

Existing installations: run the install command again once to add the runtime; the binary alone will download it on first scan.

macOS binaries are ad-hoc signed, not Apple-notarized; Windows binaries are unsigned. SHA256SUMS contains release hashes.
