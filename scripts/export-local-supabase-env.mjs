#!/usr/bin/env node
/* eslint-disable no-console */

import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

export function getLocalSupabaseStatus() {
  const raw = execSync("npx supabase status --output=json", {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
  const jsonStart = raw.indexOf("{");
  if (jsonStart === -1) {
    throw new Error("Unable to find JSON payload in Supabase status output.");
  }
  return JSON.parse(raw.slice(jsonStart));
}

function printShellExports() {
  const status = getLocalSupabaseStatus();
  const entries = {
    API_URL: status.API_URL,
    ANON_KEY: status.ANON_KEY,
    REST_URL: status.REST_URL,
    SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
  };

  for (const [key, value] of Object.entries(entries)) {
    if (value) {
      process.stdout.write(`export ${key}=${JSON.stringify(value)}\n`);
    }
  }
}

if (
  typeof process !== "undefined" &&
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  try {
    printShellExports();
  } catch (error) {
    console.error("Failed to read local Supabase status:", error.message);
    process.exit(1);
  }
}
