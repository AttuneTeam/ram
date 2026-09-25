// Makes Vitest's globals (describe, it, expect, vi, ...) visible to `tsc`,
// matching `globals: true` in vitest.config.ts.
//
// Deliberately a reference directive rather than `types: ["vitest/globals"]` in
// tsconfig.json: setting `types` replaces the automatic inclusion of every
// @types package, which would silently drop Node globals such as `process`
// and `Buffer`. This is additive instead.
/// <reference types="vitest/globals" />
