aegis v0.3.3

- Releases carry the executables gzip-compressed, which the installers and the updater unpack with what the system already has. The macOS ARM64 download goes from 41 MB to about 19 MB.
- Versions up to 0.3.2 look for the uncompressed file and cannot update themselves to this release. Run the one-line installation command once; the saved credential is kept.

aegis v0.3.2

- Remove the parts of the Bun runtime the program never calls, and forbid generating code from strings at run time. The macOS ARM64 executable goes from 60 MB to 41 MB.

aegis v0.3.1

- Build the macOS and Windows executables ahead of time with Bun to reduce download size.

aegis v0.3.0

- One public repository for source, CI and downloads; no cross-repository release credentials.
- One-line installation and local credential configuration using AEGIS_TOKEN. No embedded credential and no yup password.
- Run aegis to start immediately; automatic language detection, optional --lang and prompt-edit commands.
- Per-run engine directories; Windows uncompressed session logs; bounded cleanup on session-log sharing failures and timeouts. Diagnostic files are retained, and failed scans are not automatically replayed.
- Direct Release downloads and update checks avoid GitHub REST API shared-IP rate limits.
- Includes the revised evidence-first investigation prompt and Windows packaging sources from v0.2.7.

Platforms: macOS 15+ ARM64 / Intel x64, Windows x64. macOS is ad-hoc signed (not notarized); Windows is unsigned. DLP-specific file-lock behavior still requires validation on affected company devices.

Older installations must reinstall once with AEGIS_TOKEN to configure a personal credential. Custom prompts remain untouched; use aegis --reset-prompt to adopt the revised built-in prompt.
