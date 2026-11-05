import json
import unittest

import test_remote_bridge as support


class RealGatewayTest(unittest.IsolatedAsyncioTestCase):
    fixture = "gateway-fixture.mjs"
    asyncSetUp = support.BridgeTest.asyncSetUp
    asyncTearDown = support.BridgeTest.asyncTearDown
    authorize = support.BridgeTest.authorize

    async def test_real_bundle_oauth_initialize_and_tools_over_bridge(self):
        _, tokens = await self.authorize()
        headers = {"Authorization": "Bearer " + tokens["access_token"],
                   "Accept": "application/json, text/event-stream"}
        response = await self.client.session.post(self.base + "/mcp", headers=headers, json={
            "jsonrpc": "2.0", "id": 1, "method": "initialize", "params": {
                "protocolVersion": "2025-03-26", "capabilities": {},
                "clientInfo": {"name": "remote-smoke-test", "version": "1.0"}}})
        self.assertEqual(response.status, 200, await response.text())
        self.assertIn("Mcp-Session-Id", response.headers)
        headers["Mcp-Session-Id"] = response.headers["Mcp-Session-Id"]
        response = await self.client.session.post(self.base + "/mcp", headers=headers, json={
            "jsonrpc": "2.0", "method": "notifications/initialized"})
        self.assertEqual(response.status, 202)
        response = await self.client.session.post(self.base + "/mcp", headers=headers, json={
            "jsonrpc": "2.0", "id": 2, "method": "tools/list"})
        raw = await response.text()
        rpc = json.loads(next(line[5:].strip() for line in raw.splitlines() if line.startswith("data:")))
        names = {tool["name"] for tool in rpc["result"]["tools"]}
        self.assertIn("picnic_get_cart", names)
        self.assertIn("picnic_browse_recipes", names)
        self.assertNotIn("picnic_cancel_delivery", names)
        self.assertNotIn("picnic_get_payment_profile", names)
        response = await self.client.session.delete(self.base + "/mcp", headers=headers)
        self.assertEqual(response.status, 200)
