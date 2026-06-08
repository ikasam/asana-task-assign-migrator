import { assert, assertEquals, assertStringIncludes } from "@std/assert";
import { confirm, createRenderer, renderSurvey, type Writer } from "../src/output.ts";
import type {
  AsanaTask,
  CliArgs,
  SurveyArgs,
  SurveyPayload,
  TaskResult,
  User,
  Workspace,
} from "../src/types.ts";

function captureWriter() {
  const out: string[] = [];
  const err: string[] = [];
  const w: Writer = {
    out: (s) => out.push(s),
    err: (s) => err.push(s),
  };
  return { w, out: () => out.join(""), err: () => err.join("") };
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

const ws: Workspace = { gid: "12345678901234", name: "My Company" };
const from: User = { gid: "12345678900001", email: "old@example.com", name: "Old User" };
const to: User = { gid: "12345678900002", email: "new@example.com", name: "New User" };

const sampleTasks: AsanaTask[] = [
  { gid: "12345678900011", name: "Q2 planning document", assigneeGid: "12345678900001" },
  { gid: "12345678900012", name: "Review onboarding flow", assigneeGid: "12345678900001" },
];

Deno.test("renderer (human, dry-run): banner + task list + footer", () => {
  const cap = captureWriter();
  const r = createRenderer({ ...baseArgs, dryRun: true }, cap.w);
  r.banner({ ...baseArgs, dryRun: true }, ws, from, { ...to, isMember: true });
  r.discoveryStart(from.email);
  r.discoveryDone(sampleTasks.length);
  r.dryRunTaskList(sampleTasks);
  r.dryRunFooter();

  const text = cap.out();
  assertStringIncludes(text, "Asana Task Assignee Migration (DRY RUN)");
  assertStringIncludes(text, `Workspace : My Company (gid: 12345678901234)`);
  assertStringIncludes(text, `From      : old@example.com (Old User, gid: 12345678900001)`);
  assertStringIncludes(
    text,
    `To        : new@example.com (New User, gid: 12345678900002)  ✓ member of workspace`,
  );
  assertStringIncludes(text, `Discovering incomplete tasks assigned to old@example.com`);
  assertStringIncludes(text, "Found 2 tasks.");
  assertStringIncludes(text, "12345678900011  Q2 planning document");
  assertStringIncludes(text, "DRY RUN: no changes were made.");
});

Deno.test("renderer (human, execute): per-task progress and summary", () => {
  const cap = captureWriter();
  const r = createRenderer(baseArgs, cap.w);
  r.banner(baseArgs, ws, from, { ...to, isMember: true });
  r.discoveryStart(from.email);
  r.discoveryDone(2);
  r.executeStart(2);
  r.taskProgress(1, 2, { gid: "abc", name: "task one", status: "success" });
  r.taskProgress(2, 2, {
    gid: "def",
    name: "task two",
    status: "failed",
    error: { httpStatus: 403, code: "not_authorized", message: "..." },
  });
  r.summary({ total: 2, success: 1, failed: 1 }, [
    {
      gid: "def",
      name: "task two",
      status: "failed",
      error: { httpStatus: 403, code: "not_authorized", message: "..." },
    },
  ]);

  const text = cap.out();
  const errText = cap.err();
  assertStringIncludes(text, "Migrating 2 tasks");
  assertStringIncludes(text, "[1/2] abc  task one");
  assertStringIncludes(text, "[2/2] def  task two");
  assertStringIncludes(text, "✓");
  assertStringIncludes(text, "✗ HTTP 403 not_authorized");
  assertStringIncludes(text, "Total    : 2");
  assertStringIncludes(text, "Success  : 1");
  assertStringIncludes(text, "Failed   : 1");
  assertStringIncludes(errText, "Failures:");
  assertStringIncludes(errText, "def  task two  HTTP 403 not_authorized");
});

Deno.test("renderer (quiet): suppresses progress but keeps summary + failures", () => {
  const cap = captureWriter();
  const r = createRenderer({ ...baseArgs, quiet: true }, cap.w);
  r.banner(baseArgs, ws, from, { ...to, isMember: true });
  r.discoveryStart(from.email);
  r.discoveryDone(1);
  r.executeStart(1);
  r.taskProgress(1, 1, { gid: "abc", name: "n", status: "success" });

  const fail: TaskResult = {
    gid: "x",
    name: "fail",
    status: "failed",
    error: { httpStatus: 500, code: "server_error", message: "boom" },
  };
  r.summary({ total: 1, success: 0, failed: 1 }, [fail]);

  const text = cap.out();
  const errText = cap.err();
  // No banner / per-task lines:
  assert(!text.includes("Asana Task Assignee Migration"));
  assert(!text.includes("[1/1]"));
  // Summary still present:
  assertStringIncludes(text, "Total    : 1");
  // Failures still go to stderr:
  assertStringIncludes(errText, "fail  HTTP 500 server_error");
});

Deno.test("renderer (json): payload is single JSON object on stdout", () => {
  const cap = captureWriter();
  const args = { ...baseArgs, json: true, dryRun: true };
  const r = createRenderer(args, cap.w);
  // Intermediate calls are no-ops in JSON mode:
  r.banner(args, ws, from, { ...to, isMember: true });
  r.discoveryStart(from.email);
  r.discoveryDone(2);
  r.dryRunTaskList(sampleTasks);

  r.jsonPayload({
    mode: "dry-run",
    workspace: ws,
    from,
    to: { ...to, isMember: true },
    tasks: sampleTasks,
    count: 2,
  });

  const text = cap.out();
  const parsed = JSON.parse(text);
  assertEquals(parsed.mode, "dry-run");
  assertEquals(parsed.count, 2);
  assertEquals(parsed.workspace.gid, "12345678901234");
  assertEquals(parsed.tasks.length, 2);
});

Deno.test("confirm: accepts y/yes (case-insensitive), rejects others", () => {
  const cap = captureWriter();
  assertEquals(confirm("?", () => "y\n", cap.w), true);
  assertEquals(confirm("?", () => "Y\n", cap.w), true);
  assertEquals(confirm("?", () => "yes\n", cap.w), true);
  assertEquals(confirm("?", () => "YES\n", cap.w), true);
  assertEquals(confirm("?", () => "n\n", cap.w), false);
  assertEquals(confirm("?", () => "\n", cap.w), false);
  assertEquals(confirm("?", () => null, cap.w), false);
});

// ---- survey rendering ----

const surveyArgs: SurveyArgs = {
  workspace: "12345678901234",
  domain: "example.com",
  json: false,
  verbose: false,
  quiet: false,
};

const surveyPayload: SurveyPayload = {
  mode: "survey",
  workspace: { gid: "12345678901234", name: "My Company" },
  domain: "example.com",
  totalUsers: 714,
  emailInvisibleUsers: 97,
  matchedAccounts: 2,
  accountsWithTasks: 1,
  totalIncompleteTasks: 5,
  accounts: [
    {
      gid: "12345678900001",
      name: "Alice",
      email: "alice@example.com",
      count: 5,
      tasks: [{ gid: "t1", name: "Task 1", assigneeGid: "12345678900001" }],
    },
    { gid: "12345678900002", name: "Bob", email: "bob@example.com", count: 0, tasks: [] },
  ],
  erroredAccounts: 0,
};

Deno.test("renderSurvey (human): header, breakdown, invisible note, summary", () => {
  const cap = captureWriter();
  renderSurvey(surveyArgs, surveyPayload, cap.w);
  const text = cap.out();
  assertStringIncludes(text, "=== Unmigrated-task survey ===");
  assertStringIncludes(text, "workspace : My Company (12345678901234)");
  assertStringIncludes(text, "domain    : @example.com");
  assertStringIncludes(text, "714 user(s); 2 match @example.com");
  assertStringIncludes(text, "97 user(s) returned no email");
  assertStringIncludes(text, "5  Alice <alice@example.com>");
  assertStringIncludes(text, "unmigrated incomplete tasks : 5");
});

Deno.test("renderSurvey (quiet): omits breakdown, keeps summary", () => {
  const cap = captureWriter();
  renderSurvey({ ...surveyArgs, quiet: true }, surveyPayload, cap.w);
  const text = cap.out();
  assert(!text.includes("Alice <alice@example.com>"));
  assertStringIncludes(text, "=== Summary ===");
  assertStringIncludes(text, "unmigrated incomplete tasks : 5");
});

Deno.test("renderSurvey (json): single JSON object on stdout", () => {
  const cap = captureWriter();
  renderSurvey({ ...surveyArgs, json: true }, surveyPayload, cap.w);
  const parsed = JSON.parse(cap.out());
  assertEquals(parsed.mode, "survey");
  assertEquals(parsed.totalIncompleteTasks, 5);
  assertEquals(parsed.emailInvisibleUsers, 97);
  assertEquals(parsed.accounts.length, 2);
});

Deno.test("renderSurvey: per-account error surfaced in human and quiet (R23)", () => {
  const withErr: SurveyPayload = {
    ...surveyPayload,
    erroredAccounts: 1,
    accountsWithTasks: 0,
    accounts: [
      {
        gid: "12345678900003",
        name: "Carol",
        email: "carol@example.com",
        count: 0,
        tasks: [],
        error: { httpStatus: 403, code: "not_authorized", message: "x" },
      },
    ],
  };

  const cap = captureWriter();
  renderSurvey(surveyArgs, withErr, cap.w);
  const text = cap.out();
  assertStringIncludes(text, "Errored accounts (task counts unavailable):");
  assertStringIncludes(text, "Carol <carol@example.com>: HTTP 403 not_authorized");
  assertStringIncludes(text, "accounts that errored");

  // --quiet still reports errored accounts (continue + report).
  const capQ = captureWriter();
  renderSurvey({ ...surveyArgs, quiet: true }, withErr, capQ.w);
  assertStringIncludes(capQ.out(), "Carol <carol@example.com>: HTTP 403 not_authorized");
});
