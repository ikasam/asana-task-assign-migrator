import { assert, assertEquals } from "@std/assert";

// Regression guard for the debug@4.4.3 `Object.keys(process.env)` crash.
//
// The bug only surfaces under a *narrow* env permission, so it is invisible to
// the rest of the suite (the `test` task runs with full `--allow-env`). We
// therefore spawn a subprocess that imports the SDK under exactly the
// `--allow-env=ASANA_ACCESS_TOKEN` permission the `migrate` task uses and assert
// it loads without a `NotCapable` env-permission error. Without
// src/process_env_shim.ts this subprocess aborts at import time.
Deno.test("SDK loads under narrow --allow-env (regression: debug Object.keys(process.env))", async () => {
  const fixture = new URL("./fixtures/sdk_load_check.ts", import.meta.url);
  const cmd = new Deno.Command(Deno.execPath(), {
    args: [
      "run",
      "--allow-env=ASANA_ACCESS_TOKEN",
      "--allow-read",
      fixture.pathname,
    ],
    // Inherit the OS env (so Deno can locate its own cache) but exercise the
    // narrow capability: the program may only read ASANA_ACCESS_TOKEN.
    env: { ASANA_ACCESS_TOKEN: "dummy-token" },
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stdout, stderr } = await cmd.output();
  const out = new TextDecoder().decode(stdout);
  const err = new TextDecoder().decode(stderr);

  assert(
    !err.includes("NotCapable") && !err.includes("Requires env access"),
    `SDK import hit an env-permission error under narrow --allow-env:\n${err}`,
  );
  assertEquals(code, 0, `subprocess exited ${code}:\n${err}`);
  assert(out.includes("SDK_LOADED_OK"), `missing success marker; stdout:\n${out}`);
});
