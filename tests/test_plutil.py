import json
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]


@unittest.skipUnless(os.uname().sysname == 'Darwin', 'Requires real macOS plutil')
class PlutilTests(unittest.TestCase):
    def convert(self, path):
        return subprocess.run(
            ['/usr/bin/plutil', '-convert', 'xml1', '-o', '/dev/null', str(path)],
            text=True, capture_output=True)

    def test_manifest_conversion_does_not_modify_source(self):
        manifest = ROOT / 'extension/manifest.json'
        before = manifest.read_bytes()
        result = self.convert(manifest)
        self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
        self.assertEqual(manifest.read_bytes(), before)

    def test_malformed_json_rejected(self):
        with tempfile.TemporaryDirectory() as temp:
            manifest = Path(temp) / 'manifest.json'
            for contents in ('{"name":', '{"name":"Claude Themes",}', 'not json'):
                with self.subTest(contents=contents):
                    manifest.write_text(contents)
                    self.assertNotEqual(self.convert(manifest).returncode, 0)

    def test_simple_json_conversion_and_lint_diagnostic(self):
        with tempfile.TemporaryDirectory() as temp:
            manifest = Path(temp) / 'manifest.json'
            manifest.write_text(json.dumps({'a': 1}))
            result = self.convert(manifest)
            self.assertEqual(result.returncode, 0, result.stdout + result.stderr)
            lint = subprocess.run(['/usr/bin/plutil', '-lint', str(manifest)],
                                  text=True, capture_output=True)
            version = subprocess.check_output(['/usr/bin/sw_vers', '-productVersion'], text=True).strip()
            print(f'\nmacOS {version}: JSON conversion succeeds; plutil -lint exit={lint.returncode}: '
                  + (lint.stdout + lint.stderr).strip())


if __name__ == '__main__':
    unittest.main()
