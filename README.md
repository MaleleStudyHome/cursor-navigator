# Cursor Navigator

> [English](#english) | [中文](#中文)
>
> Fork of [dy-sh/remember-cursor-position](https://github.com/dy-sh/remember-cursor-position) by Dmitry Savosh, with significant enhancements.

---

## English

An Obsidian plugin that **remembers cursor and scroll positions** for each note, and adds **VS Code-style global cursor navigation history** with `Alt + ←` and `Alt + →`.

### Features

- **Per-note position memory**: Automatically saves and restores cursor position and scroll viewport for every note
- **Global back/forward navigation**: `Alt + ←` / `Alt + →` to jump between cursor positions across different notes, like VS Code or a web browser
- **Tab switch tracking**: When you click a different tab, the plugin automatically records the position you left — so `Alt + ←` takes you back to where you were in the previous tab
- **Link jump tracking**: When a link opens in a new tab, the source position is recorded — navigate back to the exact spot where you clicked the link
- **Smart history deduplication**: Consecutive entries from the same file at similar positions are merged, avoiding noisy history
- **Input validation**: Filters out invalid entries like embed references (`![[...`), non-markdown files, and path traversal
- **Auto cleanup**: On startup, automatically purges invalid entries (`![[...` etc.) from the database
- **Configurable thresholds**: Set minimum line change and scroll distance before recording history entries
- **Chinese / English UI**: Settings page automatically displays Chinese when Obsidian uses a Chinese locale

### Default Shortcuts

| Action | Shortcut | Command Name |
| --- | --- | --- |
| Go back | `Alt + ←` | `Cursor navigator: Go back` |
| Go forward | `Alt + →` | `Cursor navigator: Go forward` |

- Customizable in **Settings → Hotkeys** (search `cursor`)
- Also available via **Command Palette** (`Ctrl+P`)

### How It Works

#### Per-note position memory

On every file open, the plugin restores the last saved cursor and scroll position. A background timer detects cursor/scroll changes and persists them to disk.

#### Global navigation history

The plugin maintains a global `past` / `future` stack:

1. **Record**: When you move the cursor beyond the configured threshold (or switch tabs), the previous position is pushed to the `past` stack
2. **Go back** (`Alt + ←`): Pops from `past`, pushes current position to `future`, jumps to the target
3. **Go forward** (`Alt + →`): Pops from `future`, pushes current position to `past`, jumps to the target

#### Tab switch tracking

When the active leaf (tab) changes:

1. The plugin detects the switch via `active-leaf-change` event
2. Records the cursor and scroll position of the **previous** tab
3. This position is pushed to the navigation history
4. So `Alt + ←` can take you back to where you were before clicking the tab

This works for both manual tab clicks and link-driven tab opens.

#### Smart deduplication

- **Same-file merge**: Consecutive entries from the same file at similar positions are collapsed into one
- **Threshold filtering**: Cursor moves smaller than the configured line/scroll threshold are ignored
- **Key dedup**: Identical (file + line + scroll) entries are skipped entirely

### Settings

| Setting | Description |
| --- | --- |
| Max history entries | Maximum number of global navigation positions to keep (default: 50). |
| Min line change to record | Cursor must move at least this many lines before the old position is recorded (default: 3). |
| Min scroll change to record | Scroll-only movement beyond this distance is also recorded (default: 80px). |
| Data file path | JSON file used to store cursor and history data. |
| Delay after opening a note | Delay before restoring position after a note is opened (default: 100ms). |
| Save interval | How often in-memory position data is written to disk (default: 5000ms). |

### Installation

**From Community Plugins:**

1. Open Obsidian → Settings → Community Plugins → Browse
2. Search for "Cursor Navigator"
3. Install and enable

**Manual:**

1. Download [`main.js`](https://github.com/MaleleStudyHome/cursor-navigator/releases/latest/download/main.js) and [`manifest.json`](https://github.com/MaleleStudyHome/cursor-navigator/releases/latest/download/manifest.json)
2. Create folder: `<your vault>/.obsidian/plugins/cursor-navigator/`
3. Place the files there
4. Enable in Settings → Community Plugins

### Attribution

Based on the original [Remember cursor position](https://github.com/dy-sh/remember-cursor-position) plugin by **Dmitry Savosh**, licensed under [MIT](LICENSE).

### License

MIT

---

## 中文

一个 Obsidian 插件，**自动记住每个笔记的光标和滚动位置**，并提供类似 **VS Code 的全局光标导航历史**（`Alt + ←` / `Alt + →` 前进后退）。

### 功能

- **记住每个笔记的光标位置**：自动保存并恢复每个笔记的光标位置和滚动视口
- **全局前进/后退导航**：`Alt + ←` / `Alt + →` 跨笔记跳转光标位置，类似 VS Code 或浏览器
- **标签切换追踪**：点击切换标签页时，自动记录离开时的光标位置——`Alt + ←` 可以回到上一个标签页的精确位置
- **链接跳转追踪**：链接在新标签页打开时，自动记录来源位置——可以导航回到点击链接时的精确位置
- **智能历史去重**：同文件的连续近似位置记录会自动合并，避免历史记录过于嘈杂
- **输入校验**：过滤无效条目，如嵌入引用（`![[...`）、非 Markdown 文件、路径遍历
- **自动清理**：启动时自动清除数据库中的无效条目（`![[...` 等）
- **可配置阈值**：设置最小行数变化和滚动距离，低于阈值的移动不记录
- **中英文界面**：设置页面根据 Obsidian 语言自动切换中文/英文

### 默认快捷键

| 操作 | 快捷键 | 命令名 |
| --- | --- | --- |
| 后退 | `Alt + ←` | `Cursor navigator: Go back` |
| 前进 | `Alt + →` | `Cursor navigator: Go forward` |

- 可在 **设置 → 快捷键** 搜 `cursor` 自行改键
- 也可用 **命令面板**（`Ctrl+P`）触发

### 工作原理

#### 记住笔记光标位置

每次打开文件时，插件自动恢复上次保存的光标和滚动位置。后台定时器检测光标/滚动变化并持久化到磁盘。

#### 全局导航历史

插件维护一个全局的 `past` / `future` 栈：

1. **记录**：当光标移动超过配置的阈值（或切换标签页）时，上一个位置被压入 `past` 栈
2. **后退**（`Alt + ←`）：从 `past` 弹出，将当前位置压入 `future`，跳转到目标
3. **前进**（`Alt + →`）：从 `future` 弹出，将当前位置压入 `past`，跳转到目标

#### 标签切换追踪

当活跃叶子（标签页）发生变化时：

1. 插件通过 `active-leaf-change` 事件检测切换
2. 记录**上一个**标签页的光标和滚动位置
3. 该位置被压入导航历史
4. `Alt + ←` 可以带你回到点击标签页之前的位置

适用于手动点击标签页和通过链接打开新标签页两种场景。

#### 智能去重

- **同文件合并**：同文件的连续近似位置记录会被合并为一条
- **阈值过滤**：小于配置的行数/滚动阈值的光标移动被忽略
- **键去重**：完全相同的（文件 + 行 + 滚动位置）条目会被跳过

### 设置

| 设置项 | 说明 |
| --- | --- |
| 最大历史条数 | 全局导航历史最多保留多少条（默认 50） |
| 最小行数变化 | 光标至少移动这么多行才记录历史（默认 3） |
| 最小滚动变化 | 仅滚动时超过此距离才记录（默认 80px） |
| 数据文件路径 | 用于存储光标和历史数据的 JSON 文件 |
| 打开笔记后延迟 | 打开笔记后恢复位置的延迟时间（默认 100ms） |
| 保存间隔 | 内存中的位置数据多久写入一次磁盘（默认 5000ms） |

### 安装

**从社区插件市场：**

1. Obsidian → 设置 → 第三方插件 → 浏览
2. 搜索 "Cursor Navigator"
3. 安装并启用

**手动安装：**

1. 下载 [`main.js`](https://github.com/MaleleStudyHome/cursor-navigator/releases/latest/download/main.js) 和 [`manifest.json`](https://github.com/MaleleStudyHome/cursor-navigator/releases/latest/download/manifest.json)
2. 创建文件夹：`<你的 vault>/.obsidian/plugins/cursor-navigator/`
3. 把文件放入
4. 在 设置 → 第三方插件 中启用

### 致谢

基于 **Dmitry Savosh** 的原始插件 [Remember cursor position](https://github.com/dy-sh/remember-cursor-position)，在 [MIT 许可证](LICENSE) 下分发。

### 许可

MIT
