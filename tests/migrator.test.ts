// Unit tests for the migrator orchestration (issue #12).
//
// runMigration is the only path that mutates production data (updateTaskAssignee),
// yet had no direct coverage. These tests drive the whole pipeline with an
// in-memory fake AsanaClient (no network: the `test` task omits --allow-net) plus
// an injected promptConfirm and a recording Renderer, exercising the contracts
// that renderer-only tests cannot catch:
//   - idempotency filter (skip tasks already assigned to `to`)
//   - dry-run guard (never mutate)
//   - confirmation decline / --yes bypass
//   - partial failure → exit 1 (continue + record)
//   - resolveWorkspace's four branches + the 401 token hint
//
// Note: runMigration builds its own throttled runner internally (no sleep seam),
// so the real 400ms MIN_INTERVAL_MS applies between successive calls. The first
// call per run is free (lastRequestAt=0), so each test keeps the task count tiny.
// resolveWorkspace is exercised directly with a pass-through runner, so its
// branch tests stay instant.

import { assert, assertEquals, assertRejects, assertStringIncludes } from "@std/assert";
import { PreCheckError, resolveWorkspace, runMigration } from "../src/migrator.ts";
import { AsanaApiErrorImpl, type AsanaClient } from "../src/asana_client.ts";
import type { Renderer } from "../src/output.ts";
import type {
  AsanaTask,
  CliArgs,
  MigrationSummary,
  OutputPayload,
  TaskResult,
  User,
  Workspace,
} from "../src/types.ts";

// --- fakes / helpers ------------------------------------------------------

interface FakeConfig {
  getWorkspace?: (gid: string) => Promise<Workspace>;
  listWorkspaces?: () => Promise<Workspace[]>;
  getUser?: (emailOrGid: string) => Promise<User>;
  isMemberOfWorkspace?: (workspaceGid: string, userGid: string) => Promise<boolean>;
  listAssignedIncompleteTasks?: (workspaceGid: string, fromGid: string) => Promise<AsanaTask[]>;
  updateTaskAssignee?: (taskGid: string, toGid: string) => Promise<void>;
}

interface FakeCalls {
  getWorkspace: string[];
  listWorkspaces: number;
  getUser: string[];
  isMemberOfWorkspace: Array<{ workspaceGid: string; userGid: string }>;
  listAssignedIncompleteTasks: Array<{ workspaceGid: string; fromGid: string }>;
  updateTaskAssignee: Array<{ taskGid: string; toGid: string }>;
}

// Known users: getUser maps the CLI's --from / --to emails to distinct gids so
// the idempotency filter (assigneeGid === to.gid) has something to compare.
const FROM_GID = "12345678900001";
const TO_GID = "12345678900002";
const USERS: Record<string, User> = {
  "old@example.com": { gid: FROM_GID, email: "old@example.com", name: "Old User" },
  "new@example.com": { gid: TO_GID, email: "new@example.com", name: "New User" },
};

function makeFakeClient(cfg: FakeConfig = {}): { client: AsanaClient; calls: FakeCalls } {
  const calls: FakeCalls = {
    getWorkspace: [],
    listWorkspaces: 0,
    getUser: [],
    isMemberOfWorkspace: [],
    listAssignedIncompleteTasks: [],
    updateTaskAssignee: [],
  };
  const client: AsanaClient = {
    getWorkspace(gid) {
      calls.getWorkspace.push(gid);
      return cfg.getWorkspace ? cfg.getWorkspace(gid) : Promise.resolve({ gid, name: `WS-${gid}` });
    },
    listWorkspaces() {
      calls.listWorkspaces++;
      return cfg.listWorkspaces ? cfg.listWorkspaces() : Promise.resolve([]);
    },
    getUser(emailOrGid) {
      calls.getUser.push(emailOrGid);
      return cfg.getUser ? cfg.getUser(emailOrGid) : Promise.resolve(
        USERS[emailOrGid] ?? { gid: `gid-${emailOrGid}`, email: emailOrGid, name: emailOrGid },
      );
    },
    listWorkspaceUsers() {
      return Promise.resolve([]);
    },
    isMemberOfWorkspace(workspaceGid, userGid) {
      calls.isMemberOfWorkspace.push({ workspaceGid, userGid });
      return cfg.isMemberOfWorkspace
        ? cfg.isMemberOfWorkspace(workspaceGid, userGid)
        : Promise.resolve(true);
    },
    listAssignedIncompleteTasks(workspaceGid, fromGid) {
      calls.listAssignedIncompleteTasks.push({ workspaceGid, fromGid });
      return cfg.listAssignedIncompleteTasks
        ? cfg.listAssignedIncompleteTasks(workspaceGid, fromGid)
        : Promise.resolve([]);
    },
    updateTaskAssignee(taskGid, toGid) {
      calls.updateTaskAssignee.push({ taskGid, toGid });
      return cfg.updateTaskAssignee ? cfg.updateTaskAssignee(taskGid, toGid) : Promise.resolve();
    },
  };
  return { client, calls };
}

// Records the orchestration outputs runMigration hands the renderer, decoupled
// from output.ts formatting (which tests/output.test.ts already covers).
interface RendererRecord {
  discoveryDoneCount?: number;
  progress: TaskResult[];
  summary?: MigrationSummary;
  failures: TaskResult[];
  jsonPayload?: OutputPayload;
}

function recordingRenderer(): { renderer: Renderer; rec: RendererRecord } {
  const rec: RendererRecord = { progress: [], failures: [] };
  const renderer: Renderer = {
    banner: () => {},
    discoveryStart: () => {},
    discoveryDone: (count) => {
      rec.discoveryDoneCount = count;
    },
    dryRunTaskList: () => {},
    dryRunFooter: () => {},
    executeStart: () => {},
    taskProgress: (_index, _total, result) => {
      rec.progress.push(result);
    },
    summary: (summary, failures) => {
      rec.summary = summary;
      rec.failures = failures;
    },
    jsonPayload: (payload) => {
      rec.jsonPayload = payload;
    },
  };
  return { renderer, rec };
}

const baseArgs: CliArgs = {
  workspace: "12345678901234",
  from: "old@example.com",
  to: "new@example.com",
  dryRun: false,
  json: false,
  quiet: false,
  verbose: false,
  yes: false,
};

// Pass-through runner for the direct resolveWorkspace tests (no throttle).
const instantRun = <T>(fn: () => Promise<T>): Promise<T> => fn();

// --- runMigration: idempotency filter -------------------------------------

Deno.test("runMigration: idempotency filter skips tasks already assigned to `to`", async () => {
  const tasks: AsanaTask[] = [
    { gid: "t1", name: "Task 1", assigneeGid: FROM_GID },
    { gid: "t2", name: "Task 2", assigneeGid: TO_GID }, // already on target → skipped
    { gid: "t3", name: "Task 3", assigneeGid: FROM_GID },
  ];
  const { client, calls } = makeFakeClient({
    listAssignedIncompleteTasks: () => Promise.resolve(tasks),
  });
  const { renderer, rec } = recordingRenderer();

  const code = await runMigration({
    args: baseArgs,
    client,
    renderer,
    promptConfirm: () => true,
  });

  // Only the two from-assigned tasks are updated; t2 is never touched.
  assertEquals(calls.updateTaskAssignee, [
    { taskGid: "t1", toGid: TO_GID },
    { taskGid: "t3", toGid: TO_GID },
  ]);
  // discoveryDone receives the post-filter count.
  assertEquals(rec.discoveryDoneCount, 2);
  // All updates succeed → exit 0.
  assertEquals(rec.summary, { total: 2, success: 2, failed: 0 });
  assertEquals(code, 0);
});

// --- runMigration: dry-run guard ------------------------------------------

Deno.test("runMigration: dry-run never mutates and returns 0", async () => {
  const tasks: AsanaTask[] = [{ gid: "t1", name: "Task 1", assigneeGid: FROM_GID }];
  const { client, calls } = makeFakeClient({
    listAssignedIncompleteTasks: () => Promise.resolve(tasks),
  });
  const { renderer } = recordingRenderer();

  // No promptConfirm: dry-run returns before the confirmation prompt, so the
  // real stdin reader is never reached.
  const code = await runMigration({
    args: { ...baseArgs, dryRun: true },
    client,
    renderer,
  });

  assertEquals(calls.updateTaskAssignee.length, 0);
  assertEquals(code, 0);
});

// --- runMigration: confirmation decline / accept / --yes ------------------

Deno.test("runMigration: declining the prompt makes zero updates and returns 0", async () => {
  const tasks: AsanaTask[] = [{ gid: "t1", name: "Task 1", assigneeGid: FROM_GID }];
  const { client, calls } = makeFakeClient({
    listAssignedIncompleteTasks: () => Promise.resolve(tasks),
  });
  const { renderer } = recordingRenderer();

  let promptCalls = 0;
  const code = await runMigration({
    args: baseArgs,
    client,
    renderer,
    promptConfirm: () => {
      promptCalls++;
      return false;
    },
  });

  assertEquals(promptCalls, 1);
  assertEquals(calls.updateTaskAssignee.length, 0);
  assertEquals(code, 0);
});

Deno.test("runMigration: --yes bypasses the prompt and proceeds to execution", async () => {
  const tasks: AsanaTask[] = [{ gid: "t1", name: "Task 1", assigneeGid: FROM_GID }];
  const { client, calls } = makeFakeClient({
    listAssignedIncompleteTasks: () => Promise.resolve(tasks),
  });
  const { renderer } = recordingRenderer();

  let promptCalls = 0;
  const code = await runMigration({
    args: { ...baseArgs, yes: true },
    client,
    renderer,
    promptConfirm: () => {
      promptCalls++;
      return true;
    },
  });

  // --yes short-circuits before promptConfirm is consulted.
  assertEquals(promptCalls, 0);
  assertEquals(calls.updateTaskAssignee, [{ taskGid: "t1", toGid: TO_GID }]);
  assertEquals(code, 0);
});

// --- runMigration: partial failure ----------------------------------------

Deno.test("runMigration: partial failure is recorded, continues, and returns 1", async () => {
  const tasks: AsanaTask[] = [
    { gid: "t1", name: "Task 1", assigneeGid: FROM_GID },
    { gid: "t2", name: "Task 2", assigneeGid: FROM_GID },
  ];
  const { client, calls } = makeFakeClient({
    listAssignedIncompleteTasks: () => Promise.resolve(tasks),
    // 403 is not a rate-limit, so the runner rethrows immediately (no retry/backoff).
    updateTaskAssignee: (taskGid) =>
      taskGid === "t2"
        ? Promise.reject(new AsanaApiErrorImpl(403, "not_authorized", "no access"))
        : Promise.resolve(),
  });
  const { renderer, rec } = recordingRenderer();

  const code = await runMigration({
    args: baseArgs,
    client,
    renderer,
    promptConfirm: () => true,
  });

  // Both tasks are attempted (continue past the failure).
  assertEquals(calls.updateTaskAssignee.map((c) => c.taskGid), ["t1", "t2"]);
  assertEquals(rec.summary, { total: 2, success: 1, failed: 1 });
  assertEquals(rec.failures.length, 1);
  assertEquals(rec.failures[0].gid, "t2");
  assertEquals(rec.failures[0].error?.httpStatus, 403);
  assertEquals(code, 1);
});

// --- resolveWorkspace: four branches + 401 hint ---------------------------

Deno.test("resolveWorkspace: numeric GID resolves directly via getWorkspace (no listing)", async () => {
  const { client, calls } = makeFakeClient({
    getWorkspace: (gid) => Promise.resolve({ gid, name: "Direct WS" }),
  });

  const ws = await resolveWorkspace(client, instantRun, "12345678901234");

  assertEquals(ws.gid, "12345678901234");
  assertEquals(calls.getWorkspace, ["12345678901234"]);
  assertEquals(calls.listWorkspaces, 0);
});

Deno.test("resolveWorkspace: single domain match re-fetches the matched workspace", async () => {
  const workspaces: Workspace[] = [
    { gid: "w1", name: "Acme", isOrganization: true, emailDomains: ["acme.com"] },
    { gid: "w2", name: "Other", isOrganization: true, emailDomains: ["other.com"] },
  ];
  const { client, calls } = makeFakeClient({
    listWorkspaces: () => Promise.resolve(workspaces),
    getWorkspace: (gid) => Promise.resolve({ gid, name: "Acme (canonical)" }),
  });

  const ws = await resolveWorkspace(client, instantRun, "acme.com");

  assertEquals(ws.gid, "w1");
  assertEquals(calls.listWorkspaces, 1);
  // The domain path re-fetches via getWorkspace for the same access/404 check.
  assertEquals(calls.getWorkspace, ["w1"]);
});

Deno.test("resolveWorkspace: zero domain matches throws PreCheckError listing visible workspaces", async () => {
  const { client } = makeFakeClient({
    listWorkspaces: () =>
      Promise.resolve([{
        gid: "w2",
        name: "Other",
        isOrganization: true,
        emailDomains: ["other.com"],
      }]),
  });

  const err = await assertRejects(
    () => resolveWorkspace(client, instantRun, "acme.com"),
    PreCheckError,
    'no workspace found for domain "acme.com"',
  );
  assertStringIncludes(err.hint ?? "", "Visible workspaces");
  assertStringIncludes(err.hint ?? "", "w2");
});

Deno.test("resolveWorkspace: multiple domain matches throws PreCheckError listing the matches", async () => {
  const { client } = makeFakeClient({
    listWorkspaces: () =>
      Promise.resolve([
        { gid: "w1", name: "Acme A", isOrganization: true, emailDomains: ["acme.com"] },
        { gid: "w2", name: "Acme B", isOrganization: true, emailDomains: ["acme.com"] },
      ]),
  });

  const err = await assertRejects(
    () => resolveWorkspace(client, instantRun, "acme.com"),
    PreCheckError,
    "matches multiple workspaces",
  );
  assertStringIncludes(err.hint ?? "", "Matching workspaces");
  // getWorkspace is not called when the domain is ambiguous.
  assert(!(err.hint ?? "").includes("Visible workspaces"));
});

Deno.test("resolveWorkspace: getWorkspace 401 surfaces the ASANA_ACCESS_TOKEN hint", async () => {
  const { client } = makeFakeClient({
    getWorkspace: () => Promise.reject(new AsanaApiErrorImpl(401, "unauthorized", "bad token")),
  });

  const err = await assertRejects(
    () => resolveWorkspace(client, instantRun, "12345678901234"),
    PreCheckError,
    "workspace not found or no access",
  );
  assertStringIncludes(err.hint ?? "", "ASANA_ACCESS_TOKEN may be invalid");
});
