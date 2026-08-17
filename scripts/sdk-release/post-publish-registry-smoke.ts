/**
 * After registry publish: install @sammati/* from npm and run ESM/CJS smoke.
 * Env: SAMMATI_SDK_VERSION = semver (e.g. 0.1.0) matching published packages.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { SDK_WORKSPACES } from "./config.ts";

const version = process.env.SAMMATI_SDK_VERSION?.trim();
if (!version) {
  throw new Error("SAMMATI_SDK_VERSION is required (e.g. 0.1.0)");
}

const npmBin = process.platform === "win32" ? "npm.cmd" : "npm";

async function waitForPackage(name: string, maxAttempts = 45): Promise<void> {
  for (let i = 0; i < maxAttempts; i += 1) {
    try {
      execFileSync(npmBin, ["view", `${name}@${version}`, "version"], {
        encoding: "utf-8",
        stdio: ["ignore", "pipe", "pipe"],
      });
      return;
    } catch {
      await delay(3000);
    }
  }
  throw new Error(`Timeout waiting for ${name}@${version} on registry`);
}

async function main(): Promise<void> {
  for (const ws of SDK_WORKSPACES) {
    await waitForPackage(ws);
  }

  const root = mkdtempSync(path.join(tmpdir(), "sammati-registry-smoke-"));
  try {
    const deps: Record<string, string> = {};
    for (const ws of SDK_WORKSPACES) {
      deps[ws] = version;
    }
    writeFileSync(
      path.join(root, "package.json"),
      JSON.stringify(
        {
          name: "sammati-registry-smoke",
          private: true,
          type: "module",
          dependencies: deps,
        },
        null,
        2,
      ),
    );

    execFileSync(npmBin, ["install", "--no-fund", "--no-audit"], {
      cwd: root,
      stdio: "inherit",
    });

    writeFileSync(
      path.join(root, "smoke-esm.mjs"),
      [
        `import { SammatiError } from "@sammati/shared-core";`,
        `import { verifyWebhookSignature } from "@sammati/webhook-utils";`,
        `import { createSammatiClient } from "@sammati/server-sdk";`,
        `import { buildHostedWidgetUrl } from "@sammati/widget-sdk";`,
        `if (typeof SammatiError !== "function") throw new Error("SammatiError");`,
        `if (typeof verifyWebhookSignature !== "function") throw new Error("verifyWebhookSignature");`,
        `if (typeof createSammatiClient !== "function") throw new Error("createSammatiClient");`,
        `if (typeof buildHostedWidgetUrl !== "function") throw new Error("buildHostedWidgetUrl");`,
        `console.log("registry-esm-smoke-ok");`,
      ].join("\n"),
    );

    writeFileSync(
      path.join(root, "smoke.cjs"),
      [
        `const { SammatiError } = require("@sammati/shared-core");`,
        `const { verifyWebhookSignature } = require("@sammati/webhook-utils");`,
        `const { createSammatiClient } = require("@sammati/server-sdk");`,
        `const { buildHostedWidgetUrl } = require("@sammati/widget-sdk");`,
        `if (typeof SammatiError !== "function") throw new Error("SammatiError");`,
        `if (typeof verifyWebhookSignature !== "function") throw new Error("verifyWebhookSignature");`,
        `if (typeof createSammatiClient !== "function") throw new Error("createSammatiClient");`,
        `if (typeof buildHostedWidgetUrl !== "function") throw new Error("buildHostedWidgetUrl");`,
        `console.log("registry-cjs-smoke-ok");`,
      ].join("\n"),
    );

    execFileSync(process.execPath, ["./smoke-esm.mjs"], { cwd: root, stdio: "inherit" });
    execFileSync(process.execPath, ["./smoke.cjs"], { cwd: root, stdio: "inherit" });

    execFileSync(npmBin, ["ls", "--depth=0"], { cwd: root, stdio: "inherit" });
    for (const ws of SDK_WORKSPACES) {
      execFileSync(npmBin, ["ls", ws], { cwd: root, stdio: "inherit" });
    }
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
