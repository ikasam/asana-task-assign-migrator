// Shared types across the CLI / output / migrator boundary.
// Keep this file free of Asana SDK imports so it stays unit-testable in isolation.

export type OutputMode = "human" | "json";

export interface CliArgs {
  workspace: string;
  from: string;
  to: string;
  dryRun: boolean;
  json: boolean;
  quiet: boolean;
  verbose: boolean;
  yes: boolean;
}

export interface Workspace {
  gid: string;
  name: string;
  // Populated only by listWorkspaces (for --workspace domain resolution, S-027).
  // An organization carries its registered email domains here; a plain workspace
  // has isOrganization=false and no domains. getWorkspace leaves these undefined.
  isOrganization?: boolean;
  emailDomains?: string[];
}

export interface User {
  gid: string;
  email: string;
  name: string;
}

export interface AsanaTask {
  gid: string;
  name: string;
  assigneeGid: string | null;
}

export interface AsanaApiError {
  httpStatus: number;
  code: string;
  message: string;
  // Seconds from the response's Retry-After header (429), when present. Preserved
  // through normalization so the rate limiter can honor it instead of falling
  // back to exponential backoff.
  retryAfterSec?: number;
}

export interface TaskResult {
  gid: string;
  name: string;
  status: "success" | "failed";
  error?: AsanaApiError;
}

export interface MigrationSummary {
  total: number;
  success: number;
  failed: number;
}

export type ExitCode = 0 | 1 | 2;

// Discriminated union for the final output payload.
// Render layer (output.ts) picks human vs json based on CliArgs.json.
export type OutputPayload =
  | {
    mode: "dry-run";
    workspace: Workspace;
    from: User;
    to: User & { isMember: true };
    tasks: AsanaTask[];
    count: number;
  }
  | {
    mode: "execute";
    workspace: Workspace;
    from: User;
    to: User;
    summary: MigrationSummary;
    results: TaskResult[];
  };

// ---- survey subcommand ----
// Read-only: counts incomplete tasks still assigned to accounts in a given
// email domain (i.e. how much is left to migrate).

export interface SurveyArgs {
  workspace: string;
  domain: string;
  json: boolean;
  verbose: boolean;
  quiet: boolean;
}

export interface SurveyAccountResult {
  gid: string;
  name: string;
  email: string;
  count: number;
  tasks: AsanaTask[];
  // Present when listing this account's tasks failed (R23: continue + report).
  error?: AsanaApiError;
}

export interface SurveyPayload {
  mode: "survey";
  workspace: Workspace;
  domain: string;
  // Total users in the workspace (all domains).
  totalUsers: number;
  // Users whose email the PAT could not see (cannot be domain-classified).
  emailInvisibleUsers: number;
  matchedAccounts: number;
  accountsWithTasks: number;
  totalIncompleteTasks: number;
  // Sorted by count descending.
  accounts: SurveyAccountResult[];
  erroredAccounts: number;
}
