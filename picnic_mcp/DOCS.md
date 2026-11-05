# Picnic MCP

Runs [mcp-picnic](https://github.com/ivo-toby/mcp-picnic) — an MCP server
for the Picnic grocery service — as a Home Assistant add-on, so AI
assistants can search products and recipes, manage your cart and follow your
deliveries from any device.

**Credit:** every Picnic tool and prompt is
[mcp-picnic](https://github.com/ivo-toby/mcp-picnic) by Ivo Toby (MIT). This
add-on packages it and adds authentication, OAuth, permissions and a 2FA
flow. It is an independent project, not affiliated with or endorsed by the
mcp-picnic authors or Picnic. Picnic has no public API; the tools use the
unofficial `picnic-api` client and can break when Picnic changes its app.

This add-on does not touch Home Assistant's own conversation or MCP
integration. It is a separate MCP server that happens to run on the same
machine.

## Quick start

### Nabu Casa / existing Home Assistant remote access

1. Enable **Remote access through Home Assistant** (`enable_remote_access`) in
   this app's Configuration and restart the Picnic app.
2. Open the Picnic app's web UI. The app installs its companion integration and
   provisions a dedicated remote route. If it asks you to restart **Home
   Assistant**, do that once. It never performs that restart automatically.
3. When the dashboard says **ready**, copy its connection URL. It uses your
   existing Nabu Casa hostname and a Picnic-specific path:
   `https://<your-ha-host>/api/picnic_mcp_remote/<private-route-key>/mcp`.
4. In ChatGPT on the web, add a custom MCP server named **Picnic**, paste the URL,
   and choose **OAuth**. Leave the client ID and secret empty for automatic
   registration. On the Picnic approval page, enter this app's `mcp_auth_token`.
5. Install/select the resulting Picnic connection and test reading the cart.
   Availability in ChatGPT and its mobile app depends on the account and product
   surface; mobile use must be verified separately.

No new domain, public app port, or second HA-MCP webhook proxy is needed. Keep
`mcp_url` blank in this mode; the app detects Home Assistant's external HTTPS URL,
preferring Nabu Casa. Nabu Casa remote access must be enabled and reachable.
The existing Home Assistant MCP connection is independent.

The URL's private route key and the Picnic app's OAuth/bearer authentication are
both required for MCP access. The bridge exposes only MCP, OAuth discovery and
sign-in endpoints, a health check, and the icon. The login/2FA dashboard and
Home Assistant services are not exposed through this route.

**Disable:** turn `enable_remote_access` off and restart the Picnic app. The
Picnic gateway immediately rejects bridge requests, and the helper disables the
HA route. Restarting the app with the option on reuses the route and sessions.
If uninstalling the app, disable remote access first. The companion integration
can then be removed from Settings > Devices & services; its own files remain in
`custom_components/picnic_mcp_remote` until manually removed.

**Permissions:** the app needs Home Assistant API access and write access to
`/config` to install its companion. It only manages that integration's directory
and entries. A previous version is saved under `/data/remote-component-backups`
before replacement. The bridge has no generic destination/proxy setting.

### Direct HTTPS hosting (existing setup)

1. **Configuration tab:** fill in `picnic_email`, `picnic_password` and
   `country_code`. Save and **start** the add-on. On first start it also
   generates a random bearer token and saves it into `mcp_auth_token`.
2. **Web UI** (sidebar entry *Picnic MCP*, or **Open Web UI**): the status
   should read *ingelogd*. If it reads *wacht op 2FA-code*, press **Stuur
   code per sms**, enter the code and press **Verifiëren** — see
   *Two-factor authentication* below. The session is stored, so this is a
   one-time step until Picnic revokes it.
3. **Give it its own subdomain**, e.g. `picnic.example.com`, through your
   Cloudflare Tunnel — see *Exposing it to the internet*. Set `mcp_url` to
   `https://picnic.example.com/mcp`. (On your own network only?
   `http://<HA host>:8097/mcp` works without any of this.)
4. **Connect Claude** — see *Connecting a client*.

## Configuration

| Option | Description |
|---|---|
| `picnic_email`, `picnic_password` | Your Picnic login. Stored only in this add-on's options on your own host. |
| `country_code` | `NL`, `DE` or `FR`. Changing the account or country discards the stored session automatically. |
| `mcp_url` | Public URL clients use, e.g. `https://picnic.example.com/mcp`. Its origin becomes the OAuth issuer, instead of trusting the request's `Host` header. Leave blank for local use. |
| `mcp_auth_token` | Bearer token. Generated on first start if blank; set your own to override (keep it long and random). Also the password on the OAuth approval page. |
| `allow_cart_changes` | Default **on**. Add/remove products and recipes in the cart, clear the cart, save/unsave recipes. Nothing is ordered until you check out in the app. |
| `allow_delivery_changes` | Default **off**. Choose a delivery slot, cancel or rate a delivery, e-mail an invoice. |
| `allow_account_details` | Default **off**. Read profile, payment profile and wallet transactions. |
| `expose_2fa_tools` | Default **off**. Let the assistant request and enter 2FA codes itself, instead of you doing it in the web UI. |
| `log_level` | `debug` \| `info` \| `warning` \| `error`. |

The dashboard and OAuth approval page use the language of `country_code`:
German (DE), Dutch (NL), or French (FR). English is the fallback for an
unsupported country. Changing the country also changes the Picnic account
context and discards its stored session; it is not a language-only setting.

Browsing — product search, promotions, product details and images, recipes,
shopping lists, the cart, delivery slots, deliveries and their status — is
always available. Tool changes need a restart.

### How the tool set is decided

Every upstream tool is classified into one of the groups above in
`app/gateway.mjs` (`TOOL_GROUPS`). At startup, tools in disabled groups are
removed from upstream's registry before any MCP session exists, so they are
neither listed nor callable. A tool that upstream adds in a later version and
that is not yet classified here is **withheld**, logged and shown in the web
UI — an assistant never gets a tool with unknown side effects just because
the upstream pin moved.

## The web UI (Ingress)

Shows the Picnic login status, the 2FA form, a **re-login** button (throws
the stored session away and logs in again), the connection URL, the OAuth
clients you have approved with a button to revoke all their tokens, and
which tools are published or withheld.

**Ingress is not admin-only.** `panel_admin` hides the sidebar entry from
non-admins, but any logged-in Home Assistant user can open the ingress URL,
and Home Assistant doesn't tell the add-on who is looking. So the web UI
never shows the bearer token or your Picnic password, and it can't change
credentials or permissions — those live in the admin-only Configuration tab.
What any user *can* do there is request a 2FA code, re-login and revoke OAuth
tokens.

It runs on a separate, unpublished port (`8096`) and rejects every
connection that doesn't come from the Supervisor's ingress proxy, so it is
not reachable from your LAN, the tunnel or other add-ons.

## Two-factor authentication (2FA)

Picnic can ask for a second factor — a code sent by SMS — when a new device
logs in. To Picnic, this add-on is a new device. You complete that step
once, in the add-on's web UI; your assistant never needs to know about it.

### How it goes

1. **Start the add-on** with your e-mail and password filled in. It logs in
   to Picnic with them.
   - No 2FA on your account: the status becomes **ingelogd** and you're done.
   - 2FA required: Picnic accepts the password but holds back access. The
     status becomes **wacht op 2FA-code** and a *Tweestapsverificatie*
     section appears.
2. **Press _Stuur code per sms_.** Picnic sends a code to the phone number on
   your account. The button can be used once a minute.
3. **Enter the code and press _Verifiëren_.** The add-on hands it to Picnic,
   receives a full session in return, checks it works, and the status
   becomes **ingelogd**.

### What is stored, and when you'll see it again

- The session from step 3 is saved in `/data/picnic-session.json`
  (readable only by the add-on), together with a random device id in
  `/data/picnic-device.json`. Restarts and add-on updates reuse both, so
  Picnic keeps recognising the same device and doesn't ask again.
- You only go through 2FA again when:
  - Picnic ends the session (Picnic decides when);
  - you press **Opnieuw inloggen** in the web UI, which deliberately throws
    the session away;
  - you change `picnic_email` or `country_code` — the old session belonged
    to the other account, so it's discarded automatically.
- If Picnic ends the session while the add-on runs, tool calls start
  failing with Picnic's own error. Press **Opnieuw inloggen**; with 2FA on
  your account the status then goes back to *wacht op 2FA-code* and you
  repeat steps 2–3.

### While the login isn't finished

The MCP endpoint stays up and Claude still sees the tools, but every tool
call answers with a short explanation ("Picnic is not available right now…
open the Picnic MCP add-on's web UI to finish the login") instead of trying
to log in itself. That is deliberate: it means a wrong password or a pending
2FA step never turns into a stream of failed logins against your Picnic
account.

### Letting the assistant do it (optional)

With `expose_2fa_tools` on, two extra tools let the assistant request and
enter the code itself — you'd tell Claude the code from the SMS. They only
work while the add-on is actually waiting for a code. This is off by
default, because the web UI route keeps the code out of your chat history
and works without a connected assistant.

### If it doesn't work

- **Status *inloggen mislukt* with a message:** usually a wrong e-mail or
  password — fix it in Configuration and restart. The 2FA form is shown in
  this state too, in case Picnic reported the 2FA requirement in a way the
  add-on didn't recognise; *Stuur code per sms* first retries the login.
- **No SMS arrives:** wait a minute and press the button again, and check
  the phone number on your account in the Picnic app. Codes are sent by
  SMS only.
- **"Code geaccepteerd, maar Picnic geeft nog geen toegang":** press
  **Opnieuw inloggen** and request a fresh code.

## Exposing it to the internet

The MCP port is **8097**, published on the host by default (change it in the
Network tab if it clashes). It deliberately doesn't go through Home Assistant
Ingress: MCP clients need a plain URL and a token, not a browser session.

Give the add-on **its own subdomain**. Each MCP add-on gets its own
hostname (e.g. `picnic.example.com`, `nlgov-mcp.example.com`), so they stay
fully independent: each serves at the root of its hostname, with its own
token and OAuth login. It costs one extra hostname in your tunnel.

### Cloudflare Tunnel

You need a domain whose DNS is on Cloudflare, and the **Cloudflared**
add-on (repository `https://github.com/homeassistant-apps/repository`, add
it the same way as this one). Cloudflared opens an outbound tunnel, so no
ports are opened on your router. How you add a hostname depends on how the
tunnel is set up:

**A. Tunnel managed in the Cloudflare dashboard** — the Cloudflared add-on
has a `tunnel_token` in its Configuration. Routes live in Cloudflare:

1. In the Cloudflare dashboard open **Zero Trust → Networks → Tunnels**,
   pick your tunnel, then **Edit**.
2. Open **Public hostnames** (called **Published application routes** in
   newer dashboards) and **Add a public hostname**:
   - *Subdomain* `picnic`, *Domain* your domain, *Path* empty.
   - *Service type* `HTTP`, *URL* `<HA host>:8097` — the LAN address your
     other hostnames already point at, with port 8097.
   - HTTP, not HTTPS: Cloudflare terminates TLS; the hop inside your
     network is plain HTTP.
3. **Save.** Cloudflare creates the DNS record itself (a proxied `CNAME` to
   `<tunnel-id>.cfargotunnel.com`) and the running Cloudflared add-on picks
   up the new route without a restart.

**B. Tunnel configured in the Cloudflared add-on** — no `tunnel_token`.
Add the hostname to the add-on's `additional_hosts` and restart Cloudflared:

```yaml
additional_hosts:
  - hostname: picnic.example.com
    service: http://<HA host>:8097
```

**Then, either way:**

1. Set `mcp_url` in this add-on to `https://picnic.example.com/mcp` and
   restart it.
2. Open `https://picnic.example.com/health` — it should answer
   `{"ok":true,"name":"picnic-mcp"}`.
3. Connect Claude (next section).

If you change the add-on's port in its Network tab, change the tunnel's
service URL to match.

**Troubleshooting**

| You see | Likely cause |
|---|---|
| `502` / *Bad gateway* at `/health` | The add-on isn't running, or the service URL has the wrong IP or port. |
| Cloudflare error *1033* | The tunnel itself is down — check the Cloudflared add-on's log. |
| `{"error":"not_found"}` | The request reached the add-on but on the wrong path: the URL must end in `/mcp`. |
| `401` on `/mcp` in a browser | Expected — the endpoint needs a token. |
| Claude can't connect, `/health` works | Check that `mcp_url` is exactly the URL you gave Claude. Cloudflare **Access** or a bot challenge in front of the hostname will also block Claude's login flow. |

### Any other reverse proxy

Give it its own hostname, forward to `<HA host>:8097`, keep the
`Authorization` header, and don't buffer responses (`proxy_buffering off;` in
nginx) — MCP streams its answers.

## Connecting a client

**Claude (web, desktop, iOS, Android):** on claude.ai go to **Settings →
Connectors → Add custom connector**, enter `https://picnic.example.com/mcp`
and press **Connect**. A page from this add-on opens asking for the bearer
token: paste `mcp_auth_token` from the Configuration tab and press
**Authorize**. The page shows where you will be sent back (`claude.ai`) — only
continue if that is right. Connectors added on claude.ai appear in the
desktop and mobile apps as well. Claude refreshes its access silently from
then on.

**Claude Code and other clients with a header field:**

```
claude mcp add --transport http picnic https://picnic.example.com/mcp \
  --header "Authorization: Bearer <mcp_auth_token>"
```

On your own network the URL can be `http://<HA host>:8097/mcp`.

**How the OAuth part works:** an unauthenticated request gets `401` with a
`WWW-Authenticate` header pointing at
`/.well-known/oauth-protected-resource/mcp`; the client discovers
`/.well-known/oauth-authorization-server`, registers itself (`/register`,
RFC 7591), sends you to `/authorize`, and exchanges the code at `/token` with
PKCE. Access tokens last an hour; refresh tokens rotate on every use and
expire after 90 days without use. Revoke all of them from the web UI at any
time; the bearer token itself is unaffected.

## Security

### What is exposed where

| Port / path | Reachable from | Protection |
|---|---|---|
| `8097` `/mcp` | LAN, and the internet through your tunnel | Bearer token or an OAuth access token |
| `8097` `/authorize`, `/token`, `/register`, `/.well-known/*` | Same | Public by design; approving a client needs the bearer token (throttled to 8 tries per 15 min) |
| `8097` `/health` | Same | None — returns only `{"ok":true}` |
| `8097` other paths | Same | `404` |
| `8096` web UI | Home Assistant Ingress only | Ingress login + source-address check |

Publishing port 8097 makes it reachable from your whole LAN, tunnel or not.

### What someone with the token can do

Everything the enabled tool groups allow, as you: see your cart, order
history, delivery times and address-related delivery details; with the
defaults, change your cart. With `allow_delivery_changes` they can also
cancel or reschedule a delivery, and with `allow_account_details` read
payment and wallet information. **None of the tools can check out or pay** —
upstream has no such tool — but treat the token like a key to your Picnic
account anyway.

### Keeping it safe

- **Keep the generated token.** It is 256-bit random and the only lock on
  the public endpoint.
- **Leave the off-by-default groups off** unless you actually use them.
- **Consider Cloudflare Access** in front of the hostname for header-based
  clients. It interferes with the OAuth flow of the Claude apps, so it suits
  Claude Code and scripts best.
- **Revoke** OAuth tokens from the web UI when you lose a device; rotate the
  bearer token by setting a new one in Configuration and restarting.

### Where your data lives

The Picnic password and the bearer token live in this add-on's options
(`/data/options.json`, managed by Supervisor on your host). The Picnic
session (`picnic-session.json`), a random device id, and OAuth clients and
tokens (`oauth-store.json`) live beside it in `/data`, readable only by the
add-on, and are included in Home Assistant backups — encrypt your backups.
OAuth tokens are stored only as SHA-256 hashes, so a copied backup can't be
used to act as your connected clients. The Picnic session itself can't be
hashed (the add-on has to send it to Picnic), which is one more reason to
encrypt backups.
Nothing is written to this repository, and nothing leaves your host except
requests to Picnic's own servers.

## Development notes

- `app/gateway.mjs` is bundled with upstream's TypeScript sources by
  esbuild in the Dockerfile's build stage. It reuses upstream's tool
  registry, MCP request handlers (`BaseTransportServer`) and Picnic client,
  and replaces only upstream's HTTP transport. `app/oauth.mjs` is the OAuth
  server.
- To pick up a newer upstream: bump `MCP_PICNIC_COMMIT` in the Dockerfile,
  compare upstream's `src/tools/picnic-tools.ts` against `TOOL_GROUPS` and
  classify any new tool, bump `version` in `config.yaml`, and add a
  `CHANGELOG.md` entry. If upstream renames the registry's internal `tools`
  map, the add-on refuses to start rather than publish ungated tools.
- Local run: bundle as the Dockerfile does, then start
  `node gateway.mjs` with `DATA_DIR`, `PICNIC_*`, `MCP_AUTH_TOKEN` and
  `ALLOW_ANY_INGRESS_SOURCE=true` in the environment.
