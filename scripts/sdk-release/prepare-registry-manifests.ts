/**
 * Rewrites workspace package.json files for npm registry publish:
 * - removes `private` from all @sammati/* SDK packages
 * - sets dependents' `@sammati/shared-core` dependency to `^<shared-core version>` (from shared-core/package.json)
 *
 * Intended for CI only after verify gates; reverts are unnecessary (ephemeral checkout).
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT, SDK_WORKSPACES, WORKSPACE_DIR } from "./config.ts";

function readJson(p: string): Record<string, unknown> {
  return JSON.parse(readFileSync(p, "utf-8")) as Record<string, unknown>;
}

function writeJson(p: string, data: Record<string, unknown>): void {
  writeFileSync(p, `${JSON.stringify(data, null, 2)}\n`);
}

export function prepareRegistryManifests(): void {
  const corePath = path.join(REPO_ROOT, "packages", WORKSPACE_DIR["@sammati/shared-core"], "package.json");
  const core = readJson(corePath);
  const coreVersion = core.version;
  if (typeof coreVersion !== "string" || !coreVersion.length) {
    throw new Error("shared-core package.json missing string version");
  }

  const range = `^${coreVersion}`;

  for (const ws of SDK_WORKSPACES) {
    const rel = WORKSPACE_DIR[ws];
    const pkgPath = path.join(REPO_ROOT, "packages", rel, "package.json");
    const pkg = readJson(pkgPath);
    delete pkg.private;
    if (ws !== "@sammati/shared-core") {
      const deps = { ...((pkg.dependencies as Record<string, string> | undefined) ?? {}) };
      deps["@sammati/shared-core"] = range;
      pkg.dependencies = deps;
    }
    writeJson(pkgPath, pkg);
  }
}
