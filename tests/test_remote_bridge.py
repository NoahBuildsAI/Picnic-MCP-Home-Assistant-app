"""Exercise real HTTP + OAuth through the bridge; stub only HA registration.

Run: .venv/Scripts/python -m unittest discover -s tests -p test_remote_bridge.py
The upstream uses the actual JS OAuth implementation and the requests traverse
the actual Python forwarding code (including streaming and header handling).
"""
import asyncio
import base64
import hashlib
import importlib.util
import json
import io
from pathlib import Path
import socket
import sys
from types import ModuleType, SimpleNamespace
import unittest
from urllib.parse import parse_qs, urlparse

import aiohttp
from aiohttp import web
from aiohttp.test_utils import TestClient, TestServer

ROOT = Path(__file__).resolve().parents[1]
KEY = "a" * 64
SLUG = "12345678_picnic_mcp"
SESSION = None


def module(name, **attrs):
    obj = ModuleType(name)
    obj.__dict__.update(attrs)
    sys.modules[name] = obj


class NoURLAvailableError(Exception):
    pass


for name in ["homeassistant", "homeassistant.components", "homeassistant.helpers"]:
    module(name)
module("homeassistant.components.http", HomeAssistantView=object)
module("homeassistant.helpers.aiohttp_client", async_get_clientsession=lambda hass: SESSION)
module("homeassistant.helpers.network", NoURLAvailableError=NoURLAvailableError,
       get_url=lambda hass, **kwargs: hass.external_url)
spec = importlib.util.spec_from_file_location("bridge", ROOT / "picnic_mcp/remote_component/picnic_mcp_remote/__init__.py")
bridge = importlib.util.module_from_spec(spec)
spec.loader.exec_module(bridge)


class LocalResolver(aiohttp.abc.AbstractResolver):
    def __init__(self, port):
        self.port = port

    async def resolve(self, host, port=0, family=socket.AF_INET):
        assert host == "12345678-picnic-mcp", host
        return [{"hostname": host, "host": "127.0.0.1", "port": self.port,
                 "family": socket.AF_INET, "proto": 0, "flags": 0}]

    async def close(self):
        pass


class BridgeTest(unittest.IsolatedAsyncioTestCase):
    async def asyncSetUp(self):
        global SESSION
        self.entry = SimpleNamespace(data={"addon_slug": SLUG, "remote_key": KEY, "enabled": True}, disabled_by=None)
        self.entries = [self.entry]
        self.hass = SimpleNamespace(config_entries=SimpleNamespace(async_entries=lambda domain: self.entries))
        view = bridge.ProxyView(self.hass)
        resource = bridge.ResourceMetadataView(self.hass)
        server = bridge.ServerMetadataView(self.hass)

        async def resource_handler(request):
            return await resource.get(request, request.match_info["remote_key"])

        async def server_handler(request):
            return await server.get(request, request.match_info["remote_key"])

        # HA normally supplies route variables as arguments to a view method.
        async def dispatch(request):
            return await view.forward(request, request.match_info["remote_key"], request.match_info["tail"])

        app = web.Application()
        app.router.add_route("*", f"{bridge.BASE}/{{remote_key}}/{{tail:.*}}", dispatch)
        app.router.add_get(resource.url, resource_handler)
        app.router.add_get(server.url, server_handler)
        self.client = TestClient(TestServer(app))
        await self.client.start_server()
        self.base = str(self.client.make_url(f"{bridge.BASE}/{KEY}"))
        self.hass.external_url = str(self.client.make_url("")).rstrip("/")
        self.node = await asyncio.create_subprocess_exec(
            "node", str(ROOT / "tests" / getattr(self, "fixture", "oauth-fixture.mjs")), self.base,
            stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        port = int(await asyncio.wait_for(self.node.stdout.readline(), 10))
        SESSION = aiohttp.ClientSession(connector=aiohttp.TCPConnector(resolver=LocalResolver(port)))
        for attempt in range(50):
            try:
                response = await self.client.session.get(self.base + "/health")
                if response.status == 200:
                    break
            except aiohttp.ClientError:
                pass
            await asyncio.sleep(0.1)
        else:
            raise RuntimeError("Gateway did not start")

    async def asyncTearDown(self):
        await SESSION.close()
        await self.client.close()
        self.node.terminate()
        await self.node.communicate()

    async def get_json(self, url):
        response = await self.client.session.get(self.client.make_url(url) if url.startswith("/") else url)
        self.assertEqual(response.status, 200)
        return await response.json()

    async def authorize(self):
        response = await self.client.session.post(self.base + "/register", json={
            "redirect_uris": ["https://chatgpt.example/callback"], "client_name": "ChatGPT test"})
        self.assertEqual(response.status, 201)
        client_id = (await response.json())["client_id"]
        verifier = "correct-verifier-" * 4
        challenge = base64.urlsafe_b64encode(hashlib.sha256(verifier.encode()).digest()).decode().rstrip("=")
        params = {"client_id": client_id, "redirect_uri": "https://chatgpt.example/callback",
                  "response_type": "code", "code_challenge": challenge, "code_challenge_method": "S256", "state": "unchanged"}
        page = await self.client.session.get(self.base + "/authorize", params=params)
        self.assertEqual(page.status, 200)
        self.assertIn(f'action="{bridge.BASE}/{KEY}/authorize"', await page.text())
        denied = await self.client.session.post(self.base + "/authorize", data={**params, "token": "wrong"})
        self.assertEqual(denied.status, 401)
        approved = await self.client.session.post(self.base + "/authorize", data={**params, "token": "fixture-key"}, allow_redirects=False)
        self.assertEqual(approved.status, 302)
        redirect = parse_qs(urlparse(approved.headers["Location"]).query)
        self.assertEqual(redirect["state"], ["unchanged"])
        response = await self.client.session.post(self.base + "/token", data={
            "grant_type": "authorization_code", "client_id": client_id,
            "redirect_uri": params["redirect_uri"], "code": redirect["code"][0], "code_verifier": verifier})
        self.assertEqual(response.status, 200)
        tokens = await response.json()
        return client_id, tokens

    async def test_discovery_uses_picnic_paths_and_preserves_auth_challenge(self):
        denied = await self.client.session.post(self.base + "/mcp", json={})
        self.assertEqual(denied.status, 401)
        metadata_url = denied.headers["WWW-Authenticate"].split('"')[1]
        metadata = await self.get_json(metadata_url)
        self.assertEqual(metadata["resource"], self.base + "/mcp")
        issuer_path = urlparse(self.base).path
        server = await self.get_json(f"/.well-known/oauth-authorization-server{issuer_path}")
        self.assertEqual(server["issuer"], self.base)
        self.assertEqual(server["token_endpoint"], self.base + "/token")
        spoofed = await self.client.session.get(metadata_url, headers={"X-Forwarded-Host": "evil.example"})
        self.assertEqual((await spoofed.json())["resource"], self.base + "/mcp")

    async def test_full_oauth_flow_streaming_and_refresh_rotation(self):
        client_id, tokens = await self.authorize()
        response = await self.client.session.post(self.base + "/mcp", headers={
            "Authorization": "Bearer " + tokens["access_token"], "Mcp-Session-Id": "client-session"}, json={})
        self.assertEqual(response.status, 200)
        self.assertEqual(response.headers["Mcp-Session-Id"], "fixture-session")
        self.assertIn('"cart":[]', await response.text())
        self.assertIn("no-transform", response.headers["Cache-Control"])
        self.assertEqual(response.headers["Content-Encoding"], "identity")
        refresh = {"grant_type": "refresh_token", "client_id": client_id, "refresh_token": tokens["refresh_token"]}
        self.assertEqual((await self.client.session.post(self.base + "/token", data=refresh)).status, 200)
        self.assertEqual((await self.client.session.post(self.base + "/token", data=refresh)).status, 400)

    async def test_disabled_missing_and_unreviewed_routes_are_closed(self):
        for tail in ["relogin", "verify-2fa", "api/services", "data/options.json"]:
            self.assertEqual((await self.client.session.get(self.base + "/" + tail)).status, 404)
        self.assertEqual((await self.client.session.get(self.base.replace(KEY, "b" * 64) + "/mcp")).status, 404)
        self.entry.data["enabled"] = False
        self.assertEqual((await self.client.session.get(self.base + "/mcp")).status, 404)
        self.entry.data["enabled"] = True
        self.entry.disabled_by = "user"
        self.assertEqual((await self.client.session.get(self.base + "/mcp")).status, 404)
        self.entry.disabled_by = None
        self.entries.clear()
        self.assertEqual((await self.client.session.get(self.base + "/mcp")).status, 404)

    async def test_admin_only_status_does_not_publish_remote_key(self):
        view = bridge.StatusView(self.hass)
        with self.assertRaises(web.HTTPForbidden):
            await view.get({})

    async def test_body_limit_and_metadata_method(self):
        response = await self.client.session.post(self.base + "/mcp", data=io.BytesIO(b"x" * (4 * 1024 * 1024 + 1)))
        self.assertEqual(response.status, 413)
        with self.assertRaises(web.HTTPMethodNotAllowed):
            await bridge.ResourceMetadataView(self.hass).post(SimpleNamespace(method="POST"), remote_key=KEY)
