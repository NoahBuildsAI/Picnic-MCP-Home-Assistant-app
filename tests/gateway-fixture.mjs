// Smoke-test the actual upstream bundle without any real Picnic credentials.
import net from "node:net";
import fs from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
const freePort = async () => {
  const server = net.createServer();
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
};
const data = fs.mkdtempSync(join(tmpdir(), "picnic-gateway-test-"));
fs.writeFileSync(join(data, "remote-info.json"), JSON.stringify({ status: "ready", url: process.argv[2] + "/mcp" }));
const port = await freePort();
Object.assign(process.env, {
  DATA_DIR: data, MCP_PORT: String(port), INGRESS_PORT: String(await freePort()),
  MCP_AUTH_TOKEN: "fixture-key", ENABLE_REMOTE_ACCESS: "true", MCP_URL: "",
  PICNIC_USERNAME: "", PICNIC_PASSWORD: "", PICNIC_COUNTRY_CODE: "DE",
  ALLOW_CART_CHANGES: "true", ALLOW_DELIVERY_CHANGES: "false", ALLOW_ACCOUNT_DETAILS: "false",
  ENABLE_HTTP_SERVER: "false", PICNIC_SESSION_FILE: join(data, "picnic-session.json"),
  PICNIC_DEVICE_FILE: join(data, "picnic-device.json"),
});
process.stdout.write(`${port}\n`);
process.on("SIGTERM", () => fs.rmSync(data, { recursive: true, force: true }));
await import("../.work/build/gateway.mjs");
