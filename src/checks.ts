export type Check = { id: string; command: string[] }
export type Result = { id: string; status: "observed" | "unknown"; output: string }
export function checks(platform = process.platform): Check[] {
  if (platform === "darwin") return [
    { id: "os", command: ["sw_vers", "-productVersion"] },
    { id: "disk-encryption", command: ["fdesetup", "status"] },
    { id: "firewall", command: ["/usr/libexec/ApplicationFirewall/socketfilterfw", "--getglobalstate"] },
    { id: "gatekeeper", command: ["spctl", "--status"] },
    { id: "system-integrity", command: ["csrutil", "status"] }
  ]
  if (platform === "win32") {
    const commands = {
      os: "[Environment]::OSVersion.Version.ToString()",
      "disk-encryption": "Get-BitLockerVolume | Select-Object MountPoint,VolumeStatus,ProtectionStatus | ConvertTo-Json -Compress",
      firewall: "Get-NetFirewallProfile | Select-Object Name,Enabled | ConvertTo-Json -Compress",
      antivirus: "Get-MpComputerStatus | Select-Object AntivirusEnabled,RealTimeProtectionEnabled,AntivirusSignatureLastUpdated | ConvertTo-Json -Compress",
      "secure-boot": "Confirm-SecureBootUEFI"
    }
    return Object.entries(commands).map(([id, command]) => ({ id, command: ["powershell.exe", "-NoProfile", "-NonInteractive", "-Command", `$ErrorActionPreference='Stop'; ${command}`] }))
  }
  throw new Error("Unsupported platform")
}
export async function collect(items = checks()): Promise<Result[]> {
  return Promise.all(items.map(async ({ id, command }): Promise<Result> => {
    try {
      const child = Bun.spawn(command, { stdout: "pipe", stderr: "ignore", stdin: "ignore", timeout: 15000, killSignal: "SIGKILL" })
      const [output, code] = await Promise.all([new Response(child.stdout).text(), child.exited])
      if (code !== 0 || child.signalCode || !output.trim()) return { id, status: "unknown", output: "" }
      return { id, status: "observed", output: output.trim().slice(0, 8000) }
    } catch { return { id, status: "unknown", output: "" } }
  }))
}
