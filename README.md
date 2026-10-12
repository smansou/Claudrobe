# Claudrobe

Colour themes and split-view extras for Claude Desktop on macOS.

## Features

- About 30 dark and light palettes, including Dracula, Nord, Catppuccin and Tokyo Night.
- Customize colours and save your own themes.
- Adjust text weight, brightness, and separate fonts for the app, transcript and code.
- Give each Code session its own colour line, glow or tint.
- Expand split panes on hover, click to keep them expanded, and show session status on pane titles.

No telemetry or network requests from the installer or theme. Claude.app itself is never modified.

## Install

```bash
git clone https://github.com/smansou/Claudrobe.git
cd Claudrobe
bash install.sh
```

The installer checks compatibility, installs the files and restarts Claude gracefully. No Node, developer mode, DevTools or sudo needed. It uses an undocumented Claude extension hook; unsupported versions are detected before any changes are made. An existing React DevTools extension in the same slot is left untouched and blocks installation.

Open the colour wheel beside the sidebar's back/forward buttons, or press **⌥⇧T**.

## Update

From your clone:

```bash
git pull --ff-only && bash install.sh
```

Saved themes and settings are kept.

## Uninstall

```bash
bash uninstall.sh
```

If you deleted the clone:

```bash
bash "$HOME/Library/Application Support/Claudrobe/uninstall.sh"
```

Saved themes and settings are kept for a future reinstall.

Palettes adapted from [cctheme](https://github.com/Burzu8/cctheme) (MIT).
