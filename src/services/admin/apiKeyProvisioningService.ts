import type { DbPool } from "../../persistence/db/pool.js";
import { withTx } from "../../persistence/db/tx.js";
import {
  getCompanyById,
  insertCompanyApiKey,
} from "../../persistence/repositories/companyRepository.js";
import { generateApiKey } from "../../security/apiKeys.js";
import { loadEnv } from "../../config/env.js";

export type ProvisionedApiKey = Readonly<{
  companyId: string;
  keyId: string;
  publicPrefix: string;
  rawApiKey: string;
  createdAt: string;
}>;

export class ApiKeyProvisioningService {
  constructor(private readonly pool: DbPool) {}

  async provisionKeyForCompany(companyId: string): Promise<ProvisionedApiKey> {
    const env = loadEnv();
    const generated = generateApiKey(env.API_KEY_HASH_PEPPER);

    return withTx(this.pool, async (client) => {
      const company = await getCompanyById(client, { companyId });
      if (!company) {
        throw new Error("Company not found.");
      }

      const keyRow = await insertCompanyApiKey(client, {
        companyId,
        keyPrefix: generated.publicPrefix,
        keyHash: generated.keyHash,
      });

      return {
        companyId,
        keyId: keyRow.id,
        publicPrefix: keyRow.key_prefix,
        rawApiKey: generated.rawApiKey,
        createdAt: keyRow.created_at,
      };
    });
  }
}

