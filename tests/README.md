# Testing

## Automated

```bash
bun install --frozen-lockfile
bunx playwright install chromium
npm test
python3 tests/test_install.py
```

The 30 JavaScript tests cover browser fixtures and palette calculations. The 11 installer tests use simulated macOS commands. Browser fixtures model Claude's panes, title bars, sidebar rows and React session props; they are not a substitute for testing Claude Desktop on a Mac. Installation itself still needs no Node, Bun or Python.

An existing compatible Chromium executable can be selected with `PLAYWRIGHT_CHROMIUM_EXECUTABLE`.

## Mac review before merging

Check out the PR branch, run `bash install.sh`, then quit Claude fully (⌘Q) and reopen it when ready. The installer will not restart it for you.

- Close/reopen the sidebar; check that the theme button never covers native controls. Check narrow windows and two- and four-pane splits, including RC buttons and repository chips.
- Enable hover expansion. Pass across panes quickly: nothing should grow. Dwell for about half a second: expansion should start smoothly. Click the expanded pane to lock; click outside to release. Open native menus, resize the window, and try macOS Reduce Motion.
- Choose an avatar with and without a colour. Check the same icon on its pane title and sidebar tab. Navigate, restart Claude, remove just the colour, and remove just the avatar. Confirm sessions remain independent.
- Navigate between coloured sessions while a reply streams. Borders/glow/fill and the appearance picker should follow the correct session without a two-second delay.
- Try several light and dark themes. Check sidebar, title bar, composer, search fields, borders, focus rings and native menus. Change fonts and brightness, then switch themes: colours/brightness should change, fonts and weight should stay. Save a custom theme and check its brightness after reselection/restart.
- Return to Claude (app default), then run `bash uninstall.sh` and restart Claude when ready. Confirm native appearance/layout returns and saved choices survive reinstallation.

No screenshot was available in this workspace, so the original placement bug still needs comparison with the real Claude layout. Installer validation is deliberately unchanged here. On macOS versions that reject JSON with `plutil -lint`, the separate installer fix in PR #3 must be approved/applied before installation; do not bypass validation or use sudo.
