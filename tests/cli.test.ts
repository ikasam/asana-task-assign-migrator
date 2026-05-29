import { assert, assertEquals, assertThrows } from "@std/assert";
import { CliUsageError, parseArgs } from "../src/cli.ts";

// ---- top-level dispatch ----

Deno.test("parseArgs: no subcommand → help", () => {
  assertEquals(parseArgs([]).kind, "help");
});

Deno.test("parseArgs: -h/--help short-circuit to help", () => {
  assertEquals(parseArgs(["--help"]).kind, "help");
  assertEquals(parseArgs(["-h"]).kind, "help");
});

Deno.test("parseArgs: -V/--version short-circuit to version", () => {
  assertEquals(parseArgs(["--version"]).kind, "version");
  assertEquals(parseArgs(["-V"]).kind, "version");
});

Deno.test("parseArgs: unknown subcommand rejected", () => {
  assertThrows(() => parseArgs(["frobnicate"]), CliUsageError, "Unknown subcommand");
});

// ---- migrate subcommand ----

Deno.test("migrate: minimal valid run", () => {
  const r = parseArgs([
    "migrate",
    "--workspace",
    "1234567890",
    "--from",
    "a@example.com",
    "--to",
    "b@example.com",
  ]);
  assertEquals(r.kind, "migrate");
  if (r.kind !== "migrate") return;
  assertEquals(r.args.workspace, "1234567890");
  assertEquals(r.args.from, "a@example.com");
  assertEquals(r.args.to, "b@example.com");
  assertEquals(r.args.dryRun, false);
});

Deno.test("migrate: all flags", () => {
  const r = parseArgs([
    "migrate",
    "--workspace=1",
    "--from=a@x.io",
    "--to=b@x.io",
    "--dry-run",
    "--json",
    "--quiet",
    "--verbose",
    "--yes",
  ]);
  if (r.kind !== "migrate") throw new Error("expected migrate");
  assert(r.args.dryRun && r.args.json && r.args.quiet && r.args.verbose && r.args.yes);
});

Deno.test("migrate: --help → help with topic", () => {
  const r = parseArgs(["migrate", "--help"]);
  assertEquals(r.kind, "help");
  if (r.kind === "help") assertEquals(r.topic, "migrate");
});

Deno.test("migrate: missing required throws", () => {
  assertThrows(() => parseArgs(["migrate"]), CliUsageError, "Missing required option");
  assertThrows(
    () => parseArgs(["migrate", "--workspace", "1", "--from", "a@b.c"]),
    CliUsageError,
    "--to",
  );
});

Deno.test("migrate: workspace must be numeric", () => {
  assertThrows(
    () => parseArgs(["migrate", "--workspace", "abc", "--from", "a@b.c", "--to", "c@d.e"]),
    CliUsageError,
    "Invalid --workspace",
  );
});

Deno.test("migrate: email format enforced", () => {
  assertThrows(
    () => parseArgs(["migrate", "--workspace", "1", "--from", "not-email", "--to", "c@d.e"]),
    CliUsageError,
    "Invalid --from",
  );
  assertThrows(
    () => parseArgs(["migrate", "--workspace", "1", "--from", "a@b.c", "--to", "nope"]),
    CliUsageError,
    "Invalid --to",
  );
});

Deno.test("migrate: from == to rejected", () => {
  assertThrows(
    () => parseArgs(["migrate", "--workspace", "1", "--from", "A@X.io", "--to", "a@x.io"]),
    CliUsageError,
    "must differ",
  );
});

Deno.test("migrate: unknown option rejected", () => {
  assertThrows(
    () => parseArgs(["migrate", "--workspace", "1", "--from", "a@b.c", "--to", "c@d.e", "--bogus"]),
    CliUsageError,
    "Unknown option",
  );
});

Deno.test("migrate: flag without value rejected", () => {
  assertThrows(
    () => parseArgs(["migrate", "--workspace", "--from", "a@b.c", "--to", "c@d.e"]),
    CliUsageError,
    "requires a value",
  );
});

// ---- survey subcommand ----

Deno.test("survey: minimal valid", () => {
  const r = parseArgs(["survey", "--workspace", "1234567890", "--domain", "example.com"]);
  assertEquals(r.kind, "survey");
  if (r.kind !== "survey") return;
  assertEquals(r.args.workspace, "1234567890");
  assertEquals(r.args.domain, "example.com");
  assertEquals(r.args.json, false);
  assertEquals(r.args.quiet, false);
});

Deno.test("survey: flags + equals form + lowercasing", () => {
  const r = parseArgs([
    "survey",
    "--workspace=1",
    "--domain=Example.COM",
    "--json",
    "--verbose",
    "--quiet",
  ]);
  if (r.kind !== "survey") throw new Error("expected survey");
  assert(r.args.json && r.args.verbose && r.args.quiet);
  assertEquals(r.args.domain, "example.com");
});

Deno.test("survey: leading @ stripped from domain", () => {
  const r = parseArgs(["survey", "--workspace", "1", "--domain", "@example.com"]);
  if (r.kind !== "survey") throw new Error("expected survey");
  assertEquals(r.args.domain, "example.com");
});

Deno.test("survey: missing required throws", () => {
  assertThrows(() => parseArgs(["survey"]), CliUsageError, "Missing required option");
  assertThrows(
    () => parseArgs(["survey", "--workspace", "1"]),
    CliUsageError,
    "--domain",
  );
});

Deno.test("survey: workspace must be numeric", () => {
  assertThrows(
    () => parseArgs(["survey", "--workspace", "abc", "--domain", "example.com"]),
    CliUsageError,
    "Invalid --workspace",
  );
});

Deno.test("survey: invalid domain rejected", () => {
  for (const bad of ["nodot", "bad@domain.com", "trailing.", ".leading", "has space.com"]) {
    assertThrows(
      () => parseArgs(["survey", "--workspace", "1", "--domain", bad]),
      CliUsageError,
      "Invalid --domain",
    );
  }
});

Deno.test("survey: migrate-only flags rejected", () => {
  assertThrows(
    () => parseArgs(["survey", "--workspace", "1", "--domain", "example.com", "--from", "a@b.c"]),
    CliUsageError,
    "Unknown option",
  );
});

Deno.test("survey: --help → help with topic", () => {
  const r = parseArgs(["survey", "--help"]);
  assertEquals(r.kind, "help");
  if (r.kind === "help") assertEquals(r.topic, "survey");
});
