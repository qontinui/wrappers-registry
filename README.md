# qontinui wrappers registry

The canonical index of installable `@qontinui` wrappers, consumed by the
[qontinui-runner](https://github.com/qontinui/qontinui-runner) **Browse** tab.

A wrapper is a small Node package that exposes typed actions (with
parameter schemas) to the runner. The runner spawns each installed
wrapper as a subprocess and routes workflow steps and agent tool calls
through it. Think of wrappers as MCP servers for the runner — but typed,
versioned, and discoverable.

## What lives here

```
registry.json                          # the index — one entry per wrapper
schemas/wrapper-entry.schema.json      # JSON Schema for a single entry
validator/validate.mjs                 # CI lint for registry.json
.github/PULL_REQUEST_TEMPLATE.md       # checklist for new submissions
.github/workflows/validate.yml         # runs validator on PRs
```

The runner fetches `registry.json` from `main` once every 24 hours,
caches it locally, and renders the entries in the **Wrappers → Browse**
tab.

## Submitting a wrapper

1. Publish your wrapper to npm under a stable scope.
2. Make sure your package's `package.json` declares a `qontinui.wrapper`
   manifest field — see the
   [wrapper authoring guide](https://github.com/qontinui/qontinui-wrappers#authoring)
   for the exact shape.
3. Fork this repo, add one entry to `registry.json` matching the
   [schema](schemas/wrapper-entry.schema.json), and open a PR.
4. The PR template walks through the checklist (LICENSE, README, no
   `postinstall`, etc.). Maintainers review and merge.

A new entry typically appears in users' Browse tabs within 24 hours of
merge.

## Entry shape (quick reference)

```json
{
  "id": "my-wrapper",
  "package": "@your-scope/wrapper-my-wrapper",
  "version": ">=0.1.0",
  "displayName": "My Wrapper",
  "description": "One-line description shown in Browse",
  "categories": ["productivity"],
  "transport": "api",
  "author": { "name": "you", "url": "https://github.com/you" },
  "repo": "https://github.com/you/wrapper-my-wrapper",
  "license": "MIT"
}
```

Required fields: `id`, `package`, `version`, `displayName`, `description`,
`categories`, `transport`, `author`, `repo`, `license`.

Optional: `verified` (defaults to `false`).

`id` must be lowercase kebab-case (`^[a-z0-9][a-z0-9-]*[a-z0-9]$`).

`transport` is one of `api`, `headless`, `headed`, `live`. Today the
runner only enables `api`; the other three are reserved for forward
compatibility.

## Verification policy

The `verified: true` flag means the qontinui maintainers have audited
the wrapper's source and behavior. The runner shows a verified badge in
the Browse tab.

Everything without the flag is **community-submitted** — it passed the
PR review (LICENSE present, no `postinstall`, README documents the
action list, declared transport works in our smoke test) but the
maintainers haven't deeply audited the code. Treat community wrappers
the way you'd treat any npm dependency: read the source, check the
issues, install with eyes open.

To request the verified badge for your wrapper, ping a maintainer in a
follow-up issue once your PR is merged.

## Validating locally

```bash
cd validator
npm install
node validate.mjs
```

The same script runs in CI on every PR via `.github/workflows/validate.yml`.

## Schema versioning

`registry.json` carries a `manifestVersion` field. We're at version `1`.
Backwards-incompatible changes to the entry shape will bump this; the
runner refuses to load registries with a `manifestVersion` newer than it
understands, so old runners stay safe.

## License

The contents of this repo (the index, schema, and tooling) are MIT.
Individual wrappers carry their own licenses — see each entry's `license`
field and the wrapper's repo.

## Links

- Runner: https://github.com/qontinui/qontinui-runner
- Wrapper framework + reference wrappers: https://github.com/qontinui/qontinui-wrappers
- Issues with this registry: file in this repo
- Issues with a specific wrapper: file in the wrapper's repo
