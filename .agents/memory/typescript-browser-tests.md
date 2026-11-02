---
name: TypeScript browser test execution
description: Running TypeScript browser tests in this Node 20 workspace.
---

The workspace's Node 20 runtime does not support `--experimental-strip-types`. Browser test files written in TypeScript can be transpiled to a temporary `.mjs` file with the project's installed TypeScript compiler and then run with `node --test`.

**Why:** The direct Node test invocation fails before loading the test because the runtime rejects the TypeScript stripping option.

**How to apply:** For a targeted TypeScript browser test, transpile it temporarily and run the generated module with Node's test runner; remove the generated file afterward.
