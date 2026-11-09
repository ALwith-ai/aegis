import { chmod, mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { join, resolve } from "node:path"
import { sha256 } from "./hash"
/** One owner-only directory per run under the output folder; it is also dsh's working directory. */
export async function createReportDirectory(output: string, started: string) {
  const parent = resolve(output)
  await mkdir(parent, { recursive: true, mode: 0o700 })
  const directory = await mkdtemp(join(parent, `aegis-${started.replace(/[:.]/g, "-")}-`))
  await chmod(directory, 0o700)
  return directory
}
/** Writes each file once (never overwrites) plus a SHA256SUMS manifest, owner-only. */
export async function writeReportFiles(directory: string, files: Record<string, string>) {
  for (const [name, content] of Object.entries(files)) await writeFile(join(directory, name), content, { flag: "wx", mode: 0o600 })
  await writeFile(join(directory, "SHA256SUMS"), Object.entries(files).map(([name, content]) => `${sha256(content)}  ${name}`).join("\n") + "\n", { flag: "wx", mode: 0o600 })
}
