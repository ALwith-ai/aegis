export type Language = "zh" | "en" | "id"
const messages = {
  zh: {
    title: "Aegis · 电脑安全自查", password: "自查口令", denied: "口令错误", action: "选择操作",
    scan: "开始排查", exit: "退出", collecting: "正在检查安全设置", review: "将以上检查结果发送给 AI 分析？",
    analyzing: "正在分析", done: "完成", missing: "请先在配置中指定正式提示词文件 promptFile",
    config: "配置文件", unsupported: "支持 macOS 15+ 和 Windows", key: "请设置 AEGIS_TOKEN 或配置 gatewayUrl",
    failed: "操作失败", cancelled: "已取消", unknown: "无法确认", update: "查看升级信息"
  },
  en: {
    title: "Aegis · Computer security check", password: "Access password", denied: "Incorrect password", action: "Choose an action",
    scan: "Start the investigation", exit: "Exit", collecting: "Checking security settings", review: "Send the results above to AI for analysis?",
    analyzing: "Analyzing", done: "Done", missing: "Set promptFile to the approved prompt file in your configuration first",
    config: "Configuration file", unsupported: "Supports macOS 15+ and Windows", key: "Set AEGIS_TOKEN or configure gatewayUrl",
    failed: "Operation failed", cancelled: "Cancelled", unknown: "Unknown", update: "Check for updates"
  },
  id: {
    title: "Aegis · Pemeriksaan keamanan komputer", password: "Kata sandi akses", denied: "Kata sandi salah", action: "Pilih tindakan",
    scan: "Mulai pemeriksaan", exit: "Keluar", collecting: "Memeriksa pengaturan keamanan", review: "Kirim hasil di atas ke AI untuk dianalisis?",
    analyzing: "Menganalisis", done: "Selesai", missing: "Atur promptFile ke berkas prompt yang disetujui dalam konfigurasi terlebih dahulu",
    config: "Berkas konfigurasi", unsupported: "Mendukung macOS 15+ dan Windows", key: "Atur AEGIS_TOKEN atau konfigurasikan gatewayUrl",
    failed: "Operasi gagal", cancelled: "Dibatalkan", unknown: "Tidak diketahui", update: "Periksa pembaruan"
  }
} as const
export function language(value = process.env.LC_ALL || process.env.LANG || Intl.DateTimeFormat().resolvedOptions().locale): Language {
  return /^zh/i.test(value) ? "zh" : /^id/i.test(value) ? "id" : "en"
}
export const text = (lang: Language) => messages[lang]
