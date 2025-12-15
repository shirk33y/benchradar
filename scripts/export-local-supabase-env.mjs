#!/usr/bin/env node
/* eslint-disable no-console */

import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

function supabaseStatusJson() {
  const cmd = "supabase status --output=json";
  let lastError;
  try {
    return execSync(cmd, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    lastError = e;
  }

  try {
    return execSync(`npx ${cmd}`, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    });
  } catch (e) {
    if (lastError) {
      // Prefer the npx error (it should be actionable) but keep the first one for debugging.
      e.message = `${e.message}\n(Also failed running directly: ${lastError.message})`;
    }
    throw e;
  }
}

export function getLocalSupabaseStatus() {
  const raw = supabaseStatusJson();
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

function printGithubEnv() {
  const status = getLocalSupabaseStatus();
  const entries = {
    API_URL: status.API_URL,
    ANON_KEY: status.ANON_KEY,
    REST_URL: status.REST_URL,
    SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY,
  };

  for (const [key, value] of Object.entries(entries)) {
    if (value) {
      process.stdout.write(`${key}=${value}\n`);
    }
  }
}

if (
  typeof process !== "undefined" &&
  process.argv[1] &&
  fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
) {
  try {
    const formatArg = process.argv.find((a) => a.startsWith("--format="));
    const format = formatArg ? formatArg.split("=")[1] : "shell";
    if (format === "github-env") {
      printGithubEnv();
    } else {
      printShellExports();
    }
  } catch (error) {
    console.error("Failed to read local Supabase status:", error.message);
    process.exit(1);
  }
}
