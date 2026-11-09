import { mkdtemp, writeFile, chmod, rename, rm } from "node:fs/promises"
import { dirname, join } from "node:path"
import pkg from "../package.json"
import { sha256 } from "./hash"
export function assetName(platform = process.platform, arch = process.arch) {
  if (platform === "darwin" && ["arm64", "x64"].includes(arch)) return `aegis-darwin-${arch}`
  if (platform === "win32" && arch === "x64") return "aegis-windows-x64.exe"
  throw new Error(`Unsupported platform: ${platform}/${arch}`)
}
export function verifyChecksum(bytes: Uint8Array, sums: string, name: string) {
  const match = sums.split(/\r?\n/).find(line => line.trim().split(/\s+/)[1] === name)?.split(/\s+/)[0]
  if (!match || !/^[a-f\d]{64}$/i.test(match) || sha256(bytes) !== match.toLowerCase()) throw new Error("Release checksum mismatch")
}
export const isCompiled = () => Bun.main.startsWith("/$bunfs/") || Bun.main.includes("~BUN")
export type UpdateResult = { status: "current" | "source" | "updated"; message: string }
export async function update(repo: string, checkTimeout = 20000, onProgress?: (received: number, total: number) => void): Promise<UpdateResult> {
  const info = await fetch(`https://github.com/${repo}/releases/latest/download/VERSION`, { signal: AbortSignal.timeout(checkTimeout) })
  if (!info.ok) throw new Error(`Release HTTP ${info.status}`)
  const tag = (await info.text()).trim()
  if (!/^v\d+\.\d+\.\d+$/.test(tag)) throw new Error("Invalid release version")
  const latest = tag.slice(1)
  if (Bun.semver.order(latest, pkg.version) <= 0) return { status: "current", message: `${pkg.version}: up to date` }
  if (!isCompiled()) return { status: "source", message: `Source run: ${pkg.version} → ${latest}; rebuild to update` }
  const asset = assetName(), base = `https://github.com/${repo}/releases/download/${tag}`
  // Read the small checksum file to completion inside its own timeout; its body must not wait behind the large download.
  const [file, sums] = await Promise.all([
    fetch(`${base}/${asset}`, { signal: AbortSignal.timeout(900000) }),
    fetch(`${base}/SHA256SUMS`, { signal: AbortSignal.timeout(20000) }).then(async response => { if (!response.ok) throw new Error(`Checksum HTTP ${response.status}`); return response.text() })
  ])
  if (!file.ok) throw new Error(`Release download HTTP ${file.status}`)
  if (!file.body) throw new Error("Empty release download")
  const total = Number(file.headers.get("content-length")) || 0
  const reader = file.body.getReader(), chunks: Uint8Array[] = []
  let received = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value); received += value.byteLength
    onProgress?.(received, total)
  }
  const bytes = new Uint8Array(received)
  let offset = 0
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
  verifyChecksum(bytes, sums, asset)
  const exe = process.execPath, directory = await mkdtemp(join(dirname(exe), ".aegis-update-")), staged = join(directory, "aegis")
  try {
    await writeFile(staged, bytes, { mode: 0o755, flag: "wx" }); await chmod(staged, 0o755)
    if (process.platform === "win32") {
      const backup = `${exe}.${Date.now()}.old`
      await rename(exe, backup)
      try { await rename(staged, exe) } catch (e) { await rename(backup, exe); throw e }
      return { status: "updated", message: `${pkg.version} → ${latest}; previous executable: ${backup}` }
    }
    await rename(staged, exe)
    return { status: "updated", message: `${pkg.version} → ${latest}` }
  } finally { await rm(directory, { recursive: true, force: true }) }
}
