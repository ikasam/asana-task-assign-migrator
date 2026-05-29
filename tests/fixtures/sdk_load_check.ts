// Fixture for tests/sdk_load.test.ts.
//
// Imports the Asana SDK under the exact narrow env permission the `migrate` task
// uses (`--allow-env=ASANA_ACCESS_TOKEN`). Without src/process_env_shim.ts this
// aborts at import time with `NotCapable: Requires env access` (debug@4.4.3 runs
// `Object.keys(process.env)`). The test runner spawns this file as a subprocess
// and asserts it prints SDK_LOADED_OK with no env-permission error.
import { createAsanaClient } from "../../src/asana_client.ts";

// Constructing the client triggers the SDK's ApiClient + Api class wiring, the
// same code path the migration uses — but makes no network call.
createAsanaClient({ accessToken: "dummy-token" });
console.log("SDK_LOADED_OK");
