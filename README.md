# Cursor Navigator

> Fork of [dy-sh/remember-cursor-position](https://github.com/dy-sh/remember-cursor-position) by Dmitry Savosh, with additional features.

An Obsidian plugin that remembers cursor and scroll positions for each note, and adds **VS Code-style global cursor navigation history** with `Alt + ←` and `Alt + →`.

## Features

### Remember last position per note

Automatically records the last cursor position and scroll position for each Markdown note. When you reopen a note, Obsidian returns to where you left off.

### Cursor navigation history (new in this fork)

Global cursor navigation history, similar to VS Code / web browser:

- `Alt + ←` — go back to the previous cursor position
- `Alt + →` — go forward to the next cursor position

Works across different notes. The history is global.

### Configurable recording sensitivity

Does not record every tiny cursor movement. Configurable thresholds:

- Minimum line change to record history
- Minimum scroll distance to record history
- Maximum number of history entries to keep

### Chinese / English settings UI

The settings page automatically displays Chinese when Obsidian is using a Chinese locale. Other languages use English.

## Settings

| Setting | Description |
| --- | --- |
| Max history entries | Maximum number of global navigation positions to keep. |
| Min line change to record | Cursor must move at least this many lines before the old position is recorded. |
| Min scroll change to record | Scroll-only movement beyond this distance is also recorded. |
| Data file path | JSON file used to store cursor and history data. |
| Delay after opening a note | Delay before restoring position after a note is opened. |
| Save interval | How often in-memory position data is written to disk. Default is 5000ms. |

## Installation

### From Community Plugins

1. Open Obsidian → Settings → Community Plugins → Browse
2. Search for "Cursor Navigator"
3. Install and enable

### Manual installation

1. Download [`main.js`](https://github.com/MaleleStudyHome/cursor-navigator/releases/latest/download/main.js) and [`manifest.json`](https://github.com/MaleleStudyHome/cursor-navigator/releases/latest/download/manifest.json)
2. Create folder: `<your-vault>/.obsidian/plugins/cursor-navigator/`
3. Place the files there
4. Enable in Settings → Community Plugins

## Usage

1. Open a Markdown note.
2. Move around the note or jump to another note.
3. Press `Alt + ←` to go back to a previous cursor position.
4. Press `Alt + →` to go forward again.

## Attribution

Based on the original [Remember cursor position](https://github.com/dy-sh/remember-cursor-position) plugin by **Dmitry Savosh**, licensed under [MIT](LICENSE).

## License

[MIT](LICENSE)
