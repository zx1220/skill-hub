import { validateApiKey, COOKIE_NAME } from "@/lib/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { apiKey } = body as { apiKey: string };

    if (!apiKey || !(await validateApiKey(apiKey))) {
      return Response.json({ error: "Invalid API key" }, { status: 401 });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": `${COOKIE_NAME}=${apiKey}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${60 * 60 * 24 * 30}${request.headers.get("x-forwarded-proto") === "https" ? "; Secure" : ""}`,
      },
    });
  } catch {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }
}
