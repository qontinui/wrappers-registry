#!/usr/bin/env node
/**
 * Validates registry.json against schemas/wrapper-entry.schema.json.
 *
 * Run from repo root:   node validator/validate.mjs
 * Or from validator/:   node validate.mjs
 *
 * Exits 0 on success, 1 on any validation failure.
 */

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
// Ajv's 2020-12 draft entrypoint is shipped as CJS; under Node ESM the default
// import is the constructor itself. `ajv-formats` is the same shape.
import Ajv2020Module from "ajv/dist/2020.js";
import addFormatsModule from "ajv-formats";

// Some Node + tooling combos wrap CJS default in `{ default: fn }`; unwrap
// defensively so both shapes work.
const Ajv2020 = Ajv2020Module.default ?? Ajv2020Module;
const addFormats = addFormatsModule.default ?? addFormatsModule;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Resolve repo root regardless of where the script is invoked from:
// validator/ sits one level below the registry root.
const repoRoot = resolve(__dirname, "..");
const registryPath = join(repoRoot, "registry.json");
const schemaPath = join(repoRoot, "schemas", "wrapper-entry.schema.json");

const errors = [];
const warnings = [];

function fail(msg) {
  errors.push(msg);
}

function warn(msg) {
  warnings.push(msg);
}

if (!existsSync(registryPath)) {
  console.error(`error: registry.json not found at ${registryPath}`);
  process.exit(1);
}
if (!existsSync(schemaPath)) {
  console.error(`error: schema not found at ${schemaPath}`);
  process.exit(1);
}

let registry;
try {
  registry = JSON.parse(readFileSync(registryPath, "utf8"));
} catch (e) {
  console.error(`error: registry.json is not valid JSON: ${e.message}`);
  process.exit(1);
}

let schema;
try {
  schema = JSON.parse(readFileSync(schemaPath, "utf8"));
} catch (e) {
  console.error(`error: schema is not valid JSON: ${e.message}`);
  process.exit(1);
}

// Top-level shape checks
if (typeof registry !== "object" || registry === null || Array.isArray(registry)) {
  fail("registry.json must be a JSON object");
}
if (registry.manifestVersion !== 1) {
  fail(
    `registry.json: expected manifestVersion === 1, got ${JSON.stringify(
      registry.manifestVersion,
    )}`,
  );
}
if (!Array.isArray(registry.wrappers)) {
  fail("registry.json: `wrappers` must be an array");
}

// npm package name validation (loose check — covers scoped + unscoped + common cases)
// - unscoped: lowercase letters, digits, hyphens, underscores, dots; cannot start with `.` or `_`
// - scoped:   @scope/name where scope follows similar rules
// Length cap: 214 chars (npm rule)
const NPM_NAME_RE =
  /^(?:@[a-z0-9][a-z0-9-_.]*\/)?[a-z0-9][a-z0-9-_.]*$/;

function looksLikeNpmName(s) {
  return typeof s === "string" && s.length <= 214 && NPM_NAME_RE.test(s);
}

// Compile schema
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

if (Array.isArray(registry.wrappers)) {
  const seenIds = new Map(); // id -> first index seen
  registry.wrappers.forEach((entry, i) => {
    const where = `wrappers[${i}]${entry && entry.id ? ` (id="${entry.id}")` : ""}`;

    const ok = validate(entry);
    if (!ok) {
      for (const err of validate.errors ?? []) {
        const path = err.instancePath || "(root)";
        fail(`${where}: ${path} ${err.message}`);
      }
    }

    // Duplicate id check
    if (entry && typeof entry.id === "string") {
      if (seenIds.has(entry.id)) {
        fail(
          `${where}: duplicate id "${entry.id}" — first seen at wrappers[${seenIds.get(
            entry.id,
          )}]`,
        );
      } else {
        seenIds.set(entry.id, i);
      }
    }

    // npm package shape check (beyond schema)
    if (entry && typeof entry.package === "string") {
      if (!looksLikeNpmName(entry.package)) {
        fail(
          `${where}: \`package\` "${entry.package}" does not look like a valid npm package name (expected unscoped or @scope/name, lowercase, length <= 214)`,
        );
      }
    }
  });

  // Soft warning if registry is empty
  if (registry.wrappers.length === 0) {
    warn("registry.json has zero entries — that's probably not intentional");
  }
}

// Report
if (warnings.length > 0) {
  for (const w of warnings) console.warn(`warn: ${w}`);
}

if (errors.length > 0) {
  console.error("");
  console.error(
    `Validation FAILED with ${errors.length} error${errors.length === 1 ? "" : "s"}:`,
  );
  for (const e of errors) console.error(`  - ${e}`);
  process.exit(1);
}

const count = Array.isArray(registry.wrappers) ? registry.wrappers.length : 0;
console.log(
  `OK: registry.json is valid (${count} entr${count === 1 ? "y" : "ies"})`,
);
process.exit(0);
