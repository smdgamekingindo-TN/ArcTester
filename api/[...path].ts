/**
 * Same-origin API proxy for the static Vite app.
 *
 * API_ORIGIN may override the deployed Render API origin.
 */
export default async function handler(req: any, res: any): Promise<void> {
  const origin = (process.env.API_ORIGIN?.trim() || "https://arctester.onrender.com").replace(/\/+$/, "");

  const incomingUrl = new URL(req.url || "/api", "https://vercel.internal");
  const upstreamPath = incomingUrl.pathname.replace(/^\/api(?=\/|$)/, "") || "/";
  const target = new URL(origin + upstreamPath);
  target.search = incomingUrl.search;

  const headers = new Headers();
  for (const [name, value] of Object.entries(req.headers || {})) {
    if (value == null || ["host", "connection", "content-length", "transfer-encoding", "upgrade", "keep-alive"].includes(name.toLowerCase())) continue;
    headers.set(name, Array.isArray(value) ? value.join(", ") : String(value));
  }

  let body: Buffer | undefined;
  if (!["GET", "HEAD"].includes(String(req.method || "GET").toUpperCase())) {
    const chunks: Buffer[] = [];
    for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    if (chunks.length) body = Buffer.concat(chunks);
  }

  try {
    const upstream = await fetch(target, {
      method: req.method,
      headers,
      body,
      redirect: "manual",
    });
    res.status(upstream.status);
    upstream.headers.forEach((value, name) => {
      if (["connection", "content-length", "content-encoding", "transfer-encoding", "set-cookie"].includes(name.toLowerCase())) return;
      res.setHeader(name, value);
    });
    // Preserve each cookie separately; Headers.forEach() can fold Set-Cookie.
    const getSetCookie = (upstream.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie;
    const cookies = getSetCookie ? getSetCookie.call(upstream.headers) : [];
    const singleCookie = upstream.headers.get("set-cookie");
    if (cookies.length) res.setHeader("Set-Cookie", cookies);
    else if (singleCookie) res.setHeader("Set-Cookie", singleCookie);
    const payload = Buffer.from(await upstream.arrayBuffer());
    res.end(payload);
  } catch (error) {
    console.error("API proxy request failed:", error);
    res.status(502).json({ error: "The API service could not be reached." });
  }
}
