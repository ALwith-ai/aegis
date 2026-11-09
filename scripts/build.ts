import { chmod, mkdir, writeFile } from "node:fs/promises"
import { join } from "node:path"
import pkg from "../package.json"
import { runtimeVersion } from "../src/dsh"
const allowed = ["bun-darwin-arm64", "bun-darwin-x64", "bun-windows-x64-baseline"] as const
const requested = process.argv[2] || (process.platform === "win32" ? "bun-windows-x64-baseline" : `bun-darwin-${process.arch}`)
if (!allowed.includes(requested as typeof allowed[number])) throw new Error("Unsupported build target")
const target = requested as typeof allowed[number]
const name = target.replace("bun-", "aegis-").replace("-baseline", "") + (target.includes("windows") ? ".exe" : "")
await mkdir("dist", { recursive: true })
const result = await Bun.build({ entrypoints: ["./main.ts"], compile: { target, outfile: join("dist", name) }, minify: true })
if (!result.success) throw new Error("Build failed")
if (process.platform === "darwin" && target.startsWith("bun-darwin-")) {
  const metadata = Bun.spawnSync(["/usr/bin/otool", "-l", join("dist", name)])
  const minimum = metadata.stdout.toString().match(/\bminos\s+(\d+(?:\.\d+)?)/)?.[1]
  if (metadata.exitCode !== 0 || !minimum || Number(minimum) > 15) {
    throw new Error("Build requires macOS newer than 15. Rebuild with the official Bun release runtime, not a locally compiled Homebrew runtime.")
  }
}
await chmod(join("dist", name), 0o755)
if (target.includes("windows")) {
  // Keep installer metadata paired with the executable produced by this build.
  await writeFile(join("dist", "installer-versions.iss"), `#define AppVersion "${pkg.version}"\n#define RuntimeVersion "${runtimeVersion}"\n`)
}
console.log(`Built ${name}; no embedded credentials`)
