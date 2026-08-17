import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  DENIED_PATH_SUBSTRINGS,
  MAX_TARBALL_BYTES,
  REQUIRED_DIST_FILES,
  REPO_ROOT,
  SDK_WORKSPACES,
  WORKSPACE_DIR,
  type SdkWorkspaceName,
} from "./config.ts";

function listFilesRecursiveSync(root: string): string[] {
  const out: string[] = [];
  function walk(dir: string, rel: string) {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      const r = rel ? `${rel}/${name}` : name;
      const st = statSync(full);
      if (st.isDirectory()) walk(full, r);
      else out.push(r.replace(/\\/g, "/"));
    }
  }
  walk(root, "");
  return out;
}

function extractTarball(tarballPath: string, destDir: string): void {
  execFileSync("tar", ["-xzf", tarballPath, "-C", destDir], {
    stdio: "pipe",
    shell: false,
  });
}

function readPackedManifest(extractRoot: string): unknown {
  const p = path.join(extractRoot, "package", "package.json");
  return JSON.parse(readFileSync(p, "utf-8"));
}

function readWorkspaceManifest(workspaceDir: string): unknown {
  const p = path.join(REPO_ROOT, "packages", workspaceDir, "package.json");
  return JSON.parse(readFileSync(p, "utf-8"));
}

function assertExportsDot(manifest: Record<string, unknown>): void {
  const exp = manifest.exports;
  if (!exp || typeof exp !== "object") throw new Error('package.json missing "exports" object');
  const dot = (exp as Record<string, unknown>)["."];
  if (!dot || typeof dot !== "object") throw new Error('package.json exports missing "."');
  const d = dot as Record<string, unknown>;
  for (const k of ["types", "import", "require"]) {
    if (typeof d[k] !== "string" || !(d[k] as string).length) {
      throw new Error(`exports["."].${k} must be a non-empty string`);
    }
  }
}

function manifestKeySubset(
  packed: Record<string, unknown>,
  source: Record<string, unknown>,
  keys: string[],
): void {
  for (const k of keys) {
    const a = packed[k];
    const b = source[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      throw new Error(
        `package.json field "${k}" differs between tarball and workspace:\n${JSON.stringify(a)}\nvs\n${JSON.stringify(b)}`,
      );
    }
  }
}

export function verifyTarballAgainstWorkspace(input: Readonly<{
  tarballPath: string;
  workspace: SdkWorkspaceName;
}>): void {
  const { tarballPath, workspace } = input;
  if (!existsSync(tarballPath)) throw new Error(`Tarball not found: ${tarballPath}`);

  const size = statSync(tarballPath).size;
  if (size > MAX_TARBALL_BYTES) {
    throw new Error(`Tarball too large (${size} bytes > ${MAX_TARBALL_BYTES}): ${tarballPath}`);
  }

  const tmp = mkdtempSync(path.join(tmpdir(), "sammati-verify-"));
  try {
    extractTarball(tarballPath, tmp);
    const root = path.join(tmp, "package");
    if (!existsSync(root)) throw new Error("Expected top-level package/ directory in tarball");

    const relFiles = listFilesRecursiveSync(root).map((f) => f.toLowerCase());
    for (const f of relFiles) {
      for (const bad of DENIED_PATH_SUBSTRINGS) {
        if (f.includes(bad.toLowerCase())) {
          throw new Error(`Forbidden path fragment "${bad}" in tarball: ${f}`);
        }
      }
      if (f.includes("/src/") || f.endsWith(".test.ts") || f.endsWith(".spec.ts")) {
        throw new Error(`Unexpected source/test path in tarball: ${f}`);
      }
    }

    const packedRaw = readPackedManifest(tmp);
    if (!packedRaw || typeof packedRaw !== "object") throw new Error("Invalid packed package.json");
    const packed = packedRaw as Record<string, unknown>;

    const dir = WORKSPACE_DIR[workspace];
    const sourceRaw = readWorkspaceManifest(dir);
    if (!sourceRaw || typeof sourceRaw !== "object") throw new Error("Invalid workspace package.json");
    const source = sourceRaw as Record<string, unknown>;

    if (packed.name !== source.name) {
      throw new Error(`name mismatch: packed ${String(packed.name)} vs workspace ${String(source.name)}`);
    }
    if (packed.version !== source.version) {
      throw new Error(`version mismatch: packed ${String(packed.version)} vs workspace ${String(source.version)}`);
    }

    assertExportsDot(packed);
    manifestKeySubset(packed, source, [
      "name",
      "version",
      "type",
      "sideEffects",
      "main",
      "module",
      "types",
      "exports",
      "files",
    ]);

    const distDir = path.join(root, "dist");
    if (!existsSync(distDir)) throw new Error("Missing dist/ in tarball");
    for (const file of REQUIRED_DIST_FILES) {
      const fp = path.join(distDir, file);
      if (!existsSync(fp)) throw new Error(`Missing required dist file: dist/${file}`);
    }

    if (packed.files) {
      const files = packed.files;
      if (!Array.isArray(files) || !files.every((x) => typeof x === "string")) {
        throw new Error('Invalid "files" array in package.json');
      }
      if (!(files as string[]).includes("dist")) {
        throw new Error('package.json "files" must include "dist"');
      }
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}

export function verifyAllPackedInDir(packDir: string): void {
  const names = readdirSync(packDir).filter((f) => f.endsWith(".tgz"));
  if (names.length !== SDK_WORKSPACES.length) {
    throw new Error(`Expected ${SDK_WORKSPACES.length} .tgz files in ${packDir}, found ${names.length}`);
  }

  const bySlug = new Map<string, string>();
  for (const n of names) {
    const m = n.match(/^sammati-([a-z-]+)-(\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?)\.tgz$/i);
    if (!m) throw new Error(`Unexpected tarball name: ${n}`);
    bySlug.set(m[1]!, path.join(packDir, n));
  }

  for (const workspace of SDK_WORKSPACES) {
    const slug = WORKSPACE_DIR[workspace];
    const tgz = bySlug.get(slug);
    if (!tgz) throw new Error(`Missing tarball for ${workspace} (expected sammati-${slug}-*.tgz)`);
    verifyTarballAgainstWorkspace({ tarballPath: tgz, workspace });
  }
}
