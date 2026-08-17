import { execFileSync, execSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { DEFAULT_PACK_OUT_DIR, SDK_WORKSPACES, WORKSPACE_DIR } from "./config.ts";
import { packAllWorkspaces } from "./pack-workspaces.ts";
import { verifyAllPackedInDir } from "./verify-tarball.ts";

function shellQuote(arg: string): string {
  if (!/[ \t\n\r'"$`]/.test(arg)) return arg;
  return `"${arg.replace(/"/g, '\\"')}"`;
}

function npm(args: string[], cwd: string): void {
  const line = ["npm", ...args.map(shellQuote)].join(" ");
  try {
    execSync(line, {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    const err = e as NodeJS.ErrnoException & { stderr?: string; stdout?: string };
    throw new Error(`npm ${args.join(" ")} failed:\n${err.stderr ?? err.stdout ?? err.message}`);
  }
}

function node(args: string[], cwd: string): void {
  try {
    execFileSync(process.execPath, args, {
      cwd,
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (e) {
    const err = e as NodeJS.ErrnoException & { stderr?: string; stdout?: string };
    throw new Error(`node ${args.join(" ")} failed:\n${err.stderr ?? err.stdout ?? err.message}`);
  }
}

function resolveTarballs(packDir: string): Record<(typeof SDK_WORKSPACES)[number], string> {
  const names = readdirSync(packDir).filter((f) => f.endsWith(".tgz"));
  const map = new Map<string, string>();
  for (const n of names) {
    const m = n.match(/^sammati-([a-z-]+)-(\d+\.\d+\.\d+(?:-[a-z0-9.-]+)?)\.tgz$/i);
    if (!m) continue;
    map.set(m[1]!, path.resolve(packDir, n));
  }
  const out = {} as Record<(typeof SDK_WORKSPACES)[number], string>;
  for (const ws of SDK_WORKSPACES) {
    const slug = WORKSPACE_DIR[ws];
    const p = map.get(slug);
    if (!p) throw new Error(`Missing tarball for ${ws} in ${packDir}`);
    out[ws] = p;
  }
  return out;
}

/**
 * Installs packed tarballs into a clean temp directory and runs minimal ESM/CJS import checks.
 * Uses npm `overrides` so nested `file:../shared-core` in packed manifests resolve to the shared-core tarball.
 * Requires npm >= 8.3 (overrides).
 */
export function runInstallSmoke(input?: Readonly<{ packDir?: string; skipPack?: boolean }>): void {
  const packDir = path.resolve(input?.packDir ?? DEFAULT_PACK_OUT_DIR);

  if (!input?.skipPack) {
    packAllWorkspaces({ outDir: packDir, clean: true });
  }
  verifyAllPackedInDir(packDir);

  const paths = resolveTarballs(packDir);
  const coreTgz = paths["@sammati/shared-core"].replace(/\\/g, "/");

  const deps: Record<string, string> = {};
  const overrides: Record<string, string> = {
    "@sammati/shared-core": `file:${coreTgz}`,
  };
  for (const ws of SDK_WORKSPACES) {
    const abs = paths[ws].replace(/\\/g, "/");
    deps[ws] = `file:${abs}`;
  }

  const smokeRoot = mkdtempSync(path.join(tmpdir(), "sammati-install-smoke-"));
  try {
    writeFileSync(
      path.join(smokeRoot, "package.json"),
      JSON.stringify(
        {
          name: "sammati-sdk-install-smoke",
          private: true,
          type: "module",
          dependencies: deps,
          overrides,
        },
        null,
        2,
      ),
    );

    npm(["install", "--no-fund", "--no-audit"], smokeRoot);

    writeFileSync(
      path.join(smokeRoot, "smoke-esm.mjs"),
      [
        `import { SammatiError } from "@sammati/shared-core";`,
        `import { verifyWebhookSignature } from "@sammati/webhook-utils";`,
        `import { createSammatiClient } from "@sammati/server-sdk";`,
        `import { buildHostedWidgetUrl } from "@sammati/widget-sdk";`,
        `if (typeof SammatiError !== "function") throw new Error("SammatiError");`,
        `if (typeof verifyWebhookSignature !== "function") throw new Error("verifyWebhookSignature");`,
        `if (typeof createSammatiClient !== "function") throw new Error("createSammatiClient");`,
        `if (typeof buildHostedWidgetUrl !== "function") throw new Error("buildHostedWidgetUrl");`,
        `console.log("esm-smoke-ok");`,
      ].join("\n"),
    );

    writeFileSync(
      path.join(smokeRoot, "smoke.cjs"),
      [
        `const { SammatiError } = require("@sammati/shared-core");`,
        `const { verifyWebhookSignature } = require("@sammati/webhook-utils");`,
        `const { createSammatiClient } = require("@sammati/server-sdk");`,
        `const { buildHostedWidgetUrl } = require("@sammati/widget-sdk");`,
        `if (typeof SammatiError !== "function") throw new Error("SammatiError");`,
        `if (typeof verifyWebhookSignature !== "function") throw new Error("verifyWebhookSignature");`,
        `if (typeof createSammatiClient !== "function") throw new Error("createSammatiClient");`,
        `if (typeof buildHostedWidgetUrl !== "function") throw new Error("buildHostedWidgetUrl");`,
        `console.log("cjs-smoke-ok");`,
      ].join("\n"),
    );

    node(["./smoke-esm.mjs"], smokeRoot);
    node(["./smoke.cjs"], smokeRoot);
  } finally {
    rmSync(smokeRoot, { recursive: true, force: true });
  }
}
