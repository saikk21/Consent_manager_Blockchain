import { createPool } from "../persistence/db/pool.js";
import { ApiKeyProvisioningService } from "../services/admin/apiKeyProvisioningService.js";

async function main() {
  const companyId = process.argv[2];
  if (!companyId) {
    throw new Error("Usage: npm run apikey:create -- <company_id>");
  }

  const pool = createPool();
  try {
    const service = new ApiKeyProvisioningService(pool);
    const provisioned = await service.provisionKeyForCompany(companyId);

    // Print raw key only once in this command output.
    // It is never written to the database.
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(provisioned, null, 2));
  } finally {
    await pool.end();
  }
}

await main();

