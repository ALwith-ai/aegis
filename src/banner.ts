import { styleText } from "node:util"
const art = [
  " █████╗ ███████╗ ██████╗ ██╗███████╗",
  "██╔══██╗██╔════╝██╔════╝ ██║██╔════╝",
  "███████║█████╗  ██║  ███╗██║███████╗",
  "██╔══██║██╔══╝  ██║   ██║██║╚════██║",
  "██║  ██║███████╗╚██████╔╝██║███████║",
  "╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚═╝╚══════╝"
]
export function banner(version: string) {
  if (!process.stdout.isTTY && !process.env.FORCE_COLOR) return `AEGIS · ${version}`
  if (process.env.NO_COLOR) return `${art.join("\n")}\n  ${version}`
  const width = Math.max(...art.map(s => [...s].length))
  const from = [34,211,238], to = [167,139,250]
  return "\n" + art.map(row => [...row].map((char, i) => {
    const color = "#" + from.map((v,j) => Math.round(v+(to[j]-v)*i/(width-1)).toString(16).padStart(2,"0")).join("")
    return char === " " ? char : styleText(color as `#${string}`, char)
  }).join("")).join("\n") + `\n\n  ${version} · Terminal security guardian\n`
}
