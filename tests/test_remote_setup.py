import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

spec = importlib.util.spec_from_file_location("setup_remote", Path(__file__).resolve().parents[1] / "picnic_mcp/remote_setup.py")
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)


class SetupTest(unittest.TestCase):
    def test_installer_changes_only_its_component_and_keeps_backup(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1]) as temporary:
            root = Path(temporary)
            source, dest, data = root / "source", root / "config/custom_components/picnic_mcp_remote", root / "data"
            source.mkdir()
            data.mkdir()
            (source / "manifest.json").write_text('{"version":"new"}')
            (source / "__init__.py").write_text("# new")
            (source / "__pycache__").mkdir()
            (source / "__pycache__/old.pyc").write_bytes(b"ignore")
            dest.mkdir(parents=True)
            (dest / "__init__.py").write_text("# previous")
            unrelated = dest.parent / "mcp_proxy"
            unrelated.mkdir()
            (unrelated / "__init__.py").write_text("# don't change")
            with patch.multiple(setup, SOURCE=source, DEST=dest, DATA=data):
                self.assertTrue(setup.install_component())
                self.assertFalse(setup.install_component())
            self.assertEqual((unrelated / "__init__.py").read_text(), "# don't change")
            self.assertEqual(next((data / "remote-component-backups").glob("*/__init__.py")).read_text(), "# previous")
            self.assertFalse((dest / "__pycache__").exists())

    def test_remote_off_does_not_install_ha_files(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1]) as temporary:
            data = Path(temporary)
            with patch.multiple(setup, DATA=data, INFO=data / "remote-info.json"), \
                 patch.dict(setup.os.environ, {"ENABLE_REMOTE_ACCESS": "false"}), \
                 patch.object(setup, "install_component") as install, \
                 patch.object(setup, "own_slug", return_value="12345678_picnic_mcp"), \
                 patch.object(setup, "api", return_value=(404, {})) as api:
                setup.main()
            install.assert_not_called()
            self.assertEqual(json.loads((data / "remote-info.json").read_text())["status"], "disabled")
            self.assertEqual(api.call_args.args[1]["enabled"], False)
            self.assertFalse((data / "remote-key").exists())

    def test_supervisor_startup_failure_is_retried(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1]) as temporary:
            data = Path(temporary)
            with patch.multiple(setup, DATA=data, INFO=data / "remote-info.json"), \
                 patch.dict(setup.os.environ, {"ENABLE_REMOTE_ACCESS": "false"}), \
                 patch.object(setup, "own_slug", side_effect=[setup.URLError("starting"), "12345678_picnic_mcp"]) as slug, \
                 patch.object(setup, "api", return_value=(404, {})), \
                 patch.object(setup.time, "sleep") as sleep:
                setup.main()
            self.assertEqual(slug.call_count, 2)
            sleep.assert_called_once_with(15)

    def test_new_integration_is_provisioned_and_remote_url_published(self):
        with tempfile.TemporaryDirectory(dir=Path(__file__).resolve().parents[1]) as temporary:
            data = Path(temporary)
            ready = {"version": setup.VERSION, "enabled": True, "status": "ready", "url": "https://example.test/api/picnic_mcp_remote/key/mcp"}
            responses = [(404, {}), (200, {"type": "form", "flow_id": "flow"}),
                         (200, {"type": "create_entry"}), (200, {}), (200, ready), (200, {})]
            with patch.multiple(setup, DATA=data, INFO=data / "remote-info.json"), \
                 patch.dict(setup.os.environ, {"ENABLE_REMOTE_ACCESS": "true"}), \
                 patch.object(setup, "install_component"), \
                 patch.object(setup, "own_slug", return_value="12345678_picnic_mcp"), \
                 patch.object(setup, "api", side_effect=responses) as api, \
                 patch.object(setup.time, "sleep", side_effect=[None, StopIteration]):
                with self.assertRaises(StopIteration):
                    setup.main()
            self.assertEqual(json.loads((data / "remote-info.json").read_text()), ready)
            submitted = api.call_args_list[2].args[1]
            self.assertEqual(submitted["addon_slug"], "12345678_picnic_mcp")
            self.assertEqual(len(submitted["remote_key"]), 64)
            self.assertEqual((data / "remote-key").read_text(), submitted["remote_key"])
