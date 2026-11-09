import { mkdir, writeFile } from "node:fs/promises"
import { homedir } from "node:os"
import { join, resolve, dirname } from "node:path"
import type { Language } from "./i18n"
export type Config = {
  autoUpdate: boolean
  releaseRepo: string
  language?: Language
  baseUrl: string
  model: string
  gatewayUrl?: string
  promptFile?: string
  updateUrl?: string
}
export const configPath = process.env.AEGIS_CONFIG || join(homedir(), ".config", "aegis", "config.json")
export function httpsUrl(value: string) {
  const url = new URL(value)
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("HTTPS URL required")
  return url.toString()
}
export async function readConfig(path = configPath): Promise<Config> {
  const file = Bun.file(path)
  const raw = await file.exists() ? await file.json() : {}
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid configuration")
  for (const key of ["baseUrl", "model", "gatewayUrl", "promptFile", "updateUrl"]) {
    if (raw[key] !== undefined && (typeof raw[key] !== "string" || !raw[key].trim())) throw new Error(`Invalid ${key}`)
  }
  if (raw.language !== undefined && !["zh", "en", "id"].includes(raw.language)) throw new Error("Invalid language")
  const config: Config = { baseUrl: "https://api.deepseek.com/anthropic", model: "deepseek-flash", releaseRepo: "alwith-ai/aegis", autoUpdate: true, ...raw }
  if (typeof config.autoUpdate !== "boolean") throw new Error("Invalid autoUpdate")
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(config.releaseRepo)) throw new Error("Invalid releaseRepo")
  config.baseUrl = httpsUrl(config.baseUrl)
  if (config.gatewayUrl) config.gatewayUrl = httpsUrl(config.gatewayUrl)
  if (config.updateUrl) config.updateUrl = httpsUrl(config.updateUrl)
  if (config.promptFile) config.promptFile = resolve(dirname(path), config.promptFile)
  return config
}
/** Remembers the language chosen in the menu, merging into the existing configuration file. */
export async function writeLanguage(lang: Language, path = configPath) {
  const file = Bun.file(path)
  const raw = await file.exists() ? await file.json() : {}
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Invalid configuration")
  if (raw.language === lang) return
  await mkdir(dirname(path), { recursive: true, mode: 0o700 })
  await writeFile(path, JSON.stringify({ ...raw, language: lang }, null, 2) + "\n", { mode: 0o600 })
}
