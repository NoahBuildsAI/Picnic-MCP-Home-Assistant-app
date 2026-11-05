#!/usr/bin/with-contenv bashio
# Home Assistant supplies /data/options.json and SUPERVISOR_TOKEN in the environment.
set -e

export MCP_PORT="8097"
export INGRESS_PORT="8096"
export DATA_DIR="/data"

# Picnic credentials and upstream's own settings. Upstream reads these at
# import time, so they must be in the environment before node starts.
export PICNIC_USERNAME PICNIC_PASSWORD PICNIC_COUNTRY_CODE
PICNIC_USERNAME="$(bashio::config 'picnic_email')"
PICNIC_PASSWORD="$(bashio::config 'picnic_password')"
PICNIC_COUNTRY_CODE="$(bashio::config 'country_code')"
export PICNIC_SESSION_FILE="/data/picnic-session.json"
export PICNIC_DEVICE_FILE="/data/picnic-device.json"
# Upstream starts its own HTTP server when this is "true"; the gateway
# replaces that server, so make sure it is off.
export ENABLE_HTTP_SERVER="false"

export MCP_URL LOG_LEVEL
MCP_URL="$(bashio::config 'mcp_url')"
LOG_LEVEL="$(bashio::config 'log_level')"

export ALLOW_CART_CHANGES ALLOW_DELIVERY_CHANGES ALLOW_ACCOUNT_DETAILS EXPOSE_2FA_TOOLS
ALLOW_CART_CHANGES="$(bashio::config 'allow_cart_changes')"
ALLOW_DELIVERY_CHANGES="$(bashio::config 'allow_delivery_changes')"
ALLOW_ACCOUNT_DETAILS="$(bashio::config 'allow_account_details')"
EXPOSE_2FA_TOOLS="$(bashio::config 'expose_2fa_tools')"

# bashio prints "null" for unset optional options.
for var in PICNIC_USERNAME PICNIC_PASSWORD MCP_URL; do
  if [ "${!var}" = "null" ]; then printf -v "$var" '%s' ""; fi
done

# Bearer token: no secret ships in config.yaml or this repo. If the
# Configuration field is blank, generate one and write it back into this
# add-on's own Configuration through the Supervisor API, so it shows up
# there on the next tab open. A value set by hand always wins.
TOKEN_FILE="/data/mcp_auth_token"
CONFIGURED_TOKEN="$(bashio::config 'mcp_auth_token')"
[ "$CONFIGURED_TOKEN" = "null" ] && CONFIGURED_TOKEN=""

if [ -n "$CONFIGURED_TOKEN" ]; then
  MCP_AUTH_TOKEN="$CONFIGURED_TOKEN"
  bashio::log.info "Using mcp_auth_token from the add-on's Configuration tab."
else
  if [ -s "$TOKEN_FILE" ]; then
    # Saving to Configuration failed on an earlier start; reuse that token
    # rather than generating a second, different one.
    MCP_AUTH_TOKEN="$(cat "$TOKEN_FILE")"
  else
    MCP_AUTH_TOKEN="$(node -e 'process.stdout.write(require("crypto").randomBytes(32).toString("hex"))')"
    ( umask 077; printf '%s' "$MCP_AUTH_TOKEN" > "$TOKEN_FILE" )
  fi

  NEW_OPTIONS="$(jq --arg token "$MCP_AUTH_TOKEN" '.mcp_auth_token = $token' /data/options.json)"
  if bashio::api.supervisor POST "/addons/self/options" "{\"options\": ${NEW_OPTIONS}}" >/dev/null; then
    bashio::log.info "Generated a bearer token and saved it into this add-on's Configuration tab."
  else
    bashio::log.warning "Generated a bearer token but could not save it into Configuration automatically."
    bashio::log.warning "It is in ${TOKEN_FILE} inside the add-on; paste it into 'mcp_auth_token' in Configuration to pin it."
  fi
fi
export MCP_AUTH_TOKEN

export ENABLE_REMOTE_ACCESS
ENABLE_REMOTE_ACCESS="$(bashio::config 'enable_remote_access')"
python3 /app/remote_setup.py &

bashio::log.info "Starting Picnic MCP gateway on :${MCP_PORT}"
cd /app || exit 1
exec node gateway.mjs
