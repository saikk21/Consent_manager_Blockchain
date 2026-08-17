import { createHash } from "node:crypto";

export type MerkleProofPath = Readonly<{
  leafIndex: number;
  pathHashes: string[];
  pathPositions: Array<"L" | "R">;
}>;

export type MerkleBuildResult = Readonly<{
  rootHash: string;
  proofs: MerkleProofPath[];
}>;

function hashPair(left: string, right: string): string {
  return createHash("sha256").update(`sammati.node.v1:${left}:${right}`).digest("hex");
}

export function buildMerkleTree(leafHashes: string[]): MerkleBuildResult {
  if (leafHashes.length === 0) {
    throw new Error("Cannot build Merkle tree with zero leaves.");
  }

  const proofs: MerkleProofPath[] = leafHashes.map((_, index) => ({
    leafIndex: index,
    pathHashes: [],
    pathPositions: [],
  }));

  let level = leafHashes.map((hash, index) => ({ hash, indices: [index] as number[] }));

  while (level.length > 1) {
    const nextLevel: Array<{ hash: string; indices: number[] }> = [];

    for (let i = 0; i < level.length; i += 2) {
      const left = level[i]!;
      const right = level[i + 1] ?? level[i]!;
      const isDuplicatedRight = i + 1 >= level.length;

      for (const idx of left.indices) {
        proofs[idx]!.pathHashes.push(right.hash);
        proofs[idx]!.pathPositions.push("R");
      }
      if (!isDuplicatedRight) {
        for (const idx of right.indices) {
          proofs[idx]!.pathHashes.push(left.hash);
          proofs[idx]!.pathPositions.push("L");
        }
      }

      nextLevel.push({
        hash: hashPair(left.hash, right.hash),
        indices: [...new Set([...left.indices, ...right.indices])],
      });
    }

    level = nextLevel;
  }

  return {
    rootHash: level[0]!.hash,
    proofs,
  };
}

export function verifyMerkleProof(
  leafHash: string,
  pathHashes: string[],
  pathPositions: Array<"L" | "R">,
  expectedRootHash: string,
): boolean {
  if (pathHashes.length !== pathPositions.length) return false;

  let current = leafHash;
  for (let i = 0; i < pathHashes.length; i += 1) {
    const sibling = pathHashes[i]!;
    const pos = pathPositions[i]!;
    current = pos === "L" ? hashPair(sibling, current) : hashPair(current, sibling);
  }
  return current === expectedRootHash;
}

