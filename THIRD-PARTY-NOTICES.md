# Third-Party Notices

This project (`asana-task-assign-migrator`, licensed under MIT) depends on
third-party software that is bundled into the executable when it is
distributed as a compiled binary (e.g. via `deno compile`).

> [!NOTE]
> This Markdown file is the **human-readable explainer**. The complete,
> machine-generated attribution bundle — every npm package resolved from
> [`deno.lock`](./deno.lock) plus the embedded Deno runtime, with each license
> text reproduced in full — is **`THIRD-PARTY-NOTICES.txt`**, produced by
> `deno task notices`. The release workflow regenerates that file and ships it
> next to every compiled binary, so distributors do not need to assemble it by
> hand. These notices apply only to **compiled binaries**; running from source
> via `deno task` / `deno run` bundles none of this software.

The dependencies are distributed under permissive licenses
(MIT / ISC / BSD / Apache-2.0), plus one **CC-BY-4.0** data package
(`caniuse-lite`, pulled in transitively via `browserslist`). All allow
redistribution in source and compiled/binary form, including commercial use,
and none impose copyleft obligations on this project; CC-BY-4.0 requires that
its attribution be preserved.

---

## asana (node-asana)

- Package: `npm:asana@3.1.11`
- Source: https://github.com/Asana/node-asana
- License (as shipped in the package): MIT
- License (as declared in `package.json`): Apache-2.0

> **Note on license discrepancy.** The package's `package.json` declares the
> license as `Apache 2.0`, but the `LICENSE` file actually shipped inside the
> published package is the **MIT License** (Copyright (c) 2014 Phips Peter,
> the library's original author). The upstream package contains **no copy of
> the Apache-2.0 license text and no `NOTICE` file.** Both MIT and Apache-2.0
> are permissive and permit binary redistribution.
>
> To make the binary notice complete under **either** interpretation, both
> license texts are reproduced below: the MIT text actually shipped in the
> package, and the standard Apache License 2.0 text matching the
> `package.json` declaration. Since the upstream package contains no `NOTICE`
> file, no additional `NOTICE` reproduction is required under Apache-2.0.

```
The MIT License (MIT)

Copyright (c) 2014 Phips Peter

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

And the Apache License 2.0 text matching the `package.json` declaration:

```
                                 Apache License
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

   END OF TERMS AND CONDITIONS
```

---

## Transitive dependencies

The `asana` SDK pulls in additional packages (notably the `superagent` HTTP
client and the `@babel/*` toolchain families). These are distributed
predominantly under **MIT**, with some **ISC**, **BSD-2-Clause**,
**BSD-3-Clause**, and **Apache-2.0**. One non-software-code dependency,
`caniuse-lite` (the browser-support dataset, reached via
`@babel/cli` → `browserslist`), is licensed under **CC-BY-4.0**. All of these
permit redistribution in source and binary form provided their copyright and
license texts are included; CC-BY-4.0 additionally requires preserving the
caniuse attribution.

Rather than reproduce each of these texts in this Markdown explainer, the full
license text of every package is collected into **`THIRD-PARTY-NOTICES.txt`**
by the generator described below.

> Note: `deno compile` bundles modules based on the import graph resolved at
> compile time (static imports plus any reachable dynamic imports), not on
> runtime code-path reachability. The generator errs on the side of
> over-inclusion: it walks the entire npm graph resolved from `deno.lock`
> (a superset of what a single entry point strictly reaches), so no bundled
> package is omitted.

### Generating the complete bundle

`THIRD-PARTY-NOTICES.txt` is produced by
[`scripts/gen_third_party_notices.ts`](./scripts/gen_third_party_notices.ts):

```sh
deno task notices
```

The task materializes `node_modules` from the frozen lockfile, reproduces the
license file of every resolved npm package (recording each package's declared
SPDX identifier alongside it — which is how the Asana SDK's `Apache 2.0`
declaration and its MIT license text both appear), and appends the embedded
Deno runtime notice. The release workflow runs this task and ships the result
next to each binary, so the published artifact is always current.

---

## Deno runtime (compiled binaries only)

A binary produced by `deno compile` embeds a slimmed-down copy of the Deno
runtime alongside the application code, so the executable also carries
software outside the npm dependency graph — the Deno runtime itself (MIT
licensed) and its native components (e.g. the V8 JavaScript engine under
BSD-3-Clause and numerous Rust crates under MIT / Apache-2.0 / BSD). This
applies only to compiled binaries; running from source via `deno task` /
`deno run` uses the locally installed Deno and bundles none of this.

The generated `THIRD-PARTY-NOTICES.txt` reproduces Deno's own MIT license (for
the build's pinned version in `mise.toml`) and points to Deno's authoritative
third-party license list at https://license.deno.dev/ for the V8/Rust native
component notices (see also the
[`deno compile` docs](https://docs.deno.com/runtime/reference/cli/compile/)).
A distribution policy that requires reproducing the full text of every native
component should consult that list pinned to the build's Deno version.
