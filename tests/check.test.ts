import { expect, test } from "bun:test"
import { checks, collect } from "../src/checks"
import { language } from "../src/i18n"
import { httpsUrl } from "../src/config"
test("three languages", () => {
  expect(language("zh_CN")).toBe("zh")
  expect(language("id-ID")).toBe("id")
  expect(language("en-US")).toBe("en")
})
test("explicit platform probes", () => {
  expect(checks("darwin")).toHaveLength(5)
  expect(checks("win32")).toHaveLength(5)
  expect(() => checks("linux")).toThrow()
})
test("failed probes are unknown", async () => {
  expect(await collect([{ id: "missing", command: ["/nonexistent/yup-test"] }])).toEqual([{ id: "missing", status: "unknown", output: "" }])
})
test("secure endpoints", () => {
  expect(() => httpsUrl("http://example.com")).toThrow()
  expect(() => httpsUrl("https://user:password@example.com")).toThrow()
})
