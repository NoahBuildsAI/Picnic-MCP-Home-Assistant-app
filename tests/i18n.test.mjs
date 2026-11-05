import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { messagesForCountry } from "../picnic_mcp/app/i18n.mjs";

test("country selects the dashboard language, with English fallback", () => {
  for (const [country, lang] of [["DE", "de"], ["NL", "nl"], ["FR", "fr"], ["de", "de"], ["XX", "en"], [undefined, "en"]]) {
    assert.equal(messagesForCountry(country).lang, lang);
  }
});

test("each supported language covers the same messages and statuses", () => {
  const reference = messagesForCountry("XX");
  for (const country of ["DE", "NL", "FR"]) {
    const locale = messagesForCountry(country);
    assert.deepEqual(Object.keys(locale).sort(), Object.keys(reference).sort());
    assert.deepEqual(Object.keys(locale.banners).sort(), Object.keys(reference.banners).sort());
    assert.equal(locale.states.length, 6);
    assert.equal(locale.groups.length, 5);
    assert.ok(locale.states.every(Boolean));
    assert.ok(locale.groups.every(Boolean));
    assert.match(locale.toolsSummary(27, 11), /27.*11/);
  }
});

test("real dashboard renders the right language, 2FA, escaping and confirmations", async () => {
  const source = await readFile(new URL("../picnic_mcp/app/gateway.mjs", import.meta.url), "utf8");
  const start = source.indexOf("function escapeHtml(str)");
  const end = source.indexOf("\nconst webApp = express();", start);
  assert.ok(start >= 0 && end > start);
  for (const [country, expected] of [["DE", "Code per SMS senden"], ["NL", "Stuur code per sms"], ["FR", "Envoyer un code par SMS"], ["XX", "Send code by SMS"]]) {
    const t = messagesForCountry(country);
    const groups = Object.fromEntries(["shopping", "cart", "delivery", "account", "twofa"].map((key, index) => [key, { option: index ? "ALLOW_TEST" : null }]));
    const context = {
      t, picnic: { state: "needs_2fa", detail: t.needs2fa }, MCP_URL: "", PORT: 8097,
      connectionUrl: () => "", REMOTE_ENABLED: false,
      TOOL_GROUPS: groups, groupEnabled: (group) => group === "shopping", withheldTools: [],
      oauth: { listClients: () => [{ client_name: "<script>alert(1)</script>", redirect_host: "example.org", created_at: 0 }] },
      publishedTools: [1], STATE_LABEL: { needs_2fa: t.states[4] }, PICNIC_EMAIL: "test@example.org", COUNTRY: country,
    };
    const render = vm.runInNewContext(`${source.slice(start, end)}\nrenderDashboard`, context);
    const html = render();
    assert.ok(html.includes(`<html lang="${t.lang}">`));
    assert.ok(html.includes(expected));
    assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
    assert.ok(!html.includes("<script>alert(1)</script>"));
    assert.ok(html.includes("onsubmit=\"return confirm(&quot;"));
    context.picnic.state = "ready";
    context.STATE_LABEL.ready = t.states[3];
    assert.ok(!render().includes(`action="send-2fa"`));
  }
});

test("OAuth approval renders each language and escapes untrusted client names", async () => {
  const source = await readFile(new URL("../picnic_mcp/app/oauth.mjs", import.meta.url), "utf8");
  const escapeStart = source.indexOf("function escapeHtml(str)");
  const escapeEnd = source.indexOf("\nexport function timingSafeEqualStr", escapeStart);
  const start = source.indexOf("  function consentPage(");
  const end = source.indexOf("\n  const router = express.Router()", start);
  assert.ok(escapeStart >= 0 && escapeEnd > escapeStart && start >= 0 && end > start);
  for (const [country, expected] of [["DE", "Autorisieren"], ["NL", "Autoriseren"], ["FR", "Autoriser"], ["XX", "Authorize"]]) {
    const messages = messagesForCountry(country);
    const context = { messages, redirectHost: () => "example.org" };
    const consent = vm.runInNewContext(`${source.slice(escapeStart, escapeEnd)}\n${source.slice(start, end)}\nconsentPage`, context);
    const html = consent({ clientName: '<script>alert(1)</script>', redirectUri: "https://example.org", error: 'bad <token>', hiddenFields: { state: '" onfocus="alert(1)' } });
    assert.ok(html.includes(`<html lang="${messages.lang}">`));
    assert.ok(html.includes(expected));
    assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
    assert.ok(html.includes("bad &lt;token&gt;"));
    assert.ok(!html.includes('<script>alert(1)</script>'));
    assert.ok(html.includes('&quot; onfocus=&quot;alert(1)'));
  }
});
