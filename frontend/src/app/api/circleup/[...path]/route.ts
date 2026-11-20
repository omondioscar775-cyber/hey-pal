import { NextRequest, NextResponse } from "next/server";
import { upstreamBase } from "../../../../lib/upstream";

function unavailable(
  status: number,
  code: string,
  message: string,
  path: string,
) {
  console.warn(
    JSON.stringify({ event: "circleup_upstream_failed", code, path }),
  );
  return NextResponse.json(
    { success: false, code, message },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

const session = "circleup_session";
const cookie = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

async function proxy(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const path = (await params).path.join("/");
  const method = request.method;
  const signIn =
    method === "POST" && ["auth/login", "auth/register"].includes(path);
  const mutation = method !== "GET";
  if (mutation && request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json(
      { message: "Cross-site request rejected." },
      { status: 403 },
    );
  }
  if (
    mutation &&
    request.headers.get("content-type")?.split(";")[0].trim() !==
      "application/json"
  ) {
    return NextResponse.json(
      { message: "Use a JSON request." },
      { status: 415 },
    );
  }
  const logout = path === "auth/logout" && method === "POST";
  const reset =
    method === "POST" &&
    /^auth\/password-reset\/(request|complete)$/.test(path);
  const publicRoute = signIn || reset || (method === "GET" && path === "ready");
  const ownedRoute =
    (path === "auth/me" && method === "GET") ||
    /^goals\/[a-f0-9]{24}\/archive$/i.test(path) ||
    /^(goals|roadmaps|tasks)(\/[a-f0-9]{24})?$/i.test(path) ||
    /^roadmaps\/[a-f0-9]{24}\/(validation|approve|milestones)$/i.test(path) ||
    /^planner\/(availability|capacity|preview|preview-plan|commit|blocks(\/[a-f0-9]{24})?)$/i.test(
      path,
    ) ||
    /^recovery\/cases(\/[a-f0-9]{24}(\/(approve|reject))?)?$/i.test(path) ||
    /^focus\/sessions(\/[a-f0-9]{24}\/(pause|resume|complete|interrupt))?$/i.test(
      path,
    ) ||
    /^progress\/(summary|goals\/[a-f0-9]{24}|reviews(\/\d{4}-\d{2}-\d{2})?)$/i.test(
      path,
    );
  if (!publicRoute && !logout && !ownedRoute)
    return NextResponse.json(
      { message: "Endpoint unavailable." },
      { status: 404 },
    );
  const token = request.cookies.get(session)?.value;
  if (!publicRoute && !token) {
    if (logout) return NextResponse.json({ success: true });
    return NextResponse.json({ message: "Please sign in." }, { status: 401 });
  }
  let base: URL;
  try {
    base = upstreamBase(
      process.env.CIRCLEUP_API_URL,
      process.env.VERCEL === "1" || Boolean(process.env.VERCEL_ENV),
    );
    if (base.origin === request.nextUrl.origin)
      throw new Error("recursive_backend_url");
  } catch {
    return unavailable(
      503,
      "BACKEND_CONFIG",
      "CircleUp’s data service needs to be configured.",
      path,
    );
  }
  try {
    const upstream = await fetch(new URL(path + request.nextUrl.search, base), {
      method,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: {
        "Content-Type": "application/json",
        ...(!publicRoute && token ? { Authorization: "Bearer " + token } : {}),
      },
      body:
        method === "POST" || method === "PATCH" || method === "PUT"
          ? await request.text()
          : undefined,
    });
    if (logout && (upstream.ok || upstream.status === 401)) {
      const response = NextResponse.json({ success: true });
      response.cookies.set(session, "", { ...cookie, maxAge: 0 });
      return response;
    }
    if (upstream.status >= 500) {
      const timeout = upstream.status === 504;
      return unavailable(
        timeout ? 504 : 503,
        timeout ? "BACKEND_TIMEOUT" : "BACKEND_UNAVAILABLE",
        timeout
          ? "The data service timed out. Please try again."
          : "CircleUp’s data service is temporarily unavailable.",
        path,
      );
    }
    const data = await upstream.json().catch(() => null);
    if (
      !data ||
      typeof data !== "object" ||
      typeof data.success !== "boolean" ||
      (upstream.ok && !data.success)
    ) {
      return unavailable(
        502,
        "INVALID_BACKEND_RESPONSE",
        "CircleUp received an unexpected response from its data service.",
        path,
      );
    }
    if (signIn && upstream.ok) {
      const { token: jwt, ...account } = data;
      if (
        typeof jwt !== "string" ||
        !jwt ||
        typeof account.user?.id !== "string"
      )
        return unavailable(
          502,
          "INVALID_BACKEND_RESPONSE",
          "CircleUp could not establish a session from the server response.",
          path,
        );
      const response = NextResponse.json(account, {
        status: upstream.status,
        headers: { "Cache-Control": "no-store" },
      });
      response.cookies.set(session, jwt, {
        ...cookie,
        maxAge: 7 * 24 * 60 * 60,
      });
      return response;
    }
    const response = NextResponse.json(data, {
      status: upstream.status,
      headers: { "Cache-Control": "no-store" },
    });
    if (!publicRoute && upstream.status === 401)
      response.cookies.set(session, "", { ...cookie, maxAge: 0 });
    return response;
  } catch (error) {
    const timeout = error instanceof Error && error.name === "TimeoutError";
    return unavailable(
      timeout ? 504 : 503,
      timeout ? "BACKEND_TIMEOUT" : "BACKEND_UNREACHABLE",
      timeout
        ? "The data service timed out. Please try again."
        : "CircleUp could not connect to its data service. Please try again.",
      path,
    );
  }
}

export {
  proxy as GET,
  proxy as POST,
  proxy as PATCH,
  proxy as PUT,
  proxy as DELETE,
};
