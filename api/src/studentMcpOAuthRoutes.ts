import express, { Router, type Request, type Response } from "express";
import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import type { PrismaClient } from "@prisma/client";
import { forbidden } from "./errors.js";
import { readSessionToken, requireAuth, requireRecentReauthentication, signJwt, verifyJwt, type AuthedRequest } from "./auth.js";

const ISSUER = "https://arctester.onrender.com";
const RESOURCE = "https://arctester.onrender.com/mcp/student";
const WEB_APP = (process.env.APP_BASE_URL?.trim() || "https://arctester.vercel.app").replace(/\/+$/, "");
const SCOPES = ["questions:read", "questions:write", "practice:read", "practice:write"] as const;
type Scope = typeof SCOPES[number];

function sha256(value: string): Buffer {
  return createHash("sha256").update(value).digest();
}
function base64url(value: Buffer): string {
  return value.toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function digestText(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}
function parseScopes(raw: string | undefined): Scope[] {
  const requested = raw?.trim() ? raw.trim().split(/\s+/) : [...SCOPES];
  if (requested.some(scope => !SCOPES.includes(scope as Scope))) throw new Error("Unsupported ArcTester scope.");
  return [...new Set(requested as Scope[])];
}
function resourceMetadata() {
  return {
    resource: RESOURCE,
    authorization_servers: [ISSUER],
    scopes_supported: [...SCOPES],
    bearer_methods_supported: ["header"],
  };
}
function authorizationMetadata() {
  return {
    issuer: ISSUER,
    authorization_response_iss_parameter_supported: true,
    authorization_endpoint: ISSUER + "/oauth/authorize",
    token_endpoint: ISSUER + "/oauth/token",
    client_id_metadata_document_supported: true,
    token_endpoint_auth_methods_supported: ["none"],
    code_challenge_methods_supported: ["S256"],
    scopes_supported: [...SCOPES],
  };
}
type OAuthClient = { clientId: string; redirectUri: string; clientName: string };
async function validateClient(clientId: string, redirectUri: string): Promise<OAuthClient> {
  let clientUrl: URL;
  let redirectUrl: URL;
  try {
    clientUrl = new URL(clientId);
    redirectUrl = new URL(redirectUri);
  } catch {
    throw new Error("OAuth client or redirect URL is invalid.");
  }
  if (clientUrl.protocol !== "https:" || !["chatgpt.com", "chat.openai.com"].includes(clientUrl.hostname) || !clientUrl.pathname.startsWith("/oauth/") || clientUrl.username || clientUrl.password) {
    throw new Error("Only ChatGPT's HTTPS OAuth client metadata documents are accepted.");
  }
  if (redirectUrl.protocol !== "https:" || redirectUrl.username || redirectUrl.password || redirectUrl.hash) {
    throw new Error("OAuth redirect URI must be a secure HTTPS URL.");
  }
  const response = await fetch(clientUrl.toString(), { signal: AbortSignal.timeout(5000), headers: { accept: "application/json" } });
  if (!response.ok) throw new Error("OAuth client metadata could not be verified.");
  const metadata = await response.json() as { redirect_uris?: unknown; client_name?: unknown };
  if (!Array.isArray(metadata.redirect_uris) || !metadata.redirect_uris.includes(redirectUri)) {
    throw new Error("The redirect URI is not registered in the OAuth client metadata.");
  }
  return { clientId, redirectUri, clientName: typeof metadata.client_name === "string" ? metadata.client_name.slice(0, 100) : "ChatGPT" };
}
const AuthorizeInput = z.object({
  client_id: z.string().url().max(2048),
  redirect_uri: z.string().url().max(2048),
  response_type: z.literal("code"),
  code_challenge: z.string().min(43).max(128),
  code_challenge_method: z.literal("S256"),
  scope: z.string().max(500).optional(),
  state: z.string().max(2048).optional(),
  resource: z.string().url().max(2048).optional(),
});
type OAuthRequest = z.infer<typeof AuthorizeInput> & { clientName?: string };

async function currentApprovedStudent(req: Request, db: PrismaClient) {
  const token = readSessionToken(req);
  if (!token) return null;
  try {
    const payload = verifyJwt(token);
    const id = Number(payload.sub);
    const email = String(payload.email ?? "");
    const sv = Number(payload.sv ?? 0);
    if (!Number.isSafeInteger(id) || id <= 0 || !email) return null;
    const user = await db.user.findUnique({ where: { id }, select: { id: true, email: true, role: true, accessStatus: true, sessionVersion: true } });
    if (!user || user.email !== email || user.sessionVersion !== sv || user.role !== "STUDENT" || user.accessStatus !== "APPROVED") return null;
    const sid = typeof payload.sid === "string" ? payload.sid : "";
    if (sid) {
      const session = await db.authSession.findFirst({ where: { id: sid, userId: id, revokedAt: null, expiresAt: { gt: new Date() } }, select: { id: true } });
      if (!session) return null;
    }
    return user;
  } catch {
    return null;
  }
}
function appAuthorizationUrl(request: OAuthRequest): string {
  const encoded = base64url(Buffer.from(JSON.stringify(request), "utf8"));
  return WEB_APP + "/?connectArcTester=1&oauthRequest=" + encodeURIComponent(encoded);
}
function redirectWithOAuthError(res: Response, redirectUri: string, state: string | undefined, error: string, description: string): void {
  const target = new URL(redirectUri);
  target.searchParams.set("error", error);
  target.searchParams.set("error_description", description.slice(0, 200));
  if (state) target.searchParams.set("state", state);
  target.searchParams.set("iss", ISSUER);
  res.redirect(302, target.toString());
}

export function studentMcpOAuthRouter(db: PrismaClient): Router {
  const router = Router();

  router.get("/.well-known/oauth-protected-resource", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json(resourceMetadata());
  });
  router.get("/.well-known/oauth-protected-resource/mcp/student", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json(resourceMetadata());
  });
  router.get("/.well-known/oauth-authorization-server", (_req, res) => {
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json(authorizationMetadata());
  });

  router.get("/oauth/authorize", async (req, res, next) => {
    try {
      const input = AuthorizeInput.parse({
        client_id: req.query.client_id,
        redirect_uri: req.query.redirect_uri,
        response_type: req.query.response_type,
        code_challenge: req.query.code_challenge,
        code_challenge_method: req.query.code_challenge_method,
        scope: req.query.scope,
        state: req.query.state,
        resource: req.query.resource,
      });
      if (input.resource && input.resource !== RESOURCE) return res.status(400).json({ error: "invalid_target", error_description: "Unsupported ArcTester resource." });
      const scopes = parseScopes(input.scope);
      const client = await validateClient(input.client_id, input.redirect_uri);
      const request: OAuthRequest = { ...input, scope: scopes.join(" "), resource: RESOURCE, clientName: client.clientName };
      const user = await currentApprovedStudent(req, db);
      if (!user) {
        return res.redirect(302, appAuthorizationUrl(request));
      }
      return res.redirect(302, appAuthorizationUrl(request));
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "invalid_request", error_description: error.issues.map(issue => issue.message).join("; ") });
      const message = error instanceof Error ? error.message : "OAuth authorization request failed.";
      return res.status(400).json({ error: "invalid_client", error_description: message });
    }
  });

  router.post("/oauth/authorize/approve", requireAuth, requireRecentReauthentication(), async (req: AuthedRequest, res, next) => {
    try {
      const input = AuthorizeInput.extend({ approved: z.literal(true), clientName: z.string().max(100).optional() }).parse(req.body);
      if (input.resource && input.resource !== RESOURCE) return res.status(400).json({ error: "invalid_target" });
      const client = await validateClient(input.client_id, input.redirect_uri);
      const scopes = parseScopes(input.scope);
      const user = await db.user.findUnique({ where: { id: req.user!.id }, select: { id: true, email: true, role: true, accessStatus: true } });
      if (!user || user.role !== "STUDENT" || user.accessStatus !== "APPROVED") return next(forbidden("An approved ArcTester student account is required."));
      const code = randomBytes(32).toString("base64url");
      const metadata = {
        codeHash: digestText(code),
        clientId: client.clientId,
        redirectUri: client.redirectUri,
        codeChallenge: input.code_challenge,
        scopes,
        resource: RESOURCE,
      };
      const challenge = metadata.codeHash + "." + base64url(Buffer.from(JSON.stringify(metadata), "utf8"));
      await db.authChallenge.create({ data: { userId: user.id, challenge, purpose: "mcp-oauth-code", expiresAt: new Date(Date.now() + 5 * 60 * 1000) } });
      const target = new URL(client.redirectUri);
      target.searchParams.set("code", code);
      if (input.state) target.searchParams.set("state", input.state);
      target.searchParams.set("iss", ISSUER);
      res.setHeader("Cache-Control", "no-store");
      res.json({ ok: true, redirectUrl: target.toString(), clientName: input.clientName || client.clientName });
    } catch (error) { next(error); }
  });

  router.post("/oauth/token", express.urlencoded({ extended: false }), async (req, res) => {
    try {
      const input = z.object({
        grant_type: z.literal("authorization_code"),
        code: z.string().min(20).max(256),
        client_id: z.string().url().max(2048),
        redirect_uri: z.string().url().max(2048),
        code_verifier: z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/),
        resource: z.string().url().max(2048).optional(),
      }).parse(req.body);
      if (input.resource && input.resource !== RESOURCE) return res.status(400).json({ error: "invalid_target" });
      await validateClient(input.client_id, input.redirect_uri);
      const codeHash = digestText(input.code);
      const row = await db.authChallenge.findFirst({ where: { purpose: "mcp-oauth-code", expiresAt: { gt: new Date() }, challenge: { startsWith: codeHash + "." } } });
      if (!row) return res.status(400).json({ error: "invalid_grant", error_description: "Authorization code is invalid or expired." });
      let metadata: { codeHash: string; clientId: string; redirectUri: string; codeChallenge: string; scopes: Scope[]; resource: string };
      try { metadata = JSON.parse(Buffer.from(row.challenge.split(".").slice(1).join("."), "base64url").toString("utf8")); }
      catch { return res.status(400).json({ error: "invalid_grant" }); }
      const verifierChallenge = base64url(sha256(input.code_verifier));
      if (metadata.codeHash !== codeHash || metadata.clientId !== input.client_id || metadata.redirectUri !== input.redirect_uri || metadata.codeChallenge !== verifierChallenge || metadata.resource !== RESOURCE) {
        return res.status(400).json({ error: "invalid_grant", error_description: "Authorization code or PKCE verification failed." });
      }
      const consumed = await db.authChallenge.deleteMany({ where: { id: row.id, purpose: "mcp-oauth-code", expiresAt: { gt: new Date() } } });
      if (consumed.count !== 1) return res.status(400).json({ error: "invalid_grant", error_description: "Authorization code was already used." });
      const user = await db.user.findUnique({ where: { id: row.userId }, select: { id: true, email: true, role: true, accessStatus: true, sessionVersion: true } });
      if (!user || user.role !== "STUDENT" || user.accessStatus !== "APPROVED") return res.status(403).json({ error: "access_denied" });
      const expiresIn = 7 * 24 * 60 * 60;
      const accessToken = signJwt({ sub: String(user.id), email: user.email, sv: user.sessionVersion, mcp_oauth: true, scope: metadata.scopes.join(" ") }, expiresIn);
      const activeKeys = await db.studentMcpKey.count({ where: { userId: user.id, revokedAt: null } });
      if (activeKeys >= 20) return res.status(429).json({ error: "temporarily_unavailable", error_description: "Too many active student MCP connections. Revoke an unused connection in ArcTester and retry." });
      await db.studentMcpKey.create({ data: { userId: user.id, name: "ChatGPT OAuth connection", keyHash: digestText(accessToken), scopes: metadata.scopes } });
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Pragma", "no-cache");
      res.json({ access_token: accessToken, token_type: "Bearer", expires_in: expiresIn, scope: metadata.scopes.join(" ") });
    } catch (error) {
      if (error instanceof z.ZodError) return res.status(400).json({ error: "invalid_request", error_description: error.issues.map(issue => issue.message).join("; ") });
      res.status(400).json({ error: "invalid_grant", error_description: "OAuth token exchange failed." });
    }
  });

  return router;
}
