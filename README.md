# Claudrobe

Colour themes and split-view extras for Claude Desktop on macOS.

## Features

- 32 dark and 15 light palettes, including Dracula, Nord, Catppuccin, Ayu, PaperColor and Tokyo Night.
- Customize colours and save your own themes.
- Adjust text weight, brightness, and separate fonts for the app, transcript and code. Selecting a theme restores its text colours and brightness without changing fonts.
- Give each Code session its own colour line, glow or tint, plus an optional avatar on its title bar and sidebar tab.
- Expand split panes after a short hover with a smooth animation; click the expanded pane to lock it. Show session status on pane titles.

No telemetry or network requests from the installer or theme. Claude.app itself is never modified.

## Install

```bash
git clone https://github.com/smansou/Claudrobe.git
cd Claudrobe
bash install.sh
```

The installer checks compatibility and installs the files without closing or restarting Claude. When ready, quit Claude fully (⌘Q) and reopen it to see the changes. No Node, developer mode, DevTools or sudo needed. It uses an undocumented Claude extension hook; unsupported versions are detected before any changes are made. An existing React DevTools extension in the same slot is left untouched and blocks installation.

Open the colour wheel beside the sidebar's back/forward buttons, or press **⌥⇧T**.

## Update

From your clone:

```bash
git pull --ff-only && bash install.sh
```

Saved themes and settings are kept. Restart Claude when ready to apply the update.

## Uninstall

```bash
bash uninstall.sh
```

If you deleted the clone:

```bash
bash "$HOME/Library/Application Support/Claudrobe/uninstall.sh"
```

Claude is left running. Restart it when ready to finish removing the changes. Saved themes and settings are kept for a future reinstall.
