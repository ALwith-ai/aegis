#!/usr/bin/env bun
import * as p from "@clack/prompts"
import { Command } from "commander"
import { join } from "node:path"
import pkg from "./package.json"
import { configPath, readConfig } from "./src/config"
import { language, text, type Language } from "./src/i18n"
import { currentKey, hasKey } from "./src/key"
import { ensureRuntime, extractHtml, investigate, sanitizeHtml } from "./src/dsh"
import { editPrompt, loadPrompt, resetPrompt } from "./src/prompt"
import { banner } from "./src/banner"
import { createReportDirectory, writeReportFiles } from "./src/report"
import { update, isCompiled } from "./src/update"
const extra = {
  zh: { output: "报告已保存", noKey: "未配置凭证，请在安装命令中传入 AEGIS_TOKEN", runtime: "准备深度排查引擎", agent: "DeepSeek 深度排查", step: "第", steps: "步", agentError: "深度排查失败", agentFile: "DeepSeek 已生成独立的 HTML 排查报告，见同目录文件", promptSaved: "提示词已保存", promptReset: "提示词已恢复默认", editPrompt: "修改提示词", resetPrompt: "恢复默认提示词" },
  en: { output: "Report saved", noKey: "Missing credential; install with AEGIS_TOKEN", runtime: "Preparing the investigation engine", agent: "DeepSeek investigation", step: "step", steps: "", agentError: "Investigation failed", agentFile: "DeepSeek wrote a separate HTML report; see the file in this folder", promptSaved: "Prompt saved", promptReset: "Prompt restored to default", editPrompt: "Edit the prompt", resetPrompt: "Restore the default prompt" },
  id: { output: "Laporan disimpan", noKey: "Kredensial belum diatur; instal dengan AEGIS_TOKEN", runtime: "Menyiapkan mesin penyelidikan", agent: "Penyelidikan DeepSeek", step: "langkah", steps: "", agentError: "Penyelidikan gagal", agentFile: "DeepSeek membuat laporan HTML terpisah; lihat berkas di folder ini", promptSaved: "Prompt disimpan", promptReset: "Prompt dikembalikan ke bawaan", editPrompt: "Ubah prompt", resetPrompt: "Pulihkan prompt bawaan" }
}
const app = new Command().name("aegis").description("Terminal security guardian · 终端安全自查 · Pemeriksaan keamanan terminal")
  .version(pkg.version)
  .option("--lang <language>", "zh | en | id")
  .option("--edit-prompt", "Edit the investigation prompt")
  .option("--reset-prompt", "Restore the latest built-in prompt")
  .option("--check-config", "Check local credential configuration without scanning")
  .option("--no-auto-update", "Skip startup update check").option("--update", "Install latest binary release").option("--config", "Show configuration path")
  .option("--output <directory>", "Report directory", "./aegis-reports")
  .addHelpText("before", () => banner(pkg.version))
  .action(async (options) => {
    if (options.config) { console.log(configPath); return }
    if (options.checkConfig) { if (!hasKey()) throw new Error("Missing AEGIS_TOKEN; rerun the installer with your credential"); console.log("Configured"); return }
    const config = await readConfig()
    const lang: Language = options.lang || config.language || language()
    if (!["zh", "en", "id"].includes(lang)) throw new Error("--lang: zh | en | id")
    const t = text(lang), m = extra[lang]
    if (isCompiled() && config.autoUpdate && options.autoUpdate !== false && !options.update) {
      const updating = p.spinner()
      updating.start(lang === "zh" ? "检查 Aegis 更新" : lang === "id" ? "Memeriksa pembaruan Aegis" : "Checking Aegis updates")
      let result, updateError: string | undefined
      try { result = await update(config.releaseRepo, 5000, (received, total) => {
        const ratio = total ? Math.min(received / total, 1) : 0
        const progress = total ? `[${"█".repeat(Math.floor(ratio * 20))}${"░".repeat(20 - Math.floor(ratio * 20))}] ${Math.floor(ratio * 100)}%` : `${(received / 1048576).toFixed(1)} MB`
        updating.message(`${lang === "zh" ? "下载更新" : lang === "id" ? "Mengunduh pembaruan" : "Downloading update"} ${progress}`)
      }) }
      catch (error) { updateError = error instanceof Error ? error.message.split("\n")[0].slice(0, 160) : "error" } // Offline or failed update must not block the installed version.
      finally { updating.stop(result?.status === "updated" ? result.message : `${lang === "zh" ? "使用当前版本" : lang === "id" ? "Menggunakan versi saat ini" : "Using current version"}${updateError ? ` (${updateError})` : ""}`) }
      if (result?.status === "updated") {
        const child = Bun.spawn([process.execPath, ...process.argv.slice(2), "--no-auto-update"], { stdin: "inherit", stdout: "inherit", stderr: "inherit" })
        process.exitCode = await child.exited
        return
      }
    }
    console.log(banner(pkg.version))
    p.intro(t.title)
    if (!["darwin", "win32"].includes(process.platform)) throw new Error(t.unsupported)
    if (process.platform === "darwin") {
      const version = Bun.spawnSync(["/usr/bin/sw_vers", "-productVersion"])
      if (version.exitCode !== 0 || !(parseInt(version.stdout.toString()) >= 15)) throw new Error(t.unsupported)
    }
    if (options.update) { p.log.info((await update(config.releaseRepo)).message); return }
    if (options.editPrompt) { p.log.info(`${m.promptSaved}: ${await editPrompt(config)}`); return }
    if (options.resetPrompt) { p.log.info(`${m.promptReset}: ${await resetPrompt(config)}`); return }
    const spinner = p.spinner()
    if (!hasKey()) throw new Error(m.noKey)
    // DeepSeek gets the prompt immediately; the report directory is its working directory and receives its answer.
    const started = new Date().toISOString()
    const directory = await createReportDirectory(options.output, started)
    const agentFile = "DeepSeek 排查报告.html", textFile = "DeepSeek 排查报告.txt"
    let result: Awaited<ReturnType<typeof investigate>> | undefined, failure: string | undefined
    spinner.start(m.agent)
    try {
      const runtime = await ensureRuntime(config.releaseRepo, (received, total) => spinner.message(`${m.runtime} ${total ? `${Math.floor(received / total * 100)}%` : `${(received / 1048576).toFixed(0)} MB`}`))
      spinner.message(m.agent)
      result = await investigate({ runtime, key: currentKey(), model: config.model, reportDir: directory, task: (await loadPrompt(config)) + `\n\nReport language: ${lang === "zh" ? "Simplified Chinese" : lang === "id" ? "Bahasa Indonesia" : "English"}. Keep original evidence and commands unchanged.`,
        onProgress: (steps, elapsed) => spinner.message(`${m.agent} · ${m.step} ${steps} ${m.steps} · ${Math.floor(elapsed / 60000)}:${String(Math.floor(elapsed / 1000) % 60).padStart(2, "0")}`) })
    } catch (error) {
      failure = error instanceof Error ? error.message.split("\n")[0].slice(0, 300) : "error"
    } finally { spinner.stop(t.done) }
    const files: Record<string, string> = {}
    let main = textFile
    if (result) {
      const extracted = extractHtml(result.text)
      if (extracted) { files[agentFile] = sanitizeHtml(extracted.html); main = agentFile; if (extracted.remainder) files["DeepSeek 说明.txt"] = extracted.remainder }
      else files[textFile] = result.text
    }
    files["run.json"] = JSON.stringify({ version: pkg.version, started, finished: new Date().toISOString(), model: config.model, platform: process.platform,
      status: failure ? "error" : "ok", steps: result?.steps, elapsedMs: result?.elapsedMs, error: failure }, null, 2)
    await writeReportFiles(directory, files)
    if (failure) { p.log.error(`${m.agentError}: ${failure}`); process.exitCode = 1 }
    else p.log.success(`${m.output}: ${join(directory, main)}`)
    p.outro(t.done)
  })
try { await app.parseAsync() } catch (error) {
  p.log.error(error instanceof Error ? error.message : "Error")
  process.exitCode = 1
}
