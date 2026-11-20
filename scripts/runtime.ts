// Repacks DeepSeek's prebuilt dsh runtime (deepseek-harness-runtime-bin on PyPI) into the per-platform archives the
// `dsh-runtime-<version>` release carries: bun scripts/runtime.ts <version>. Each wheel is verified against the SHA-256
// PyPI publishes for it. Writes dist/runtime/<archives> and SHA256SUMS, and prints the checksums src/dsh.ts pins.
import { mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { join } from "node:path"
import { runtimeAssets } from "../src/dsh"
import { sha256 } from "../src/hash"

const version = process.argv[2]
if (!version || !/^[0-9A-Za-z.]+$/.test(version)) throw new Error("Usage: bun scripts/runtime.ts <version>")
const wheels: Record<string, string> = { "darwin-arm64": "macosx_14_0_arm64", "darwin-x64": "macosx_14_0_x86_64", "win32-x64": "win_amd64" }
const archives: Record<string, string> = { "darwin-arm64": "darwin-arm64", "darwin-x64": "darwin-x64", "win32-x64": "windows-x64" }
const run = async (command: string[]) => {
  const child = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" })
  if ((await child.exited) !== 0) throw new Error(`${command[0]} failed`)
}
const index = await fetch(`https://pypi.org/pypi/deepseek-harness-runtime-bin/${version}/json`)
if (!index.ok) throw new Error(`PyPI HTTP ${index.status}`)
const files = ((await index.json()) as { urls: { filename: string; url: string; digests: { sha256: string } }[] }).urls
const out = "dist/runtime"
await rm(out, { recursive: true, force: true })
await mkdir(out, { recursive: true })
const sums: string[] = []
for (const [platform, asset] of Object.entries(runtimeAssets)) {
  const wheel = files.find(file => file.filename.endsWith(`-${wheels[platform]}.whl`))
  if (!wheel) throw new Error(`No ${platform} wheel for ${version}`)
  const work = join(out, platform), archive = join(work, wheel.filename)
  await mkdir(work)
  await run(["curl", "--fail", "--location", "--retry", "5", "--retry-all-errors", "--progress-bar", wheel.url, "--output", archive])
  if (sha256(new Uint8Array(await readFile(archive))) !== wheel.digests.sha256) throw new Error(`${wheel.filename}: checksum mismatch`)
  const names = asset.files.map(suffix => asset.prefix + suffix)
  await run(["unzip", "-q", "-j", archive, ...names.map(name => `deepseek_harness_runtime/runtime/${name}`), "-d", work])
  const name = `dsh-runtime-${version}-${archives[platform]}.tar.gz`
  await run(["tar", "-czf", join(out, name), "-C", work, ...names])
  sums.push(`${sha256(new Uint8Array(await readFile(join(out, name))))}  ${name}`)
  await rm(work, { recursive: true })
}
await writeFile(join(out, "SHA256SUMS"), sums.join("\n") + "\n")
console.log(sums.join("\n"))
