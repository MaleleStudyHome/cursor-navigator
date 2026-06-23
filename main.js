/*
 * Remember Cursor Position - Enhanced
 * =====================================
 * Original: remember cursor and scroll position for each note.
 * Enhanced: global cursor navigation history with Alt+Left / Alt+Right.
 *
 * Based on original plugin by Dmitry Savosh: https://github.com/dy-sh/
 */

'use strict';

var obsidian = require('obsidian');

/******************************************************************************
Copyright (c) Microsoft Corporation.
***************************************************************************** */
function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

const SAFE_DB_FLUSH_INTERVAL = 5000;
const GLOBAL_NAV_KEY = '__global_nav__';

const DEFAULT_SETTINGS = {
    dbFileName: '.obsidian/plugins/cursor-navigator/cursor-positions.json',
    delayAfterFileOpening: 100,
    saveTimer: SAFE_DB_FLUSH_INTERVAL,
    maxHistorySize: 50,
    minLineChangeForHistory: 3,
    minScrollChangeForHistory: 80,
};

const I18N = {
    zh: {
        settingTitle: '记住光标位置 — 设置',
        navSection: '🕮 光标导航历史',
        navDesc: '记录光标移动历史，实现类似 VS Code / 浏览器的「前进 / 后退」导航。',
        navKbBack: '默认快捷键：Alt + ←（左方向键）→ 回到上一个光标位置',
        navKbForward: '默认快捷键：Alt + →（右方向键）→ 前进到下一个光标位置',
        maxHistory: '最大历史条数',
        maxHistoryDesc: '全局最多保存多少个历史位置。超过后会删除最旧的记录。',
        minLineChange: '触发记录的最小行数变化',
        minLineChangeDesc: '光标上下移动超过此行数时，旧位置才会被记录。数值小更灵敏，数值大更干净。',
        minScrollChange: '触发记录的最小滚动距离（像素）',
        minScrollChangeDesc: '纯滚动超过此距离时也会记录，适合阅读时返回之前的滚动位置。',
        generalSection: '⚙ 通用设置',
        dbFileName: '数据文件路径',
        dbFileNameDesc: '光标位置数据保存到哪个 JSON 文件。',
        delayAfterOpen: '打开笔记后的延迟',
        delayAfterOpenDesc: '打开笔记后等待多久再恢复位置。若链接到标题时被误滚动，可适当调大。',
        saveInterval: '数据保存间隔',
        saveIntervalDesc: '多久把内存中的位置数据写入硬盘。默认 5000ms，即 5 秒。',
        noHistory: '📌 当前暂无光标导航历史',
        historyInfo: function (past, future, max) { return `📌 光标历史：后退 ${past} 条 ← | 前进 ${future} 条 →（上限 ${max} 条）`; },
    },
    en: {
        settingTitle: 'Remember Cursor Position — Settings',
        navSection: '🕮 Cursor Navigation History',
        navDesc: 'Tracks cursor movement history, enabling forward/back navigation like VS Code or a browser.',
        navKbBack: 'Default hotkey: Alt + ← (Left Arrow) → Go back to previous cursor position',
        navKbForward: 'Default hotkey: Alt + → (Right Arrow) → Go forward to next cursor position',
        maxHistory: 'Max history entries',
        maxHistoryDesc: 'Maximum number of global navigation positions to keep. Oldest entries are discarded when exceeded.',
        minLineChange: 'Min line change to record history',
        minLineChangeDesc: 'The cursor must move at least this many lines before the old position is recorded.',
        minScrollChange: 'Min scroll change to record history (pixels)',
        minScrollChangeDesc: 'Scroll-only movement beyond this distance is also recorded.',
        generalSection: '⚙ General',
        dbFileName: 'Data file path',
        dbFileNameDesc: 'The JSON file used to store cursor position data.',
        delayAfterOpen: 'Delay after opening a note',
        delayAfterOpenDesc: 'How long to wait before restoring position after opening a note.',
        saveInterval: 'Save interval',
        saveIntervalDesc: 'How often in-memory position data is flushed to disk. Default is 5000ms, i.e. 5 seconds.',
        noHistory: '📌 No cursor navigation history yet.',
        historyInfo: function (past, future, max) { return `📌 Cursor History: ${past} back ← | ${future} forward → (max ${max})`; },
    },
};

class RememberCursorPosition extends obsidian.Plugin {
    constructor() {
        super(...arguments);
        this.loadedLeafIdList = [];
        this.loadingFile = false;
        this.isNavigating = false;
        this.pendingNavigationTarget = null;
        this.locale = 'en';
        this.lastActiveLeaf = null;
        this.lastActiveLeafFile = null;
    }

    /**
     * Check if a file path is valid for cursor tracking.
     * Rejects embed references like "![[Note.md", invalid paths, etc.
     */
    isValidFilePath(fileName) {
        if (!fileName || typeof fileName !== 'string') return false;
        // Reject Obsidian embed references: ![[something
        if (fileName.startsWith('!')) return false;
        // Must end with a known markdown extension
        if (!/\.(md|markdown|txt)$/i.test(fileName)) return false;
        // No path traversal or control characters
        if (fileName.includes('..') || fileName.includes('\0')) return false;
        return true;
    }

    onload() {
        return __awaiter(this, void 0, void 0, function* () {
            this.locale = this.detectLocale();
            yield this.loadSettings();

            try {
                this.db = yield this.readDb();
                this.lastSavedDb = JSON.parse(JSON.stringify(this.db));
            }
            catch (e) {
                console.error("Remember Cursor Position plugin can't read database: " + e);
                this.db = {};
                this.lastSavedDb = {};
            }
            this.ensureGlobalNav();

            // Clean up invalid entries from database (e.g., embed references)
            this.cleanupInvalidDbEntries();

            this.addSettingTab(new SettingTab(this.app, this));

            this.addCommand({
                id: 'navigate-back',
                name: 'Cursor history: Go back',
                hotkeys: [{ modifiers: ['Alt'], key: 'ArrowLeft' }],
                callback: () => this.navigateBack(),
            });

            this.addCommand({
                id: 'navigate-forward',
                name: 'Cursor history: Go forward',
                hotkeys: [{ modifiers: ['Alt'], key: 'ArrowRight' }],
                callback: () => this.navigateForward(),
            });

            this.addCommand({
                id: 'show-history-info',
                name: 'Cursor history: Show history info',
                callback: () => this.showHistoryInfo(),
            });

            this.registerEvent(this.app.workspace.on('file-open', () => this.restoreEphemeralState()));
            this.registerEvent(this.app.workspace.on('active-leaf-change', (leaf) => this.handleActiveLeafChange(leaf)));
            this.registerEvent(this.app.workspace.on('quit', () => { this.writeDb(this.db); }));
            this.registerEvent(this.app.vault.on('rename', (file, oldPath) => this.renameFile(file, oldPath)));
            this.registerEvent(this.app.vault.on('delete', (file) => this.deleteFile(file)));

            this.registerInterval(window.setInterval(() => this.checkEphemeralStateChanged(), 100));
            this.registerInterval(window.setInterval(() => this.writeDb(this.db), this.settings.saveTimer));

            // Initialize lastActiveLeaf with the current active leaf
            const initialLeaf = this.app.workspace.getMostRecentLeaf();
            if (initialLeaf) {
                this.lastActiveLeaf = initialLeaf;
                this.lastActiveLeafFile = this.getLeafFile(initialLeaf);
            }

            this.restoreEphemeralState();
        });
    }

    onunload() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.writeDb(this.db);
        });
    }

    detectLocale() {
        try {
            const candidates = [
                this.app.vault && this.app.vault.getConfig ? this.app.vault.getConfig('language') : '',
                this.app.vault && this.app.vault.getConfig ? this.app.vault.getConfig('locale') : '',
                this.app && this.app.vault && this.app.vault.config ? this.app.vault.config.language : '',
                this.app && this.app.vault && this.app.vault.config ? this.app.vault.config.locale : '',
                obsidian.moment && obsidian.moment.locale ? obsidian.moment.locale() : '',
                window.moment && window.moment.locale ? window.moment.locale() : '',
                document && document.documentElement ? document.documentElement.lang : '',
                window.localStorage ? window.localStorage.getItem('language') : '',
                window.localStorage ? window.localStorage.getItem('locale') : '',
            ];
            for (const item of candidates) {
                const lang = String(item || '').toLowerCase();
                if (lang.startsWith('zh') || lang.includes('chinese')) return 'zh';
            }
        }
        catch (e) { }
        return 'en';
    }

    t(key) {
        const dict = I18N[this.locale] || I18N.en;
        return dict[key] || I18N.en[key] || key;
    }

    ensureGlobalNav() {
        if (!this.db) this.db = {};
        if (!this.db[GLOBAL_NAV_KEY]) {
            this.db[GLOBAL_NAV_KEY] = { past: [], future: [] };
        }
        if (!Array.isArray(this.db[GLOBAL_NAV_KEY].past)) this.db[GLOBAL_NAV_KEY].past = [];
        if (!Array.isArray(this.db[GLOBAL_NAV_KEY].future)) this.db[GLOBAL_NAV_KEY].future = [];
        return this.db[GLOBAL_NAV_KEY];
    }

    /**
     * Remove invalid entries from the database on startup.
     * This cleans up entries caused by embed references (![[), non-markdown files, etc.
     */
    cleanupInvalidDbEntries() {
        let dirty = false;
        for (const key in this.db) {
            if (key === GLOBAL_NAV_KEY) {
                // Clean nav history
                const nav = this.db[GLOBAL_NAV_KEY];
                if (nav.past) {
                    const before = nav.past.length;
                    nav.past = nav.past.filter((e) => e.file && this.isValidFilePath(e.file));
                    if (nav.past.length !== before) dirty = true;
                }
                if (nav.future) {
                    const before = nav.future.length;
                    nav.future = nav.future.filter((e) => e.file && this.isValidFilePath(e.file));
                    if (nav.future.length !== before) dirty = true;
                }
            } else {
                // Clean per-file entries
                if (!this.isValidFilePath(key)) {
                    delete this.db[key];
                    dirty = true;
                }
            }
        }
        // Also clean up stale per-file entries that are actually embed references stored as keys
        // (they don't end with .md but somehow got in)
        if (dirty) {
            this.writeDb(this.db);
        }
    }

    navigateBack() {
        const nav = this.ensureGlobalNav();
        if (!nav.past.length) {
            return;
        }

        const currentEntry = this.getCurrentNavEntry();
        if (currentEntry) nav.future.push(currentEntry);

        const target = nav.past.pop();
        this.navigateToEntry(target);
    }

    navigateForward() {
        const nav = this.ensureGlobalNav();
        if (!nav.future.length) return;

        const currentEntry = this.getCurrentNavEntry();
        if (currentEntry) nav.past.push(currentEntry);

        const target = nav.future.pop();
        this.navigateToEntry(target);
    }

    getCurrentNavEntry() {
        var _a;
        const fileName = (_a = this.app.workspace.getActiveFile()) === null || _a === void 0 ? void 0 : _a.path;
        const state = this.getEphemeralState();
        if (!fileName || !state || !state.cursor) return null;
        return {
            file: fileName,
            scroll: state.scroll,
            cursor: state.cursor,
        };
    }

    navigateToEntry(entry) {
        if (!entry || !entry.file || !this.isValidFilePath(entry.file)) {
            this.isNavigating = false;
            return;
        }
        const activeFile = this.app.workspace.getActiveFile();
        this.isNavigating = true;

        if (activeFile && activeFile.path === entry.file) {
            this.setEphemeralState(entry);
            this.lastEphemeralState = { scroll: entry.scroll, cursor: entry.cursor };
            this.updateLastPosition(entry.file, entry);
            window.setTimeout(() => { this.isNavigating = false; }, 500);
            return;
        }

        const targetFile = this.app.vault.getAbstractFileByPath(entry.file);
        if (!targetFile) {
            this.isNavigating = false;
            return;
        }

        this.pendingNavigationTarget = entry;

        // Use the most recent leaf directly instead of getLeaf() to avoid
        // interference from open-tab-settings' monkey-patching of getLeaf().
        const leaf = this.app.workspace.getMostRecentLeaf();
        if (leaf) {
            leaf.openFile(targetFile).catch((e) => {
                console.error('Remember Cursor Position: failed to open target file', e);
                this.pendingNavigationTarget = null;
                this.isNavigating = false;
            });
        } else {
            this.app.workspace.getLeaf(false).openFile(targetFile).catch((e) => {
                console.error('Remember Cursor Position: failed to open target file', e);
                this.pendingNavigationTarget = null;
                this.isNavigating = false;
            });
        }

        window.setTimeout(() => {
            if (this.isNavigating && this.pendingNavigationTarget === entry) {
                this.pendingNavigationTarget = null;
                this.isNavigating = false;
            }
        }, 2500);
    }

    showHistoryInfo() {
        const nav = this.ensureGlobalNav();
        if (!nav.past.length && !nav.future.length) {
            new obsidian.Notice(this.t('noHistory'), 4000);
            return;
        }
        const formatter = this.t('historyInfo');
        const text = typeof formatter === 'function'
            ? formatter(nav.past.length, nav.future.length, this.settings.maxHistorySize)
            : `Cursor History: ${nav.past.length} back, ${nav.future.length} forward`;
        new obsidian.Notice(text, 5000);
    }

    pushToHistory(fileName, state) {
        if (!fileName || !this.isValidFilePath(fileName) || !state || !state.cursor || this.isNavigating) {
            return;
        }
        const nav = this.ensureGlobalNav();

        // Also check for stale entries with invalid paths in the nav history and clean them
        if (nav.past.length) {
            nav.past = nav.past.filter((e) => e.file && this.isValidFilePath(e.file));
        }
        if (nav.future.length) {
            nav.future = nav.future.filter((e) => e.file && this.isValidFilePath(e.file));
        }

        const last = nav.past.length ? nav.past[nav.past.length - 1] : null;

        // Dedup: skip if the new entry is the same file + same line + same scroll as the last entry
        if (last && last.file === fileName && last.cursor) {
            const lineDiff = Math.abs(state.cursor.from.line - last.cursor.from.line);
            const scrollDiff = Math.abs((state.scroll || 0) - (last.scroll || 0));
            if (lineDiff < this.settings.minLineChangeForHistory &&
                scrollDiff < this.settings.minScrollChangeForHistory) {
                return;
            }
        }

        // Merge consecutive same-file entries: keep only the most significant position changes
        this.mergeConsecutiveSameFileEntries(nav);

        nav.past.push({
            file: fileName,
            scroll: state.scroll,
            cursor: state.cursor,
        });
        nav.future = [];

        while (nav.past.length > this.settings.maxHistorySize) {
            nav.past.shift();
        }
    }

    /**
     * Merge consecutive entries from the same file in the past stack.
     * If the top of the stack has multiple entries from the same file,
     * keep only the first and last of each consecutive group (boundary points).
     * This reduces noise from browsing within a single file.
     */
    mergeConsecutiveSameFileEntries(nav) {
        if (nav.past.length < 3) return;
        const minLine = this.settings.minLineChangeForHistory;
        const minScroll = this.settings.minScrollChangeForHistory;

        // Work from the top of the stack backwards
        let i = nav.past.length - 1;
        while (i >= 1) {
            const curr = nav.past[i];
            const prev = nav.past[i - 1];
            if (prev.file === curr.file && prev.cursor && curr.cursor) {
                const lineDiff = Math.abs(curr.cursor.from.line - prev.cursor.from.line);
                const scrollDiff = Math.abs((curr.scroll || 0) - (prev.scroll || 0));
                if (lineDiff < minLine && scrollDiff < minScroll) {
                    // The two entries are too close — keep the newer one (curr), drop prev
                    nav.past.splice(i - 1, 1);
                    i--; // i now points to what was i-2 (since we removed i-1), but we decremented i so it's correct
                } else {
                    i--;
                }
            } else {
                i--;
            }
        }
    }

    checkEphemeralStateChanged() {
        var _a;
        const fileName = (_a = this.app.workspace.getActiveFile()) === null || _a === void 0 ? void 0 : _a.path;
        if (!fileName || !this.lastLoadedFileName || fileName !== this.lastLoadedFileName || this.loadingFile) return;

        const state = this.getEphemeralState();
        if (!this.lastEphemeralState) {
            this.lastEphemeralState = state;
            return;
        }

        if (!this.isEphemeralStatesEquals(state, this.lastEphemeralState)) {
            if (!this.isNavigating) this.pushToHistory(fileName, this.lastEphemeralState);
            this.saveEphemeralState(state);
            this.lastEphemeralState = state;
        }
    }

    isEphemeralStatesEquals(state1, state2) {
        if (!state1 || !state2) return false;
        if (!!state1.cursor !== !!state2.cursor) return false;
        if (state1.cursor) {
            if (state1.cursor.from.ch !== state2.cursor.from.ch) return false;
            if (state1.cursor.from.line !== state2.cursor.from.line) return false;
            if (state1.cursor.to.ch !== state2.cursor.to.ch) return false;
            if (state1.cursor.to.line !== state2.cursor.to.line) return false;
        }
        const scroll1 = Number(state1.scroll || 0);
        const scroll2 = Number(state2.scroll || 0);
        if (scroll1 !== scroll2) return false;
        return true;
    }

    saveEphemeralState(state) {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const fileName = (_a = this.app.workspace.getActiveFile()) === null || _a === void 0 ? void 0 : _a.path;
            if (fileName && fileName === this.lastLoadedFileName) {
                this.updateLastPosition(fileName, state);
            }
        });
    }

    updateLastPosition(fileName, state) {
        if (!fileName || fileName === GLOBAL_NAV_KEY) return;
        const existing = this.db[fileName] || {};
        this.db[fileName] = Object.assign({}, existing, {
            scroll: state.scroll,
            cursor: state.cursor,
        });
    }

    restoreEphemeralState() {
        var _a;
        return __awaiter(this, void 0, void 0, function* () {
            const fileName = (_a = this.app.workspace.getActiveFile()) === null || _a === void 0 ? void 0 : _a.path;
            // Skip invalid file paths (embed references, non-markdown, etc.)
            if (fileName && !this.isValidFilePath(fileName)) return;
            if (fileName && this.loadingFile && this.lastLoadedFileName === fileName) return;

            const activeLeaf = this.app.workspace.getMostRecentLeaf();
            const leafAlreadyLoaded = activeLeaf && this.loadedLeafIdList.includes(activeLeaf.id + ':' + activeLeaf.getViewState().state.file);

            this.loadedLeafIdList = [];
            this.app.workspace.iterateAllLeaves((leaf) => {
                if (leaf.getViewState().type === 'markdown') {
                    this.loadedLeafIdList.push(leaf.id + ':' + leaf.getViewState().state.file);
                }
            });

            if (leafAlreadyLoaded) {
                // The leaf was already loaded (e.g., navigating back to a previously open tab).
                // We still need to update lastLoadedFileName and lastEphemeralState so that
                // checkEphemeralStateChanged can continue tracking cursor changes.
                if (this.lastLoadedFileName !== fileName) {
                    // Record the old file's position before switching
                    if (this.lastLoadedFileName && this.lastEphemeralState && !this.isNavigating) {
                        this.pushToHistory(this.lastLoadedFileName, this.lastEphemeralState);
                    }
                    this.lastLoadedFileName = fileName;
                    // Re-read current state so the 100ms timer picks up changes from here
                    const currentState = this.getEphemeralState();
                    this.lastEphemeralState = currentState || {};
                }
                return;
            }

            if (this.lastLoadedFileName && this.lastLoadedFileName !== fileName && this.lastEphemeralState && !this.isNavigating) {
                this.pushToHistory(this.lastLoadedFileName, this.lastEphemeralState);
            }

            this.loadingFile = true;

            if (this.lastLoadedFileName !== fileName) {
                this.lastEphemeralState = {};
                this.lastLoadedFileName = fileName;

                let state;
                if (fileName) {
                    if (this.pendingNavigationTarget && this.pendingNavigationTarget.file === fileName) {
                        state = this.pendingNavigationTarget;
                        this.pendingNavigationTarget = null;
                    }
                    else {
                        state = this.db[fileName];
                    }

                    if (state && state.cursor) {
                        yield this.delay(this.settings.delayAfterFileOpening);
                        for (let i = 0; i < 20; i++) {
                            const view = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
                            const scroll = view === null || view === void 0 ? void 0 : view.currentMode === null || view.currentMode === void 0 ? void 0 : view.currentMode.getScroll();
                            if (scroll !== null && scroll !== undefined) break;
                            yield this.delay(10);
                        }
                        yield this.delay(10);
                        this.setEphemeralState(state);
                        this.lastEphemeralState = { scroll: state.scroll, cursor: state.cursor };
                        this.updateLastPosition(fileName, state);
                    }
                    else {
                        this.lastEphemeralState = state || {};
                    }
                }
            }

            this.loadingFile = false;
            this.isNavigating = false;
        });
    }

    getEphemeralState() {
        var _a, _b, _c;
        const state = {};
        state.scroll = Number((_c = (_b = (_a = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView)) === null || _a === void 0 ? void 0 : _a.currentMode) === null || _b === void 0 ? void 0 : _b.getScroll()) === null || _c === void 0 ? void 0 : _c.toFixed(4));
        if (isNaN(state.scroll)) state.scroll = 0;

        const editor = this.getEditor();
        if (editor) {
            const from = editor.getCursor('anchor');
            const to = editor.getCursor('head');
            if (from && to) {
                state.cursor = {
                    from: { ch: from.ch, line: from.line },
                    to: { ch: to.ch, line: to.line },
                };
            }
        }
        return state;
    }

    setEphemeralState(state) {
        const view = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView);
        if (!state) return;

        if (state.cursor) {
            const editor = this.getEditor();
            if (editor) {
                try {
                    editor.setSelection(state.cursor.from, state.cursor.to);
                    if (editor.scrollIntoView) {
                        editor.scrollIntoView({ from: state.cursor.from, to: state.cursor.to }, true);
                    }
                }
                catch (e) { }
            }
        }

        if (view && state.scroll !== undefined && state.scroll !== null) {
            view.setEphemeralState({ scroll: state.scroll });
        }
    }

    getEditor() {
        var _a;
        return (_a = this.app.workspace.getActiveViewOfType(obsidian.MarkdownView)) === null || _a === void 0 ? void 0 : _a.editor;
    }

    /**
     * Get the file path associated with a leaf, if any.
     */
    getLeafFile(leaf) {
        if (!leaf) return null;
        try {
            var _a;
            const viewState = leaf.getViewState();
            if (!viewState || !viewState.state) return null;
            const file = (_a = viewState.state.file) !== null && _a !== void 0 ? _a : viewState.state.path;
            return file || null;
        } catch (e) {
            return null;
        }
    }

    /**
     * Handle active leaf change event — records the previous tab's position
     * so the user can navigate back with Alt+Left.
     */
    handleActiveLeafChange(leaf) {
        if (!leaf || this.isNavigating || this.loadingFile) return;

        const newFile = this.getLeafFile(leaf);

        // If there was a previous active leaf with a different file, record it
        if (this.lastActiveLeaf && this.lastActiveLeafFile && this.lastActiveLeafFile !== newFile) {
            if (this.lastActiveLeaf === leaf) {
                // SAME LEAF, DIFFERENT FILE: The leaf's editor has already transitioned
                // to the new file. We CANNOT read the old file's position from the editor.
                // Use lastEphemeralState (maintained by 100ms polling) or fall back to DB.
                if (this.lastEphemeralState && this.lastEphemeralState.cursor) {
                    this.pushToHistory(this.lastActiveLeafFile, this.lastEphemeralState);
                } else {
                    const savedState = this.db[this.lastActiveLeafFile];
                    if (savedState && savedState.cursor) {
                        this.pushToHistory(this.lastActiveLeafFile, savedState);
                    }
                }
            } else {
                // DIFFERENT LEAF: The old leaf's editor should still have the old file's state.
                // Try reading from the old leaf's editor, with DB fallback.
                const oldView = this.lastActiveLeaf.view;
                if (oldView && oldView.editor && oldView.currentMode) {
                    try {
                        const editor = oldView.editor;
                        const from = editor.getCursor('anchor');
                        const to = editor.getCursor('head');
                        let scroll = 0;
                        try {
                            scroll = oldView.currentMode.getScroll();
                            if (typeof scroll === 'number') scroll = Number(scroll.toFixed(4));
                        } catch (e) { scroll = 0; }

                        if (from && to) {
                            this.pushToHistory(this.lastActiveLeafFile, {
                                scroll: scroll,
                                cursor: {
                                    from: { ch: from.ch, line: from.line },
                                    to: { ch: to.ch, line: to.line },
                                },
                            });
                        }
                    } catch (e) {
                        // Editor might not be accessible — fall back to db-stored position
                        const savedState = this.db[this.lastActiveLeafFile];
                        if (savedState && savedState.cursor) {
                            this.pushToHistory(this.lastActiveLeafFile, savedState);
                        }
                    }
                } else {
                    // Fall back to db-stored position for the old leaf's file
                    const savedState = this.db[this.lastActiveLeafFile];
                    if (savedState && savedState.cursor) {
                        this.pushToHistory(this.lastActiveLeafFile, savedState);
                    }
                }
            }
        }

        this.lastActiveLeaf = leaf;
        this.lastActiveLeafFile = newFile;
    }

    renameFile(file, oldPath) {
        const newName = file.path;
        this.db[newName] = this.db[oldPath];
        delete this.db[oldPath];

        const nav = this.ensureGlobalNav();
        for (const entry of nav.past.concat(nav.future)) {
            if (entry.file === oldPath) entry.file = newName;
        }
    }

    deleteFile(file) {
        const fileName = file.path;
        delete this.db[fileName];

        const nav = this.ensureGlobalNav();
        nav.past = nav.past.filter((entry) => entry.file !== fileName);
        nav.future = nav.future.filter((entry) => entry.file !== fileName);
    }

    readDb() {
        return __awaiter(this, void 0, void 0, function* () {
            let db = {};
            if (yield this.app.vault.adapter.exists(this.settings.dbFileName)) {
                const data = yield this.app.vault.adapter.read(this.settings.dbFileName);
                db = JSON.parse(data);
            }
            return db;
        });
    }

    writeDb(db) {
        return __awaiter(this, void 0, void 0, function* () {
            if (!db) return;
            const lastSlash = this.settings.dbFileName.lastIndexOf('/');
            if (lastSlash > 0) {
                const parentFolder = this.settings.dbFileName.substring(0, lastSlash);
                if (!(yield this.app.vault.adapter.exists(parentFolder))) {
                    yield this.app.vault.adapter.mkdir(parentFolder);
                }
            }
            if (JSON.stringify(db) !== JSON.stringify(this.lastSavedDb)) {
                yield this.app.vault.adapter.write(this.settings.dbFileName, JSON.stringify(db));
                this.lastSavedDb = JSON.parse(JSON.stringify(db));
            }
        });
    }

    loadSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            const settings = Object.assign({}, DEFAULT_SETTINGS, yield this.loadData());
            if ((settings === null || settings === void 0 ? void 0 : settings.saveTimer) < SAFE_DB_FLUSH_INTERVAL) {
                settings.saveTimer = SAFE_DB_FLUSH_INTERVAL;
            }
            this.settings = settings;
        });
    }

    saveSettings() {
        return __awaiter(this, void 0, void 0, function* () {
            yield this.saveData(this.settings);
        });
    }

    delay(ms) {
        return __awaiter(this, void 0, void 0, function* () {
            return new Promise(resolve => setTimeout(resolve, ms));
        });
    }
}

class SettingTab extends obsidian.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display() {
        const { containerEl } = this;
        const plugin = this.plugin;
        containerEl.empty();

        containerEl.createEl('h2', { text: plugin.t('settingTitle') });

        containerEl.createEl('h3', { text: plugin.t('navSection') });
        const desc = containerEl.createEl('div', { cls: 'setting-item-description' });
        desc.createEl('p', { text: plugin.t('navDesc') });
        desc.createEl('p', { text: plugin.t('navKbBack') });
        desc.createEl('p', { text: plugin.t('navKbForward') });

        new obsidian.Setting(containerEl)
            .setName(plugin.t('maxHistory'))
            .setDesc(plugin.t('maxHistoryDesc'))
            .addSlider((slider) => slider
            .setLimits(10, 200, 5)
            .setValue(plugin.settings.maxHistorySize)
            .setDynamicTooltip()
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            plugin.settings.maxHistorySize = value;
            yield plugin.saveSettings();
        })));

        new obsidian.Setting(containerEl)
            .setName(plugin.t('minLineChange'))
            .setDesc(plugin.t('minLineChangeDesc'))
            .addSlider((slider) => slider
            .setLimits(1, 30, 1)
            .setValue(plugin.settings.minLineChangeForHistory)
            .setDynamicTooltip()
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            plugin.settings.minLineChangeForHistory = value;
            yield plugin.saveSettings();
        })));

        new obsidian.Setting(containerEl)
            .setName(plugin.t('minScrollChange'))
            .setDesc(plugin.t('minScrollChangeDesc'))
            .addSlider((slider) => slider
            .setLimits(20, 500, 10)
            .setValue(plugin.settings.minScrollChangeForHistory)
            .setDynamicTooltip()
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            plugin.settings.minScrollChangeForHistory = value;
            yield plugin.saveSettings();
        })));

        containerEl.createEl('h3', { text: plugin.t('generalSection') });

        new obsidian.Setting(containerEl)
            .setName(plugin.t('dbFileName'))
            .setDesc(plugin.t('dbFileNameDesc'))
            .addText((text) => text
            .setPlaceholder('Example: cursor-positions.json')
            .setValue(plugin.settings.dbFileName)
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            plugin.settings.dbFileName = value;
            yield plugin.saveSettings();
        })));

        new obsidian.Setting(containerEl)
            .setName(plugin.t('delayAfterOpen'))
            .setDesc(plugin.t('delayAfterOpenDesc'))
            .addSlider((slider) => slider
            .setLimits(0, 300, 10)
            .setValue(plugin.settings.delayAfterFileOpening)
            .setDynamicTooltip()
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            plugin.settings.delayAfterFileOpening = value;
            yield plugin.saveSettings();
        })));

        new obsidian.Setting(containerEl)
            .setName(plugin.t('saveInterval'))
            .setDesc(plugin.t('saveIntervalDesc'))
            .addSlider((slider) => slider
            .setLimits(SAFE_DB_FLUSH_INTERVAL, SAFE_DB_FLUSH_INTERVAL * 10, 10)
            .setValue(plugin.settings.saveTimer)
            .setDynamicTooltip()
            .onChange((value) => __awaiter(this, void 0, void 0, function* () {
            plugin.settings.saveTimer = value;
            yield plugin.saveSettings();
        })));
    }
}

module.exports = RememberCursorPosition;

/* nosourcemap */
