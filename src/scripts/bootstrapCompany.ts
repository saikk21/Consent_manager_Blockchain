import { createPool } from "../persistence/db/pool.js";
import { CompanyBootstrapService } from "../services/admin/companyBootstrapService.js";

async function main() {
  const companyName = process.argv[2];
  if (!companyName) {
    throw new Error('Usage: npm run company:bootstrap -- "Company Name"');
  }

  const pool = createPool();
  try {
    const service = new CompanyBootstrapService(pool);
    const result = await service.createCompanyWithInitialApiKey(companyName);
    // Raw key is intentionally printed once and never persisted in plaintext.
    // eslint-disable-next-line no-console
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await pool.end();
  }
}

await main();

