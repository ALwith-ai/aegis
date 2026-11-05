Aegis 0.1.3

- Run `aegis`, enter the access password, and scanning, sanitized DeepSeek analysis and local reporting proceed automatically. No action menus or repeated confirmations.
- Automatic startup updates, with download progress.
- Installer shows a download progress bar and configures the command path. Installation never launches a scan.
- Removed the ASCII shield; retained gradient AEGIS lettering.
- macOS 15+ Apple Silicon / Intel and Windows x64. Chinese, English and Indonesian.

Raw evidence stays local. Use `--local` to skip DeepSeek. Source remains private; this repository distributes binaries and installers only.

Validation: type checking and 21 tests passed. macOS ARM64 and Intel executable startup checked locally. The previous 0.1.2 build passed macOS 15 ARM64, macOS 15 Intel and Windows x64 CI; these 0.1.3 binaries are cross-compiled locally.

macOS binaries are ad-hoc signed, not Apple-notarized; Windows binaries are unsigned. SHA256SUMS contains release hashes.
