# Picnic MCP — Home Assistant add-on

<p align="center"><img src="assets/logo.svg" alt="Picnic MCP mascot: a walking grocery bag with a speech bubble" width="200"></p>

Let AI assistants use your **[Picnic](https://picnic.app)** grocery account
from your own Home Assistant, over the
[Model Context Protocol](https://modelcontextprotocol.io). Ask Claude
*"plan vijf avondmaaltijden voor twee en zet de boodschappen in mijn
mandje"* or *"wanneer komt mijn bezorging?"* on your phone, laptop or the
web, and it searches products and recipes, fills your cart and checks your
deliveries. You still check out in the Picnic app yourself.

> **Powered by [mcp-picnic](https://github.com/ivo-toby/mcp-picnic) by Ivo
> Toby.** The Picnic tools — the hard part — are theirs. This add-on packages
> them for Home Assistant and adds authentication, OAuth for the Claude apps,
> a 2FA flow and tool permissions. It is an independent project, **not
> affiliated with or endorsed by the mcp-picnic authors or Picnic**.

## What this add-on adds

- **Optional Nabu Casa remote access.** Enable remote access, finish the initial
  Home Assistant setup/restart if requested, and copy the Picnic-specific URL
  into ChatGPT with OAuth. The app provisions its own bridge; it doesn't reuse
  or reconfigure the HA-MCP proxy. See `picnic_mcp/DOCS.md` for setup, permissions
  and removal instructions.

- **Authentication.** A bearer token on every MCP request, generated on first
  start, plus an OAuth 2.1 layer (dynamic client registration + PKCE) so
  Claude on the web, desktop, iOS and Android can connect with no header
  field.
- **Permissions.** Browsing products, recipes, the cart and deliveries is
  always available. Changing the cart is on by default; changing deliveries
  and reading account or payment details are off until you turn them on.
- **2FA and login status** in a small web UI inside Home Assistant, instead of
  a crash loop when a password is wrong.
- **Dashboard language** follows the selected Picnic country: German for DE,
  Dutch for NL and French for FR, with English as the fallback.

## Install

> [!NOTE]
> HACS can't install this — it's a Supervisor add-on, so it comes from the
> **Add-on Store**.

[![Open your Home Assistant instance and show the add add-on repository dialog with a specific repository URL pre-filled.](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2FEmacee%2FPicnic-MCP-Home-Assistant-app)

1. Click the button, or go to **Settings → Add-ons → Add-on Store → ⋮ →
   Repositories** and add `https://github.com/Emacee/Picnic-MCP-Home-Assistant-app`.
2. Install **Picnic MCP**, fill in your Picnic e-mail, password and country
   on the **Configuration** tab, and start it.
3. Open the add-on's web UI. If your account uses two-factor
   authentication, the status reads *wacht op 2FA-code*: press **Stuur code
   per sms**, enter the code from the SMS and press **Verifiëren**. The
   session is stored, so you only do this again if Picnic ends it. The
   *Two-factor authentication* section of the Documentation tab has the
   details.

Requires a 64-bit Home Assistant OS or Supervised install (`amd64` or `aarch64`).

## Reaching it from your devices

On your own network the MCP endpoint is `http://<HA host>:8097/mcp`.

To use it from your phone or claude.ai, give it **its own subdomain** through
a Cloudflare Tunnel — the
[Cloudflared add-on](https://github.com/homeassistant-apps/app-cloudflared)
(repository `https://github.com/homeassistant-apps/repository`) — or any
reverse proxy:

```
https://picnic.example.com/mcp  ──►  http://<HA host>:8097/mcp
```

1. Add a public hostname `picnic.example.com` to your tunnel with service
   `http://<HA host>:8097`: in the Cloudflare dashboard under **Zero Trust →
   Networks → Tunnels →** your tunnel **→ Public hostnames** (*Published
   application routes* in newer dashboards), or in the Cloudflared add-on's
   `additional_hosts`. Cloudflare creates the DNS record.
2. Set `mcp_url` in this add-on to `https://picnic.example.com/mcp` and
   restart it.
3. In Claude: **Settings → Connectors → Add custom connector** →
   `https://picnic.example.com/mcp`, and paste the add-on's token on the page
   that opens. The connector then works in the Claude apps on all your
   devices.

Running other MCP add-ons, such as
[Dutch Open Data MCP](https://github.com/Emacee/Dutch-Open-Data-MCP---Home-Assistant-App)?
Give each its own subdomain the same way; they stay fully independent. The
Documentation tab has the details.

## Security, briefly

This add-on can change what gets delivered to your door. Keep the generated
token (it is the only lock), leave the delivery and account groups off unless
you need them, and read the *Security* section of the documentation before
exposing it to the internet. Your Picnic password and the session live only
in the add-on's own storage on your Home Assistant; nothing is committed to
this repository or sent anywhere but Picnic.

## Credits and licence

- **[mcp-picnic](https://github.com/ivo-toby/mcp-picnic)** by **Ivo Toby** —
  every Picnic tool and prompt this add-on serves. MIT; its licence is
  retained in [`NOTICE`](NOTICE).
- It talks to Picnic through the unofficial
  [picnic-api](https://www.npmjs.com/package/picnic-api) client. Picnic does
  not offer a public API; things can break when Picnic changes its app.
- This add-on is licensed [MIT](LICENSE).

Bugs in the Picnic tools belong
[upstream](https://github.com/ivo-toby/mcp-picnic/issues); bugs in
packaging, auth or the web UI belong here.
