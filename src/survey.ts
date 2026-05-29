// Survey orchestrator (S-021 / S-022). Read-only companion to the migrator:
// counts incomplete tasks still assigned to accounts in a given email domain
// (i.e. how much is left to migrate for that domain).
//
// Pipeline:
//   1. pre-check workspace (PreCheckError → exit 2)
//   2. list all workspace users
//   3. filter to the target domain; count email-invisible users (R20)
//   4. per matched account: list incomplete assigned tasks (continue on error, R23)
//   5. render (renderSurvey)
//
// Uses the same getTasks query as the migrator (subtasks included, H-DOM3), so
// the count equals what the migrator would still need to touch for those accounts.
// This module never calls updateTask (S-026).

import type { AsanaClient } from "./asana_client.ts";
import { normalizeError } from "./asana_client.ts";
import { PreCheckError } from "./migrator.ts";
import {
  createThrottledRunner,
  defaultRateLimitDetector,
  defaultRetryAfterExtractor,
} from "./rate_limiter.ts";
import { renderSurvey, stdWriter, type Writer } from "./output.ts";
import type {
  ExitCode,
  SurveyAccountResult,
  SurveyArgs,
  SurveyPayload,
  Workspace,
} from "./types.ts";

export interface RunSurveyOpts {
  args: SurveyArgs;
  client: AsanaClient;
  // Injectable for tests; defaults to stdout.
  writer?: Writer;
}

export async function runSurvey(opts: RunSurveyOpts): Promise<ExitCode> {
  const { args, client } = opts;
  const writer = opts.writer ?? stdWriter;

  const run = createThrottledRunner({
    detectRateLimit: defaultRateLimitDetector,
    extractRetryAfterSec: defaultRetryAfterExtractor,
  });

  // [Pre-check] workspace
  const workspace = await preCheckWorkspace(client, run, args.workspace);

  // [List users] + [domain filter] (R17)
  const allUsers = await run(() => client.listWorkspaceUsers(args.workspace));
  const suffix = "@" + args.domain;
  const matched = allUsers.filter((u) => u.email !== "" && u.email.endsWith(suffix));
  const emailInvisibleUsers = allUsers.filter((u) => u.email === "").length;

  // [Per-account counts] — continue on error (R23)
  const accounts: SurveyAccountResult[] = [];
  for (const u of matched) {
    try {
      const tasks = await run(() => client.listAssignedIncompleteTasks(args.workspace, u.gid));
      // Only retain per-task detail when --json needs it; otherwise keep just the
      // count so large workspaces don't hold every task across all accounts.
      accounts.push({
        gid: u.gid,
        name: u.name,
        email: u.email,
        count: tasks.length,
        tasks: args.json ? tasks : [],
      });
    } catch (e) {
      accounts.push({
        gid: u.gid,
        name: u.name,
        email: u.email,
        count: 0,
        tasks: [],
        error: normalizeError(e),
      });
    }
  }

  // [Sort + aggregate] (R19)
  accounts.sort((a, b) => b.count - a.count);
  const erroredAccounts = accounts.filter((a) => a.error).length;
  const accountsWithTasks = accounts.filter((a) => !a.error && a.count > 0).length;
  const totalIncompleteTasks = accounts.reduce((sum, a) => sum + a.count, 0);

  const payload: SurveyPayload = {
    mode: "survey",
    workspace,
    domain: args.domain,
    totalUsers: allUsers.length,
    emailInvisibleUsers,
    matchedAccounts: matched.length,
    accountsWithTasks,
    totalIncompleteTasks,
    accounts,
    erroredAccounts,
  };

  renderSurvey(args, payload, writer);

  // exit 1 if any account errored, else 0 (S-024). Pre-check failures throw
  // PreCheckError above and are mapped to exit 2 by main.ts.
  return erroredAccounts > 0 ? 1 : 0;
}

async function preCheckWorkspace(
  client: AsanaClient,
  run: <T>(fn: () => Promise<T>) => Promise<T>,
  gid: string,
): Promise<Workspace> {
  try {
    return await run(() => client.getWorkspace(gid));
  } catch (e) {
    const err = normalizeError(e);
    throw new PreCheckError(
      `workspace not found or no access (gid=${gid})`,
      err.httpStatus === 401
        ? "ASANA_ACCESS_TOKEN may be invalid or revoked."
        : `Asana API: HTTP ${err.httpStatus} ${err.code}`,
    );
  }
}
