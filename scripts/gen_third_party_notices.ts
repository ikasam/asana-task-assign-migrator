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

// Canonical Apache License 2.0 text. Some packages (e.g. asana@3.x) declare
// Apache-2.0 in package.json but ship only a different LICENSE file (MIT), so
// Apache-2.0's own requirement — give recipients a copy of the license — is not
// met by the shipped file alone. When that mismatch is detected, this text is
// appended so the bundle is complete under the declared license too.
const APACHE_2_0 = `                                 Apache License
                           Version 2.0, January 2004
                        http://www.apache.org/licenses/

   TERMS AND CONDITIONS FOR USE, REPRODUCTION, AND DISTRIBUTION

   1. Definitions.

      "License" shall mean the terms and conditions for use, reproduction,
      and distribution as defined by Sections 1 through 9 of this document.

      "Licensor" shall mean the copyright owner or entity authorized by
      the copyright owner that is granting the License.

      "Legal Entity" shall mean the union of the acting entity and all
      other entities that control, are controlled by, or are under common
      control with that entity. For the purposes of this definition,
      "control" means (i) the power, direct or indirect, to cause the
      direction or management of such entity, whether by contract or
      otherwise, or (ii) ownership of fifty percent (50%) or more of the
      outstanding shares, or (iii) beneficial ownership of such entity.

      "You" (or "Your") shall mean an individual or Legal Entity
      exercising permissions granted by this License.

      "Source" form shall mean the preferred form for making modifications,
      including but not limited to software source code, documentation
      source, and configuration files.

      "Object" form shall mean any form resulting from mechanical
      transformation or translation of a Source form, including but
      not limited to compiled object code, generated documentation,
      and conversions to other media types.

      "Work" shall mean the work of authorship, whether in Source or
      Object form, made available under the License, as indicated by a
      copyright notice that is included in or attached to the work
      (an example is provided in the Appendix below).

      "Derivative Works" shall mean any work, whether in Source or Object
      form, that is based on (or derived from) the Work and for which the
      editorial revisions, annotations, elaborations, or other modifications
      represent, as a whole, an original work of authorship. For the purposes
      of this License, Derivative Works shall not include works that remain
      separable from, or merely link (or bind by name) to the interfaces of,
      the Work and Derivative Works thereof.

      "Contribution" shall mean any work of authorship, including
      the original version of the Work and any modifications or additions
      to that Work or Derivative Works thereof, that is intentionally
      submitted to Licensor for inclusion in the Work by the copyright owner
      or by an individual or Legal Entity authorized to submit on behalf of
      the copyright owner. For the purposes of this definition, "submitted"
      means any form of electronic, verbal, or written communication sent
      to the Licensor or its representatives, including but not limited to
      communication on electronic mailing lists, source code control systems,
      and issue tracking systems that are managed by, or on behalf of, the
      Licensor for the purpose of discussing and improving the Work, but
      excluding communication that is conspicuously marked or otherwise
      designated in writing by the copyright owner as "Not a Contribution."

      "Contributor" shall mean Licensor and any individual or Legal Entity
      on behalf of whom a Contribution has been received by Licensor and
      subsequently incorporated within the Work.

   2. Grant of Copyright License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      copyright license to reproduce, prepare Derivative Works of,
      publicly display, publicly perform, sublicense, and distribute the
      Work and such Derivative Works in Source or Object form.

   3. Grant of Patent License. Subject to the terms and conditions of
      this License, each Contributor hereby grants to You a perpetual,
      worldwide, non-exclusive, no-charge, royalty-free, irrevocable
      (except as stated in this section) patent license to make, have made,
      use, offer to sell, sell, import, and otherwise transfer the Work,
      where such license applies only to those patent claims licensable
      by such Contributor that are necessarily infringed by their
      Contribution(s) alone or by combination of their Contribution(s)
      with the Work to which such Contribution(s) was submitted. If You
      institute patent litigation against any entity (including a
      cross-claim or counterclaim in a lawsuit) alleging that the Work
      or a Contribution incorporated within the Work constitutes direct
      or contributory patent infringement, then any patent licenses
      granted to You under this License for that Work shall terminate
      as of the date such litigation is filed.

   4. Redistribution. You may reproduce and distribute copies of the
      Work or Derivative Works thereof in any medium, with or without
      modifications, and in Source or Object form, provided that You
      meet the following conditions:

      (a) You must give any other recipients of the Work or
          Derivative Works a copy of this License; and

      (b) You must cause any modified files to carry prominent notices
          stating that You changed the files; and

      (c) You must retain, in the Source form of any Derivative Works
          that You distribute, all copyright, patent, trademark, and
          attribution notices from the Source form of the Work,
          excluding those notices that do not pertain to any part of
          the Derivative Works; and

      (d) If the Work includes a "NOTICE" text file as part of its
          distribution, then any Derivative Works that You distribute must
          include a readable copy of the attribution notices contained
          within such NOTICE file, excluding those notices that do not
          pertain to any part of the Derivative Works, in at least one
          of the following places: within a NOTICE text file distributed
          as part of the Derivative Works; within the Source form or
          documentation, if provided along with the Derivative Works; or,
          within a display generated by the Derivative Works, if and
          wherever such third-party notices normally appear. The contents
          of the NOTICE file are for informational purposes only and
          do not modify the License. You may add Your own attribution
          notices within Derivative Works that You distribute, alongside
          or as an addendum to the NOTICE text from the Work, provided
          that such additional attribution notices cannot be construed
          as modifying the License.

      You may add Your own copyright statement to Your modifications and
      may provide additional or different license terms and conditions
      for use, reproduction, or distribution of Your modifications, or
      for any such Derivative Works as a whole, provided Your use,
      reproduction, and distribution of the Work otherwise complies with
      the conditions stated in this License.

   5. Submission of Contributions. Unless You explicitly state otherwise,
      any Contribution intentionally submitted for inclusion in the Work
      by You to the Licensor shall be under the terms and conditions of
      this License, without any additional terms or conditions.
      Notwithstanding the above, nothing herein shall supersede or modify
      the terms of any separate license agreement you may have executed
      with Licensor regarding such Contributions.

   6. Trademarks. This License does not grant permission to use the trade
      names, trademarks, service marks, or product names of the Licensor,
      except as required for reasonable and customary use in describing the
      origin of the Work and reproducing the content of the NOTICE file.

   7. Disclaimer of Warranty. Unless required by applicable law or
      agreed to in writing, Licensor provides the Work (and each
      Contributor provides its Contributions) on an "AS IS" BASIS,
      WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or
      implied, including, without limitation, any warranties or conditions
      of TITLE, NON-INFRINGEMENT, MERCHANTABILITY, or FITNESS FOR A
      PARTICULAR PURPOSE. You are solely responsible for determining the
      appropriateness of using or redistributing the Work and assume any
      risks associated with Your exercise of permissions under this License.

   8. Limitation of Liability. In no event and under no legal theory,
      whether in tort (including negligence), contract, or otherwise,
      unless required by applicable law (such as deliberate and grossly
      negligent acts) or agreed to in writing, shall any Contributor be
      liable to You for damages, including any direct, indirect, special,
      incidental, or consequential damages of any character arising as a
      result of this License or out of the use or inability to use the
      Work (including but not limited to damages for loss of goodwill,
      work stoppage, computer failure or malfunction, or any and all
      other commercial damages or losses), even if such Contributor
      has been advised of the possibility of such damages.

   9. Accepting Warranty or Additional Liability. While redistributing
      the Work or Derivative Works thereof, You may choose to offer,
      and charge a fee for, acceptance of support, warranty, indemnity,
      or other liability obligations and/or rights consistent with this
      License. However, in accepting such obligations, You may act only
      on Your own behalf and on Your sole responsibility, not on behalf
      of any other Contributor, and only if You agree to indemnify,
      defend, and hold each Contributor harmless for any liability
      incurred by, or claims asserted against, such Contributor by reason
      of your accepting any such warranty or additional liability.

   END OF TERMS AND CONDITIONS`;

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
  const body = p.text ??
    "(no license file found in package; see declared identifier above)";
  // If a package declares Apache-2.0 but ships a license file that is not the
  // Apache text, also reproduce the canonical Apache-2.0 text so recipients
  // receive the declared license terms (Apache-2.0 §4(a)).
  const declaresApache = /apache[\s-]*(license[\s,-]*)?(version[\s-]*)?2(\.0)?/i
    .test(p.declared);
  const hasApacheText = p.text !== null &&
    /Apache License,?\s+Version 2\.0/i.test(p.text);
  const apacheAddendum = declaresApache && !hasApacheText
    ? [
      "",
      "--- Apache License 2.0 (per package.json declaration) ---",
      "",
      APACHE_2_0,
    ]
    : [];
  lines.push(
    sep,
    `Package: ${p.name}@${p.version}`,
    `License (declared in package.json): ${p.declared}`,
    sub,
    body,
    ...apacheAddendum,
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
