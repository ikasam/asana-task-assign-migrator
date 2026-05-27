// Phase 1 spike: Verify npm:asana@3 loads in Deno without making API calls.
// Run: deno run --allow-net --allow-env --allow-read spike/phase1_load.ts
//
// Success criteria:
//   - import resolves without runtime error
//   - ApiClient can be instantiated
//   - UsersApi / TasksApi constructors are reachable
//   - typeof check works on key methods

import Asana from "npm:asana@3";

console.log("[1] import resolved:", typeof Asana);
console.log("[2] Asana.ApiClient:", typeof Asana.ApiClient);
console.log("[3] Asana.UsersApi:", typeof Asana.UsersApi);
console.log("[4] Asana.TasksApi:", typeof Asana.TasksApi);
console.log("[5] Asana.WorkspacesApi:", typeof Asana.WorkspacesApi);

const client = new Asana.ApiClient();
console.log("[6] ApiClient instance:", client.constructor.name);
console.log("[7] client.authentications:", Object.keys(client.authentications ?? {}));

const usersApi = new Asana.UsersApi(client);
console.log("[8] UsersApi instance:", usersApi.constructor.name);
console.log("[9] usersApi.getUser is function:", typeof usersApi.getUser);

const tasksApi = new Asana.TasksApi(client);
console.log("[10] tasksApi.searchTasksForWorkspace is function:", typeof tasksApi.searchTasksForWorkspace);
console.log("[11] tasksApi.updateTask is function:", typeof tasksApi.updateTask);

const workspacesApi = new Asana.WorkspacesApi(client);
console.log("[12] workspacesApi.getWorkspace is function:", typeof workspacesApi.getWorkspace);

console.log("\nOK: phase 1 spike completed without runtime error.");
