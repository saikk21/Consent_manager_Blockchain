import { execSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync } from "node:fs";
import path from "node:path";
import { DEFAULT_PACK_OUT_DIR, REPO_ROOT, SDK_WORKSPACES } from "./config.ts";

function shellQuote(arg: string): string {
  if (!/[ \t\n\r'"$`]/.test(arg)) return arg;
  return `"${arg.replace(/"/g, '\\"')}"`;
}

export type PackResult = Readonly<{
  workspace: string;
  tarballPath: string;
}>;

function findTarballInDir(dir: string, beforeNames: Set<string>): string {
  const after = new Set(readdirSync(dir).filter((f) => f.endsWith(".tgz")));
  for (const name of after) {
    if (!beforeNames.has(name)) {
      return path.join(dir, name);
    }
  }
  throw new Error(`No new .tgz found in ${dir}`);
}

/**
 * Runs `npm pack -w <workspace> --pack-destination <outDir>` for each SDK in order.
 * Optionally clears `outDir` first so outputs are reproducible.
 */
export function packAllWorkspaces(input?: Readonly<{ outDir?: string; clean?: boolean }>): PackResult[] {
  const outDir = input?.outDir ?? DEFAULT_PACK_OUT_DIR;
  const clean = input?.clean ?? true;

  if (clean && existsSync(outDir)) {
    rmSync(outDir, { recursive: true, force: true });
  }
  mkdirSync(outDir, { recursive: true });

  const results: PackResult[] = [];
  const knownTgz = new Set<string>();

  for (const workspace of SDK_WORKSPACES) {
    const before = new Set(readdirSync(outDir).filter((f) => f.endsWith(".tgz")));
    try {
      execSync(`npm pack -w ${shellQuote(workspace)} --pack-destination ${shellQuote(outDir)}`, {
        cwd: REPO_ROOT,
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (e) {
      const err = e as NodeJS.ErrnoException & { stderr?: string; stdout?: string };
      throw new Error(
        `npm pack failed for ${workspace}: ${err.stderr ?? err.stdout ?? err.message}`,
      );
    }
    const tarballPath = findTarballInDir(outDir, before);
    knownTgz.add(path.basename(tarballPath));
    results.push({ workspace, tarballPath });
  }

  return results;
}
