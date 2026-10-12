#!/bin/bash
set -euo pipefail

fail() { printf 'Claudrobe: %s\n' "$*" >&2; exit 1; }
[ "$(uname -s)" = Darwin ] || fail 'This installer requires macOS.'
[ "$(id -u)" != 0 ] || fail 'Run this as your normal user, without sudo.'

APP=''
for candidate in /Applications/Claude.app "$HOME/Applications/Claude.app"; do
  if [ -f "$candidate/Contents/Resources/app.asar" ]; then APP="$candidate"; break; fi
done
[ -n "$APP" ] || fail 'Install Claude Desktop in Applications first.'
grep -aq loadReactDevTools "$APP/Contents/Resources/app.asar" || fail 'This Claude version does not support the extension-loading hook. No changes were made.'

STATE="$HOME/Library/Application Support/Claudrobe"
EXT="$HOME/Library/Application Support/Claude/extensions/fmkadmapgofadopljbjfkapdkoienihi"
PLIST="$HOME/Library/LaunchAgents/com.claude-themes.env.plist"
DOMAIN="gui/$(id -u)"
SOURCE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

for item in extension/manifest.json extension/theme.js com.claude-themes.env.plist uninstall.sh; do
  [ -f "$SOURCE/$item" ] || fail "Missing $item. Clone or download the complete repository before installing."
done
plutil -lint "$SOURCE/com.claude-themes.env.plist" >/dev/null
# plutil -lint rejects JSON on recent macOS; a conversion still parses it strictly.
plutil -convert xml1 -o /dev/null "$SOURCE/extension/manifest.json" || fail 'extension/manifest.json is not valid JSON.'
[ -s "$SOURCE/extension/theme.js" ] || fail 'The local theme script is empty. Rebuild it with node build.mjs.'
bash -n "$SOURCE/uninstall.sh"

[ ! -L "$EXT" ] && [ ! -L "$STATE" ] && [ ! -L "$PLIST" ] || fail 'An installation path is a symlink; refusing to overwrite it.'
if [ -e "$STATE" ] && [ ! -f "$STATE/installed" ]; then
  fail "The installer state folder already exists but is not owned by Claudrobe: $STATE"
fi
if [ -e "$EXT" ]; then
  NAME="$(plutil -extract name raw -o - "$EXT/manifest.json" 2>/dev/null || true)"
  if [ "$NAME" != 'Claude Themes' ]; then
    fail 'The extension slot contains another extension (possibly React DevTools). Move it elsewhere before installing; it has not been changed.'
  fi
fi
if [ -f "$PLIST" ]; then
  grep -q REACT_PROFILE "$PLIST" && grep -q fmkadmapgofadopljbjfkapdkoienihi "$PLIST" || fail 'The existing login item is not recognized as Claudrobe; it has not been changed.'
fi

mkdir -p "$EXT" "$STATE" "$(dirname "$PLIST")"
cp "$SOURCE/extension/manifest.json" "$SOURCE/extension/theme.js" "$EXT/"
cp "$SOURCE/uninstall.sh" "$STATE/uninstall.sh"
cp "$SOURCE/com.claude-themes.env.plist" "$PLIST"
touch "$STATE/installed"
launchctl bootout "$DOMAIN/com.claude-themes.env" >/dev/null 2>&1 || true
launchctl bootstrap "$DOMAIN" "$PLIST" || fail 'Files are installed, but the login item could not load. Rerun the install command to retry.'
launchctl setenv REACT_PROFILE 1
printf '\nClaudrobe installed. Claude has not been closed or restarted.\n'
printf 'When ready, quit Claude fully (Cmd+Q) and reopen it to see the changes.\n'
printf 'Update: get the latest source, then rerun bash install.sh. Your saved themes and settings are kept.\n'
printf 'Uninstall: bash "$HOME/Library/Application Support/Claudrobe/uninstall.sh"\n'
