import { randomBytes, timingSafeEqual } from "crypto";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { dirname } from "path";
import { DB_CONFIG } from "./constants";

const COOKIE_NAME = "skill-hub-key";

/** Generate a random API key */
export function generateApiKey(): string {
  return randomBytes(24).toString("hex");
}

/** Get the master API key: env var first (serverless), then local file fallback. */
export async function getMasterKey(): Promise<string> {
  // 1) Environment variable — required for serverless (read-only FS)
  if (process.env.SKILL_MASTER_KEY) {
    return process.env.SKILL_MASTER_KEY;
  }

  // 2) Local file fallback (Docker / local dev)
  const keyPath = DB_CONFIG.masterKeyPath;
  if (existsSync(keyPath)) {
    return readFileSync(keyPath, "utf-8").trim();
  }

  // 3) Local dev first run: generate and persist
  const key = generateApiKey();
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
export async function validateApiKey(key: string): Promise<boolean> {
  if (!key) return false;
  const masterKey = await getMasterKey();
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
export async function isAuthenticated(request: Request): Promise<boolean> {
  const key = extractApiKey(request);
  if (!key) return false;
  return validateApiKey(key);
}

/** HOC: wrap an API handler to require authentication */
export function withAuth(
  handler: (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response>
): (request: Request, context: { params: Promise<Record<string, string>> }) => Promise<Response> {
  return async (request, context) => {
    if (!(await isAuthenticated(request))) {
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
    if (!(await isAuthenticated(request))) {
      return Response.json({ error: "Unauthorized. Provide API key via Authorization header or login." }, { status: 401 });
    }
    return handler(request);
  };
}

export { COOKIE_NAME };
