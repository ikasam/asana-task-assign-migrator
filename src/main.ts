// Entrypoint: wire CLI → migrator → output, then translate outcomes to exit codes (S-006).
//
// Exit semantics:
//   0 — all tasks succeeded / dry-run completed / confirmation declined
//   1 — at least one task update failed (execution attempted)
//   2 — pre-execution error (args, env, pre-check)

import { CliUsageError, helpText, parseArgs, versionText } from "./cli.ts";
import { createRenderer, formatFatal, stdWriter } from "./output.ts";
import type { ExitCode } from "./types.ts";

const PAT_ENV = "ASANA_ACCESS_TOKEN";
const PAT_HINT = "Set ASANA_ACCESS_TOKEN to a Personal Access Token.\n" +
  "Issue one at https://app.asana.com/0/my-apps";

if (import.meta.main) {
  const code = await main(Deno.args);
  Deno.exit(code);
}

export async function main(argv: readonly string[]): Promise<ExitCode> {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (e) {
    if (e instanceof CliUsageError) {
      formatFatal({ message: e.message, hint: e.hint });
      return 2;
    }
    throw e;
  }

  if (parsed.kind === "help") {
    stdWriter.out(helpText(parsed.topic));
    return 0;
  }
  if (parsed.kind === "version") {
    stdWriter.out(versionText());
    return 0;
  }

  const token = Deno.env.get(PAT_ENV);
  if (!token) {
    formatFatal({ message: `${PAT_ENV} is not set.`, hint: PAT_HINT });
    return 2;
  }

  // Lazy-import the SDK boundary so help/version don't pay the cost of loading
  // npm:asana (which transitively reads process.env at import time).
  const { createAsanaClient } = await import("./asana_client.ts");
  const { PreCheckError } = await import("./migrator.ts");
  const client = createAsanaClient({ accessToken: token, verbose: parsed.args.verbose });

  try {
    if (parsed.kind === "migrate") {
      const { runMigration } = await import("./migrator.ts");
      const renderer = createRenderer(parsed.args);
      return await runMigration({ args: parsed.args, client, renderer });
    }
    // survey (read-only)
    const { runSurvey } = await import("./survey.ts");
    return await runSurvey({ args: parsed.args, client });
  } catch (e) {
    if (e instanceof PreCheckError) {
      formatFatal({ message: e.message, hint: e.hint });
      return 2;
    }
    // Unknown failure during pre-checks (network down, SDK crash, etc.): exit 2.
    const msg = e instanceof Error ? e.message : String(e);
    formatFatal({ message: `Unexpected error: ${msg}` });
    return 2;
  }
}
