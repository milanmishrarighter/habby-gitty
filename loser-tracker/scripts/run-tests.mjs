// Bundles the plain-logic tests and runs them in Node.
import { build } from "esbuild";
import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const out = join(mkdtempSync(join(tmpdir(), "loser-tests-")), "tests.mjs");
await build({ entryPoints: ["scripts/tests.ts"], bundle: true, platform: "node", format: "esm", outfile: out, logLevel: "warning" });
execFileSync("node", [out], { stdio: "inherit" });
