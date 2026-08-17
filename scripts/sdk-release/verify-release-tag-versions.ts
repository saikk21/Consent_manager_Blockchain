/**
 * Ensures git tag `sdk-v<version>` matches `version` in all @sammati/* package.json files.
 * CI: set RELEASE_TAG (e.g. sdk-v0.2.0) or rely on GITHUB_REF=refs/tags/sdk-v...
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { REPO_ROOT, SDK_WORKSPACES, WORKSPACE_DIR } from "./config.ts";

function readVersionFromTag(): string {
  const fromEnv = process.env.RELEASE_TAG?.trim();
  const ref = process.env.GITHUB_REF?.trim();
  const raw =
    fromEnv ??
    (ref?.startsWith("refs/tags/") ? ref.slice("refs/tags/".length) : undefined) ??
    "";
  if (!raw || !raw.startsWith("sdk-v")) {
    throw new Error(
      `RELEASE_TAG or GITHUB_REF must denote a tag like sdk-v1.2.3 (got RELEASE_TAG=${JSON.stringify(fromEnv)}, GITHUB_REF=${JSON.stringify(ref)})`,
    );
  }
  return raw.slice("sdk-v".length);
}

function readPkgVersion(dir: string): string {
  const p = path.join(REPO_ROOT, "packages", dir, "package.json");
  const j = JSON.parse(readFileSync(p, "utf-8")) as { version?: string };
  if (!j.version) throw new Error(`Missing version in ${p}`);
  return j.version;
}

export function verifyReleaseTagMatchesPackageVersions(): void {
  const tagVersion = readVersionFromTag();
  for (const ws of SDK_WORKSPACES) {
    const dir = WORKSPACE_DIR[ws];
    const pkgVersion = readPkgVersion(dir);
    if (pkgVersion !== tagVersion) {
      throw new Error(
        `Release version mismatch: tag resolves to ${tagVersion} but ${ws} has version ${pkgVersion}`,
      );
    }
  }
}
