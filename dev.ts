#!/usr/bin/env bun
import { realpath } from "node:fs/promises"
import { dirname, join } from "node:path"
import { parseEnv } from "node:util"

// Development entry: resolve the project even when invoked through a global symlink.
const directory = dirname(await realpath(import.meta.path))
const env = Bun.file(join(directory, ".env"))
if (await env.exists()) {
  const values = parseEnv(await env.text())
  for (const name of ["AEGIS_TOKEN", "AEGIS_CONFIG", "AEGIS_CREDENTIALS"]) {
    if (process.env[name] === undefined && values[name] !== undefined) process.env[name] = values[name]
  }
}
await import("./main.ts")
