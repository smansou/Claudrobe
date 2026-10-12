import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
STUB = '''#!/usr/bin/env python3
import json, os, pathlib, plistlib, shutil, sys
name = pathlib.Path(sys.argv[0]).name
args = sys.argv[1:]
if name == 'uname': print('Darwin')
elif name == 'id': print('501')
elif name == 'pgrep': sys.exit(0)
elif name in ('open', 'osascript', 'kill', 'killall', 'pkill'):
    pathlib.Path(os.environ['LIFECYCLE']).write_text(name)
    sys.exit(98)
elif name in ('curl', 'wget', 'git'):
    pathlib.Path(os.environ['NETWORK']).write_text(name)
    sys.exit(99)
elif name == 'plutil':
    try:
        if '-lint' in args:
            for file in args[1:]:
                plistlib.loads(pathlib.Path(file).read_bytes())
        elif '-convert' in args and args[args.index('-convert') + 1] == 'xml1':
            value = json.loads(pathlib.Path(args[-1]).read_text())
            plistlib.dumps(value)
        elif '-extract' in args:
            print(json.loads(pathlib.Path(args[-1]).read_text())['name'])
        else:
            raise ValueError('Unexpected plutil command: ' + repr(args))
    except Exception as error:
        print(error, file=sys.stderr)
        sys.exit(1)
elif name == 'launchctl':
    with open(os.environ['CALLS'], 'a') as f: f.write(' '.join(args) + '\\n')
'''


class InstallerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.home = Path(self.temp.name) / 'home'
        self.home.mkdir()
        self.bin = Path(self.temp.name) / 'bin'
        self.bin.mkdir()
        stub = self.bin / 'stub'
        stub.write_text(STUB)
        stub.chmod(0o755)
        for name in ('uname', 'id', 'pgrep', 'curl', 'wget', 'git', 'plutil', 'launchctl', 'open', 'osascript', 'kill', 'killall', 'pkill'):
            (self.bin / name).symlink_to(stub)
        self.source = Path(self.temp.name) / 'checkout with spaces'
        self.source.mkdir()
        for relative in ('install.sh', 'uninstall.sh', 'com.claude-themes.env.plist',
                         'extension/manifest.json', 'extension/theme.js'):
            target = self.source / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(ROOT / relative, target)
        self.system_app = Path(self.temp.name) / 'system/Applications/Claude.app'
        installer = self.source / 'install.sh'
        text = installer.read_text()
        self.assertEqual(text.count('/Applications/Claude.app "$HOME/Applications/Claude.app"'), 1)
        installer.write_text(text.replace(
            '/Applications/Claude.app "$HOME/Applications/Claude.app"',
            '"' + str(self.system_app) + '" "$HOME/Applications/Claude.app"'))
        self.network = Path(self.temp.name) / 'network-call'
        self.lifecycle = Path(self.temp.name) / 'lifecycle-call'
        self.env = dict(os.environ, HOME=str(self.home), NETWORK=str(self.network),
                        LIFECYCLE=str(self.lifecycle),
                        CALLS=str(Path(self.temp.name) / 'calls'),
                        PATH=str(self.bin) + ':' + os.environ['PATH'])
        self.asar = self.home / 'Applications/Claude.app/Contents/Resources/app.asar'
        self.asar.parent.mkdir(parents=True)
        self.asar.write_text('loadReactDevTools')
        self.ext = self.home / 'Library/Application Support/Claude/extensions/fmkadmapgofadopljbjfkapdkoienihi'
        self.state = self.home / 'Library/Application Support/Claudrobe'
        self.plist = self.home / 'Library/LaunchAgents/com.claude-themes.env.plist'

    def run_script(self, name, success=True):
        result = subprocess.run(['bash', str(self.source / name)], env=self.env,
                                cwd=self.home, text=True, capture_output=True)
        self.assertEqual(result.returncode == 0, success, result.stdout + result.stderr)
        self.assertFalse(self.network.exists(), 'Installer attempted a network command')
        self.assertFalse(self.lifecycle.exists(), 'Script interrupted or opened Claude')
        return result

    def test_install_update_uninstall(self):
        self.run_script('install.sh')
        self.assertEqual((self.ext / 'theme.js').read_bytes(), (ROOT / 'extension/theme.js').read_bytes())
        self.assertTrue(self.plist.exists())
        self.assertTrue((self.state / 'uninstall.sh').exists())
        self.run_script('install.sh')
        self.run_script('uninstall.sh')
        self.assertFalse(self.ext.exists())
        self.assertFalse(self.plist.exists())
        self.assertFalse(self.state.exists())
        self.run_script('uninstall.sh')

    def test_manual_restart_message_after_install_and_update(self):
        for _ in range(2):
            result = self.run_script('install.sh')
            self.assertIn('Claudrobe installed.', result.stdout)
            self.assertIn('quit Claude fully (Cmd+Q) and reopen it', result.stdout)

    def test_manual_restart_message_after_uninstall(self):
        self.run_script('install.sh')
        result = self.run_script('uninstall.sh')
        self.assertIn('Claudrobe uninstalled.', result.stdout)
        self.assertIn('quit Claude fully (Cmd+Q) and reopen it', result.stdout)

    def test_installs_local_changes_without_downloading(self):
        local = self.source / 'extension/theme.js'
        local.write_text('window.localCheckout = true;\n')
        self.run_script('install.sh')
        self.assertEqual((self.ext / 'theme.js').read_bytes(), local.read_bytes())

    def test_incomplete_checkout_leaves_install_untouched(self):
        self.run_script('install.sh')
        before = (self.ext / 'theme.js').read_bytes()
        (self.source / 'extension/theme.js').unlink()
        self.run_script('install.sh', False)
        self.assertEqual((self.ext / 'theme.js').read_bytes(), before)

    def test_empty_local_script_rejected(self):
        (self.source / 'extension/theme.js').write_text('')
        self.run_script('install.sh', False)
        self.assertFalse(self.ext.exists())

    def test_unsupported_version(self):
        self.asar.write_text('no hook')
        self.run_script('install.sh', False)
        self.assertFalse(self.ext.exists())

    def test_system_app_takes_precedence_without_using_host_app(self):
        asar = self.system_app / 'Contents/Resources/app.asar'
        asar.parent.mkdir(parents=True)
        asar.write_text('no hook')
        self.run_script('install.sh', False)
        self.assertFalse(self.ext.exists())
        asar.write_text('loadReactDevTools')
        self.asar.write_text('no hook')
        self.run_script('install.sh')

    def test_missing_app_leaves_install_untouched(self):
        self.asar.unlink()
        self.run_script('install.sh', False)
        self.assertFalse(self.ext.exists())
        self.assertFalse(self.state.exists())

    def test_invalid_manifest_leaves_existing_install_untouched(self):
        self.run_script('install.sh')
        before = (self.ext / 'theme.js').read_bytes()
        (self.source / 'extension/manifest.json').write_text('{"name":')
        result = self.run_script('install.sh', False)
        self.assertIn('extension/manifest.json is not valid JSON', result.stderr)
        self.assertEqual((self.ext / 'theme.js').read_bytes(), before)

    def test_invalid_manifest_leaves_new_install_untouched(self):
        (self.source / 'extension/manifest.json').write_text('{"name":')
        self.run_script('install.sh', False)
        self.assertFalse(self.ext.exists())
        self.assertFalse(self.state.exists())
        self.assertFalse(self.plist.exists())

    def test_invalid_plist_leaves_install_untouched(self):
        (self.source / 'com.claude-themes.env.plist').write_text('<plist>')
        self.run_script('install.sh', False)
        self.assertFalse(self.ext.exists())
        self.assertFalse(self.state.exists())

    def test_preserve_other_extension(self):
        self.ext.mkdir(parents=True)
        manifest = self.ext / 'manifest.json'
        manifest.write_text(json.dumps({'name': 'React Developer Tools'}))
        self.run_script('install.sh', False)
        self.assertEqual(json.loads(manifest.read_text())['name'], 'React Developer Tools')
        self.assertFalse(self.state.exists())

    def test_migrate_manual_install(self):
        self.ext.mkdir(parents=True)
        (self.ext / 'manifest.json').write_text(json.dumps({'name': 'Claude Themes'}))
        self.run_script('install.sh')
        self.assertTrue((self.state / 'installed').exists())
        self.run_script('uninstall.sh')

    def test_replaced_extension_is_not_deleted(self):
        self.run_script('install.sh')
        (self.ext / 'manifest.json').write_text(json.dumps({'name': 'Other'}))
        self.run_script('uninstall.sh', False)
        self.assertTrue(self.plist.exists())
        self.assertTrue((self.ext / 'manifest.json').exists())

    def test_symlink_refused(self):
        self.ext.parent.mkdir(parents=True)
        self.ext.symlink_to(self.home)
        self.run_script('install.sh', False)
        self.assertFalse(self.state.exists())


@unittest.skipUnless(os.uname().sysname == 'Darwin', 'Requires real macOS plutil')
class MacInstallerTests(InstallerTests):
    def setUp(self):
        super().setUp()
        (self.bin / 'plutil').unlink()
        (self.bin / 'plutil').symlink_to('/usr/bin/plutil')


if __name__ == '__main__':
    unittest.main()
