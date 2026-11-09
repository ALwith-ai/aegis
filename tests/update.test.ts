import { describe, expect, test } from "bun:test"
import { sha256 } from "../src/hash"
import { assetName, verifyChecksum } from "../src/update"

describe("update", () => {
  test("asset names follow platform and architecture", () => {
    expect(assetName("darwin", "arm64")).toBe("aegis-darwin-arm64")
    expect(assetName("darwin", "x64")).toBe("aegis-darwin-x64")
    expect(assetName("win32", "x64")).toBe("aegis-windows-x64.exe")
    expect(() => assetName("linux", "x64")).toThrow("Unsupported platform")
  })
  test("checksums reject corruption and missing entries", () => {
    const bytes = new TextEncoder().encode("binary")
    verifyChecksum(bytes, `${sha256(bytes)}  aegis-darwin-arm64\n`, "aegis-darwin-arm64")
    expect(() => verifyChecksum(bytes, `${sha256(bytes)}  aegis-darwin-arm64\n`, "aegis-darwin-x64")).toThrow("checksum")
    expect(() => verifyChecksum(new TextEncoder().encode("tampered"), `${sha256(bytes)}  aegis-darwin-arm64\n`, "aegis-darwin-arm64")).toThrow("checksum")
  })
})
