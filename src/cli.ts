// CLI argument parser for asana-task-assign-migrator.
// Conforms to S-001 / S-002 / S-017 / S-018.
//
// Behaviour:
//   - Throws CliUsageError (exit 2) on validation failure.
//   - Returns ParseResult discriminating help / version / run.
//   - No I/O side effects; main.ts is responsible for stdout/stderr writes.

import type { CliArgs } from "./types.ts";

export const VERSION = "0.1.0";

export class CliUsageError extends Error {
  constructor(message: string, public hint?: string) {
    super(message);
    this.name = "CliUsageError";
  }
}

export type ParseResult =
  | { kind: "help" }
  | { kind: "version" }
  | { kind: "run"; args: CliArgs };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GID_RE = /^[0-9]+$/;

export function parseArgs(argv: readonly string[]): ParseResult {
  if (argv.some((a) => a === "-h" || a === "--help")) return { kind: "help" };
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
        else throw new CliUsageError(`Unknown option: ${a}`, "See --help for usage.");
    }
  }

  if (!workspace) throw new CliUsageError("Missing required option: --workspace");
  if (!from) throw new CliUsageError("Missing required option: --from");
  if (!to) throw new CliUsageError("Missing required option: --to");

  if (!GID_RE.test(workspace)) {
    throw new CliUsageError(
      `Invalid --workspace value: ${workspace}`,
      "Expected a numeric GID. Find it in the Asana URL: /0/<gid>/...",
    );
  }
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
    kind: "run",
    args: { workspace, from, to, dryRun, json, quiet, verbose, yes },
  };
}

function expectValue(argv: readonly string[], i: number, flag: string): string {
  const v = argv[i];
  if (v === undefined || v.startsWith("--")) {
    throw new CliUsageError(`Option ${flag} requires a value.`);
  }
  return v;
}

export function helpText(): string {
  return `asana-task-assign-migrator ${VERSION}

USAGE:
  asana-task-assign-migrator [OPTIONS]

REQUIRED:
  --workspace <gid>          target workspace GID
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

ENVIRONMENT VARIABLES:
  ASANA_ACCESS_TOKEN         Required. Personal Access Token.
                             Issue at https://app.asana.com/0/my-apps

See README.md for full documentation.
`;
}

export function versionText(): string {
  return `asana-task-assign-migrator ${VERSION}\n`;
}
