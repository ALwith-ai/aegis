import { spawn } from "node:child_process"

export type EngineOptions = {
  executable: string; args: string[]; cwd: string; env: Record<string, string>; input: string
  timeoutMs: number; onStderr?: (text: string) => void
}
export type EngineResult = { stdout: string; stderr: string; code: number | null; failure?: string }

// Match runtime session-storage failures, not incidental EBUSY text in inspected files.
export function sessionStorageFailure(text: string): boolean {
  return /(?:EBUSY|ERROR_SHARING_VIOLATION|sharing violation)/i.test(text)
    && /session[^\r\n]*\.jsonl(?:\.zstd)?|session-persistence-jsonl/i.test(text)
    && /(?:error|failed|fatal|uncaught)/i.test(text)
}

/** Supervise only the engine and subprocesses it owns; never target scanned processes. */
export function runEngine(options: EngineOptions): Promise<EngineResult> {
  return new Promise((resolve) => {
    const windows = process.platform === "win32"
    const child = spawn(options.executable, options.args, {
      cwd: options.cwd, env: options.env, windowsHide: true, detached: !windows,
      stdio: ["pipe", "pipe", "pipe"]
    })
    let stdout = "", stderr = "", outputBytes = 0, code: number | null = null
    let failure: string | undefined, settled = false, stopping = false
    let escalation: ReturnType<typeof setTimeout> | undefined
    let deadline: ReturnType<typeof setTimeout> | undefined
    let drain: ReturnType<typeof setTimeout> | undefined
    let killer: ReturnType<typeof spawn> | undefined
    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(timer); clearTimeout(escalation); clearTimeout(deadline); clearTimeout(drain)
      child.stdin.destroy(); child.stdout.destroy(); child.stderr.destroy()
      // A broken descendant may keep inherited pipes open. Do not keep the CLI alive for those pipes.
      child.unref()
      if (killer && killer.exitCode === null) { killer.kill(); killer.unref() }
      resolve({ stdout, stderr, code, failure })
    }
    const signal = (force: boolean) => {
      if (!child.pid) return
      try {
        if (windows) child.kill("SIGKILL")
        else process.kill(-child.pid, force ? "SIGKILL" : "SIGTERM")
      } catch { /* Process/group already exited. */ }
    }
    const stop = (reason: string) => {
      failure ??= reason
      if (stopping || settled) return
      stopping = true
      if (windows && child.pid) {
        // /PID scopes cleanup to this engine; /T includes only its descendants.
        killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" })
        killer.on("error", () => signal(true))
        killer.on("exit", (exit) => { if (exit !== 0) signal(true) })
      } else signal(false)
      escalation = setTimeout(() => signal(true), 1000)
      deadline = setTimeout(() => { signal(true); finish() }, 3000)
    }
    const timer = setTimeout(() => stop(`dsh timed out after ${Math.round(options.timeoutMs / 1000)} seconds`), options.timeoutMs)
    child.stdout.setEncoding("utf8")
    child.stderr.setEncoding("utf8")
    child.stdout.on("data", (chunk: string) => {
      outputBytes += Buffer.byteLength(chunk)
      if (outputBytes > 16 * 1024 * 1024) { stop("dsh report exceeded 16 MB"); return }
      stdout += chunk
    })
    child.stderr.on("data", (chunk: string) => {
      stderr = (stderr + chunk).slice(-65536)
      try { options.onStderr?.(chunk) } catch { stop("dsh progress handler failed") }
      if (sessionStorageFailure(stderr)) stop("dsh session log is busy (EBUSY); investigation interrupted")
    })
    child.on("error", (error) => { failure ??= `dsh failed to start: ${error.message}`; finish() })
    child.stdin.on("error", (error: NodeJS.ErrnoException) => {
      if (error.code !== "EPIPE") stop(`dsh input failed: ${error.message}`)
    })
    child.on("exit", (exit, signalName) => {
      code = exit
      if (signalName) failure ??= `dsh exited on ${signalName}`
      // Bound pipe draining even if a descendant inherited stdout/stderr.
      drain = setTimeout(() => {
        failure ??= "dsh exited but its output pipes did not close"
        signal(true)
        finish()
      }, 1000)
    })
    child.on("close", () => { if (stopping && !windows) signal(true); finish() })
    child.stdin.end(options.input)
  })
}
