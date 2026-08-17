import { strict as assert } from "node:assert";
import { buildMerkleTree, verifyMerkleProof } from "../services/proof/merkleTree.js";
import { computeLeafHash } from "../services/proof/canonicalHashing.js";

function run() {
  const event = {
    eventId: "e1",
    companyId: "c1",
    consentId: "co1",
    externalUserId: "u1",
    purposeCode: "KYC",
    eventType: "CONSENT_GRANTED",
    versionNo: 1,
    policyRef: "policy-v1",
    occurredAt: "2026-05-07T10:00:00.000Z",
    recordedAt: "2026-05-07T10:00:01.000Z",
    eventHash: "abc",
  };

  const h1 = computeLeafHash(event);
  const h2 = computeLeafHash({ ...event });
  assert.equal(h1, h2, "canonical leaf hash should be deterministic");

  const leaves = [h1, computeLeafHash({ ...event, eventId: "e2" }), computeLeafHash({ ...event, eventId: "e3" })];
  const merkle = buildMerkleTree(leaves);
  assert.ok(merkle.rootHash.length > 10, "root hash should be generated");

  for (const proof of merkle.proofs) {
    const valid = verifyMerkleProof(
      leaves[proof.leafIndex]!,
      proof.pathHashes,
      proof.pathPositions,
      merkle.rootHash,
    );
    assert.equal(valid, true, "proof path should verify");
  }

  const broken = verifyMerkleProof(
    leaves[0]!,
    merkle.proofs[0]!.pathHashes,
    merkle.proofs[0]!.pathPositions,
    "bad_root",
  );
  assert.equal(broken, false, "tampered root must fail verification");

  // eslint-disable-next-line no-console
  console.log("proof verification tests passed");
}

run();

