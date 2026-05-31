// CLI argument parser for asana-task-assign-migrator.
// Conforms to S-001 / S-002 / S-017 / S-018 / S-019 / S-020.
//
// Subcommand-based (S-019): `migrate` (assignee migration) and `survey`
// (read-only unmigrated-task count). A subcommand is required; bare invocation
// and unknown subcommands fail with exit 2.
//
// Behaviour:
//   - Throws CliUsageError (exit 2) on validation failure.
//   - Returns ParseResult discriminating help / version / migrate / survey.
//   - No I/O side effects; main.ts is responsible for stdout/stderr writes.

import type { CliArgs, SurveyArgs } from "./types.ts";
import denoJson from "../deno.json" with { type: "json" };

export const VERSION = denoJson.version;

export class CliUsageError extends Error {
  constructor(message: string, public hint?: string) {
    super(message);
    this.name = "CliUsageError";
  }
}

export type Subcommand = "migrate" | "survey";

export type ParseResult =
  | { kind: "help"; topic?: Subcommand }
  | { kind: "version" }
  | { kind: "migrate"; args: CliArgs }
  | { kind: "survey"; args: SurveyArgs };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GID_RE = /^[0-9]+$/;

export function parseArgs(argv: readonly string[]): ParseResult {
  const first = argv[0];
  // Explicit help / version are top-level; a missing subcommand is a usage error
  // (S-019: a subcommand is required, so bare invocation exits 2).
  if (first === "-h" || first === "--help") return { kind: "help" };
  if (first === "-V" || first === "--version") return { kind: "version" };
  if (first === undefined) {
    throw new CliUsageError(
      "Missing subcommand.",
      "Expected 'migrate' or 'survey'. See --help for usage.",
    );
  }
  if (first === "migrate") return parseMigrate(argv.slice(1));
  if (first === "survey") return parseSurvey(argv.slice(1));
  throw new CliUsageError(
    `Unknown subcommand: ${first}`,
    "Expected 'migrate' or 'survey'. See --help for usage.",
  );
}

function parseMigrate(argv: readonly string[]): ParseResult {
  if (argv.some((a) => a === "-h" || a === "--help")) return { kind: "help", topic: "migrate" };
  if (argv.some((a) => a === "-V" || a === "--version")) return { kind: "version" };

  let workspace: string | undefined;
  let from: string | undefined;
  let to: string | undefined;
  let dryRun = false;
  let json = false;
  let quiet = false;
  let verbose = false;
  let yes = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--workspace":
        workspace = expectValue(argv, ++i, "--workspace");
        break;
      case "--from":
        from = expectValue(argv, ++i, "--from");
        break;
      case "--to":
        to = expectValue(argv, ++i, "--to");
        break;
      case "--dry-run":
        dryRun = true;
        break;
      case "--json":
        json = true;
        break;
      case "--quiet":
        quiet = true;
        break;
      case "--verbose":
        verbose = true;
        break;
      case "--yes":
        yes = true;
        break;
      default:
        if (a.startsWith("--workspace=")) workspace = a.slice("--workspace=".length);
        else if (a.startsWith("--from=")) from = a.slice("--from=".length);
        else if (a.startsWith("--to=")) to = a.slice("--to=".length);
        else throw new CliUsageError(`Unknown option: ${a}`, "See 'migrate --help' for usage.");
    }
  }

  if (!workspace) throw new CliUsageError("Missing required option: --workspace");
  if (!from) throw new CliUsageError("Missing required option: --from");
  if (!to) throw new CliUsageError("Missing required option: --to");

  workspace = validateWorkspace(workspace);
  if (!EMAIL_RE.test(from)) {
    throw new CliUsageError(`Invalid --from value: ${from}`, "Expected an email address.");
  }
  if (!EMAIL_RE.test(to)) {
    throw new CliUsageError(`Invalid --to value: ${to}`, "Expected an email address.");
  }
  if (from.toLowerCase() === to.toLowerCase()) {
    throw new CliUsageError("--from and --to must differ.");
  }

  return {
    kind: "migrate",
    args: { workspace, from, to, dryRun, json, quiet, verbose, yes },
  };
}

function parseSurvey(argv: readonly string[]): ParseResult {
  if (argv.some((a) => a === "-h" || a === "--help")) return { kind: "help", topic: "survey" };
  if (argv.some((a) => a === "-V" || a === "--version")) return { kind: "version" };

  let workspace: string | undefined;
  let domain: string | undefined;
  let json = false;
  let verbose = false;
  let quiet = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--workspace":
        workspace = expectValue(argv, ++i, "--workspace");
        break;
      case "--domain":
        domain = expectValue(argv, ++i, "--domain");
        break;
      case "--json":
        json = true;
        break;
      case "--verbose":
        verbose = true;
        break;
      case "--quiet":
        quiet = true;
        break;
      default:
        if (a.startsWith("--workspace=")) workspace = a.slice("--workspace=".length);
        else if (a.startsWith("--domain=")) domain = a.slice("--domain=".length);
        else throw new CliUsageError(`Unknown option: ${a}`, "See 'survey --help' for usage.");
    }
  }

  if (!workspace) throw new CliUsageError("Missing required option: --workspace");
  if (!domain) throw new CliUsageError("Missing required option: --domain");

  workspace = validateWorkspace(workspace);

  const normalized = normalizeDomain(domain);
  if (!isValidDomain(normalized)) {
    throw new CliUsageError(
      `Invalid --domain value: ${domain}`,
      "Expected a domain like example.com (no '@', at least one dot).",
    );
  }

  return {
    kind: "survey",
    args: { workspace, domain: normalized, json, verbose, quiet },
  };
}

// Validates and normalizes a --workspace value (S-027 / R24). A numeric GID passes
// through unchanged; otherwise the value must be a domain (lowercased, leading '@'
// stripped) which the orchestrator later resolves to a GID via the API. The GID is
// disambiguated from a domain purely by /^[0-9]+$/ — domains always carry a dot.
function validateWorkspace(raw: string): string {
  if (GID_RE.test(raw)) return raw;
  const normalized = normalizeDomain(raw);
  if (isValidDomain(normalized)) return normalized;
  throw new CliUsageError(
    `Invalid --workspace value: ${raw}`,
    "Expected a numeric GID (Asana URL /0/<gid>/...) or a domain like example.com.",
  );
}

// Lowercase and drop a leading '@' so both "example.com" and "@example.com" work.
function normalizeDomain(raw: string): string {
  const d = raw.toLowerCase();
  return d.startsWith("@") ? d.slice(1) : d;
}

// Validates a domain without a regex: ASCII letters/digits/hyphen/dot, at least
// two non-empty dot-separated labels. The char whitelist excludes '@'/whitespace.
function isValidDomain(d: string): boolean {
  if (d.length === 0) return false;
  const allowed = (c: string) =>
    (c >= "a" && c <= "z") || (c >= "0" && c <= "9") || c === "-" || c === ".";
  if (![...d].every(allowed)) return false;
  const labels = d.split(".");
  return labels.length >= 2 && labels.every((l) => l.length > 0);
}

function expectValue(argv: readonly string[], i: number, flag: string): string {
  const v = argv[i];
  if (v === undefined || v.startsWith("--")) {
    throw new CliUsageError(`Option ${flag} requires a value.`);
  }
  return v;
}

export function helpText(topic?: Subcommand): string {
  if (topic === "migrate") return migrateHelp();
  if (topic === "survey") return surveyHelp();
  return topHelp();
}

function topHelp(): string {
  return `asana-task-assign-migrator ${VERSION}

USAGE:
  asana-task-assign-migrator <subcommand> [OPTIONS]

SUBCOMMANDS:
  migrate    Reassign incomplete tasks from one account to another
  survey     Count incomplete tasks still assigned to a domain (read-only)

OPTIONS:
  -h, --help                 show this help
  -V, --version              show version

ENVIRONMENT VARIABLES:
  ASANA_ACCESS_TOKEN         Required. Personal Access Token.
                             Issue at https://app.asana.com/0/my-apps

Run 'asana-task-assign-migrator <subcommand> --help' for subcommand options.
See README.md for full documentation.
`;
}

function migrateHelp(): string {
  return `asana-task-assign-migrator ${VERSION} — migrate

USAGE:
  asana-task-assign-migrator migrate [OPTIONS]

REQUIRED:
  --workspace <gid|domain>   target workspace: a numeric GID, or a domain
                             (e.g. example.com) resolved to its organization
  --from <email>             old account email
  --to <email>               new account email

OPTIONS:
  --dry-run                  list target tasks without updating
  --json                     emit JSON output
  --quiet                    suppress per-task progress lines
  --verbose                  log API request/response details to stderr
  --yes                      skip the confirmation prompt
  -h, --help                 show this help
  -V, --version              show version
`;
}

function surveyHelp(): string {
  return `asana-task-assign-migrator ${VERSION} — survey (read-only)

USAGE:
  asana-task-assign-migrator survey [OPTIONS]

REQUIRED:
  --workspace <gid|domain>   target workspace: a numeric GID, or a domain
                             (e.g. example.com) resolved to its organization
  --domain <domain>          assignee email domain to survey (e.g. example.com)
                             — this is the accounts to count, not the workspace

OPTIONS:
  --json                     emit JSON output
  --verbose                  log API request/response details to stderr
  --quiet                    omit per-account breakdown, show summary only
  -h, --help                 show this help
  -V, --version              show version
`;
}

export function versionText(): string {
  return `asana-task-assign-migrator ${VERSION}\n`;
}
