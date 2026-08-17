import type { DbPool } from "../../persistence/db/pool.js";
import { withTx } from "../../persistence/db/tx.js";
import {
  insertCompany,
  insertCompanyApiKey,
} from "../../persistence/repositories/companyRepository.js";
import { generateApiKey } from "../../security/apiKeys.js";
import { loadEnv } from "../../config/env.js";

export type BootstrapCompanyResult = Readonly<{
  companyId: string;
  companyName: string;
  keyId: string;
  publicPrefix: string;
  rawApiKey: string;
  createdAt: string;
}>;

export class CompanyBootstrapService {
  constructor(private readonly pool: DbPool) {}

  async createCompanyWithInitialApiKey(companyName: string): Promise<BootstrapCompanyResult> {
    const env = loadEnv();
    const generated = generateApiKey(env.API_KEY_HASH_PEPPER);

    return withTx(this.pool, async (client) => {
      const company = await insertCompany(client, { name: companyName });
      const key = await insertCompanyApiKey(client, {
        companyId: company.id,
        keyPrefix: generated.publicPrefix,
        keyHash: generated.keyHash,
      });

      return {
        companyId: company.id,
        companyName: company.name,
        keyId: key.id,
        publicPrefix: key.key_prefix,
        rawApiKey: generated.rawApiKey,
        createdAt: key.created_at,
      };
    });
  }
}

