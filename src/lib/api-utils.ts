/**
 * Safe error response — never leak internal details to the client.
 */
export function safeError(e: unknown, status = 500): Response {
  // Log full error server-side (in production, use a real logger)
  console.error("[API Error]", e);

  const message =
    e instanceof Error ? e.message : "Internal server error";

  // Hide GitHub API details from the client
  const safeMessage = message.includes("api.github.com")
    ? "Upstream service error"
    : message.length > 200
      ? "Internal server error"
      : message;

  return Response.json({ error: safeMessage }, { status });
}
