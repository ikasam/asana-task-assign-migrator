// Generates THIRD-PARTY-NOTICES.txt: an aggregated reproduction of the license
// texts of every third-party package bundled into the compiled binary, plus the
// embedded Deno runtime. This implements the de-facto attribution practice used
// by tools like cargo-about / generate-license-file / go-licenses, adapted for a
// Deno project that resolves its npm graph through deno.lock.
//
// Run via `deno task notices` (after `deno install --node-modules-dir=auto`).
// The release workflow regenerates this file and ships it alongside each binary.
//
// Permissions: --allow-read (node_modules + repo files), --allow-write (output).
//
// Intentionally dependency-free (Deno built-ins only): adding imports here would
// add packages to the very graph this file is meant to attribute.

const NODE_MODULES = "node_modules";
const OUTPUT = "THIRD-PARTY-NOTICES.txt";

// The Deno runtime is embedded by `deno compile` and is not part of the npm
// graph, so it is recorded separately. Pinned to the version in mise.toml.
const DENO_VERSION = (() => {
  const toml = Deno.readTextFileSync("mise.toml");
  const m = toml.match(/^\s*deno\s*=\s*"([^"]+)"/m);
  if (!m) throw new Error("could not read deno version from mise.toml");
  return m[1];
})();

const DENO_LICENSE = `MIT License

Copyright 2018-2026 the Deno authors

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the "Software"), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.`;

const LICENSE_FILE = /^(LICEN[CS]E|COPYING|NOTICE)([.\-].*)?$/i;

interface Pkg {
  name: string;
  version: string;
  declared: string; // SPDX-ish string from package.json
  text: string | null; // reproduced license file text, if found
}

function licenseField(json: Record<string, unknown>): string {
  if (typeof json.license === "string") return json.license;
  // Legacy { type } / [{ type }] shapes.
  const lic = json.license ?? json.licenses;
  if (lic && typeof lic === "object") {
    const arr = Array.isArray(lic) ? lic : [lic];
    const types = arr
      .map((l) => (l && typeof l === "object" ? (l as { type?: string }).type : undefined))
      .filter(Boolean);
    if (types.length) return types.join(" OR ");
  }
  return "UNKNOWN";
}

async function findLicenseText(pkgDir: string): Promise<string | null> {
  let best: string | null = null;
  for await (const entry of Deno.readDir(pkgDir)) {
    if (entry.isFile && LICENSE_FILE.test(entry.name)) {
      const text = (await Deno.readTextFile(`${pkgDir}/${entry.name}`)).trim();
      // Prefer a LICENSE/LICENCE over a standalone NOTICE if both exist.
      if (!best || /^licen[cs]e/i.test(entry.name)) best = text;
    }
  }
  return best;
}

// Recursively yield every package.json path under `root` (Deno built-in walk).
async function* findManifests(root: string): AsyncGenerator<string> {
  for await (const entry of Deno.readDir(root)) {
    const path = `${root}/${entry.name}`;
    if (entry.isDirectory) {
      yield* findManifests(path);
    } else if (entry.isFile && entry.name === "package.json") {
      yield path;
    }
  }
}

// Collect every distinct name@version under node_modules. Deno lays packages out
// at node_modules/.deno/<key>/node_modules/<name>/, with nested node_modules for
// each package's own deps, so a recursive walk for package.json covers them all.
const packages = new Map<string, Pkg>();
const missing: string[] = [];

for await (const manifest of findManifests(NODE_MODULES)) {
  let json: Record<string, unknown>;
  try {
    json = JSON.parse(await Deno.readTextFile(manifest));
  } catch {
    continue; // not a real manifest
  }
  const name = json.name as string | undefined;
  const version = json.version as string | undefined;
  if (!name || !version) continue;
  const key = `${name}@${version}`;
  if (packages.has(key)) continue;

  const pkgDir = manifest.slice(0, -"/package.json".length);
  const text = await findLicenseText(pkgDir);
  if (!text) missing.push(key);
  packages.set(key, { name, version, declared: licenseField(json), text });
}

const sorted = [...packages.values()].sort((a, b) =>
  a.name.localeCompare(b.name) || a.version.localeCompare(b.version)
);

const sep = "=".repeat(80);
const sub = "-".repeat(80);
const lines: string[] = [];

lines.push(
  "THIRD-PARTY SOFTWARE NOTICES",
  sep,
  "",
  "This file is generated by scripts/gen_third_party_notices.ts. Do not edit by",
  "hand. It accompanies compiled binaries of asana-task-assign-migrator and",
  "reproduces the license texts of the third-party software bundled into them.",
  "",
  "The project itself is licensed under MIT (see the LICENSE file shipped",
  "alongside this notice). Running from source via `deno task` bundles none of the",
  "software below.",
  "",
  `npm packages resolved from deno.lock: ${sorted.length}`,
);
if (missing.length) {
  lines.push(
    "",
    "NOTE: no license file was found inside these packages; their declared SPDX",
    "identifier is recorded below, but verify their terms before redistribution:",
    ...missing.sort().map((k) => `  - ${k}`),
  );
}
lines.push("");

for (const p of sorted) {
  lines.push(
    sep,
    `Package: ${p.name}@${p.version}`,
    `License (declared in package.json): ${p.declared}`,
    sub,
    p.text ?? "(no license file found in package; see declared identifier above)",
    "",
  );
}

lines.push(
  sep,
  `Embedded runtime: Deno ${DENO_VERSION}`,
  "License (declared): MIT",
  sub,
  "`deno compile` embeds a slimmed-down Deno runtime (Deno itself, the V8",
  "JavaScript engine, and numerous Rust crates) into the binary. Deno is MIT",
  "licensed (text below). The authoritative third-party license list for the",
  `runtime's native components is published at https://license.deno.dev/ ;`,
  `consult it pinned to Deno ${DENO_VERSION} for the V8/Rust component notices.`,
  "",
  DENO_LICENSE,
  "",
);

await Deno.writeTextFile(OUTPUT, lines.join("\n"));
console.log(
  `Wrote ${OUTPUT}: ${sorted.length} npm packages + Deno ${DENO_VERSION} runtime` +
    (missing.length ? ` (${missing.length} without an embedded license file)` : ""),
);
