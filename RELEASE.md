aegis v0.3.0

- One public repository for source, CI and downloads; no cross-repository release credentials.
- One-line installation and local credential configuration using AEGIS_TOKEN. No embedded credential and no yup password.
- Run aegis to start immediately; automatic language detection, optional --lang and prompt-edit commands.
- Per-run engine directories; Windows uncompressed session logs; bounded cleanup on session-log sharing failures and timeouts. Diagnostic files are retained, and failed scans are not automatically replayed.
- Direct Release downloads and update checks avoid GitHub REST API shared-IP rate limits.
- Includes the revised evidence-first investigation prompt and Windows packaging sources from v0.2.7.

Platforms: macOS 15+ ARM64 / Intel x64, Windows x64. macOS is ad-hoc signed (not notarized); Windows is unsigned. DLP-specific file-lock behavior still requires validation on affected company devices.

Older installations must reinstall once with AEGIS_TOKEN to configure a personal credential. Custom prompts remain untouched; use aegis --reset-prompt to adopt the revised built-in prompt.
