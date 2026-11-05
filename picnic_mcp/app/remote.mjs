import fs from "node:fs";

export function readRemoteInfo(path) {
  try { return JSON.parse(fs.readFileSync(path, "utf8")); }
  catch { return { status: "starting" }; }
}

export function connectionBase(mcpUrl) {
  if (!mcpUrl) return "";
  const url = new URL(mcpUrl);
  if (!/^https?:$/.test(url.protocol) || url.username || url.password || url.search || url.hash ||
      !url.pathname.endsWith("/mcp")) throw new Error("Invalid MCP connection URL");
  return url.href.slice(0, -4).replace(/\/$/, "");
}

export function resourceMetadataUrl(base) {
  const url = new URL(base);
  return `${url.origin}/.well-known/oauth-protected-resource${url.pathname.replace(/\/$/, "")}/mcp`;
}
