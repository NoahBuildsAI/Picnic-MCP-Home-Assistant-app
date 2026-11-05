"""The Picnic app provisions its own remote route through this config flow."""
import re

import voluptuous as vol

from homeassistant import config_entries

from . import DOMAIN

SLUG = re.compile(r"[a-z0-9]{8}_picnic_mcp")
KEY = re.compile(r"[a-f0-9]{64}")


class PicnicRemoteFlow(config_entries.ConfigFlow, domain=DOMAIN):
    VERSION = 1

    async def async_step_user(self, user_input=None):
        if user_input is not None:
            if not SLUG.fullmatch(user_input.get("addon_slug", "")) or not KEY.fullmatch(user_input.get("remote_key", "")):
                return self.async_abort(reason="invalid_config")
            await self.async_set_unique_id(user_input["addon_slug"])
            self._abort_if_unique_id_configured()
            return self.async_create_entry(title="Picnic MCP Remote", data={
                "addon_slug": user_input["addon_slug"],
                "remote_key": user_input["remote_key"], "enabled": True,
            })
        return self.async_show_form(step_id="user", data_schema=vol.Schema({
            vol.Required("addon_slug"): str, vol.Required("remote_key"): str,
        }))
