import { runEngine } from "./engine"
import { createHash } from "node:crypto"
import { chmod, mkdir, mkdtemp, rename, rm, stat, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join } from "node:path"

// DeepSeek Harness (dsh) one-shot runtime: DeepSeek's prebuilt native executable (deepseek-harness-runtime-bin on PyPI),
// repacked per platform and attached to the `dsh-runtime-<version>` release of the download repository. The installer
// places it under ~/.aegis/dsh/<version>; ensureRuntime only downloads when that step was skipped.
export const runtimeVersion = "0.2.1rc2"
type Asset = { name: string; sha256: string; prefix: string; files: string[] }
export const runtimeAssets: Record<string, Asset> = {
  "darwin-arm64": { name: `dsh-runtime-${runtimeVersion}-darwin-arm64.tar.gz`, sha256: "12f2fd9131360d94721c7efd60579446201e060a0242fe92608f8a4c5810640b", prefix: "deepseek-harness-sdk-runtime-macos-arm64", files: ["", "-rg", "-spawn-helper"] },
  "darwin-x64": { name: `dsh-runtime-${runtimeVersion}-darwin-x64.tar.gz`, sha256: "85df4d16ef90fe60834ba191fdea04b5bff58329e7a51456951adfc23e88395b", prefix: "deepseek-harness-sdk-runtime-macos-x64", files: ["", "-rg", "-spawn-helper"] },
  "win32-x64": { name: `dsh-runtime-${runtimeVersion}-windows-x64.tar.gz`, sha256: "d310717b3040f9b1f8de3ca40aa52e6be830a8759a1bbd73c98fdf5b2ef6d792", prefix: "deepseek-harness-sdk-runtime-win-x64", files: [".exe", "-rg.exe"] }
}
export const runtimeTag = `dsh-runtime-${runtimeVersion}`
export const platformKey = (platform = process.platform, arch = process.arch) => `${platform}-${arch}`
export const runtimeRoot = () => process.env.AEGIS_DSH_DIR || join(homedir(), ".aegis", "dsh")
const exists = (path: string) => stat(path).then(() => true, () => false)

/** Returns the runtime executable the installer placed; downloads and verifies it from the release only when missing. */
export async function ensureRuntime(repo: string, onProgress?: (received: number, total: number) => void): Promise<string> {
  if (process.env.AEGIS_DSH_RUNTIME) return process.env.AEGIS_DSH_RUNTIME
  const asset = runtimeAssets[platformKey()]
  if (!asset) throw new Error(`No dsh runtime for ${platformKey()}`)
  const directory = join(runtimeRoot(), runtimeVersion), main = join(directory, asset.prefix + asset.files[0])
  if (await exists(join(directory, ".complete")) && await exists(main)) return main
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo)) throw new Error("Invalid releaseRepo")
  await mkdir(directory, { recursive: true, mode: 0o700 })
  const archive = join(directory, ".download.tar.gz")
  const response = await fetch(`https://github.com/${repo}/releases/download/${runtimeTag}/${asset.name}`, { signal: AbortSignal.timeout(900000), redirect: "follow" })
  if (!response.ok || !response.body) throw new Error(`Runtime download HTTP ${response.status}`)
  const total = Number(response.headers.get("content-length")) || 0, hash = createHash("sha256")
  const writer = Bun.file(archive).writer()
  let received = 0
  try {
    for await (const chunk of response.body) { hash.update(chunk); writer.write(chunk); received += chunk.byteLength; onProgress?.(received, total) }
    await writer.end()
    if (hash.digest("hex") !== asset.sha256) throw new Error("Runtime checksum mismatch")
    const tar = Bun.spawn(["tar", "-xzf", archive, "-C", directory], { stdout: "ignore", stderr: "pipe" })
    const stderr = await new Response(tar.stderr).text()
    if (await tar.exited !== 0) throw new Error(`Runtime extraction failed: ${stderr.trim().slice(0, 300)}`)
    if (process.platform !== "win32") for (const suffix of asset.files) await chmod(join(directory, asset.prefix + suffix), 0o755)
    await writeFile(join(directory, ".complete"), runtimeVersion)
  } finally { await rm(archive, { force: true }) }
  return main
}

/** Profile overlay for `dsh --profile headless`: no persona beyond the task, pinned model, read-only tools, no delegation or network. */
export function patchText(model: string, platform = process.platform) {
  if (!/^[A-Za-z0-9._-]+$/.test(model)) throw new Error("Invalid model")
  return `# Aegis overlay: read-only security investigation.
${platform === "win32" ? "- id: session-persistence-jsonl\n  config:\n    compression: none\n" : ""}
- id: system-prompt
  config:
    personaPrefix: ''
- id: agent-default-model
  config:
    provider: deepseek-official
    model: ${model}
- id: tool-fs
  config:
    read: true
    readImage: false
    write: false
    edit: false
    applyPatch: false
- id: tool-web
  disabled: true
- id: tool-subagent
  disabled: true
- id: tool-subagent-fork
  disabled: true
- id: tool-subagent-control
  disabled: true
- id: tool-workflow
  disabled: true
- id: tool-goal
  disabled: true
- id: tool-jobs
  disabled: true
- id: tool-skill
  disabled: true
- id: approval
  config:
    policy: never
- id: permission
  config:
    presets:
      read-only:
        sandbox: read-only
        approval: never
      workspace-write:
        sandbox: workspace-write
        approval: ask
      danger-full-access:
        sandbox: danger-full-access
        approval: never
    defaultPreset: read-only
`
}

export const scrub = (text: string, key: string) => text.replaceAll(key, "<KEY>").replace(/\bsk-[A-Za-z0-9_-]{12,}/g, "<KEY>")
export function countSteps(stderr: string) { return stderr.split(/\r?\n/).filter(line => line.startsWith("dsh: reasoning")).length }

export type InvestigateOptions = {
  runtime: string; key: string; model: string; reportDir: string; task: string
  timeoutMs?: number; onProgress?: (steps: number, elapsedMs: number) => void
}
export type Investigation = { text: string; steps: number; elapsedMs: number; model: string }

/** Runs one headless dsh task against the local report directory and returns its final answer. */
export async function investigate(options: InvestigateOptions): Promise<Investigation> {
  const timeoutMs = options.timeoutMs ?? 1800000
  if (!options.task.trim()) throw new Error("Empty task")
  const runs = join(runtimeRoot(), "runs")
  await mkdir(runs, { recursive: true, mode: 0o700 })
  const home = await mkdtemp(join(runs, "run-"))
  await chmod(home, 0o700)
  // Retain each run's logs for diagnosis; never reuse, delete or migrate old session logs.
  const patch = join(home, "aegis.patch.yml")
  await writeFile(patch, patchText(options.model), { mode: 0o600 })
  const env: Record<string, string> = { DSH_HOME: home, DSH_PERMISSION_MODE: "read-only", DEEPSEEK_API_KEY: options.key, NO_COLOR: "1" }
  for (const name of ["PATH", "HOME", "USER", "LOGNAME", "SHELL", "TMPDIR", "LANG", "LC_ALL", "USERPROFILE", "HOMEDRIVE", "HOMEPATH", "APPDATA", "LOCALAPPDATA", "TEMP", "TMP", "SystemRoot", "SYSTEMROOT", "windir", "ComSpec", "PATHEXT", "ProgramFiles", "ProgramData", "PSModulePath"]) {
    const value = process.env[name]
    if (value) env[name] = value
  }
  const started = Date.now()
  let steps = 0, pending = ""
  const result = await runEngine({ executable: options.runtime, args: ["--profile", "headless", "--patch", patch, "-"],
    cwd: options.reportDir, env, input: options.task, timeoutMs,
    onStderr: (chunk) => {
      pending += chunk
      const lines = pending.split(/\r?\n/)
      pending = lines.pop()!.slice(-16384)
      for (const line of lines) if (line.startsWith("dsh: reasoning")) steps++
      options.onProgress?.(steps, Date.now() - started)
    }
  })
  const tail = scrub(result.stderr.split(/\r?\n/).filter(line => line && !line.startsWith("dsh: reasoning")).slice(-5).join("\n"), options.key)
  if (result.failure || result.code !== 0 || !result.stdout.trim()) {
    const failure = result.failure || (result.code !== 0 ? `dsh exit ${result.code}` : "dsh returned no answer")
    // Error diagnostics are local and redact the supplied key. Do not replay a partially completed scan automatically.
    await writeFile(join(home, "failure.json"), JSON.stringify({ failure: scrub(failure, options.key), stderr: scrub(result.stderr, options.key), steps, elapsedMs: Date.now() - started }, null, 2), { mode: 0o600 })
    if (result.stdout) await writeFile(join(home, "partial-output.txt"), scrub(result.stdout, options.key), { mode: 0o600 })
    throw new Error(`${scrub(failure, options.key)}; diagnostics: ${home}; ${tail.slice(0, 500)}`)
  }
  const text = scrub(result.stdout.trim(), options.key)
  return { text, steps, elapsedMs: Date.now() - started, model: options.model }
}

/** Finds the HTML document in an answer: bare, or inside a fenced block after prose (the sandbox refuses the model's own file write). */
export function extractHtml(text: string): { html: string; remainder: string } | undefined {
  const match = /<!doctype\s+html[\s\S]*?<\/html\s*>|<html[\s>][\s\S]*?<\/html\s*>/i.exec(text)
  if (!match) return undefined
  const before = text.slice(0, match.index).replace(/```\s*(html)?\s*$/i, ""), after = text.slice(match.index + match[0].length).replace(/^\s*```/, "")
  return { html: match[0], remainder: `${before.trim()}\n\n${after.trim()}`.trim() }
}
export const looksLikeHtml = (text: string) => extractHtml(text) !== undefined
/** Strips active content from a model-written HTML report so it opens as a plain local document. */
export function sanitizeHtml(html: string) {
  return declareUtf8(html
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, "").replace(/<script\b[^>]*>/gi, "")
    .replace(/<(iframe|object|embed|frame|frameset|applet|base|link|meta)\b[^>]*>(?:[\s\S]*?<\/\1\s*>)?/gi, "")
    .replace(/\s+on[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\s+(href|src|action|formaction|poster|data)\s*=\s*(?:"(?:javascript|data|vbscript|https?|ftp|file):[^"]*"|'(?:javascript|data|vbscript|https?|ftp|file):[^']*')/gi, "")
    .replace(/url\((?:"|')?\s*(?:javascript|data|https?|ftp|file):[^)]*\)/gi, "none")
    .replace(/@import\b[^;]*;?/gi, ""))
}
/** The sanitizer removes every <meta>, including the charset; without it Safari reads a local UTF-8 file as Latin-1 and Chinese turns into mojibake. */
export function declareUtf8(html: string) {
  const meta = '<meta charset="utf-8">'
  if (/<head\b[^>]*>/i.test(html)) return html.replace(/<head\b[^>]*>/i, (tag) => `${tag}${meta}`)
  if (/<html\b[^>]*>/i.test(html)) return html.replace(/<html\b[^>]*>/i, (tag) => `${tag}<head>${meta}</head>`)
  return `${meta}${html}`
}
