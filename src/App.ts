import { GameSession } from './game/GameSession';
import { LocalAdapter } from './network/LocalAdapter';
import { loadSettings, saveSettings } from './persistence/Settings';
import { WorldStorage } from './persistence/WorldStorage';
import { CreateWorldMenu, type CreateWorldData } from './ui/menu/CreateWorldMenu';
import { MainMenu } from './ui/menu/MainMenu';
import { MenuScreen } from './ui/menu/MenuScreen';
import { DeathScreen } from './ui/menu/DeathScreen';
import { PauseMenu } from './ui/menu/PauseMenu';
import { SettingsMenu } from './ui/menu/SettingsMenu';
import { WorldsMenu } from './ui/menu/WorldsMenu';
import {
  DEFAULT_KEYBINDINGS,
  DEFAULT_SETTINGS,
  GameMode,
  type AppState,
  type FurnaceState,
  type INetworkAdapter,
  type Settings,
  type WorldMetadata,
  type WorldSave,
} from './types';
import { serializeWorld, validateWorldExport } from './persistence/WorldSerializer';
import { deriveSeed } from './utils/Hash';

const TOAST_DURATION_MS = 2000;

export class App {
  private settings: Settings;
  private worldStorage: WorldStorage;
  private network: INetworkAdapter;

  private state: AppState = 'main_menu';
  private menuContainer!: HTMLElement;
  private hudContainer!: HTMLElement;
  private currentScreen: MenuScreen | null = null;
  private session: GameSession | null = null;
  private settingsReturnState: AppState = 'main_menu';
  /** Pending debounced settings save. window.setTimeout returns number in browsers. */
  private _settingsSaveTimer: number | null = null;
  private escKeyHandler!: (e: KeyboardEvent) => void;

  constructor() {
    this.settings = { ...DEFAULT_SETTINGS };
    this.worldStorage = new WorldStorage();
    this.network = new LocalAdapter();
  }

  async start(): Promise<void> {
    this.settings = loadSettings();

    const hud = document.getElementById('hud');
    if (hud === null) {
      throw new Error('App: #hud element not found in DOM');
    }
    this.hudContainer = hud;

    // Build menuContainer FIRST so _toast (which uses document.body, but conceptually
    // shares the menu lifecycle) can render even if storage init fails below.
    const menu = document.createElement('div');
    menu.id = 'menu';
    menu.style.position = 'fixed';
    menu.style.inset = '0';
    menu.style.pointerEvents = 'auto';
    menu.style.zIndex = '100';
    menu.style.display = 'flex';
    document.body.appendChild(menu);
    this.menuContainer = menu;

    try {
      await this.worldStorage.open();
      await this.network.connect();
    } catch (err) {
      console.error('App.start(): storage/network init failed:', err);
      this._toast('Storage unavailable — your worlds and settings will not persist this session.');
      // Continue with the in-memory worldStorage object as-is; subsequent calls
      // will fail and toast individually, but the menu UI remains usable.
    }

    this.escKeyHandler = (e: KeyboardEvent): void => {
      if (e.code !== 'Escape') return;
      switch (this.state) {
        case 'worlds':
          e.stopImmediatePropagation();
          void this._show('main_menu');
          break;
        case 'create_world':
          e.stopImmediatePropagation();
          void this._show('worlds');
          break;
        case 'settings':
          e.stopImmediatePropagation();
          this._flushSettingsSave();
          void this._show(this.settingsReturnState);
          break;
        case 'paused':
          // stopImmediatePropagation prevents GameSession's later-registered window
          // keydown handler from re-pausing immediately after we resume.
          e.stopImmediatePropagation();
          this._resumeSession();
          break;
        // main_menu / in_game / dead: do nothing (in_game ESC -> GameSession pauses; dead has its own buttons).
      }
    };
    window.addEventListener('keydown', this.escKeyHandler);

    void this._show('main_menu');
  }

  private async _show(state: AppState): Promise<void> {
    // If we're transitioning AWAY from in_game (and the session exists), tear it down.
    const leavingInGame =
      this.state === 'in_game' && state !== 'in_game' && state !== 'paused' && state !== 'dead';
    if (leavingInGame && this.session !== null) {
      try {
        await this.session.save();
      } catch (err) {
        console.error('Save on exit failed:', err);
        this._toast('Save on exit failed; world may be out of date.');
      }
      this.session.stop();
      this.session = null;
    }

    if (this.currentScreen !== null) {
      this.currentScreen.dispose();
      this.currentScreen = null;
    }

    this.state = state;

    switch (state) {
      case 'main_menu':
        this._setHudVisible(false);
        this._setMenuVisible(true);
        this.currentScreen = new MainMenu(this.menuContainer, {
          onSingleplayer: () => {
            void this._show('worlds');
          },
          onMultiplayer: () => {
            this._toast('Multiplayer coming soon — foundation only');
          },
          onSettings: () => {
            this.settingsReturnState = 'main_menu';
            void this._show('settings');
          },
          onQuit: () => {
            window.close();
            this._toast('Closing… (browsers may ignore this)');
          },
        });
        break;

      case 'worlds': {
        this._setHudVisible(false);
        this._setMenuVisible(true);
        let worlds: WorldMetadata[];
        try {
          worlds = await this.worldStorage.listWorlds();
        } catch (err) {
          console.error('listWorlds failed:', err);
          const msg = err instanceof Error ? err.message : String(err);
          this._toast('Failed to read worlds: ' + msg);
          void this._show('main_menu');
          return;
        }
        this.currentScreen = new WorldsMenu(this.menuContainer, worlds, {
          onCreate: () => {
            void this._show('create_world');
          },
          onLoad: (name: string) => {
            void this._loadWorld(name);
          },
          onDelete: (name: string) => {
            void this._deleteWorld(name);
          },
          onExport: (name: string) => {
            void this._exportWorld(name);
          },
          onImport: () => {
            this._importWorld();
          },
          onBack: () => {
            void this._show('main_menu');
          },
        });
        break;
      }

      case 'create_world': {
        this._setHudVisible(false);
        this._setMenuVisible(true);
        let worlds: WorldMetadata[];
        try {
          worlds = await this.worldStorage.listWorlds();
        } catch (err) {
          console.error('listWorlds failed:', err);
          const msg = err instanceof Error ? err.message : String(err);
          this._toast('Failed to read worlds: ' + msg);
          void this._show('main_menu');
          return;
        }
        const names = worlds.map((w) => w.name);
        this.currentScreen = new CreateWorldMenu(this.menuContainer, names, {
          onCreate: (data: CreateWorldData) => {
            void this._createWorld(data);
          },
          onCancel: () => {
            void this._show('worlds');
          },
        });
        break;
      }

      case 'paused':
        // Session is intentionally still alive; only show the overlay.
        this._setHudVisible(true);
        this._setMenuVisible(true);
        this.currentScreen = new PauseMenu(this.menuContainer, {
          onResume: () => this._resumeSession(),
          onSettings: () => {
            this.settingsReturnState = 'paused';
            void this._show('settings');
          },
          onQuitToMenu: () => {
            void this._quitToMenu();
          },
        });
        break;

      case 'dead':
        // Session stays alive so the player can respawn into the same world.
        this._setHudVisible(true);
        this._setMenuVisible(true);
        this.currentScreen = new DeathScreen(this.menuContainer, {
          onRespawn: () => this._respawnSession(),
          onQuitToMenu: () => {
            void this._quitToMenu();
          },
        });
        break;

      case 'settings':
        this._setMenuVisible(true);
        this.currentScreen = new SettingsMenu(this.menuContainer, this.settings, {
          onChange: (next: Settings) => {
            this.settings = next;
            if (this.session !== null) this.session.applySettings(next);
            // Debounce only the localStorage write — applySettings stays live.
            this._scheduleSettingsSave();
          },
          onDone: () => {
            this._flushSettingsSave();
            void this._show(this.settingsReturnState);
          },
          onResetDefaults: () => {
            this.settings = { ...DEFAULT_SETTINGS, keybindings: { ...DEFAULT_KEYBINDINGS } };
            saveSettings(this.settings);
            if (this._settingsSaveTimer !== null) {
              window.clearTimeout(this._settingsSaveTimer);
              this._settingsSaveTimer = null;
            }
            if (this.session !== null) this.session.applySettings(this.settings);
            const screen = this.currentScreen;
            if (screen instanceof SettingsMenu) {
              screen.setValues(this.settings);
            }
          },
        });
        break;

      case 'in_game':
        // in_game is only entered via _startSession / _resumeSession.
        // Falling through here would leave us with no screen and no session — bail out.
        console.warn('App._show("in_game") called directly; ignoring.');
        break;
    }
  }

  private _resumeSession(): void {
    if (this.session === null) {
      void this._show('main_menu');
      return;
    }
    if (this.currentScreen !== null) {
      this.currentScreen.dispose();
      this.currentScreen = null;
    }
    this.state = 'in_game';
    this._setMenuVisible(false);
    this._setHudVisible(true);
    this.session.requestPointerLock();
  }

  private _respawnSession(): void {
    if (this.session === null) {
      void this._show('main_menu');
      return;
    }
    if (this.currentScreen !== null) {
      this.currentScreen.dispose();
      this.currentScreen = null;
    }
    this.session.respawn();
    this.state = 'in_game';
    this._setMenuVisible(false);
    this._setHudVisible(true);
    this.session.requestPointerLock();
  }

  private async _quitToMenu(): Promise<void> {
    if (this.session === null) return;
    this._flushSettingsSave();
    // Quitting from the death screen: respawn first so we persist a safe spawn,
    // not the corpse position (which would otherwise reload into a fresh death).
    if (this.session.isDeadState()) {
      this.session.respawn();
    }
    try {
      await this.session.save();
    } catch (err) {
      console.error('Save and Quit failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      this._toast('Save failed — proceeding anyway: ' + msg);
    }
    this.session.stop();
    this.session = null;
    void this._show('main_menu');
  }

  private async _loadWorld(name: string): Promise<void> {
    // Bail before any await so a fast double-click can't enter twice.
    if (this.session !== null || this.state === 'in_game') return;
    let save: WorldSave | null;
    try {
      save = await this.worldStorage.getWorld(name);
    } catch (err) {
      console.error('Load world failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      this._toast('Failed to load world: ' + msg);
      return;
    }
    if (save === null) {
      this._toast('World not found');
      return;
    }
    let furnaces: Record<string, FurnaceState> = {};
    try {
      furnaces = await this.worldStorage.loadFurnaces(name);
    } catch (err) {
      console.error('Load furnaces failed:', err);
    }
    this._startSession(save, furnaces);
  }

  private async _deleteWorld(name: string): Promise<void> {
    try {
      await this.worldStorage.deleteWorld(name);
    } catch (err) {
      console.error('Delete failed:', err);
      this._toast('Delete failed');
    }
    void this._show('worlds');
  }

  private async _createWorld(data: CreateWorldData): Promise<void> {
    // Bail before any await so a fast double-click can't enter twice.
    if (this.session !== null || this.state === 'in_game') return;
    const seed = deriveSeed(data.name, data.seed);
    const now = Date.now();
    const metadata: WorldMetadata = {
      name: data.name,
      seed,
      createdAt: now,
      lastPlayed: now,
      gameMode: data.gameMode === GameMode.CREATIVE ? GameMode.CREATIVE : GameMode.SURVIVAL,
      playerPosition: { x: 0, y: 0, z: 0 },
      playerYaw: 0,
      playerPitch: 0,
      selectedSlot: 0,
    };
    const save: WorldSave = { metadata, overrides: {} };
    try {
      await this.worldStorage.saveWorld(save);
    } catch (err) {
      console.error('Create world failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      this._toast('Create world failed: ' + msg);
      return;
    }
    this._startSession(save);
  }

  private async _exportWorld(name: string): Promise<void> {
    let save: WorldSave | null;
    try {
      save = await this.worldStorage.getWorld(name);
    } catch (err) {
      console.error('Export failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      this._toast('Export failed: ' + msg);
      return;
    }
    if (save === null) {
      this._toast('World not found');
      return;
    }
    let furnaces: Record<string, FurnaceState> = {};
    try {
      furnaces = await this.worldStorage.loadFurnaces(name);
    } catch (err) {
      console.error('Export: loadFurnaces failed (continuing without furnaces):', err);
    }
    const json = serializeWorld(save, furnaces);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = this._exportFileName(name);
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Revoke later: the download is async, and revoking synchronously cancels it on Firefox.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    this._toast('Exported "' + name + '"');
  }

  private _exportFileName(name: string): string {
    const safe = name.replace(/[^\w.\-]+/g, '_').replace(/^[._]+|[._]+$/g, '');
    return (safe.length > 0 ? safe : 'world') + '.blockraft.json';
  }

  private _importWorld(): void {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const file = input.files !== null && input.files.length > 0 ? input.files[0] : null;
      input.remove();
      if (file === undefined || file === null) return;
      const reader = new FileReader();
      reader.onload = (): void => {
        const text = typeof reader.result === 'string' ? reader.result : '';
        void this._finishImport(text);
      };
      reader.onerror = (): void => {
        this._toast('Could not read file');
      };
      reader.readAsText(file);
    });
    document.body.appendChild(input);
    input.click();
  }

  private async _finishImport(text: string): Promise<void> {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      this._toast('Import failed: not valid JSON');
      return;
    }
    const exp = validateWorldExport(parsed);
    if (exp === null) {
      this._toast('Import failed: not a Blockraft world file');
      return;
    }
    let existing: string[];
    try {
      existing = (await this.worldStorage.listWorlds()).map((w) => w.name);
    } catch (err) {
      console.error('Import: listWorlds failed:', err);
      this._toast('Import failed: could not read world list');
      return;
    }
    const uniqueName = this._uniqueWorldName(exp.metadata.name, existing);
    const metadata: WorldMetadata = { ...exp.metadata, name: uniqueName };
    try {
      await this.worldStorage.saveWorld({ metadata, overrides: exp.overrides });
    } catch (err) {
      console.error('Import save failed:', err);
      const msg = err instanceof Error ? err.message : String(err);
      this._toast('Import failed: ' + msg);
      return;
    }
    try {
      await this.worldStorage.saveFurnaces(uniqueName, exp.furnaces);
    } catch (err) {
      // World is already persisted; report partial success so the user can still find it.
      console.error('Import: saveFurnaces failed (world imported without furnace state):', err);
      this._toast('Imported "' + uniqueName + '" (furnace data lost)');
      void this._show('worlds');
      return;
    }
    this._toast('Imported "' + uniqueName + '"');
    void this._show('worlds');
  }

  private _uniqueWorldName(base: string, existing: string[]): string {
    const taken = new Set(existing);
    if (!taken.has(base)) return base;
    const first = base + ' (imported)';
    if (!taken.has(first)) return first;
    let n = 2;
    while (taken.has(base + ' (imported ' + n + ')')) n++;
    return base + ' (imported ' + n + ')';
  }

  private _startSession(save: WorldSave, initialFurnaces: Record<string, FurnaceState> = {}): void {
    // Bail if a session is already starting or running (fast double-click race guard).
    if (this.session !== null || this.state === 'in_game') return;
    this._flushSettingsSave();
    if (this.currentScreen !== null) {
      this.currentScreen.dispose();
      this.currentScreen = null;
    }
    this._setMenuVisible(false);
    this._setHudVisible(true);

    this.session = new GameSession({
      worldName: save.metadata.name,
      worldStorage: this.worldStorage,
      initialSave: save,
      settings: this.settings,
      network: this.network,
      hudContainer: this.hudContainer,
      rendererTarget: document.body,
      initialFurnaces,
      onPauseRequested: () => {
        // Avoid re-entering pause if we're already there or transitioning.
        if (this.state !== 'in_game') return;
        void this._show('paused');
      },
      onDeath: () => {
        // Only fire from active gameplay; guards against double-firing the death overlay.
        if (this.state !== 'in_game') return;
        void this._show('dead');
      },
    });
    this.session.start();
    this.session.requestPointerLock();
    this.state = 'in_game';
  }

  private _setMenuVisible(visible: boolean): void {
    this.menuContainer.style.display = visible ? 'flex' : 'none';
  }

  private _setHudVisible(visible: boolean): void {
    this.hudContainer.style.display = visible ? 'block' : 'none';
  }

  /**
   * Schedule a debounced settings save. Multiple rapid changes (e.g. slider drag)
   * coalesce into a single localStorage write 200ms after the user stops moving.
   */
  private _scheduleSettingsSave(): void {
    if (this._settingsSaveTimer !== null) {
      window.clearTimeout(this._settingsSaveTimer);
    }
    this._settingsSaveTimer = window.setTimeout(() => {
      saveSettings(this.settings);
      this._settingsSaveTimer = null;
    }, 200);
  }

  /** Flush any pending debounced settings save synchronously. */
  private _flushSettingsSave(): void {
    if (this._settingsSaveTimer === null) return;
    window.clearTimeout(this._settingsSaveTimer);
    this._settingsSaveTimer = null;
    saveSettings(this.settings);
  }

  private _toast(text: string): void {
    const el = document.createElement('div');
    el.textContent = text;
    el.style.position = 'fixed';
    el.style.top = '20px';
    el.style.left = '50%';
    el.style.transform = 'translateX(-50%)';
    el.style.background = 'rgba(20, 20, 30, 0.9)';
    el.style.color = '#fff';
    el.style.padding = '10px 16px';
    el.style.border = '2px solid #555';
    el.style.fontFamily = 'monospace';
    el.style.fontSize = '14px';
    el.style.zIndex = '1000';
    el.style.opacity = '1';
    el.style.transition = 'opacity 400ms ease-in-out';
    el.style.pointerEvents = 'none';
    document.body.appendChild(el);
    setTimeout(() => {
      el.style.opacity = '0';
    }, TOAST_DURATION_MS - 400);
    setTimeout(() => {
      if (el.parentNode !== null) el.parentNode.removeChild(el);
    }, TOAST_DURATION_MS);
  }
}
