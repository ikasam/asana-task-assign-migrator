# Third-Party Notices

This project (`asana-task-assign-migrator`, licensed under MIT) bundles
third-party software when distributed as a compiled binary (e.g. via
`deno compile`). The licenses and attributions below are reproduced to
satisfy the redistribution conditions of those dependencies.

All bundled dependencies are distributed under permissive licenses
(MIT / ISC / BSD / Apache-2.0) that allow redistribution in source and
compiled/binary form, including commercial use.

The authoritative, version-pinned list of all transitive dependencies is
recorded in [`deno.lock`](./deno.lock).

---

## asana (node-asana)

- Package: `npm:asana@3.1.11`
- Source: https://github.com/Asana/node-asana
- License: Apache License 2.0 (declared in the package's `package.json`)

> **Note on license discrepancy.** The package metadata (`package.json`)
> declares the license as `Apache 2.0`, while the `LICENSE` file shipped in
> the repository contains the MIT License (Copyright (c) 2014 Phips Peter,
> the library's original author). Both are permissive licenses that permit
> redistribution in compiled/binary form. To honor either interpretation,
> the MIT notice actually shipped in the package is reproduced below; the
> Apache-2.0 declaration is noted above. There is no `NOTICE` file in the
> upstream package, so no additional Apache-2.0 attribution is required.

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

---

## Transitive dependencies

The `asana` SDK pulls in additional packages (notably the `superagent` HTTP
client and the `@babel/*` toolchain families). These are distributed under
permissive licenses — predominantly **MIT**, with some **ISC**, **BSD-2-Clause**,
**BSD-3-Clause**, and **Apache-2.0** — all of which permit redistribution in
source and binary form with attribution.

Because the exact set of bundled packages depends on which modules the
compiled entry point actually reaches, the complete and version-accurate
inventory is the one pinned in [`deno.lock`](./deno.lock). To regenerate a
per-package attribution report from the lockfile, list the packages there and
retrieve each package's `LICENSE` from its npm registry entry or source
repository.
