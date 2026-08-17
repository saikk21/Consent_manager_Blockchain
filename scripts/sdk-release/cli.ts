/**
 * Local SDK release dry-run CLI (E.1a.2). Does not publish to any registry.
 *
 * Usage (from repo root):
 *   npx tsx scripts/sdk-release/cli.ts pack [--out <dir>]
 *   npx tsx scripts/sdk-release/cli.ts verify [--out <dir>]
 *   npx tsx scripts/sdk-release/cli.ts smoke [--out <dir>] [--skip-pack]
 */
import { DEFAULT_PACK_OUT_DIR } from "./config.ts";
import { packAllWorkspaces } from "./pack-workspaces.ts";
import { runInstallSmoke } from "./install-smoke.ts";
import { verifyAllPackedInDir } from "./verify-tarball.ts";

function argValue(flag: string, argv: string[]): string | undefined {
  const i = argv.indexOf(flag);
  if (i < 0 || i + 1 >= argv.length) return undefined;
  return argv[i + 1];
}

const argv = process.argv.slice(2);
const cmd = argv[0];
const outDir = argValue("--out", argv) ?? DEFAULT_PACK_OUT_DIR;

if (!cmd || cmd === "-h" || cmd === "--help") {
  console.log(`sammati sdk-release (local dry-run only, no npm publish)

Commands:
  pack    Build tarballs via npm pack (dependency order)
  verify  Inspect tarballs in --out dir (requires exactly four .tgz files)
  smoke   pack + verify + clean temp npm install + ESM/CJS import smoke

Options:
  --out <dir>     Pack output directory (default: .release/packs)
  --skip-pack     (smoke only) use existing tarballs in --out
`);
  process.exit(cmd ? 0 : 1);
}

try {
  if (cmd === "pack") {
    const results = packAllWorkspaces({ outDir, clean: true });
    for (const r of results) {
      console.log("packed", r.workspace, "->", r.tarballPath);
    }
  } else if (cmd === "verify") {
    verifyAllPackedInDir(outDir);
    console.log("verify ok:", outDir);
  } else if (cmd === "smoke") {
    const skipPack = argv.includes("--skip-pack");
    runInstallSmoke({ packDir: outDir, skipPack });
    console.log("smoke ok");
  } else {
    console.error(`Unknown command: ${cmd}`);
    process.exit(1);
  }
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
