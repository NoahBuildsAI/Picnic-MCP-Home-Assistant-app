"""Forward only Picnic's MCP/OAuth surface through HA's existing remote UI.

The local Picnic gateway enforces authentication. The bridge cannot call HA
services, change its target from a request, or forward Picnic's ingress UI.
"""
import asyncio
import re

from aiohttp import ClientError, ClientTimeout, web

from homeassistant.components.http import HomeAssistantView
from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.helpers.network import NoURLAvailableError, get_url

DOMAIN = "picnic_mcp_remote"
VERSION = "0.5.1"
BASE = "/api/picnic_mcp_remote"
PUBLIC_PATHS = frozenset({
    "mcp", "authorize", "token", "register", "health", "icon.png",
    ".well-known/oauth-protected-resource", ".well-known/oauth-protected-resource/mcp",
    ".well-known/oauth-authorization-server", ".well-known/openid-configuration",
})
HOP_HEADERS = frozenset({
    "connection", "keep-alive", "proxy-authenticate", "proxy-authorization",
    "te", "trailer", "transfer-encoding", "upgrade", "host", "content-length",
    "x-picnic-remote", "forwarded", "x-forwarded-host", "x-forwarded-proto",
    "x-forwarded-for", "cookie", "set-cookie",
})
TIMEOUT = ClientTimeout(total=None, sock_connect=10, sock_read=None)


def _entry(hass, *, key=None, slug=None):
    return next((entry for entry in hass.config_entries.async_entries(DOMAIN)
                 if (key is None or entry.data.get("remote_key") == key)
                 and (slug is None or entry.data.get("addon_slug") == slug)), None)


def _external_url(hass):
    try:
        url = get_url(hass, allow_internal=False, allow_ip=False, prefer_cloud=True, require_ssl=True)
    except NoURLAvailableError:
        return None
    return url.rstrip("/")


def _admin(request):
    user = request.get("hass_user")
    if user is None or not user.is_admin:
        raise web.HTTPForbidden()


async def async_setup(hass, config):
    if DOMAIN not in hass.data:
        hass.http.register_view(StatusView(hass))
        hass.http.register_view(ConfigureView(hass))
        hass.http.register_view(ProxyView(hass))
        hass.http.register_view(ResourceMetadataView(hass))
        hass.http.register_view(ServerMetadataView(hass))
        hass.data[DOMAIN] = True
    return True


async def async_setup_entry(hass, entry):
    await async_setup(hass, {})
    return True


async def async_unload_entry(hass, entry):
    # Fixed views stay registered, but look up the entry on every request.
    # Removing/disabling an entry therefore returns 404 immediately.
    return True


class StatusView(HomeAssistantView):
    url = f"{BASE}/status"
    name = f"{DOMAIN}:status"

    def __init__(self, hass):
        self.hass = hass

    async def get(self, request):
        _admin(request)
        entry = _entry(self.hass, slug=request.query.get("addon_slug", ""))
        if entry is None:
            return web.json_response({"version": VERSION, "status": "not_configured"}, status=404)
        external = _external_url(self.hass)
        enabled = entry.data.get("enabled", False) and entry.disabled_by is None
        url = f"{external}{BASE}/{entry.data['remote_key']}/mcp" if external and enabled else None
        return web.json_response({"version": VERSION, "status": "ready" if url else "no_remote_url" if enabled else "disabled",
                                  "enabled": enabled, "url": url}, headers={"Cache-Control": "no-store"})


class ConfigureView(StatusView):
    url = f"{BASE}/configure"
    name = f"{DOMAIN}:configure"

    async def post(self, request):
        _admin(request)
        data = await request.json()
        if not isinstance(data, dict) or not isinstance(data.get("enabled"), bool):
            raise web.HTTPBadRequest()
        entry = _entry(self.hass, slug=data.get("addon_slug", ""))
        if entry is None:
            raise web.HTTPNotFound()
        self.hass.config_entries.async_update_entry(entry, data={**entry.data, "enabled": data["enabled"]})
        return web.json_response({"ok": True})


class ProxyView(HomeAssistantView):
    url = f"{BASE}/{{remote_key}}/{{tail:.*}}"
    name = f"{DOMAIN}:proxy"
    requires_auth = False  # Picnic's own OAuth/bearer authentication is preserved.

    def __init__(self, hass):
        self.hass = hass

    async def forward(self, request, remote_key, tail):
        entry = _entry(self.hass, key=remote_key)
        if entry is None or not entry.data.get("enabled") or entry.disabled_by is not None or tail not in PUBLIC_PATHS:
            raise web.HTTPNotFound()
        slug = entry.data["addon_slug"]
        if not re.fullmatch(r"[a-z0-9]{8}_picnic_mcp", slug):
            raise web.HTTPNotFound()
        target = f"http://{slug.replace('_', '-')}:8097/{tail}"
        blocked = HOP_HEADERS | {part.strip().lower() for part in request.headers.get("Connection", "").split(",")}
        headers = {key: value for key, value in request.headers.items() if key.lower() not in blocked}
        headers["X-Picnic-Remote"] = "1"
        headers["Accept-Encoding"] = "identity"
        if request.content_length is not None and request.content_length > 4 * 1024 * 1024:
            raise web.HTTPRequestEntityTooLarge(max_size=4 * 1024 * 1024, actual_size=request.content_length)
        body = bytearray()
        async for chunk in request.content.iter_chunked(65536):
            body.extend(chunk)
            if len(body) > 4 * 1024 * 1024:
                raise web.HTTPRequestEntityTooLarge(max_size=4 * 1024 * 1024, actual_size=len(body))
        response = None
        try:
            session = async_get_clientsession(self.hass)
            async with session.request(request.method, target, params=request.query,
                                       headers=headers, data=bytes(body) if body else None,
                                       allow_redirects=False, timeout=TIMEOUT) as upstream:
                response_headers = {key: value for key, value in upstream.headers.items() if key.lower() not in HOP_HEADERS}
                response_headers.update({"Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no",
                                         "Content-Encoding": "identity"})
                response = web.StreamResponse(status=upstream.status, headers=response_headers)
                await response.prepare(request)
                async for chunk in upstream.content.iter_any():
                    await response.write(chunk)
                await response.write_eof()
                return response
        except (ClientError, asyncio.TimeoutError, OSError):
            if response is not None and response.prepared:
                response.force_close()
                return response
            return web.json_response({"error": "picnic_unavailable"}, status=502)

    async def get(self, request, remote_key, tail):
        return await self.forward(request, remote_key, tail)

    post = get
    delete = get
    # Home Assistant's CORS layer owns OPTIONS/preflight registration.


class ResourceMetadataView(ProxyView):
    url = f"/.well-known/oauth-protected-resource{BASE}/{{remote_key}}/mcp"
    name = f"{DOMAIN}:resource_metadata"

    async def get(self, request, remote_key):
        return await self.forward(request, remote_key, ".well-known/oauth-protected-resource/mcp")

    async def post(self, request, **kwargs):
        raise web.HTTPMethodNotAllowed(request.method, ["GET"])

    delete = post


class ServerMetadataView(ProxyView):
    url = f"/.well-known/oauth-authorization-server{BASE}/{{remote_key}}"
    name = f"{DOMAIN}:server_metadata"

    async def get(self, request, remote_key):
        return await self.forward(request, remote_key, ".well-known/oauth-authorization-server")

    post = ResourceMetadataView.post
    delete = post
