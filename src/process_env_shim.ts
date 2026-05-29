// process.env shim — keeps the narrow `--allow-env=ASANA_ACCESS_TOKEN` permission
// (R9 / H-DENO1) usable when loading npm:asana.
//
// Root cause (see skill `deno-narrow-env-permission`):
//   npm:asana@3.1.11 → debug@4.4.3 runs `Object.keys(process.env)` at module
//   load (debug/src/node.js:124). Deno treats *enumerating* the environment as a
//   distinct capability from *reading one variable*, so under
//   `--allow-env=ASANA_ACCESS_TOKEN` the enumeration throws
//   `NotCapable: Requires env access` and the SDK import aborts before any
//   migration work runs. Lazy-importing the SDK (src/main.ts) only spares the
//   help/version path this cost — the actual migration path still imports the SDK
//   and still crashes.
//
// Fix: before "asana" is imported, replace `process.env` with a detached plain
// object seeded only with the env names this tool is permitted to read. After the
// swap, `Object.keys(process.env)`, `for..in`, and `process.env.ANYTHING` are
// ordinary property operations on a normal object — Deno's env permission is
// never consulted — so the narrow grant is preserved and any transitive dep that
// enumerates or probes the environment (debug, superagent, supports-color, …)
// loads cleanly. Reads of names outside the grant return `undefined` instead of
// throwing, which matches the permission's intent: only ASANA_ACCESS_TOKEN is in
// scope.
//
// `node:process` default export is the same singleton as the global `process`,
// so this swap is visible to deps that reference the global. Our own code never
// reads env through this object — main.ts uses `Deno.env.get("ASANA_ACCESS_TOKEN")`
// directly. Import this module *before* `import ... from "asana"` (see
// src/asana_client.ts); ES module evaluation order guarantees this shim runs
// first.

import process from "node:process";

// Keep in sync with the `--allow-env=...` list in deno.json's `migrate` task.
const PERMITTED_ENV_NAMES = ["ASANA_ACCESS_TOKEN"] as const;

const snapshot: Record<string, string> = {};
for (const name of PERMITTED_ENV_NAMES) {
  try {
    const value = Deno.env.get(name);
    if (value !== undefined) snapshot[name] = value;
  } catch {
    // Name not actually granted at runtime (allowlist drift) — skip it rather
    // than crash. The SDK receives the PAT via an explicit constructor argument,
    // not via env, so a missing seed never breaks authentication.
  }
}

process.env = snapshot;
