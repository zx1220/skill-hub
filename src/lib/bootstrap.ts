import { getDb } from "./db";
import { getMasterKey } from "./auth";

/**
 * Initialize the application on first startup.
 * - Creates data directories
 * - Initializes SQLite database
 * - Generates master API key if not exists
 *
 * Call this once when the server starts.
 */
export function initializeApp(): void {
  // Initialize database (creates tables if needed)
  getDb();

  // Ensure master API key exists (generated on first run)
  getMasterKey();
  console.log(`[skill-hub] Database initialized`);
}
