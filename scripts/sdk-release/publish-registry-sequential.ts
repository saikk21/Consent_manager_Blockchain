/**
 * Sequential npm publish (or --dry-run) for @sammati/* in dependency order.
 * Env: DRY_RUN=1 for dry-run only.
 */
import { execFileSync } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { REPO_ROOT, SDK_WORKSPACES } from "./config.ts";

const dry = process.env.DRY_RUN === "1";
const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";

for (const ws of SDK_WORKSPACES) {
  const args = ["publish", "-w", ws, "--access", "public", "--no-git-checks"];
  if (dry) args.splice(1, 0, "--dry-run");
  execFileSync(npmBin, args, {
    cwd: REPO_ROOT,
    stdio: "inherit",
    env: process.env,
  });
  if (!dry) await delay(8000);
}
