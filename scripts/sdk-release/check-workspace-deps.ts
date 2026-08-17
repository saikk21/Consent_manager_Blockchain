/**
 * Ensures @sammati/* workspace packages do not drift to unexpected dependency specs
 * before registry publishing (E.1a.3 CI gate). Expects file: links to shared-core only.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT, SDK_WORKSPACES, WORKSPACE_DIR } from "./config.ts";

const EXPECTED_SHARED_CORE = "file:../shared-core";

function readPkg(dir: string): { name?: string; dependencies?: Record<string, string> } {
  const p = path.join(REPO_ROOT, "packages", dir, "package.json");
  return JSON.parse(readFileSync(p, "utf-8")) as {
    name?: string;
    dependencies?: Record<string, string>;
  };
}

function assertWorkspaceDependencyPolicy(): void {
  for (const ws of SDK_WORKSPACES) {
    const dir = WORKSPACE_DIR[ws];
    const pkg = readPkg(dir);
    if (ws === "@sammati/shared-core") {
      if (pkg.dependencies && Object.keys(pkg.dependencies).length > 0) {
        throw new Error(`${ws} must not declare package dependencies (found: ${JSON.stringify(pkg.dependencies)})`);
      }
      continue;
    }
    const dep = pkg.dependencies?.["@sammati/shared-core"];
    if (dep !== EXPECTED_SHARED_CORE) {
      throw new Error(
        `${ws} must depend on @sammati/shared-core via "${EXPECTED_SHARED_CORE}" (found: ${JSON.stringify(dep)}).`,
      );
    }
    const extra = { ...pkg.dependencies };
    delete extra["@sammati/shared-core"];
    if (Object.keys(extra).length > 0) {
      throw new Error(
        `${ws} must only depend on @sammati/shared-core among workspace packages (found: ${JSON.stringify(extra)})`,
      );
    }
  }
}

export { assertWorkspaceDependencyPolicy };
