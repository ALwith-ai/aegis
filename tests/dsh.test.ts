import { describe, expect, test } from "bun:test"
import { countSteps, declareUtf8, extractHtml, looksLikeHtml, patchText, platformKey, runtimeAssets, runtimeTag, runtimeVersion, sanitizeHtml, scrub } from "../src/dsh"
import { loadPrompt, prompt, promptPath, resetPrompt } from "../src/prompt"
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

describe("dsh runtime assets", () => {
  test("cover the three shipped platforms with pinned checksums", () => {
    expect(Object.keys(runtimeAssets).sort()).toEqual(["darwin-arm64", "darwin-x64", "win32-x64"])
    for (const asset of Object.values(runtimeAssets)) {
      expect(asset.name).toMatch(new RegExp(`^dsh-runtime-${runtimeVersion.replaceAll(".", "\\.")}-(darwin-arm64|darwin-x64|windows-x64)\\.tar\\.gz$`))
      expect(asset.sha256).toMatch(/^[a-f0-9]{64}$/)
      expect(asset.files.length).toBeGreaterThan(0)
    }
    expect(runtimeTag).toBe(`dsh-runtime-${runtimeVersion}`)
    expect(platformKey("darwin", "arm64")).toBe("darwin-arm64")
    expect(runtimeAssets[platformKey("win32", "x64")].files[0]).toBe(".exe")
  })
  test("installers pin the same runtime version and asset names", async () => {
    const sh = await readFile(new URL("../scripts/install.sh", import.meta.url), "utf8")
    const ps = await readFile(new URL("../scripts/install.ps1", import.meta.url), "utf8")
    expect(sh).toContain(`runtime_version=${runtimeVersion}`)
    expect(sh).toContain('"$HOME/.aegis/dsh/$runtime_version"')
    expect(sh).toContain('dsh-runtime-$runtime_version-darwin-$arch.tar.gz')
    expect(ps).toContain(`$runtimeVersion = '${runtimeVersion}'`)
    expect(ps).toContain('dsh-runtime-$runtimeVersion-windows-x64.tar.gz')
  })
})

describe("dsh overlay patch", () => {
  test("is valid YAML that locks the agent to read-only tools and an empty persona", () => {
    const rows = Bun.YAML.parse(patchText("deepseek-flash")) as { id: string; disabled?: boolean; config?: Record<string, unknown> }[]
    const byId = Object.fromEntries(rows.map(row => [row.id, row]))
    for (const id of ["tool-web", "tool-subagent", "tool-subagent-fork", "tool-subagent-control", "tool-workflow", "tool-goal", "tool-jobs", "tool-skill"]) expect(byId[id]?.disabled).toBe(true)
    expect(byId["tool-fs"]?.config).toEqual({ read: true, readImage: false, write: false, edit: false, applyPatch: false })
    expect(byId["approval"]?.config).toEqual({ policy: "never" })
    expect((byId["permission"]?.config as { defaultPreset: string }).defaultPreset).toBe("read-only")
    expect(byId["agent-default-model"]?.config).toEqual({ provider: "deepseek-official", model: "deepseek-flash" })
    expect(byId["system-prompt"]?.config).toEqual({ personaPrefix: "" })
    const windowsRows = Bun.YAML.parse(patchText("deepseek-flash", "win32")) as { id: string; config?: Record<string, unknown> }[]
    expect(windowsRows.find(row => row.id === "session-persistence-jsonl")?.config).toEqual({ compression: "none" })
    expect(() => patchText("x; rm -rf /")).toThrow("Invalid model")
  })
})

describe("official prompt", () => {
  test("requires read-only evidence checks and a complete HTML report", () => {
    expect(prompt.startsWith("终端安全自查任务（只读）")).toBe(true)
    expect(prompt).toContain("最终回答必须且只能是一个完整、独立、自包含的 HTML 文档")
    expect(prompt).toContain("全程只读。禁止删除、修改、移动任何文件")
    expect(prompt).toContain("未检查项不得计入「未发现异常」")
    expect(prompt).toContain("不得把「签名有效」写成「确认正版」")
  })
  test("prompt file is created from the built-in text, then edited text wins, and reset restores it", async () => {
    const dir = await mkdtemp(join(tmpdir(), "aegis-prompt-"))
    try {
      const config = { promptFile: join(dir, "nested", "prompt.txt") }
      expect(promptPath(config)).toBe(config.promptFile)
      expect(await loadPrompt(config)).toBe(prompt)
      expect(await readFile(config.promptFile, "utf8")).toBe(prompt)
      await writeFile(config.promptFile, "只看进程\n")
      expect(await loadPrompt(config)).toBe("只看进程\n")
      await writeFile(config.promptFile, "  \n")
      await expect(loadPrompt(config)).rejects.toThrow("Prompt file is empty")
      expect(await resetPrompt(config)).toBe(config.promptFile)
      expect(await loadPrompt(config)).toBe(prompt)
    } finally { await rm(dir, { recursive: true, force: true }) }
  })
})

describe("dsh helpers", () => {
  test("progress counts reasoning sections and scrub hides keys", () => {
    expect(countSteps("dsh: reasoning:\nthinking\ndsh: reasoning:\nmore\ninfo line\ndsh: reasoning: x\n")).toBe(3)
    expect(scrub("key sk-abcdef0123456789abcdef used; literal SECRET too", "SECRET")).toBe("key <KEY> used; literal <KEY> too")
  })
  test("HTML answers are detected and stripped of active content", () => {
    expect(looksLikeHtml("<!DOCTYPE html>\n<html><body>x</body></html>")).toBe(true)
    expect(looksLikeHtml("总体结论\n未发现高危")).toBe(false)
    const fenced = "沙箱只读，无法写入文件。下面是完整的 HTML 报告源码：\n\n```html\n<!DOCTYPE html>\n<html lang=\"zh-CN\"><body><h1>报告</h1></body></html>\n```\n\n保存后即可打开。"
    const found = extractHtml(fenced)!
    expect(found.html.startsWith("<!DOCTYPE html>")).toBe(true)
    expect(found.html.endsWith("</html>")).toBe(true)
    expect(found.remainder).toBe("沙箱只读，无法写入文件。下面是完整的 HTML 报告源码：\n\n保存后即可打开。")
    expect(extractHtml("plain <b>bold</b> text")).toBeUndefined()
    const dirty = `<html><head><script>alert(1)</script><link rel="stylesheet" href="https://x/y.css"><meta http-equiv="refresh" content="0"></head>
<body onload="evil()"><a href="javascript:evil()">a</a><img src="https://t/p.png"><div style="background:url(https://t/i.png)">ok</div><iframe src="https://x"></iframe></body></html>`
    const clean = sanitizeHtml(dirty)
    for (const bad of ["<script", "onload", "javascript:", "https://", "<iframe", "<link", "http-equiv"]) expect(clean).not.toContain(bad)
    expect(clean).toContain('<head><meta charset="utf-8"></head>')
    expect(clean).toContain("<div style=\"background:none\">ok</div>")
    expect(clean).toContain("<a>a</a>")
  })
})

test("sanitized HTML keeps a UTF-8 charset declaration for Safari", () => {
  const report = sanitizeHtml('<!doctype html><html><head><meta charset="gbk"><title>报告</title></head><body>中文</body></html>')
  expect(report).toContain('<head><meta charset="utf-8"><title>报告</title>')
  expect(report).not.toContain("gbk")
  expect(sanitizeHtml("<html><body>中文</body></html>")).toContain('<html><head><meta charset="utf-8"></head><body>')
  expect(declareUtf8("<p>中文</p>")).toBe('<meta charset="utf-8"><p>中文</p>')
})
