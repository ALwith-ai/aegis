import { readdir, writeFile } from "node:fs/promises"
import { sha256 } from "../src/hash"
const files = (await readdir("dist")).filter(n => /^aegis-(darwin-(arm64|x64)|windows-x64\.exe)$/.test(n)).sort()
await writeFile("dist/SHA256SUMS", (await Promise.all(files.map(async name => `${sha256(new Uint8Array(await Bun.file(`dist/${name}`).arrayBuffer()))}  ${name}`))).join("\n") + "\n")
