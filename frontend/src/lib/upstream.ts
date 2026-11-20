export function upstreamBase(
  configured: string | undefined,
  hosted: boolean,
): URL {
  if (hosted && !configured?.trim()) throw new Error("missing_backend_url");
  const url = new URL(configured?.trim() || "http://127.0.0.1:5000/api");
  if (
    !["https:", "http:"].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error("invalid_backend_url");
  const host = url.hostname.toLowerCase().replace(/\.$/, "");
  if (
    hosted &&
    (url.protocol !== "https:" ||
      host === "localhost" ||
      host.endsWith(".localhost") ||
      host.startsWith("127.") ||
      host === "0.0.0.0" ||
      host === "[::1]" ||
      host === "[::]")
  )
    throw new Error("invalid_hosted_backend_url");
  const pathname = url.pathname.replace(/\/+$/, "");
  if (pathname !== "" && pathname !== "/api")
    throw new Error("invalid_backend_base_path");
  url.pathname = "/api/";
  return url;
}
