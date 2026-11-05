import assert from "node:assert/strict";
import test from "node:test";
import { connectionBase, resourceMetadataUrl } from "../picnic_mcp/app/remote.mjs";

test("remote OAuth metadata follows the scoped Nabu URL; direct hosting still works", () => {
  const base = connectionBase("https://ha.example/api/picnic_mcp_remote/route-key/mcp");
  assert.equal(base, "https://ha.example/api/picnic_mcp_remote/route-key");
  assert.equal(resourceMetadataUrl(base), "https://ha.example/.well-known/oauth-protected-resource/api/picnic_mcp_remote/route-key/mcp");
  assert.equal(connectionBase("https://picnic.example/mcp"), "https://picnic.example");
  assert.equal(resourceMetadataUrl("https://picnic.example"), "https://picnic.example/.well-known/oauth-protected-resource/mcp");
  for (const url of ["file:///mcp", "https://user:secret@example/mcp", "https://example/mcp?token=bad", "https://example/mcp#x", "https://example/other"])
    assert.throws(() => connectionBase(url));
});
