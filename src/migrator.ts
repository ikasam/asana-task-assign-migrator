// Migration orchestrator per S-003 / S-010.
//
// Pipeline:
//   1. pre-checks (workspace, from user, to user, to-membership)
//   2. task discovery (paginated getTasks — surfaces subtasks too, see H-DOM3)
//   3. idempotency filter (drop tasks already assigned to `to`)
//   4. confirmation prompt (unless --yes or --dry-run)
//   5. execution (serial updateTask via rate limiter)
//   6. reporting (renderer.summary / renderer.jsonPayload)
//
// All Asana SDK contact is funneled through AsanaClient (asana_client.ts), and all
// network calls are wrapped by the rate-limiter runner. This module is pure
// orchestration + the discriminating policy decisions.

import type { AsanaClient } from "./asana_client.ts";
import { normalizeError } from "./asana_client.ts";
import {
  createThrottledRunner,
  defaultRateLimitDetector,
  defaultRetryAfterExtractor,
} from "./rate_limiter.ts";
import type { Renderer } from "./output.ts";
import { confirm } from "./output.ts";
import type {
  AsanaTask,
  CliArgs,
  ExitCode,
  OutputPayload,
  TaskResult,
  User,
  Workspace,
} from "./types.ts";

export class PreCheckError extends Error {
  constructor(message: string, public hint?: string) {
    super(message);
    this.name = "PreCheckError";
  }
}

const GID_RE = /^[0-9]+$/;

// Resolves a --workspace value (GID or domain) to a Workspace. Shared by migrate
// and survey pre-checks (S-027 / R24 / R25).
//   - Numeric → direct getWorkspace (no listing call, the common path).
//   - Otherwise → treat as a domain (already normalized by the CLI parser) and
//     match against organizations' email_domains. 0 or >1 matches → PreCheckError
//     (exit 2) listing visible workspaces so the user can fall back to a GID.
export async function resolveWorkspace(
  client: AsanaClient,
  run: <T>(fn: () => Promise<T>) => Promise<T>,
  input: string,
): Promise<Workspace> {
  if (GID_RE.test(input)) {
    try {
      return await run(() => client.getWorkspace(input));
    } catch (e) {
      throw workspaceLookupError(`workspace not found or no access (gid=${input})`, e);
    }
  }

  const domain = input; // CLI parser already lowercased / stripped a leading '@'
  let workspaces: Workspace[];
  try {
    workspaces = await run(() => client.listWorkspaces());
  } catch (e) {
    throw workspaceLookupError(
      `failed to list workspaces while resolving domain "${domain}"`,
      e,
    );
  }

  const matches = workspaces.filter((w) => (w.emailDomains ?? []).includes(domain));
  if (matches.length === 1) {
    // Re-fetch via getWorkspace so the domain path gets the same canonical
    // access/404 validation as the numeric-GID path (S-027: "getWorkspace
    // pre-check に合流").
    try {
      return await run(() => client.getWorkspace(matches[0].gid));
    } catch (e) {
      throw workspaceLookupError(
        `workspace not found or no access ` +
          `(gid=${matches[0].gid}, resolved from domain "${domain}")`,
        e,
      );
    }
  }
  if (matches.length === 0) {
    throw new PreCheckError(
      `no workspace found for domain "${domain}".`,
      workspaceListHint(workspaces, "Visible workspaces (use --workspace <gid> directly):"),
    );
  }
  throw new PreCheckError(
    `domain "${domain}" matches multiple workspaces.`,
    workspaceListHint(matches, "Matching workspaces (use --workspace <gid> directly):"),
  );
}

function workspaceLookupError(message: string, e: unknown): PreCheckError {
  const err = normalizeError(e);
  return new PreCheckError(
    message,
    err.httpStatus === 401
      ? "ASANA_ACCESS_TOKEN may be invalid or revoked."
      : `Asana API: HTTP ${err.httpStatus} ${err.code}`,
  );
}

function workspaceListHint(workspaces: Workspace[], header: string): string {
  if (workspaces.length === 0) {
    return "No workspaces are visible to this token.";
  }
  const lines = workspaces.map((w) => {
    const domains = w.emailDomains ?? [];
    let tag: string;
    if (domains.length > 0) {
      tag = `[${domains.join(", ")}]`;
    } else if (w.isOrganization === false) {
      tag = "(not an organization, no domain)";
    } else {
      // Organization (or unknown) but no email domains visible to this PAT (C-018).
      tag = "(organization; no email domains visible to this token)";
    }
    return `  ${w.gid}  ${w.name}  ${tag}`;
  });
  return header + "\n" + lines.join("\n");
}

export interface RunMigrationOpts {
  args: CliArgs;
  client: AsanaClient;
  renderer: Renderer;
  // Injectable for tests; defaults to interactive stdin prompt.
  promptConfirm?: (message: string) => boolean;
}

export async function runMigration(opts: RunMigrationOpts): Promise<ExitCode> {
  const { args, client, renderer } = opts;

  const run = createThrottledRunner({
    detectRateLimit: defaultRateLimitDetector,
    extractRetryAfterSec: defaultRetryAfterExtractor,
  });

  // [Pre-checks]
  const workspace = await resolveWorkspace(client, run, args.workspace);
  const fromUser = await preCheckUser(client, run, args.from, "from");
  const toUser = await preCheckUser(client, run, args.to, "to");
  await preCheckMembership(client, run, workspace.gid, toUser);

  renderer.banner(args, workspace, fromUser, { ...toUser, isMember: true });

  // [Task discovery] — H-DOM3 採択済み: getTasks のレスポンスに subtask も含まれるため、
  // /tasks/{gid}/subtasks の追加走査は不要。
  renderer.discoveryStart(fromUser.email);
  const tasks = await run(() => client.listAssignedIncompleteTasks(workspace.gid, fromUser.gid));

  // [Idempotency filter] — S-013
  const filtered = tasks.filter((t) => t.assigneeGid !== toUser.gid);
  renderer.discoveryDone(filtered.length);

  // [Dry-run branch]
  if (args.dryRun) {
    if (args.json) {
      renderer.jsonPayload({
        mode: "dry-run",
        workspace,
        from: fromUser,
        to: { ...toUser, isMember: true },
        tasks: filtered,
        count: filtered.length,
      });
    } else {
      renderer.dryRunTaskList(filtered);
      renderer.dryRunFooter();
    }
    return 0;
  }

  // [Confirmation prompt] — S-009
  if (!args.yes) {
    const prompt =
      `\nAbout to update assignee for ${filtered.length} tasks in workspace "${workspace.name}".\n` +
      `  From: ${fromUser.email} (${fromUser.name})\n` +
      `  To:   ${toUser.email} (${toUser.name})\n\n` +
      `Continue? [y/N]: `;
    const ok = opts.promptConfirm ? opts.promptConfirm(prompt) : confirm(prompt);
    if (!ok) return 0;
  }

  // [Execution] — S-007 / S-012
  renderer.executeStart(filtered.length);
  const results: TaskResult[] = [];
  for (let i = 0; i < filtered.length; i++) {
    const t = filtered[i];
    const r = await executeOne(client, run, t, toUser.gid);
    results.push(r);
    renderer.taskProgress(i + 1, filtered.length, r);
  }

  // [Reporting] — S-005
  const summary = {
    total: results.length,
    success: results.filter((r) => r.status === "success").length,
    failed: results.filter((r) => r.status === "failed").length,
  };
  const failures = results.filter((r) => r.status === "failed");

  if (args.json) {
    const payload: OutputPayload = {
      mode: "execute",
      workspace,
      from: fromUser,
      to: toUser,
      summary,
      results,
    };
    renderer.jsonPayload(payload);
  } else {
    renderer.summary(summary, failures);
  }

  return summary.failed > 0 ? 1 : 0;
}

async function preCheckUser(
  client: AsanaClient,
  run: <T>(fn: () => Promise<T>) => Promise<T>,
  email: string,
  role: "from" | "to",
): Promise<User> {
  try {
    return await run(() => client.getUser(email));
  } catch (e) {
    const err = normalizeError(e);
    throw new PreCheckError(
      `${role} user not found: ${email}`,
      `Asana API: HTTP ${err.httpStatus} ${err.code}`,
    );
  }
}

async function preCheckMembership(
  client: AsanaClient,
  run: <T>(fn: () => Promise<T>) => Promise<T>,
  workspaceGid: string,
  user: User,
): Promise<void> {
  const member = await run(() => client.isMemberOfWorkspace(workspaceGid, user.gid));
  if (!member) {
    throw new PreCheckError(
      `to user is not a member of the workspace: ${user.email}`,
      "Ask a workspace admin to invite the new account before re-running.",
    );
  }
}

async function executeOne(
  client: AsanaClient,
  run: <T>(fn: () => Promise<T>) => Promise<T>,
  task: AsanaTask,
  toUserGid: string,
): Promise<TaskResult> {
  try {
    await run(() => client.updateTaskAssignee(task.gid, toUserGid));
    return { gid: task.gid, name: task.name, status: "success" };
  } catch (e) {
    const err = normalizeError(e);
    return {
      gid: task.gid,
      name: task.name,
      status: "failed",
      error: err,
    };
  }
}
