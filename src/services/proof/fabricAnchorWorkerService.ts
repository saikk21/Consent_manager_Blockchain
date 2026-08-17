import * as grpc from '@grpc/grpc-js';
import { connect, hash, signers } from '@hyperledger/fabric-gateway';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { DbPool } from '../../persistence/db/pool.js';
import { withTx } from '../../persistence/db/tx.js';
import {
  claimSealedBatchForAnchor,
  confirmMockAnchor,
  getProofBatchCompanyId,
} from '../../persistence/repositories/proofRepository.js';
import type { WebhookEventService } from '../webhooks/webhookEventService.js';

const FABRIC_BASE = path.join(process.env.HOME ?? '/home/rithika', 'hyperledger/mynetwork/crypto-config');
const MSP_ID = 'Org1MSP';
const PEER_ENDPOINT = 'peer0.org1.example.com:7051';
const PEER_HOST_ALIAS = 'peer0.org1.example.com';
const TLS_CERT_PATH = path.join(FABRIC_BASE, 'peerOrganizations/org1.example.com/peers/peer0.org1.example.com/tls/ca.crt');
const CERT_PATH = path.join(FABRIC_BASE, 'peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/signcerts/Admin@org1.example.com-cert.pem');
const KEY_DIR = path.join(FABRIC_BASE, 'peerOrganizations/org1.example.com/users/Admin@org1.example.com/msp/keystore');
const CHANNEL_NAME = 'mychannel';
const CHAINCODE_NAME = 'sammati_anchor';

function loadPrivateKey(): crypto.KeyObject {
  const files = fs.readdirSync(KEY_DIR);
  if (files.length === 0) throw new Error('No private key found in keystore');
  const keyPem = fs.readFileSync(path.join(KEY_DIR, files[0]));
  return crypto.createPrivateKey(keyPem);
}

function newGrpcConnection(): grpc.Client {
  const tlsCert = fs.readFileSync(TLS_CERT_PATH);
  const credentials = grpc.credentials.createSsl(tlsCert);
  return new grpc.Client(PEER_ENDPOINT, credentials, {
    'grpc.ssl_target_name_override': PEER_HOST_ALIAS,
  });
}

export class FabricAnchorWorkerService {
  constructor(
    private readonly pool: DbPool,
    private readonly webhookEvent?: WebhookEventService,
  ) {}

  async processNextBatch(): Promise<boolean> {
    const claimed = await withTx(this.pool, (client) => claimSealedBatchForAnchor(client));
    if (!claimed) return false;

    const batchId = claimed.id;
    const rootHash = claimed.root_hash ?? 'missing_root';
    const batchNo = claimed.batch_no;
    const eventCount = claimed.event_count ?? 1;

    console.log(`[fabric-anchor] Processing batch ${batchId}`);

    const grpcClient = newGrpcConnection();

    try {
      const identity = {
        mspId: MSP_ID,
        credentials: fs.readFileSync(CERT_PATH),
      };

      const privateKey = loadPrivateKey();
      const signer = signers.newPrivateKeySigner(privateKey);

      const gateway = connect({
        client: grpcClient,
        identity,
        signer,
        hash: hash.sha256,
      });

      try {
        const network = gateway.getNetwork(CHANNEL_NAME);
        const contract = network.getContract(CHAINCODE_NAME);

        console.log('[fabric-anchor] Calling AnchorBatch on Fabric...');

        const resultBytes = await contract.submit('AnchorBatch', {
          arguments: [batchId, rootHash, String(batchNo), 'MERKLE_SHA256_V1', String(eventCount)],
          endorsingOrganizations: ['Org1MSP', 'Org2MSP'],
        });

        const resultJson = Buffer.from(resultBytes).toString('utf8');
        const result = JSON.parse(resultJson) as { txId: string };
        const fabricTxId = result.txId;

        console.log(`[fabric-anchor] Anchored! txId=${fabricTxId}`);

        await withTx(this.pool, (client) =>
          confirmMockAnchor(client, { batchId, anchorRef: fabricTxId }),
        );

        await this.pool.query(
          `UPDATE proof_batches SET anchor_mode = 'FABRIC', updated_at = now() WHERE id = $1`,
          [batchId],
        );

        const companyId = await withTx(this.pool, (client) =>
          getProofBatchCompanyId(client, { batchId }),
        );

        if (companyId) {
          await this.webhookEvent?.enqueueEvent(companyId, 'proof.anchor_confirmed', {
            batch_id: batchId,
            anchor_ref: fabricTxId,
            root_hash: rootHash,
            anchor_mode: 'FABRIC',
          });
        }

        console.log(`[fabric-anchor] Batch ${batchId} confirmed on Fabric`);
        return true;

      } finally {
        gateway.close();
      }
    } catch (err) {
      console.error(`[fabric-anchor] Failed to anchor batch ${batchId}:`, err);
      throw err;
    } finally {
      grpcClient.close();
    }
  }
}
