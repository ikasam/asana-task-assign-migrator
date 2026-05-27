// Phase 2 spike: live API verification for hypotheses that block the migrator design.
//
// Run:
//   ASANA_ACCESS_TOKEN=... \
//   deno run --allow-net --allow-env --allow-read spike/phase2_api.ts \
//     --workspace <gid> \
//     --user <email-of-anyone-in-workspace> \
//     [--non-member-email <email-known-to-not-be-in-workspace>] \
//     [--parent-task <task_gid-with-subtasks>]
//
// Reports findings for:
//   H-API4 — getTasks({workspace, assignee, completed_since:"now"}) returns tasks
//            with assignee.gid populated when opt_fields is set
//   H-API5 — getTasks works on a Free workspace (no 402)
//   H-API6 — getUserForWorkspace returns 404 for a non-member
//   H-DOM3 — subtasks appear in getTasks output (or need separate /subtasks walk)
//   H-DENO2 — error objects from superagent expose response.headers
//
// This script is read-only. It does NOT call updateTask.

import Asana from "asana";

interface SpikeArgs {
  workspace: string;
  user: string;
  nonMemberEmail?: string;
  parentTask?: string;
}

function parseSpikeArgs(): SpikeArgs {
  const argv = Deno.args;
  const get = (k: string) => {
    const i = argv.indexOf(k);
    return i >= 0 ? argv[i + 1] : undefined;
  };
  const ws = get("--workspace");
  const u = get("--user");
  if (!ws || !u) {
    console.error(
      "Usage: phase2_api.ts --workspace <gid> --user <email> " +
        "[--non-member-email <email>] [--parent-task <gid>]",
    );
    Deno.exit(2);
  }
  return {
    workspace: ws,
    user: u,
    nonMemberEmail: get("--non-member-email"),
    parentTask: get("--parent-task"),
  };
}

interface Report {
  hypothesis: string;
  result: "✓ supported" | "✗ rejected" | "? inconclusive";
  evidence: string;
}

const report: Report[] = [];

function record(hypothesis: string, result: Report["result"], evidence: string) {
  report.push({ hypothesis, result, evidence });
  console.log(`[${result}] ${hypothesis}`);
  console.log(`        ${evidence}\n`);
}

async function main() {
  const args = parseSpikeArgs();
  const token = Deno.env.get("ASANA_ACCESS_TOKEN");
  if (!token) {
    console.error("ASANA_ACCESS_TOKEN is not set.");
    Deno.exit(2);
  }

  // deno-lint-ignore no-explicit-any
  const client: any = new Asana.ApiClient();
  client.authentications["token"].accessToken = token;

  // deno-lint-ignore no-explicit-any
  const usersApi: any = new Asana.UsersApi(client);
  // deno-lint-ignore no-explicit-any
  const tasksApi: any = new Asana.TasksApi(client);

  setWorkspaceCtx(args.workspace);

  console.log(`\n=== Phase 2 API spike ===`);
  console.log(`workspace: ${args.workspace}`);
  console.log(`user:      ${args.user}\n`);

  // Resolve user gid first; needed for getTasks(assignee=...).
  let userGid: string;
  try {
    const me = await usersApi.getUser(args.user, { opt_fields: "name,email,gid" });
    const data = me.data ?? me;
    userGid = data.gid;
    console.log(`Resolved user: ${data.name} <${data.email}> gid=${userGid}\n`);
  } catch (err) {
    console.error("getUser failed:", err);
    Deno.exit(1);
  }

  // -------- H-API5 / H-API4 --------
  try {
    const collection = await tasksApi.getTasks({
      workspace: args.workspace,
      assignee: userGid,
      completed_since: "now",
      opt_fields: "name,gid,assignee.gid,completed",
      limit: 10,
    });
    const items = (collection.data ?? []) as Array<Record<string, unknown>>;
    record(
      "H-API5",
      "✓ supported",
      `getTasks did not 402; returned ${items.length} item(s) on first page.`,
    );

    const allFiltered = items.every((t) => t.completed === false || t.completed === undefined);
    const assigneePopulated = items.every((t) => {
      const a = t.assignee as { gid?: string } | undefined;
      return !a || typeof a.gid === "string";
    });
    if (items.length === 0) {
      record(
        "H-API4",
        "? inconclusive",
        "No tasks returned — cannot verify completed_since=now filter or opt_fields. " +
          "Pick a --user that actually has incomplete tasks in --workspace, or relax filter.",
      );
    } else if (allFiltered && assigneePopulated) {
      record(
        "H-API4",
        "✓ supported",
        `All items have completed=false and assignee.gid populated (sampled ${items.length}).`,
      );
    } else {
      record(
        "H-API4",
        "✗ rejected",
        `allFiltered=${allFiltered} assigneePopulated=${assigneePopulated}. ` +
          "Need to re-design discovery (search API or client-side filter).",
      );
    }

    // -------- H-DOM3 --------
    // Prefer the explicit --parent-task over sampling from getTasks, because the
    // sampled task may not have subtasks. If neither is available, mark inconclusive.
    const probeGid = args.parentTask ?? (items[0]?.gid as string | undefined);
    if (probeGid) {
      await probeSubtasks(tasksApi, probeGid, items);
    } else {
      record(
        "H-DOM3",
        "? inconclusive",
        "No task to probe subtasks against. Pass --parent-task <gid> to force a check.",
      );
    }
  } catch (err) {
    record(
      "H-API5",
      "✗ rejected",
      `getTasks threw: ${describeError(err)}`,
    );
    // Inspect headers presence even on error (separate from 429 path).
    inspectErrorShape(err);
  }

  // -------- H-API6 --------
  if (args.nonMemberEmail) {
    try {
      await usersApi.getUserForWorkspace(args.workspace, args.nonMemberEmail, {
        opt_fields: "gid",
      });
      record(
        "H-API6",
        "✗ rejected",
        `getUserForWorkspace returned 2xx for ${args.nonMemberEmail}. ` +
          "Need alternate membership check (e.g., list users + match).",
      );
    } catch (err) {
      const status = readStatus(err);
      record(
        "H-API6",
        status === 404 ? "✓ supported" : "✗ rejected",
        `Non-member probe returned HTTP ${status}. ${
          status === 404 ? "" : "Fall back to getUsersForWorkspace list-and-match."
        }`,
      );
    }
  } else {
    record(
      "H-API6",
      "? inconclusive",
      "Pass --non-member-email <email> to test 404 behaviour.",
    );
  }

  // -------- H-DENO2: error shape from a deliberate failure --------
  try {
    await usersApi.getUser("definitely-not-an-email-or-gid-zzz", {});
  } catch (err) {
    inspectErrorShape(err);
  }

  console.log("\n=== Summary ===");
  for (const r of report) console.log(`${r.result.padEnd(16)} ${r.hypothesis}`);
}

// Definitive H-DOM3 probe:
//   1. List subtasks of the given parent.
//   2. For each unique assignee of those subtasks, fetch their getTasks result
//      and check whether the subtask gid appears.
//   3. Report ✓ if any subtask appears in the corresponding assignee's getTasks list,
//      ✗ if no overlap exists despite having candidates, else inconclusive.
async function probeSubtasks(
  // deno-lint-ignore no-explicit-any
  tasksApi: any,
  parentGid: string,
  parentItems: Array<Record<string, unknown>>,
) {
  // deno-lint-ignore no-explicit-any
  let subs: any;
  try {
    subs = await tasksApi.getSubtasksForTask(parentGid, {
      opt_fields: "name,gid,assignee.gid,parent.gid,completed",
      limit: 50,
    });
  } catch (err) {
    record(
      "H-DOM3",
      "? inconclusive",
      `getSubtasksForTask(${parentGid}) failed: ${(err as Error).message ?? err}`,
    );
    return;
  }

  const subItems = (subs.data ?? []) as Array<Record<string, unknown>>;
  console.log(`  parent=${parentGid} has ${subItems.length} subtask(s):`);
  for (const s of subItems) {
    const a = s.assignee as { gid?: string } | undefined;
    console.log(
      `    sub=${s.gid} name="${s.name}" assignee=${a?.gid ?? "—"} completed=${s.completed}`,
    );
  }

  const assignedIncompleteSubs = subItems.filter((s) => {
    const a = s.assignee as { gid?: string } | undefined;
    return a?.gid && s.completed === false;
  });

  if (assignedIncompleteSubs.length === 0) {
    record(
      "H-DOM3",
      "? inconclusive",
      `parent=${parentGid} has no assigned+incomplete subtasks. ` +
        "Cannot determine if getTasks surfaces subtasks. " +
        "Pass another --parent-task with at least one assigned incomplete subtask, " +
        "or default subtaskMode to 'expand' for safety.",
    );
    return;
  }

  // For each unique assignee, query getTasks and check whether the subtask appears.
  const byAssignee = new Map<string, Array<Record<string, unknown>>>();
  for (const s of assignedIncompleteSubs) {
    const a = (s.assignee as { gid?: string }).gid!;
    if (!byAssignee.has(a)) byAssignee.set(a, []);
    byAssignee.get(a)!.push(s);
  }

  let foundOverlap = false;
  let totalChecked = 0;
  for (const [assigneeGid, sList] of byAssignee.entries()) {
    // deno-lint-ignore no-explicit-any
    let listRes: any;
    try {
      listRes = await tasksApi.getTasks({
        workspace: parentItems[0]
          ? (parentItems[0].workspace as { gid?: string } | undefined)?.gid ??
            getWorkspaceFromState()
          : getWorkspaceFromState(),
        assignee: assigneeGid,
        completed_since: "now",
        opt_fields: "gid",
        limit: 100,
      });
    } catch (err) {
      console.log(`    getTasks(assignee=${assigneeGid}) failed: ${(err as Error).message ?? err}`);
      continue;
    }
    const gtItems = (listRes.data ?? []) as Array<Record<string, unknown>>;
    const gtGids = new Set(gtItems.map((t) => t.gid as string));
    const subsGidsForAssignee = new Set(sList.map((s) => s.gid as string));
    const hits = [...subsGidsForAssignee].filter((g) => gtGids.has(g)).length;
    totalChecked += subsGidsForAssignee.size;
    if (hits > 0) foundOverlap = true;
    console.log(
      `    assignee=${assigneeGid}: ${subsGidsForAssignee.size} subtask(s), ` +
        `getTasks returned ${gtItems.length} item(s), overlap=${hits}`,
    );
  }

  if (foundOverlap) {
    record(
      "H-DOM3",
      "✓ supported",
      `Confirmed: getTasks returns at least one subtask among ${totalChecked} probed. ` +
        "→ subtaskMode='auto' is safe; expand fallback not strictly required.",
    );
  } else {
    record(
      "H-DOM3",
      "✗ rejected",
      `${totalChecked} incomplete+assigned subtask(s) probed, none appeared in getTasks ` +
        "for their respective assignee. → subtaskMode default MUST be 'expand'.",
    );
  }
}

// The spike defines `args` inside main() — read workspace via a small closure-bound state.
let _workspaceCtx = "";
function getWorkspaceFromState(): string {
  return _workspaceCtx;
}
function setWorkspaceCtx(w: string) {
  _workspaceCtx = w;
}

function inspectErrorShape(err: unknown) {
  const e = err as Record<string, unknown>;
  const res = e?.response as Record<string, unknown> | undefined;
  const headers = res?.headers;
  const status = res?.status ?? e?.status;
  const hasHeaders = headers != null && typeof headers === "object";
  record(
    "H-DENO2",
    hasHeaders ? "✓ supported" : "? inconclusive",
    `error.response.status=${status} headers present=${hasHeaders}. ` +
      (hasHeaders
        ? `keys=${Object.keys(headers as Record<string, unknown>).slice(0, 5).join(",")}...`
        : "Retry-After will be unreachable; rely on exponential backoff."),
  );
}

function readStatus(err: unknown): number | undefined {
  const e = err as Record<string, unknown>;
  if (typeof e?.status === "number") return e.status;
  const res = e?.response as Record<string, unknown> | undefined;
  return res?.status as number | undefined;
}

function describeError(err: unknown): string {
  const e = err as Record<string, unknown>;
  const status = readStatus(err);
  const msg = (e?.message as string) ?? String(err);
  return `HTTP ${status ?? "?"} ${msg}`;
}

if (import.meta.main) {
  await main();
}
