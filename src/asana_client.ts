// Thin facade over npm:asana@3.
//
// Goals:
//   - Centralize ApiClient construction (PAT injection via authentications['token']).
//   - Normalize SDK errors to AsanaApiError (so migrator never sees superagent shapes).
//   - Iterate Collection pagination so callers receive flat arrays.
//
// All API methods are wrapped by the caller in the rate-limiter, not here, so this
// module stays free of timing concerns.

// MUST precede the "asana" import: neutralizes debug@4.4.3's import-time
// `Object.keys(process.env)` so the SDK loads under the narrow
// `--allow-env=ASANA_ACCESS_TOKEN` permission. See src/process_env_shim.ts.
import "./process_env_shim.ts";
import Asana from "asana";
import type { AsanaApiError, AsanaTask, User, Workspace } from "./types.ts";

// deno-lint-ignore no-explicit-any
type AnyApi = any;

export interface AsanaClient {
  getWorkspace(gid: string): Promise<Workspace>;
  getUser(email: string): Promise<User>;
  // Lists every user in the workspace (with email when visible). Used by the
  // survey subcommand. Users whose email the PAT cannot see get email = "".
  listWorkspaceUsers(workspaceGid: string): Promise<User[]>;
  isMemberOfWorkspace(workspaceGid: string, userIdentifier: string): Promise<boolean>;
  listAssignedIncompleteTasks(
    workspaceGid: string,
    fromUserGid: string,
  ): Promise<AsanaTask[]>;
  updateTaskAssignee(taskGid: string, toUserGid: string): Promise<void>;
}

export class AsanaApiErrorImpl extends Error implements AsanaApiError {
  constructor(
    public httpStatus: number,
    public code: string,
    public override message: string,
  ) {
    super(message);
    this.name = "AsanaApiError";
  }
}

// Maps any thrown value from the SDK to AsanaApiError.
// SDK errors come from superagent; shape is roughly:
//   { status, response: { status, body: { errors: [{message, help?}] } } }
export function normalizeError(err: unknown): AsanaApiError {
  if (err instanceof AsanaApiErrorImpl) return err;
  if (!err || typeof err !== "object") {
    return new AsanaApiErrorImpl(0, "unknown", String(err));
  }
  const e = err as Record<string, unknown>;
  const res = (e.response ?? {}) as Record<string, unknown>;
  const status = (typeof e.status === "number" ? e.status : (res.status as number)) ?? 0;
  const body = (res.body ?? {}) as Record<string, unknown>;
  const errors = body.errors as Array<{ message?: string; help?: string }> | undefined;
  const first = errors?.[0];
  const message = first?.message ?? (e.message as string) ?? "Asana API error";
  const code = inferErrorCode(status, first?.message);
  return new AsanaApiErrorImpl(status, code, message);
}

function inferErrorCode(status: number, message?: string): string {
  if (status === 401) return "unauthorized";
  if (status === 403) return "not_authorized";
  if (status === 404) return "not_found";
  if (status === 429) return "rate_limited";
  if (status >= 500) return "server_error";
  if (message) {
    const slug = message.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
    return slug || `http_${status}`;
  }
  return `http_${status}`;
}

export interface CreateAsanaClientOpts {
  accessToken: string;
  // If true, dump request/response details to stderr (S-015).
  verbose?: boolean;
}

export function createAsanaClient(opts: CreateAsanaClientOpts): AsanaClient {
  const client = new Asana.ApiClient();
  const auth = client.authentications["token"];
  if (!auth) {
    throw new Error(
      "Asana SDK ApiClient.authentications['token'] missing — SDK version mismatch?",
    );
  }
  auth.accessToken = opts.accessToken;

  if (opts.verbose) {
    installVerboseHook(client);
  }

  const workspacesApi = new Asana.WorkspacesApi(client) as AnyApi;
  const usersApi = new Asana.UsersApi(client) as AnyApi;
  const tasksApi = new Asana.TasksApi(client) as AnyApi;

  return {
    async getWorkspace(gid: string): Promise<Workspace> {
      try {
        const res = await workspacesApi.getWorkspace(gid, { opt_fields: "name,gid" });
        const data = unwrap(res);
        return { gid: data.gid, name: data.name };
      } catch (err) {
        throw normalizeError(err);
      }
    },

    async getUser(emailOrGid: string): Promise<User> {
      try {
        const res = await usersApi.getUser(emailOrGid, { opt_fields: "name,email,gid" });
        const data = unwrap(res);
        return { gid: data.gid, email: data.email, name: data.name };
      } catch (err) {
        throw normalizeError(err);
      }
    },

    async listWorkspaceUsers(workspaceGid: string): Promise<User[]> {
      // GET /users?workspace=&opt_fields=name,email,gid — paginated like getTasks.
      // Email is only returned for users the PAT can see; absent → "" sentinel.
      const out: User[] = [];
      try {
        let page = await usersApi.getUsers({
          workspace: workspaceGid,
          opt_fields: "name,email,gid",
          limit: 100,
        });
        for (;;) {
          const data = page.data ?? [];
          for (const u of data) {
            out.push({
              gid: u.gid,
              email: (u.email ?? "").toLowerCase(),
              name: u.name ?? "",
            });
          }
          if (typeof page.nextPage !== "function") break;
          const next = await page.nextPage();
          if (!next || next.data == null) break;
          page = next;
        }
      } catch (err) {
        throw normalizeError(err);
      }
      return out;
    },

    async isMemberOfWorkspace(workspaceGid: string, userIdentifier: string): Promise<boolean> {
      // Primary path: getUserForWorkspace; H-API6 says this 404s for non-members.
      try {
        await usersApi.getUserForWorkspace(workspaceGid, userIdentifier, {
          opt_fields: "gid",
        });
        return true;
      } catch (err) {
        const norm = normalizeError(err);
        if (norm.httpStatus === 404) return false;
        // If H-API6 turns out false (200 + body indicates non-member, or different status),
        // fall back to listing workspace users and matching. The spike confirms which path.
        throw norm;
      }
    },

    async listAssignedIncompleteTasks(
      workspaceGid: string,
      fromUserGid: string,
    ): Promise<AsanaTask[]> {
      const out: AsanaTask[] = [];
      // S-011: workspace + assignee=from + completed_since=now + opt_fields + limit=100
      try {
        let page = await tasksApi.getTasks({
          workspace: workspaceGid,
          assignee: fromUserGid,
          completed_since: "now",
          opt_fields: "name,gid,assignee.gid",
          limit: 100,
        });
        for (;;) {
          const data = page.data ?? [];
          for (const t of data) {
            out.push({
              gid: t.gid,
              name: t.name,
              assigneeGid: t.assignee?.gid ?? null,
            });
          }
          if (typeof page.nextPage !== "function") break;
          const next = await page.nextPage();
          if (!next || next.data == null) break;
          page = next;
        }
      } catch (err) {
        throw normalizeError(err);
      }
      return out;
    },

    async updateTaskAssignee(taskGid: string, toUserGid: string): Promise<void> {
      // S-012: body is exactly { data: { assignee: to_gid } }, nothing else.
      try {
        await tasksApi.updateTask({ data: { assignee: toUserGid } }, taskGid, {
          opt_fields: "gid,assignee.gid",
        });
      } catch (err) {
        throw normalizeError(err);
      }
    },
  };
}

// SDK returns either Collection (paginated endpoints) or { data: ... } directly.
// Either way unwrap to the inner record.
// deno-lint-ignore no-explicit-any
function unwrap(res: any): any {
  return res?.data ?? res;
}

// Wraps ApiClient.callApi to dump request line and response status to stderr (S-015).
// The SDK uses superagent internally and doesn't expose a request hook, so we monkey-patch
// callApi — the single funnel point through which every API call flows.
//
// callApi signature (Asana SDK 3.1.11 ApiClient.js#callApi):
//   callApi(path, httpMethod, pathParams, queryParams, headerParams,
//           formParams, bodyParam, authNames, contentTypes, accepts, returnType)
// Resolves to `{ data, response }` where `response` is superagent's Response object —
// `response.status` is the HTTP status code. (API methods like `getWorkspace` unwrap
// `.data` downstream; we hook callApi directly so we still see the raw shape.)
function installVerboseHook(client: AnyApi): void {
  const original = client.callApi.bind(client) as (
    ...args: unknown[]
  ) => Promise<unknown>;
  const encoder = new TextEncoder();
  const write = (s: string) => {
    try {
      Deno.stderr.writeSync(encoder.encode(s));
    } catch {
      // stderr may not be writable in unusual host environments; swallow silently.
    }
  };
  client.callApi = function (
    path: string,
    httpMethod: string,
    pathParams: Record<string, unknown>,
    queryParams: Record<string, unknown>,
    ...rest: unknown[]
  ): Promise<unknown> {
    const url = client.buildUrl(path, pathParams);
    const qs = serializeQuery(queryParams);
    const fullUrl = qs ? `${url}?${qs}` : url;
    write(`> ${httpMethod.toUpperCase()} ${fullUrl}\n`);
    return original(path, httpMethod, pathParams, queryParams, ...rest).then(
      (res) => {
        const status = (res as { response?: { status?: number } })?.response?.status;
        write(`< ${status ?? "?"}\n`);
        return res;
      },
      (err) => {
        const e = err as { status?: number; response?: { status?: number } };
        const status = e?.status ?? e?.response?.status ?? "ERR";
        write(`< ${status}\n`);
        throw err;
      },
    );
  };
}

// Serializes the SDK's queryParams object the same way superagent.query() would.
// We don't reuse client.normalizeParams() because we want a flat URLSearchParams output
// (arrays are joined with comma — sufficient for Asana's opt_fields / limit / etc.).
function serializeQuery(params: Record<string, unknown> | undefined): string {
  if (!params) return "";
  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v == null) continue;
    if (Array.isArray(v)) usp.append(k, v.map(String).join(","));
    else usp.append(k, String(v));
  }
  return usp.toString();
}
