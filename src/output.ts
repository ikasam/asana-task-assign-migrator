// Output formatting per S-004 / S-005 / S-008 / S-016.
// Human-readable vs JSON, with --quiet suppression of per-task progress.
// All writes go through Writer abstractions so tests can capture them.

import type {
  AsanaTask,
  CliArgs,
  MigrationSummary,
  OutputPayload,
  SurveyArgs,
  SurveyPayload,
  TaskResult,
  User,
  Workspace,
} from "./types.ts";

export interface Writer {
  out(s: string): void;
  err(s: string): void;
}

export const stdWriter: Writer = {
  out: (s) => Deno.stdout.writeSync(new TextEncoder().encode(s)),
  err: (s) => Deno.stderr.writeSync(new TextEncoder().encode(s)),
};

export interface Renderer {
  banner(args: CliArgs, ws: Workspace, from: User, to: User & { isMember: true }): void;
  discoveryStart(fromEmail: string): void;
  discoveryDone(count: number): void;
  dryRunTaskList(tasks: AsanaTask[]): void;
  dryRunFooter(): void;
  executeStart(count: number): void;
  taskProgress(index: number, total: number, result: TaskResult): void;
  summary(summary: MigrationSummary, failures: TaskResult[]): void;
  jsonPayload(payload: OutputPayload): void;
}

// Pad a number to a fixed width so "[ 3/47]" aligns with "[47/47]".
function padNum(n: number, width: number): string {
  return String(n).padStart(width, " ");
}

function statusGlyph(r: TaskResult): string {
  if (r.status === "success") return "✓";
  const e = r.error;
  if (!e) return "✗";
  return `✗ HTTP ${e.httpStatus} ${e.code}`;
}

export function createRenderer(args: CliArgs, w: Writer = stdWriter): Renderer {
  if (args.json) return jsonRenderer(w);
  return humanRenderer(args, w);
}

function humanRenderer(args: CliArgs, w: Writer): Renderer {
  const quiet = args.quiet;
  return {
    banner(_a, ws, from, to) {
      if (quiet) return;
      const title = args.dryRun
        ? "=== Asana Task Assignee Migration (DRY RUN) ==="
        : "=== Asana Task Assignee Migration ===";
      w.out(`${title}\n\n`);
      w.out(`Workspace : ${ws.name} (gid: ${ws.gid})\n`);
      if (args.dryRun) {
        w.out(`From      : ${from.email} (${from.name}, gid: ${from.gid})\n`);
        w.out(
          `To        : ${to.email} (${to.name}, gid: ${to.gid})  ✓ member of workspace\n\n`,
        );
      } else {
        w.out(`From      : ${from.email} → To: ${to.email}\n\n`);
      }
    },
    discoveryStart(fromEmail) {
      if (quiet) return;
      if (args.dryRun) {
        w.out(`Discovering incomplete tasks assigned to ${fromEmail}...\n`);
      } else {
        w.out(`Discovering tasks... `);
      }
    },
    discoveryDone(count) {
      if (quiet) return;
      if (args.dryRun) w.out(`Found ${count} tasks.\n\n`);
      else w.out(`${count} found.\n`);
    },
    dryRunTaskList(tasks) {
      if (quiet) return;
      const width = String(tasks.length).length;
      for (let i = 0; i < tasks.length; i++) {
        const t = tasks[i];
        w.out(`  [${padNum(i + 1, width)}] ${t.gid}  ${t.name}\n`);
      }
      w.out("\n");
    },
    dryRunFooter() {
      if (quiet) return;
      w.out("DRY RUN: no changes were made.\n");
      w.out("Re-run without --dry-run to execute migration.\n");
    },
    executeStart(count) {
      if (quiet) return;
      w.out(`Migrating ${count} tasks...\n\n`);
    },
    taskProgress(index, total, r) {
      if (quiet) return;
      const width = String(total).length;
      const label = `[${padNum(index, width)}/${total}]`;
      const namePad = r.name.length < 32 ? r.name.padEnd(32, " ") : r.name;
      w.out(`  ${label} ${r.gid}  ${namePad} ${statusGlyph(r)}\n`);
    },
    summary(summary, failures) {
      if (!quiet) w.out(`\nDone.\n`);
      w.out(`  Total    : ${summary.total}\n`);
      w.out(`  Success  : ${summary.success}\n`);
      w.out(`  Failed   : ${summary.failed}\n`);
      if (failures.length > 0) {
        w.err(`\nFailures:\n`);
        for (const f of failures) {
          const e = f.error;
          const tag = e ? `HTTP ${e.httpStatus} ${e.code}` : "unknown error";
          w.err(`  ${f.gid}  ${f.name}  ${tag}\n`);
        }
        if (!quiet) w.out(`\nRe-run the same command to retry failed tasks (idempotent).\n`);
      }
    },
    jsonPayload() {
      // Not used in human mode.
    },
  };
}

function jsonRenderer(w: Writer): Renderer {
  // In JSON mode we buffer everything and emit a single payload at the end via jsonPayload().
  // Intermediate methods are no-ops.
  return {
    banner: () => {},
    discoveryStart: () => {},
    discoveryDone: () => {},
    dryRunTaskList: () => {},
    dryRunFooter: () => {},
    executeStart: () => {},
    taskProgress: () => {},
    summary: () => {},
    jsonPayload(payload) {
      w.out(JSON.stringify(payload, null, 2) + "\n");
    },
  };
}

// Renders the survey result (S-023). Read-only: no progress / confirm states.
// Human mode shows per-account counts; per-task detail lives only in --json.
// --verbose affects the API request dump (asana_client), not this output.
export function renderSurvey(
  args: SurveyArgs,
  payload: SurveyPayload,
  w: Writer = stdWriter,
): void {
  if (args.json) {
    w.out(JSON.stringify(payload, null, 2) + "\n");
    return;
  }

  const lines: string[] = [];
  lines.push("");
  lines.push("=== Unmigrated-task survey ===");
  lines.push(`workspace : ${payload.workspace.name} (${payload.workspace.gid})`);
  lines.push(`domain    : @${payload.domain}`);
  lines.push("");
  lines.push(
    `workspace has ${payload.totalUsers} user(s); ` +
      `${payload.matchedAccounts} match @${payload.domain}.`,
  );
  if (payload.emailInvisibleUsers > 0) {
    lines.push(
      `  note: ${payload.emailInvisibleUsers} user(s) returned no email ` +
        `(PAT lacks visibility) — they cannot be domain-classified.`,
    );
  }

  if (!args.quiet && payload.matchedAccounts > 0) {
    lines.push("");
    lines.push(`Incomplete tasks still assigned to @${payload.domain} accounts:`);
    lines.push("");
    for (const a of payload.accounts) {
      if (a.error) {
        lines.push(`  ! ${a.name} <${a.email}>: ERROR HTTP ${a.error.httpStatus} ${a.error.code}`);
        continue;
      }
      lines.push(`  ${String(a.count).padStart(5)}  ${a.name} <${a.email}>`);
    }
  }

  lines.push("");
  lines.push("=== Summary ===");
  lines.push(`domain accounts             : ${payload.matchedAccounts}`);
  lines.push(`  of which with tasks       : ${payload.accountsWithTasks}`);
  lines.push(`unmigrated incomplete tasks : ${payload.totalIncompleteTasks}`);
  if (payload.erroredAccounts > 0) {
    lines.push(`accounts that errored       : ${payload.erroredAccounts}`);
  }
  w.out(lines.join("\n") + "\n");
}

// Confirmation prompt per S-009. Returns true to continue, false to abort.
// Reads from stdin; --yes bypass is handled by the caller before invoking this.
export function confirm(
  message: string,
  reader: () => string | null = readLineSync,
  w: Writer = stdWriter,
): boolean {
  w.out(message);
  const answer = (reader() ?? "").trim().toLowerCase();
  return answer === "y" || answer === "yes";
}

function readLineSync(): string | null {
  const buf = new Uint8Array(256);
  const n = Deno.stdin.readSync(buf);
  if (n === null) return null;
  return new TextDecoder().decode(buf.subarray(0, n));
}

// Format a fatal pre-check error per S-018.
export function formatFatal(err: { message: string; hint?: string }, w: Writer = stdWriter): void {
  w.err(`Error: ${err.message}\n`);
  if (err.hint) w.err(`${err.hint}\n`);
}
