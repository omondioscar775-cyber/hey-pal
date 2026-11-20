import { NextRequest, NextResponse } from "next/server";

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
  const publicRoute = signIn || reset;
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
  try {
    const base =
      process.env.CIRCLEUP_API_URL ??
      process.env.NEXT_PUBLIC_API_URL ??
      "http://localhost:5000/api";
    const upstream = await fetch(
      base.replace(/\/$/, "") + "/" + path + request.nextUrl.search,
      {
        method,
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(15000),
        headers: {
          "Content-Type": "application/json",
          ...(!publicRoute && token
            ? { Authorization: "Bearer " + token }
            : {}),
        },
        body:
          method === "POST" || method === "PATCH" || method === "PUT"
            ? await request.text()
            : undefined,
      },
    );
    if (logout && (upstream.ok || upstream.status === 401)) {
      const response = NextResponse.json({ success: true });
      response.cookies.set(session, "", { ...cookie, maxAge: 0 });
      return response;
    }
    const data = await upstream.json();
    if (signIn && upstream.ok) {
      const { token: jwt, ...account } = data;
      if (typeof jwt !== "string" || !account.user)
        throw new Error("Invalid sign-in response");
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
  } catch {
    return NextResponse.json(
      {
        message: "CircleUp could not reach its data service. Please try again.",
      },
      { status: 502 },
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
