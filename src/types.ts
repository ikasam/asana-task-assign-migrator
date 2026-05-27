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
