import { randomBytes, timingSafeEqual } from "crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { DB_CONFIG } from "./constants";

const COOKIE_NAME = "skill-hub-key";

/** Generate a random API key */
export function generateApiKey(): string {
  return randomBytes(24).toString("hex");
}

/** Get or create the master API key */
export function getMasterKey(): string {
  const keyPath = DB_CONFIG.masterKeyPath;

  if (existsSync(keyPath)) {
    return readFileSync(keyPath, "utf-8").trim();
  }

  // Generate new master key
  const key = generateApiKey();

  // Ensure directory exists
  const dir = dirname(keyPath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  writeFileSync(keyPath, key, "utf-8");
  console.log(`\n🔑 Master API Key generated: ${key}`);
  console.log(`   Saved to: ${keyPath}\n`);
  return key;
}

/** Validate an API key against the master key (timing-safe) */
export function validateApiKey(key: string): boolean {
  if (!key) return false;
  const masterKey = getMasterKey();
  if (key.length !== masterKey.length) return false;
  return timingSafeEqual(Buffer.from(key), Buffer.from(masterKey));
}

/** Extract API key from request (header or cookie) */
export function extractApiKey(request: Request): string | null {
  // Check Authorization header first (CLI usage)
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    return authHeader.slice(7).trim();
  }

  // Check cookie (web UI usage)
  const cookie = request.headers.get("cookie");
  if (cookie) {
    const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
    if (match) return match[1].trim();
  }

  return null;
}

/** Check if request is authenticated */
export function isAuthenticated(request: Request): boolean {
  const key = extractApiKey(request);
  if (!key) return false;
  return validateApiKey(key);
}

/** HOC: wrap an API handler to require authentication */
export function withAuth(
  handler: (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>
): (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response> {
  return async (request, context) => {
    if (!isAuthenticated(request)) {
      return Response.json({ error: "Unauthorized. Provide API key via Authorization header or login." }, { status: 401 });
    }
    return handler(request, context);
  };
}

/** HOC for routes without params */
export function withAuthSimple(
  handler: (request: Request) => Promise<Response>
): (request: Request) => Promise<Response> {
  return async (request) => {
    if (!isAuthenticated(request)) {
      return Response.json({ error: "Unauthorized. Provide API key via Authorization header or login." }, { status: 401 });
    }
    return handler(request);
  };
}

export { COOKIE_NAME };
