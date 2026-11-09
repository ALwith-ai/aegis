import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { join } from "node:path"

export const credentialPath = () => process.env.AEGIS_CREDENTIALS || join(homedir(), ".config", "aegis", "credentials.json")
export function readCredential(path = credentialPath()): string {
  try {
    const value = JSON.parse(readFileSync(path, "utf8").replace(/^\uFEFF/, ""))
    return typeof value?.token === "string" ? value.token.trim() : ""
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return ""
    throw new Error("Cannot read aegis credentials; rerun the installer with AEGIS_TOKEN")
  }
}
// Never embed a shared credential. Environment overrides the per-user local file.
export const currentKey = () => process.env.AEGIS_TOKEN?.trim() || readCredential()
export const hasKey = () => Boolean(currentKey())
