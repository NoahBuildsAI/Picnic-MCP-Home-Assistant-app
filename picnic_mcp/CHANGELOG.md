# Changelog

## 0.5.1

- Let Home Assistant register CORS preflight handlers to avoid an OPTIONS-route
  collision when configured CORS origins are present.
- Exercise view registration with the real CORS layer in the remote tests.

## 0.5.0

- Optional remote access through Home Assistant's existing Nabu Casa / external
  HTTPS URL. The app installs its own `picnic_mcp_remote` integration, provisions
  a persistent route and shows the ready-to-copy Picnic MCP URL in its dashboard.
- Picnic OAuth discovery, registration, approval, token refresh and streaming MCP
  responses use Picnic-specific paths. They coexist with HA-MCP's remote routes.
- Initial integration installation or updates can require a Home Assistant
  restart; the app requests it but never restarts Home Assistant automatically.
- Remote access is off by default. Local Picnic credentials, sessions and tool
  permissions are retained. Existing direct HTTPS hosting remains supported.
- App permissions now include Home Assistant API access and `/config` write
  access to install only the companion integration. Previous companion files
  are backed up under the app's `/data` before replacement.

## 0.4.1

- The add-on's icon is now offered to MCP clients: as `serverInfo.icons`
  in the initialize response (MCP spec 2025-11-25), and as `/favicon.ico`,
  `/favicon.png`, `/icon.png` and `/apple-touch-icon.png` on the public
  hostname. Claude doesn't show icons for custom connectors yet; this is
  in place for when it does.

## 0.4.0

Security hardening, matching Dutch Open Data MCP 1.1.0.

- OAuth tokens are now stored as SHA-256 hashes. `/data` is in every Home
  Assistant backup, so a plaintext store let anyone holding a backup act as
  your connected clients. The existing store is migrated on first start;
  connected clients keep working.
- `trust proxy` now trusts forwarded headers only from private addresses
  (where cloudflared or a LAN proxy connects from), not from any client.
- Flooding `/register` can no longer evict the client you actually
  authorised: eviction now skips clients holding a live refresh token.
- Accepts `bearer` in any letter case, per RFC 7235.
- A rejected `initialize` no longer leaks its MCP server and transport.
- Checking an OAuth token no longer writes to disk on the request path.

## 0.3.0

- Removed hostname sharing: the `path_prefix` and `forward_other_paths_to`
  options, the forwarder and the prefix-aware OAuth discovery paths are
  gone. Each MCP add-on gets its own subdomain and serves at its root
  (`https://picnic.example.com/mcp`), which needs none of that code. If you
  had set either option, it is ignored; set the add-on up on its own
  hostname instead.

## 0.2.0

- **The add-on now serves at the root of its own hostname by default**:
  `path_prefix` defaults to `/`, so the endpoint is
  `https://picnic.example.com/mcp` (and `http://<HA host>:8097/mcp`
  locally). A dedicated subdomain is now the documented setup.
- Sharing one hostname with another MCP add-on still works: set
  `path_prefix: /picnic` and `forward_other_paths_to`. The docs describe it
  as an advanced setup.
- If you installed 0.1.0 and kept its default, `path_prefix` stays
  `/picnic` until you change it to `/` in Configuration.

## 0.1.0

First release.

- Packages [mcp-picnic](https://github.com/ivo-toby/mcp-picnic) at commit
  `d235da4325f94c5e9b6284dc4324281159179127`, bundled at image build time
  with a gateway that replaces upstream's HTTP server.
- Bearer-token auth (token generated on first start and saved into the
  Configuration tab) and an OAuth 2.1 server with dynamic client
  registration, PKCE and rotating refresh tokens, for Claude's web, desktop
  and mobile apps.
- Everything served under a configurable `path_prefix` (default `/picnic`),
  including RFC 8414 / RFC 9728 discovery documents at their path-inserted
  root locations, so the add-on can share a hostname with other servers.
- `forward_other_paths_to`: streams every request outside the prefix to
  another service (e.g. the Dutch Open Data MCP add-on), so one tunnel
  hostname serves both.
- Tool groups: browsing always on; `allow_cart_changes` on by default;
  `allow_delivery_changes`, `allow_account_details` and `expose_2fa_tools`
  off by default. Tools upstream adds in a later pin stay withheld until
  they're classified here.
- Login state machine: a wrong password or pending 2FA no longer crashes
  the add-on, and tools explain the problem instead of re-trying the login
  on every call. 2FA codes and re-login from the ingress web UI.
- The Picnic session is dropped automatically when the configured account
  or country changes.
