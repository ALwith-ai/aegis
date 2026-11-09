import { expect, test } from "bun:test"
import { mkdtemp, writeFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
import { readCredential } from "../src/key"

test("credentials load from the user's local file and never expose malformed content", async () => {
  const dir = await mkdtemp(join(tmpdir(), "aegis-key-")), path = join(dir, "credentials.json")
  try {
    expect(readCredential(path)).toBe("")
    await writeFile(path, '\ufeff{"token":"fixture_personal_token"}', { mode: 0o600 })
    expect(readCredential(path)).toBe("fixture_personal_token")
    await writeFile(path, "invalid secret fixture_personal_token")
    expect(() => readCredential(path)).toThrow("Cannot read aegis credentials")
    try { readCredential(path) } catch (error) { expect(String(error)).not.toContain("fixture_personal_token") }
  } finally { await rm(dir, { recursive: true, force: true }) }
})

test("public build and workflow do not embed or fetch credentials", async () => {
  const build = await Bun.file(new URL("../scripts/build.ts", import.meta.url)).text()
  const workflow = await Bun.file(new URL("../.github/workflows/release.yml", import.meta.url)).text()
  expect(build).not.toContain("AEGIS_BUILTIN_KEY")
  expect(build).not.toContain("DEEPSEEK_API_KEY")
  expect(workflow).not.toContain("secrets.")
  expect(workflow).not.toContain("aegis-private")
})
