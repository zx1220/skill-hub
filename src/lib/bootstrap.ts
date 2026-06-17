import { getClient } from "./db";
import { getMasterKey } from "./auth";

/**
 * Initialize the application on first startup.
 * - Creates/verifies the database schema
 * - Generates master API key if not exists (local dev only)
 *
 * NOTE: Most initialization is lazy via getClient(); this is optional and
 * currently has no call site. Kept for future explicit warm-up.
 */
export async function initializeApp(): Promise<void> {
  await getClient();
  await getMasterKey();
  console.log(`[skill-hub] Database initialized`);
}
