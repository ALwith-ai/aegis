Initial Aegis release: read-only terminal security checks, evidence-based local HTML reports, Chinese / English / Indonesian UI, and optional sanitized DeepSeek analysis through the official Anthropic SDK.

Download the binary for your OS, or use the one-command installer in the README. SHA256SUMS contains release hashes.

This release is an initial implementation with explicit coverage limitations. It does not guarantee absence of threats or recover deleted evidence. macOS binaries are ad-hoc signed, not Apple-notarized; Windows binaries are unsigned.

Source code remains private. No source or source maps are distributed by this repository.

Validation for this initial build: local type checking and 19 tests passed; DeepSeek SDK connectivity passed with synthetic input. macOS ARM64 and Intel binaries passed local startup smoke tests (Intel via Rosetta). Windows binary is cross-compiled and has not yet been runtime-tested. macOS 15-specific and Windows CI validation is pending because the organization Actions billing/spending limit prevented jobs from starting.
