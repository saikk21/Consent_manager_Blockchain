import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Repository root (monorepo). */
export const REPO_ROOT = path.resolve(__dirname, "..", "..");

/** Default output directory for packed tarballs (gitignored). */
export const DEFAULT_PACK_OUT_DIR = path.join(REPO_ROOT, ".release", "packs");

/**
 * Publish / pack order: shared-core first, then dependents.
 * Must match docs/phase-e1a1-release-policy.md.
 */
export const SDK_WORKSPACES = [
  "@sammati/shared-core",
  "@sammati/webhook-utils",
  "@sammati/server-sdk",
  "@sammati/widget-sdk",
] as const;

export type SdkWorkspaceName = (typeof SDK_WORKSPACES)[number];

/** Workspace folder name under packages/ for each scoped name. */
export const WORKSPACE_DIR: Readonly<Record<SdkWorkspaceName, string>> = {
  "@sammati/shared-core": "shared-core",
  "@sammati/webhook-utils": "webhook-utils",
  "@sammati/server-sdk": "server-sdk",
  "@sammati/widget-sdk": "widget-sdk",
};

/** Maximum tarball size per package (bytes). */
export const MAX_TARBALL_BYTES = 600_000;

/** Path substrings that must not appear in packed file paths (lowercased match). */
export const DENIED_PATH_SUBSTRINGS = [
  ".env",
  ".pem",
  "id_rsa",
  "/.ssh/",
  "webhook-receiver-log",
] as const;

/** Required files under dist/ inside the packed package. */
export const REQUIRED_DIST_FILES = [
  "index.js",
  "index.cjs",
  "index.d.ts",
] as const;
