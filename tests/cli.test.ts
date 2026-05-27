import { assert, assertEquals, assertThrows } from "@std/assert";
import { CliUsageError, parseArgs } from "../src/cli.ts";

Deno.test("parseArgs: minimal valid run", () => {
  const r = parseArgs([
    "--workspace",
    "1234567890",
    "--from",
    "a@example.com",
    "--to",
    "b@example.com",
  ]);
  assertEquals(r.kind, "run");
  if (r.kind !== "run") return;
  assertEquals(r.args.workspace, "1234567890");
  assertEquals(r.args.from, "a@example.com");
  assertEquals(r.args.to, "b@example.com");
  assertEquals(r.args.dryRun, false);
  assertEquals(r.args.json, false);
  assertEquals(r.args.yes, false);
});

Deno.test("parseArgs: all flags", () => {
  const r = parseArgs([
    "--workspace=1",
    "--from=a@x.io",
    "--to=b@x.io",
    "--dry-run",
    "--json",
    "--quiet",
    "--verbose",
    "--yes",
  ]);
  if (r.kind !== "run") throw new Error("expected run");
  assert(r.args.dryRun && r.args.json && r.args.quiet && r.args.verbose && r.args.yes);
});

Deno.test("parseArgs: --help short-circuits", () => {
  assertEquals(parseArgs(["--help"]).kind, "help");
  assertEquals(parseArgs(["-h"]).kind, "help");
  assertEquals(parseArgs(["--workspace", "1", "-h"]).kind, "help");
});

Deno.test("parseArgs: --version short-circuits", () => {
  assertEquals(parseArgs(["--version"]).kind, "version");
  assertEquals(parseArgs(["-V"]).kind, "version");
});

Deno.test("parseArgs: missing required throws", () => {
  assertThrows(() => parseArgs([]), CliUsageError, "Missing required option");
  assertThrows(
    () => parseArgs(["--workspace", "1", "--from", "a@b.c"]),
    CliUsageError,
    "--to",
  );
});

Deno.test("parseArgs: workspace must be numeric", () => {
  assertThrows(
    () => parseArgs(["--workspace", "abc", "--from", "a@b.c", "--to", "c@d.e"]),
    CliUsageError,
    "Invalid --workspace",
  );
});

Deno.test("parseArgs: email format enforced", () => {
  assertThrows(
    () => parseArgs(["--workspace", "1", "--from", "not-email", "--to", "c@d.e"]),
    CliUsageError,
    "Invalid --from",
  );
  assertThrows(
    () => parseArgs(["--workspace", "1", "--from", "a@b.c", "--to", "nope"]),
    CliUsageError,
    "Invalid --to",
  );
});

Deno.test("parseArgs: from == to rejected", () => {
  assertThrows(
    () => parseArgs(["--workspace", "1", "--from", "A@X.io", "--to", "a@x.io"]),
    CliUsageError,
    "must differ",
  );
});

Deno.test("parseArgs: unknown option rejected", () => {
  assertThrows(
    () => parseArgs(["--workspace", "1", "--from", "a@b.c", "--to", "c@d.e", "--bogus"]),
    CliUsageError,
    "Unknown option",
  );
});

Deno.test("parseArgs: flag without value rejected", () => {
  assertThrows(
    () => parseArgs(["--workspace", "--from", "a@b.c", "--to", "c@d.e"]),
    CliUsageError,
    "requires a value",
  );
});
