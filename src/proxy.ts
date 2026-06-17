import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * Next.js 16 Proxy (formerly Middleware)
 *
 * 未登录(无 skill-hub-key cookie)的页面请求统一重定向到 /login。
 * 这是 optimistic check —— 仅校验 cookie 是否存在,不验证 key 真伪;
 * 真正的写操作仍由 API 路由的 withAuth / withAuthSimple 严格校验把关。
 */
const COOKIE_NAME = "skill-hub-key";

export function proxy(request: NextRequest) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  if (!token) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // 拦截所有页面,排除:登录页、API 路由、静态资源
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|login).*)"],
};
