import { expect, test } from "bun:test"
import { runEngine, sessionStorageFailure } from "../src/engine"

const run = (script: string, timeoutMs = 3000) => runEngine({ executable: process.execPath,
  args: ["-e", script], cwd: process.cwd(), env: { PATH: process.env.PATH || "", SystemRoot: process.env.SystemRoot || "" }, input: "test", timeoutMs })
const alive = (pid: number) => { try { process.kill(pid, 0); return true } catch { return false } }

test("engine collects stdout and stderr and reports nonzero exit", async () => {
  const result = await run('process.stdout.write("partial report");process.stderr.write("failure detail");process.exit(7)')
  expect(result.stdout).toBe("partial report")
  expect(result.stderr).toBe("failure detail")
  expect(result.code).toBe(7)
})

test("session-log EBUSY ends a hung engine and reaps its process", async () => {
  const result = await run('process.stdout.write(String(process.pid));process.stderr.write("Error: EBUSY opening session.v3.jsonl.zstd\\n");setInterval(()=>{},1000)')
  expect(result.failure).toContain("session log is busy")
  expect(result.stderr).toContain("EBUSY")
  expect(alive(Number(result.stdout))).toBe(false)
}, 10000)

test("timeout escalates even when the engine ignores graceful shutdown", async () => {
  const result = await run('process.stdout.write(String(process.pid));process.on("SIGTERM",()=>{});setInterval(()=>{},1000)', 500)
  expect(result.failure).toContain("timed out")
  expect(alive(Number(result.stdout))).toBe(false)
}, 10000)

test("an incidental locked file does not abort a successful investigation", async () => {
  expect(sessionStorageFailure("Error: EBUSY opening /tmp/other.db")).toBe(false)
  const result = await run('process.stderr.write("Error: EBUSY opening other.db");process.stdout.write("finished")')
  expect(result.failure).toBeUndefined()
  expect(result.stdout).toBe("finished")
  expect(result.code).toBe(0)
})

test("failed startup completes without a dangling timeout", async () => {
  const result = await runEngine({ executable: "/nonexistent/aegis-test-engine", args: [], cwd: process.cwd(), env: {}, input: "", timeoutMs: 30000 })
  expect(result.failure).toContain("failed to start")
})
