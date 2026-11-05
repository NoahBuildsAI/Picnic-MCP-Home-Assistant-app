// Minimal OAuth 2.1 authorization server for this single-user MCP gateway.
//
// Why this exists: MCP clients that only offer an "OAuth" connector option
// (no raw header field — Claude on the web, iOS and Android) speak the MCP
// Authorization spec: OAuth 2.1 + Dynamic Client Registration (RFC 7591) +
// PKCE (RFC 7636), discovered through RFC 9728 / RFC 8414 metadata. There is
// no separate identity provider, so the add-on's own mcp_auth_token doubles
// as the login credential on the /authorize consent page: whoever knows that
// token can approve a new client, which then gets its own opaque
// access/refresh tokens instead of the shared secret itself.
//
// Deliberately simple: opaque random tokens looked up server-side (no JWT),
// one fixed scope, public clients + PKCE only, rotating refresh tokens, and a
// flat JSON file for persistence. Proportionate to a one-person deployment.
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import fs from "node:fs";
import express from "express";
import { messagesForCountry } from "./i18n.mjs";
import { resourceMetadataUrl } from "./remote.mjs";

const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const REFRESH_TOKEN_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 days, sliding (rotated on use)
const AUTH_CODE_TTL_MS = 5 * 60 * 1000; // 5 minutes
const MAX_CLIENTS = 200;
const STORE_VERSION = 2;

// Brute-force throttle on the consent form. The token is 256-bit random by
// default, so this is defence in depth, not the primary defence.
const MAX_ATTEMPTS = 8;
const ATTEMPT_WINDOW_MS = 15 * 60 * 1000;

/**
 * Tokens are stored as SHA-256 hashes, never as themselves. /data — and so
 * the token store — is included in every Home Assistant backup, which people
 * copy to NAS shares and cloud drives. A plaintext store would let anyone
 * holding a backup use your Picnic account as your connected clients until
 * the tokens expired or were revoked; hashes are useless to them. The tokens
 * are 256-bit random, so a plain unsalted hash is enough.
 */
function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

export function timingSafeEqualStr(a, b) {
  const bufA = Buffer.from(String(a));
  const bufB = Buffer.from(String(b));
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function verifyPkce(codeVerifier, codeChallenge) {
  if (typeof codeVerifier !== "string" || !codeVerifier) return false;
  const computed = createHash("sha256").update(codeVerifier).digest("base64url");
  return timingSafeEqualStr(computed, codeChallenge);
}

function redirectHost(uri) {
  try {
    const url = new URL(uri);
    return url.host || url.protocol;
  } catch {
    return uri;
  }
}

/**
 * @param {object} opts
 * @param {string} opts.storePath      JSON file for clients and tokens (under /data)
 * @param {string} opts.publicOrigin   origin from mcp_url, or "" to use the request's host
 * @param {() => string} opts.getAuthToken
 * @param {(level: string, msg: string, extra?: object) => void} opts.log
 */
export function createOAuth({ storePath, publicOrigin, getPublicBase, getAuthToken, log, messages = messagesForCountry() }) {
  const empty = () => ({ version: STORE_VERSION, clients: {}, accessTokens: {}, refreshTokens: {} });
  let store;
  let migrated = false;
  try {
    const raw = JSON.parse(fs.readFileSync(storePath, "utf8"));
    store = { ...empty(), ...raw };
    if ((raw.version ?? 1) < STORE_VERSION) {
      // v1 keyed tokens by their plaintext value. Re-key by hash so existing
      // clients keep working across the upgrade; the plaintext leaves the
      // disk with the save below.
      const rekey = (map) => Object.fromEntries(Object.entries(map ?? {}).map(([t, rec]) => [hashToken(t), rec]));
      store.accessTokens = rekey(raw.accessTokens);
      store.refreshTokens = rekey(raw.refreshTokens);
      store.version = STORE_VERSION;
      migrated = true;
    }
  } catch {
    store = empty();
  }

  function save() {
    const tmp = `${storePath}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, storePath);
  }

  if (migrated) {
    try { save(); } catch { /* retried on the next save */ }
  }

  function prune() {
    const now = Date.now();
    for (const [hash, rec] of Object.entries(store.accessTokens)) {
      if (rec.expires_at < now) delete store.accessTokens[hash];
    }
    for (const [hash, rec] of Object.entries(store.refreshTokens)) {
      if (rec.expires_at && rec.expires_at < now) delete store.refreshTokens[hash];
    }
  }

  function issueTokens(clientId) {
    prune();
    const now = Date.now();
    const accessToken = randomBytes(32).toString("hex");
    const refreshToken = randomBytes(32).toString("hex");
    store.accessTokens[hashToken(accessToken)] = { client_id: clientId, issued_at: now, expires_at: now + ACCESS_TOKEN_TTL_MS };
    store.refreshTokens[hashToken(refreshToken)] = { client_id: clientId, issued_at: now, expires_at: now + REFRESH_TOKEN_TTL_MS };
    save();
    return {
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
      refresh_token: refreshToken,
      scope: "mcp",
    };
  }

  // Authorization codes are one-time and short-lived; memory is enough.
  const pendingCodes = new Map();
  const attempts = new Map();

  function tooManyAttempts(key) {
    const rec = attempts.get(key);
    if (!rec) return false;
    if (Date.now() - rec.windowStart > ATTEMPT_WINDOW_MS) {
      attempts.delete(key);
      return false;
    }
    return rec.count >= MAX_ATTEMPTS;
  }
  function recordAttempt(key) {
    const rec = attempts.get(key);
    if (!rec || Date.now() - rec.windowStart > ATTEMPT_WINDOW_MS) {
      attempts.set(key, { count: 1, windowStart: Date.now() });
    } else {
      rec.count += 1;
    }
  }

  // With "trust proxy" on, the request's host can come from X-Forwarded-Host,
  // which the caller controls. Prefer the operator's configured origin so the
  // discovery documents can't be made to advertise someone else's hostname.
  const origin = (req) => getPublicBase?.() || publicOrigin || `${req.protocol}://${req.get("host")}`;
  const formAction = (req) => new URL(`${origin(req)}/authorize`).pathname;

  function protectedResourceMetadata(req, res) {
    res.json({
      resource: `${origin(req)}/mcp`,
      authorization_servers: [origin(req)],
      scopes_supported: ["mcp"],
      bearer_methods_supported: ["header"],
    });
  }

  function authorizationServerMetadata(req, res) {
    const base = origin(req);
    res.json({
      issuer: base,
      authorization_endpoint: `${base}/authorize`,
      token_endpoint: `${base}/token`,
      registration_endpoint: `${base}/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code", "refresh_token"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
      scopes_supported: ["mcp"],
    });
  }

  function consentPage({ clientName, redirectUri, error, hiddenFields, formAction = "/authorize" }) {
    const hidden = Object.entries(hiddenFields)
      .map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v ?? "")}">`)
      .join("\n    ");
    return `<!doctype html>
<html lang="${messages.lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(messages.oauthTitle)} — Picnic MCP</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 15px/1.5 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 440px; margin: 3rem auto; padding: 0 1rem; }
  h1 { font-size: 1.2rem; }
  input[type="password"] { width: 100%; box-sizing: border-box; font-family: ui-monospace, monospace; padding: .6rem; border-radius: 6px; border: 1px solid color-mix(in srgb, currentColor 25%, transparent); background: transparent; color: inherit; margin: .5rem 0 1rem; }
  button { width: 100%; padding: .6rem; border-radius: 6px; border: 1px solid color-mix(in srgb, currentColor 25%, transparent); background: transparent; color: inherit; cursor: pointer; font-size: 1rem; }
  .error { color: #c0392b; font-size: .9rem; }
  p.small { font-size: .85rem; opacity: .8; }
  code { word-break: break-all; }
</style>
</head>
<body>
  <h1>${escapeHtml(messages.authorize)} ${escapeHtml(clientName || "MCP client")}</h1>
  <p>${escapeHtml(messages.oauthIntro)}</p>
  <p class="small">${escapeHtml(messages.oauthRedirect)} <code>${escapeHtml(redirectHost(redirectUri))}</code>.
  ${escapeHtml(messages.oauthCheck)}</p>
  ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
  <form method="post" action="${escapeHtml(formAction)}">
    ${hidden}
    <label for="token">${escapeHtml(messages.oauthToken)}</label>
    <input type="password" id="token" name="token" autocomplete="off" autofocus required>
    <button type="submit">${escapeHtml(messages.authorize)}</button>
  </form>
  <p class="small">${escapeHtml(messages.oauthTokenHelp)}</p>
</body>
</html>`;
  }

  const router = express.Router();
  // RFC 9728 puts the resource metadata for https://host/mcp at
  // /.well-known/oauth-protected-resource/mcp; some clients ask without the
  // suffix. Some also fall back to OIDC discovery for the server metadata.
  const metadataPaths = {
    resource: ["/.well-known/oauth-protected-resource/mcp", "/.well-known/oauth-protected-resource"],
    server: ["/.well-known/oauth-authorization-server", "/.well-known/openid-configuration"],
  };
  const ownPaths = [...metadataPaths.resource, ...metadataPaths.server, "/register", "/authorize", "/token"];

  router.use((req, res, next) => {
    if (!ownPaths.includes(req.path)) return next();
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type, Authorization, MCP-Protocol-Version");
    if (req.method === "OPTIONS") {
      res.sendStatus(204);
      return;
    }
    next();
  });

  for (const p of metadataPaths.resource) router.get(p, protectedResourceMetadata);
  for (const p of metadataPaths.server) router.get(p, authorizationServerMetadata);

  // --- RFC 7591: Dynamic Client Registration ---
  router.post("/register", express.json({ limit: "64kb" }), (req, res) => {
    const body = req.body ?? {};
    const redirectUris = Array.isArray(body.redirect_uris)
      ? body.redirect_uris.filter((u) => typeof u === "string" && /^[a-z][a-z0-9+.-]*:/i.test(u))
      : [];
    if (redirectUris.length === 0) {
      res.status(400).json({ error: "invalid_client_metadata", error_description: "redirect_uris is required" });
      return;
    }

    const ids = Object.keys(store.clients);
    if (ids.length >= MAX_CLIENTS) {
      // Make room by evicting the oldest client that holds no live refresh
      // token. Plain oldest-first would let anyone flood /register until the
      // client you actually authorised was pushed out.
      const active = new Set(Object.values(store.refreshTokens).map((r) => r.client_id));
      const evictable = ids.filter((id) => !active.has(id));
      const pool = evictable.length > 0 ? evictable : ids;
      const oldest = pool.reduce((a, b) => (store.clients[a].created_at <= store.clients[b].created_at ? a : b));
      delete store.clients[oldest];
    }

    const clientId = randomBytes(16).toString("hex");
    const record = {
      client_id: clientId,
      client_name: typeof body.client_name === "string" ? body.client_name.slice(0, 200) : undefined,
      redirect_uris: redirectUris.slice(0, 10),
      created_at: Date.now(),
    };
    store.clients[clientId] = record;
    save();
    log("info", "Registered a new OAuth client", { clientName: record.client_name });

    res.status(201).json({
      client_id: clientId,
      client_id_issued_at: Math.floor(record.created_at / 1000),
      client_name: record.client_name,
      redirect_uris: record.redirect_uris,
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
    });
  });

  // --- /authorize: consent form gated by the add-on's bearer token ---
  router.get("/authorize", (req, res) => {
    const { client_id, redirect_uri, response_type, code_challenge, code_challenge_method, state } = req.query;
    const client = typeof client_id === "string" ? store.clients[client_id] : undefined;
    if (!client) {
      res.status(400).type("text/plain").send("Unknown client_id. Remove the connector in your MCP client and add it again.");
      return;
    }
    if (typeof redirect_uri !== "string" || !client.redirect_uris.includes(redirect_uri)) {
      res.status(400).type("text/plain").send("redirect_uri does not match what this client registered.");
      return;
    }

    const redirectWithError = (error) => {
      const url = new URL(redirect_uri);
      url.searchParams.set("error", error);
      if (typeof state === "string") url.searchParams.set("state", state);
      res.redirect(302, url.toString());
    };
    if (response_type !== "code") return redirectWithError("unsupported_response_type");
    if (code_challenge_method !== "S256" || typeof code_challenge !== "string" || !code_challenge) {
      return redirectWithError("invalid_request");
    }

    res.set("Cache-Control", "no-store");
    res.set("X-Frame-Options", "DENY");
    res.type("html").send(consentPage({
      formAction: formAction(req),
      clientName: client.client_name,
      redirectUri: redirect_uri,
      hiddenFields: { client_id, redirect_uri, state: typeof state === "string" ? state : "", code_challenge },
    }));
  });

  router.post("/authorize", express.urlencoded({ extended: false, limit: "16kb" }), (req, res) => {
    // Keyed on the raw socket address, never req.ip: "trust proxy" makes
    // req.ip the caller-controlled X-Forwarded-For. Behind a tunnel every
    // request shares one address, so this throttles consent globally —
    // the safe direction for a rare, interactive action.
    const key = req.socket.remoteAddress ?? "unknown";
    const { client_id, redirect_uri, state, code_challenge, token } = req.body ?? {};
    const client = typeof client_id === "string" ? store.clients[client_id] : undefined;
    if (!client || typeof redirect_uri !== "string" || !client.redirect_uris.includes(redirect_uri)) {
      res.status(400).type("text/plain").send("Invalid client or redirect_uri.");
      return;
    }
    if (typeof code_challenge !== "string" || !code_challenge) {
      res.status(400).type("text/plain").send("Missing PKCE code_challenge.");
      return;
    }

    const again = (status, error) => res.status(status).type("html").send(consentPage({
      formAction: formAction(req),
      clientName: client.client_name,
      redirectUri: redirect_uri,
      error,
      hiddenFields: { client_id, redirect_uri, state: state ?? "", code_challenge },
    }));

    if (tooManyAttempts(key)) return again(429, messages.oauthLimit);

    const expected = getAuthToken();
    const ok = typeof token === "string" && token.length > 0 && expected.length > 0 && timingSafeEqualStr(token.trim(), expected);
    if (!ok) {
      recordAttempt(key);
      log("warning", "Rejected OAuth consent: wrong bearer token", { clientName: client.client_name });
      return again(401, messages.oauthWrong);
    }

    const code = randomBytes(32).toString("hex");
    pendingCodes.set(code, { client_id, redirect_uri, code_challenge, expires_at: Date.now() + AUTH_CODE_TTL_MS });
    setTimeout(() => pendingCodes.delete(code), AUTH_CODE_TTL_MS + 1000).unref();
    log("info", "Approved an OAuth client", { clientName: client.client_name });

    const url = new URL(redirect_uri);
    url.searchParams.set("code", code);
    if (typeof state === "string" && state) url.searchParams.set("state", state);
    res.redirect(302, url.toString());
  });

  // --- /token: authorization_code and refresh_token grants ---
  router.post(
    "/token",
    express.urlencoded({ extended: false, limit: "16kb" }),
    express.json({ limit: "16kb" }),
    (req, res) => {
      res.set("Cache-Control", "no-store");
      const body = req.body ?? {};

      if (body.grant_type === "authorization_code") {
        const { code, redirect_uri, client_id, code_verifier } = body;
        const pending = typeof code === "string" ? pendingCodes.get(code) : undefined;
        if (!pending || pending.expires_at < Date.now() || pending.client_id !== client_id || pending.redirect_uri !== redirect_uri) {
          res.status(400).json({ error: "invalid_grant" });
          return;
        }
        // One-time use, even when PKCE fails: a code is never worth a second try.
        pendingCodes.delete(code);
        if (!verifyPkce(code_verifier, pending.code_challenge)) {
          res.status(400).json({ error: "invalid_grant", error_description: "PKCE verification failed" });
          return;
        }
        res.json(issueTokens(client_id));
        return;
      }

      if (body.grant_type === "refresh_token") {
        const { refresh_token, client_id } = body;
        const hash = typeof refresh_token === "string" ? hashToken(refresh_token) : undefined;
        const rec = hash ? store.refreshTokens[hash] : undefined;
        if (!rec || (rec.expires_at && rec.expires_at < Date.now()) || (client_id && rec.client_id !== client_id) || !store.clients[rec.client_id]) {
          res.status(400).json({ error: "invalid_grant" });
          return;
        }
        // Rotate: the presented refresh token is spent, a new pair is issued.
        delete store.refreshTokens[hash];
        res.json(issueTokens(rec.client_id));
        return;
      }

      res.status(400).json({ error: "unsupported_grant_type" });
    },
  );

  return {
    router,
    /** RFC 9728 document URL for the WWW-Authenticate header on a 401. */
    resourceMetadataUrl: (req) => resourceMetadataUrl(origin(req)),
    // Read-only on purpose: expired entries are pruned the next time tokens
    // are issued, so checking a token never writes to disk on the request path.
    isValidAccessToken(token) {
      const rec = store.accessTokens[hashToken(token)];
      return Boolean(rec) && rec.expires_at >= Date.now();
    },
    listClients() {
      return Object.values(store.clients)
        .map((c) => ({ client_name: c.client_name, created_at: c.created_at, redirect_host: redirectHost(c.redirect_uris[0]) }))
        .sort((a, b) => b.created_at - a.created_at);
    },
    /** Every issued token becomes invalid; clients stay registered. */
    revokeAll() {
      store.accessTokens = {};
      store.refreshTokens = {};
      save();
    },
  };
}
