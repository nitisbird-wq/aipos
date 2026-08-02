#!/usr/bin/env node
/**
 * AIPOS CLI — local project auditor / doctor
 *
 * Usage:
 *   npm run aipos -- doctor
 *   npm run aipos -- doctor --profile local
 *   npm run aipos -- doctor --profile pr
 *   npm run aipos -- doctor --profile production
 *   npm run doctor
 */
import path from "node:path";
import { doctorAndReport } from "./doctor";
import { parseProfile } from "./types";

function usage() {
  console.log(`AIPOS CLI

Commands:
  doctor   Run project readiness audit (default)
  audit    Alias of doctor
  help     Show this help

Profiles:
  local       Critical blocks only (default for local work)
  pr          Critical + High block (soft: branch protection)
  production  Critical + High + Medium block

Examples:
  npm run aipos -- doctor --profile local
  npm run aipos -- doctor --profile pr
  npm run doctor
`);
}

function readFlag(args: string[], name: string): string | undefined {
  const eq = args.find((a) => a.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const idx = args.indexOf(name);
  if (idx >= 0 && args[idx + 1] && !args[idx + 1].startsWith("-")) {
    return args[idx + 1];
  }
  return undefined;
}

function main() {
  const args = process.argv.slice(2);
  const cmd = (args[0] || "doctor").toLowerCase();
  const rootRaw = readFlag(args, "--root");
  const root = rootRaw ? path.resolve(rootRaw) : path.resolve(process.cwd());

  let profile;
  try {
    profile = parseProfile(readFlag(args, "--profile"));
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  if (cmd === "help" || cmd === "-h" || cmd === "--help") {
    usage();
    process.exit(0);
  }

  if (cmd === "doctor" || cmd === "audit" || cmd === "scan" || cmd === "readiness") {
    const result = doctorAndReport(root, profile);
    process.exit(result.exit_code);
  }

  console.error(`Unknown command: ${cmd}`);
  usage();
  process.exit(1);
}

main();
