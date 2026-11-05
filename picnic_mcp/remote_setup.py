"""Install and provision only the app-owned Picnic remote integration.

Never restart Home Assistant. New integration code may need a user-initiated
restart; keep the local gateway available while waiting for it.
"""
import json
import os
from pathlib import Path
import secrets
import shutil
import time
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

DOMAIN = "picnic_mcp_remote"
DATA = Path(os.environ.get("DATA_DIR", "/data"))
INFO = DATA / "remote-info.json"
SOURCE = Path("/opt/remote_component") / DOMAIN
DEST = Path("/config/custom_components") / DOMAIN
API = "http://supervisor/core/api"
VERSION = "0.5.0"


def write_info(**info):
    temporary = INFO.with_suffix(".tmp")
    temporary.write_text(json.dumps(info), encoding="utf-8")
    temporary.chmod(0o600)
    temporary.replace(INFO)


def api(path, data=None):
    headers = {"Authorization": "Bearer " + os.environ["SUPERVISOR_TOKEN"], "Content-Type": "application/json"}
    request = Request(API + path, headers=headers,
                      data=json.dumps(data).encode() if data is not None else None)
    try:
        with urlopen(request, timeout=10) as response:
            body = response.read()
            return response.status, json.loads(body) if body else {}
    except HTTPError as error:
        return error.code, {}


def own_slug():
    request = Request("http://supervisor/addons/self/info", headers={
        "Authorization": "Bearer " + os.environ["SUPERVISOR_TOKEN"]})
    with urlopen(request, timeout=10) as response:
        return json.load(response)["data"]["slug"]


def install_component():
    source_files = {path.relative_to(SOURCE): path.read_bytes() for path in SOURCE.rglob("*")
                    if path.is_file() and path.suffix in (".py", ".json") and "__pycache__" not in path.parts}
    if not source_files:
        raise ValueError("Missing remote integration bundle")
    if all((DEST / name).is_file() and (DEST / name).read_bytes() == content
           for name, content in source_files.items()):
        return False
    if DEST.exists():
        # This directory is owned by the Picnic remote feature. Keep the last
        # installed version before updating it; never touch other integrations.
        backup = DATA / "remote-component-backups" / time.strftime("%Y%m%d-%H%M%S")
        shutil.copytree(DEST, backup, dirs_exist_ok=True)
    DEST.mkdir(parents=True, exist_ok=True)
    for name, content in source_files.items():
        target = DEST / name
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(content)
    return True


def notify_restart():
    api("/services/persistent_notification/create", {
        "notification_id": "picnic_mcp_remote_setup",
        "title": "Picnic MCP: Remote-Zugang einrichten",
        "message": "Die Picnic-Weiterleitung ist vorbereitet. Starte Home Assistant neu, falls der Remote-Zugang noch auf die Einrichtung wartet. Die bestehende Home-Assistant-MCP-Verbindung bleibt separat.",
    })


def main():
    enabled = os.environ.get("ENABLE_REMOTE_ACCESS", "false").lower() == "true"
    write_info(enabled=enabled, status="starting" if enabled else "disabled")
    # With remote off on a fresh install, don't install any HA code.
    if enabled:
        install_component()
    slug = None
    key_file = DATA / "remote-key"
    if enabled and not key_file.exists():
        key_file.write_text(secrets.token_hex(32), encoding="utf-8")
        key_file.chmod(0o600)
    notified = False
    while True:
        try:
            if slug is None:
                slug = own_slug()
            if not enabled:
                status, _ = api(f"/{DOMAIN}/configure", {"addon_slug": slug, "enabled": False})
                if status in (200, 404):
                    return
            else:
                status, info = api(f"/{DOMAIN}/status?addon_slug={slug}")
                if status == 404:
                    _, flow = api("/config/config_entries/flow", {"handler": DOMAIN})
                    if flow.get("type") == "form":
                        api("/config/config_entries/flow/" + flow["flow_id"], {
                            "addon_slug": slug, "remote_key": key_file.read_text(encoding="utf-8").strip(),
                        })
                    write_info(enabled=True, status="restart_required")
                    if not notified:
                        notify_restart()
                        notified = True
                elif status == 200 and info.get("version") == VERSION:
                    if not info.get("enabled"):
                        api(f"/{DOMAIN}/configure", {"addon_slug": slug, "enabled": True})
                    else:
                        write_info(**info)
                        if info.get("status") == "ready" and notified:
                            api("/services/persistent_notification/dismiss", {"notification_id": "picnic_mcp_remote_setup"})
                            notified = False
                else:
                    write_info(enabled=True, status="restart_required")
                    if not notified:
                        notify_restart()
                        notified = True
        except (OSError, URLError, ValueError, KeyError):
            write_info(enabled=enabled, status="waiting_for_home_assistant" if enabled else "disabled")
        time.sleep(15)


if __name__ == "__main__":
    main()
