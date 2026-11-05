// Real OAuth implementation plus a small MCP responder, used by the bridge tests.
import express from "express";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createOAuth } from "../picnic_mcp/app/oauth.mjs";
import { messagesForCountry } from "../picnic_mcp/app/i18n.mjs";

const dir = mkdtempSync(join(tmpdir(), "picnic-remote-test-"));
const oauth = createOAuth({ storePath: join(dir, "oauth.json"),
  getPublicBase: () => process.argv[2], getAuthToken: () => "fixture-key",
  messages: messagesForCountry("DE"), log() {} });
const app = express();
app.get("/health", (_req, res) => res.json({ ok: true }));
app.use(oauth.router);
app.all("/mcp", express.json(), (req, res) => {
  const token = /^Bearer (.+)$/.exec(req.headers.authorization ?? "")?.[1];
  if (!oauth.isValidAccessToken(token ?? "")) {
    res.set("WWW-Authenticate", `Bearer resource_metadata="${oauth.resourceMetadataUrl(req)}"`);
    return res.status(401).json({ error: "unauthorized" });
  }
  res.set("Mcp-Session-Id", "fixture-session");
  res.type("text/event-stream");
  res.write('event: message\ndata: {"result":');
  setTimeout(() => res.end('{"cart":[]},"jsonrpc":"2.0","id":2}\n\n'), 30);
});
const server = app.listen(0, "127.0.0.1", () => process.stdout.write(`${server.address().port}\n`));
process.on("SIGTERM", () => { server.closeAllConnections(); server.close(); rmSync(dir, { recursive: true }); process.exit(0); });
