import type { PlayerState, ItemStack, IWorld } from '../types';
import { Hotbar } from './Hotbar';
import { Minimap } from './Minimap';
import type { ItemIconRenderer } from '../rendering/ItemIconRenderer';

const STYLE_ID = 'mc-hud-style';

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID) !== null) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.mc-crosshair { position: absolute; left: 50%; top: 50%; width: 16px; height: 16px; transform: translate(-50%, -50%); pointer-events: none; }
.mc-crosshair::before, .mc-crosshair::after { content: ''; position: absolute; background: white; box-shadow: 0 0 2px black, 1px 1px 2px black; }
.mc-crosshair::before { left: 50%; top: 0; width: 2px; height: 16px; transform: translateX(-50%); }
.mc-crosshair::after { top: 50%; left: 0; height: 2px; width: 16px; transform: translateY(-50%); }
.mc-readout { position: absolute; top: 8px; left: 8px; color: white; text-shadow: 1px 1px 2px black; font-family: monospace; font-size: 12px; line-height: 1.4; pointer-events: none; }
.mc-clickhint { position: absolute; left: 50%; bottom: 70px; transform: translateX(-50%); color: white; text-shadow: 1px 1px 2px black; font-family: monospace; font-size: 14px; padding: 6px 12px; background: rgba(0,0,0,0.4); border-radius: 4px; pointer-events: none; }
.mc-clickhint[hidden] { display: none; }
.mc-health { position: absolute; right: 50%; bottom: 96px; transform: translateX(-4px); display: flex; gap: 2px; pointer-events: none; }
.mc-health[hidden] { display: none; }
.mc-heart { position: relative; width: 16px; height: 16px; }
.mc-heart-bg, .mc-heart-fg { position: absolute; top: 0; left: 0; height: 16px; font-size: 16px; line-height: 16px; }
.mc-heart-bg { color: #444; text-shadow: 1px 1px 1px black; }
.mc-heart-fg { color: #ff4d4d; overflow: hidden; white-space: nowrap; text-shadow: 1px 1px 1px black; }
.mc-air { position: absolute; left: 50%; bottom: 116px; transform: translateX(-50%); display: flex; gap: 2px; pointer-events: none; }
.mc-air[hidden] { display: none; }
.mc-bubble { position: relative; width: 16px; height: 16px; }
.mc-bubble-bg, .mc-bubble-fg { position: absolute; top: 0; left: 0; height: 16px; font-size: 16px; line-height: 16px; }
.mc-bubble-bg { color: #444; text-shadow: 1px 1px 1px black; }
.mc-bubble-fg { color: #7ec8ff; overflow: hidden; white-space: nowrap; text-shadow: 1px 1px 1px black; }
.mc-underwater { position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity 0.25s ease-out; background: rgba(30,90,170,0.35); }
.mc-damage-vignette { position: absolute; inset: 0; pointer-events: none; opacity: 0; transition: opacity 0.4s ease-out; box-shadow: inset 0 0 120px 50px rgba(170,0,0,0.65); }
.mc-break { position: absolute; left: 50%; top: 50%; width: 28px; height: 28px; transform: translate(-50%, -50%); border-radius: 50%; pointer-events: none; opacity: 0; }
.mc-hunger { position: absolute; left: 50%; bottom: 96px; transform: translateX(4px); display: flex; flex-direction: row-reverse; gap: 2px; pointer-events: none; }
.mc-hunger[hidden] { display: none; }
.mc-drumstick { position: relative; width: 16px; height: 16px; }
.mc-drumstick-bg, .mc-drumstick-fg { position: absolute; top: 0; left: 0; width: 16px; height: 16px; overflow: hidden; }
.mc-drumstick-bg::before { content: ''; position: absolute; top: 3px; left: 2px; width: 10px; height: 9px; background: #4a4a4a; border-radius: 40% 50% 50% 40%; }
.mc-drumstick-bg::after { content: ''; position: absolute; top: 10px; left: 9px; width: 5px; height: 4px; background: #4a4a4a; border-radius: 50% 50% 40% 40%; transform: rotate(-30deg); }
.mc-drumstick-fg { width: 0; white-space: nowrap; }
.mc-drumstick-fg::before { content: ''; position: absolute; top: 3px; left: 2px; width: 10px; height: 9px; background: #c8850a; border-radius: 40% 50% 50% 40%; }
.mc-drumstick-fg::after { content: ''; position: absolute; top: 10px; left: 9px; width: 5px; height: 4px; background: #e8b86d; border-radius: 50% 50% 40% 40%; transform: rotate(-30deg); }
.mc-armor { position: absolute; right: 50%; bottom: 136px; transform: translateX(-4px); display: flex; gap: 2px; pointer-events: none; }
.mc-armor[hidden] { display: none; }
.mc-armor-icon { position: relative; width: 16px; height: 16px; }
.mc-armor-bg, .mc-armor-fg { position: absolute; top: 0; left: 0; height: 16px; width: 16px; overflow: hidden; }
.mc-armor-bg::before, .mc-armor-fg::before { content: ''; position: absolute; top: 2px; left: 2px; width: 12px; height: 12px; clip-path: polygon(50% 0, 100% 22%, 100% 60%, 50% 100%, 0 60%, 0 22%); }
.mc-armor-bg::before { background: #444; }
.mc-armor-fg::before { background: #c8d2dc; }
.mc-rebuild { position: absolute; left: 50%; top: 12%; transform: translateX(-50%); color: white; text-shadow: 1px 1px 2px black; font-family: monospace; font-size: 14px; padding: 6px 14px; background: rgba(0,0,0,0.55); border-radius: 4px; pointer-events: none; }
.mc-rebuild[hidden] { display: none; }
`;
  document.head.appendChild(style);
}

export class HUD {
  private fpsEl: HTMLElement;
  private posEl: HTMLElement;
  private dayEl: HTMLElement;
  private timeEl: HTMLElement;
  private weatherEl: HTMLElement;
  private clickHintEl: HTMLElement;
  private crosshairEl: HTMLElement;
  private readoutEl: HTMLElement;
  private healthEl: HTMLElement;
  private airEl: HTMLElement;
  private damageVignetteEl: HTMLElement;
  private underwaterEl: HTMLElement;
  private breakEl: HTMLElement;
  private heartFills: HTMLElement[] = [];
  private bubbleFills: HTMLElement[] = [];
  private hungerEl: HTMLElement;
  private hungerFills: HTMLElement[] = [];
  private armorEl: HTMLElement;
  private armorFills: HTMLElement[] = [];
  hotbar: Hotbar;
  private minimap: Minimap;
  private rebuildEl: HTMLElement;
  private rebuildHideTimer: ReturnType<typeof setTimeout> | null = null;

  private fpsEma: number = 0;
  private fpsInitialized: boolean = false;
  private showFps: boolean = true;

  // Dirty-flag caches — sentinel values ensure first call always writes.
  private _lastFpsStr: string = '';
  private _lastPosStr: string = '';
  private _lastDayStr: string = '';
  private _lastTimeStr: string = '';
  private _lastWeatherStr: string = '';
  private _lastUnderwater: boolean | null = null;
  private _lastHealthVal: number = -1;
  private _lastHealthMax: number = -1;
  private _lastAirVal: number = -1;
  private _lastAirMax: number = -1;
  private _lastHungerVal: number = -1;
  private _lastHungerMax: number = -1;
  private _lastArmorVal: number = -1;
  private _lastArmorMax: number = -1;

  constructor(container: HTMLElement, hotbarStacks: ReadonlyArray<ItemStack | null>, showCounts: boolean, iconRenderer: ItemIconRenderer) {
    ensureStyle();

    const crosshair = document.createElement('div');
    crosshair.className = 'mc-crosshair';
    container.appendChild(crosshair);
    this.crosshairEl = crosshair;

    const breakEl = document.createElement('div');
    breakEl.className = 'mc-break';
    container.appendChild(breakEl);
    this.breakEl = breakEl;

    const readout = document.createElement('div');
    readout.className = 'mc-readout';
    const fps = document.createElement('div');
    fps.textContent = 'FPS: --';
    const pos = document.createElement('div');
    pos.textContent = 'Pos: 0.0, 0.0, 0.0';
    readout.appendChild(fps);
    readout.appendChild(pos);
    const day = document.createElement('div');
    day.textContent = 'Day 1';
    readout.appendChild(day);
    const time = document.createElement('div');
    time.textContent = 'Time: --:--';
    readout.appendChild(time);
    const weather = document.createElement('div');
    weather.textContent = 'Weather: Clear';
    readout.appendChild(weather);
    container.appendChild(readout);
    this.readoutEl = readout;
    this.fpsEl = fps;
    this.posEl = pos;
    this.dayEl = day;
    this.timeEl = time;
    this.weatherEl = weather;

    const hint = document.createElement('div');
    hint.className = 'mc-clickhint';
    hint.textContent = 'Click to play';
    container.appendChild(hint);
    this.clickHintEl = hint;

    const health = document.createElement('div');
    health.className = 'mc-health';
    health.hidden = true;
    for (let i = 0; i < 10; i++) {
      const heart = document.createElement('div');
      heart.className = 'mc-heart';
      const bg = document.createElement('span');
      bg.className = 'mc-heart-bg';
      bg.textContent = '♥';
      const fg = document.createElement('span');
      fg.className = 'mc-heart-fg';
      fg.textContent = '♥';
      heart.appendChild(bg);
      heart.appendChild(fg);
      health.appendChild(heart);
      this.heartFills.push(fg);
    }
    container.appendChild(health);
    this.healthEl = health;

    const air = document.createElement('div');
    air.className = 'mc-air';
    air.hidden = true;
    for (let i = 0; i < 10; i++) {
      const bubble = document.createElement('div');
      bubble.className = 'mc-bubble';
      const bg = document.createElement('span');
      bg.className = 'mc-bubble-bg';
      bg.textContent = '●';
      const fg = document.createElement('span');
      fg.className = 'mc-bubble-fg';
      fg.textContent = '●';
      bubble.appendChild(bg);
      bubble.appendChild(fg);
      air.appendChild(bubble);
      this.bubbleFills.push(fg);
    }
    container.appendChild(air);
    this.airEl = air;

    const hunger = document.createElement('div');
    hunger.className = 'mc-hunger';
    hunger.hidden = true;
    for (let i = 0; i < 10; i++) {
      const drumstick = document.createElement('div');
      drumstick.className = 'mc-drumstick';
      const bg = document.createElement('span');
      bg.className = 'mc-drumstick-bg';
      const fg = document.createElement('span');
      fg.className = 'mc-drumstick-fg';
      drumstick.appendChild(bg);
      drumstick.appendChild(fg);
      hunger.appendChild(drumstick);
      this.hungerFills.push(fg);
    }
    container.appendChild(hunger);
    this.hungerEl = hunger;

    const armor = document.createElement('div');
    armor.className = 'mc-armor';
    armor.hidden = true;
    for (let i = 0; i < 10; i++) {
      const icon = document.createElement('div');
      icon.className = 'mc-armor-icon';
      const bg = document.createElement('span');
      bg.className = 'mc-armor-bg';
      const fg = document.createElement('span');
      fg.className = 'mc-armor-fg';
      icon.appendChild(bg);
      icon.appendChild(fg);
      armor.appendChild(icon);
      this.armorFills.push(fg);
    }
    container.appendChild(armor);
    this.armorEl = armor;

    const underwater = document.createElement('div');
    underwater.className = 'mc-underwater';
    container.appendChild(underwater);
    this.underwaterEl = underwater;

    const vignette = document.createElement('div');
    vignette.className = 'mc-damage-vignette';
    container.appendChild(vignette);
    this.damageVignetteEl = vignette;

    const rebuild = document.createElement('div');
    rebuild.className = 'mc-rebuild';
    rebuild.hidden = true;
    container.appendChild(rebuild);
    this.rebuildEl = rebuild;

    this.hotbar = new Hotbar(container, hotbarStacks, showCounts, iconRenderer);
    this.minimap = new Minimap(container);
  }

  update(player: PlayerState, dtMs: number): void {
    // EMA over ~0.5s. alpha = 1 - exp(-dt/tau)
    const dt = Math.max(dtMs, 0.001) / 1000;
    const instFps = 1 / dt;
    if (!this.fpsInitialized) {
      this.fpsEma = instFps;
      this.fpsInitialized = true;
    } else {
      const tau = 0.5;
      const alpha = 1 - Math.exp(-dt / tau);
      this.fpsEma = this.fpsEma + (instFps - this.fpsEma) * alpha;
    }
    if (this.showFps) {
      const fpsStr = 'FPS: ' + this.fpsEma.toFixed(0);
      if (fpsStr !== this._lastFpsStr) {
        this._lastFpsStr = fpsStr;
        this.fpsEl.textContent = fpsStr;
      }
    }
    const p = player.position;
    const posStr = 'Pos: ' + p.x.toFixed(1) + ', ' + p.y.toFixed(1) + ', ' + p.z.toFixed(1);
    if (posStr !== this._lastPosStr) {
      this._lastPosStr = posStr;
      this.posEl.textContent = posStr;
    }

    if (this.hotbar.selectedSlot !== player.selectedSlot) {
      this.hotbar.setSelectedSlot(player.selectedSlot);
    }
  }

  updateMinimap(world: IWorld, px: number, pz: number, yaw: number, dtMs: number): void {
    this.minimap.update(world, px, pz, yaw, dtMs);
  }

  setHotbarStacks(stacks: ReadonlyArray<ItemStack | null>): void {
    this.hotbar.setStacks(stacks);
  }

  /** Show or hide the FPS readout line (wired to the Show FPS setting). */
  setShowFps(show: boolean): void {
    this.showFps = show;
    this.fpsEl.hidden = !show;
  }

  /** Update the clock readout from a normalized time of day t in [0, 1): 0=00:00, 0.5=12:00. */
  setTimeOfDay(t: number): void {
    const minutesOfDay = Math.floor((((t % 1) + 1) % 1) * 24 * 60);
    const hh = Math.floor(minutesOfDay / 60) % 24;
    const mm = minutesOfDay % 60;
    const timeStr = 'Time: ' + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
    if (timeStr !== this._lastTimeStr) {
      this._lastTimeStr = timeStr;
      this.timeEl.textContent = timeStr;
    }
  }

  /** Update the weather readout. label is 'Clear' | 'Rain' | 'Snow'. */
  setWeather(label: string): void {
    const s = 'Weather: ' + label;
    if (s !== this._lastWeatherStr) {
      this._lastWeatherStr = s;
      this.weatherEl.textContent = s;
    }
  }

  /** Update the session day counter readout (Day 1, Day 2, ...). */
  setDay(day: number): void {
    const s = 'Day ' + day;
    if (s !== this._lastDayStr) {
      this._lastDayStr = s;
      this.dayEl.textContent = s;
    }
  }

  setHealth(hp: number, max: number): void {
    if (hp === this._lastHealthVal && max === this._lastHealthMax) return;
    this._lastHealthVal = hp;
    this._lastHealthMax = max;
    const clamped = Math.max(0, Math.min(max, hp));
    this.healthEl.hidden = false;
    this.heartFills.forEach((fg, i) => {
      const heartValue = clamped - i * 2;          // points for THIS heart
      const fraction = Math.max(0, Math.min(1, heartValue / 2)); // 0, 0.5, or 1
      fg.style.width = (fraction * 16) + 'px';
    });
  }

  setAir(air: number, max: number): void {
    if (air === this._lastAirVal && max === this._lastAirMax) return;
    this._lastAirVal = air;
    this._lastAirMax = max;
    if (air >= max) {
      this.airEl.hidden = true;
      return;
    }
    this.airEl.hidden = false;
    const perBubble = max / this.bubbleFills.length;
    this.bubbleFills.forEach((fg, i) => {
      const value = air - i * perBubble;
      const fraction = Math.max(0, Math.min(1, value / perBubble));
      fg.style.width = (fraction * 16) + 'px';
    });
  }

  setHunger(hunger: number, max: number): void {
    if (hunger === this._lastHungerVal && max === this._lastHungerMax) return;
    this._lastHungerVal = hunger;
    this._lastHungerMax = max;
    const clamped = Math.max(0, Math.min(max, hunger));
    this.hungerEl.hidden = false;
    this.hungerFills.forEach((fg, i) => {
      const drumstickValue = clamped - i * 2;           // points for THIS drumstick
      const fraction = Math.max(0, Math.min(1, drumstickValue / 2)); // 0, 0.5, or 1
      fg.style.width = (fraction * 16) + 'px';
    });
  }

  /** Render the armor bar from total armor points. Hidden entirely at 0. `max` is the points scale across all 10 icons (2 points each). */
  setArmor(points: number, max: number): void {
    if (points === this._lastArmorVal && max === this._lastArmorMax) return;
    this._lastArmorVal = points;
    this._lastArmorMax = max;
    if (points <= 0) {
      this.armorEl.hidden = true;
      return;
    }
    this.armorEl.hidden = false;
    const clamped = Math.max(0, Math.min(max, points));
    const perIcon = max / this.armorFills.length;
    this.armorFills.forEach((fg, i) => {
      const value = clamped - i * perIcon;
      const fraction = Math.max(0, Math.min(1, value / perIcon));
      fg.style.width = (fraction * 16) + 'px';
    });
  }

  /** Pulse the red damage vignette to full opacity, then fade it out over ~0.4s. Re-arms on every call. */
  flashDamage(): void {
    const el = this.damageVignetteEl;
    // Snap to full opacity with no transition, force a reflow, then fade out.
    // The reflow restarts the fade even when bites land in quick succession.
    el.style.transition = 'none';
    el.style.opacity = '1';
    void el.offsetWidth;
    el.style.transition = 'opacity 0.4s ease-out';
    el.style.opacity = '0';
  }

  /** Fade the blue underwater tint in (active) or out. The CSS transition handles the animation. */
  setUnderwater(active: boolean): void {
    if (active === this._lastUnderwater) return;
    this._lastUnderwater = active;
    this.underwaterEl.style.opacity = active ? '1' : '0';
  }

  setLocked(locked: boolean): void {
    this.clickHintEl.hidden = locked;
  }

  /** Show mining progress as a filling disc over the crosshair. frac in [0,1]; values <= 0 hide it. */
  setBreakProgress(frac: number): void {
    const f = Math.max(0, Math.min(1, frac));
    if (f <= 0) {
      this.breakEl.style.opacity = '0';
      return;
    }
    const deg = f * 360;
    this.breakEl.style.opacity = '1';
    this.breakEl.style.background =
      'conic-gradient(rgba(255,255,255,0.55) ' + deg + 'deg, rgba(0,0,0,0.30) ' + deg + 'deg)';
  }

  /**
   * Show terrain-rebuild progress (after an atlas-resolution change). `total <= 0`
   * hides immediately. Once `done >= total` the banner lingers ~2s then auto-hides.
   * Safe to call every frame; re-arming is debounced.
   */
  setRebuildProgress(done: number, total: number): void {
    if (total <= 0) { this.hideRebuild(); return; }
    this.rebuildEl.hidden = false;
    const d = Math.max(0, Math.min(total, done));
    this.rebuildEl.textContent = 'Rebuilding terrain ' + d + '/' + total + '…';
    if (d >= total) {
      if (this.rebuildHideTimer === null) {
        this.rebuildHideTimer = setTimeout(() => { this.hideRebuild(); }, 2000);
      }
    } else if (this.rebuildHideTimer !== null) {
      clearTimeout(this.rebuildHideTimer);
      this.rebuildHideTimer = null;
    }
  }

  private hideRebuild(): void {
    if (this.rebuildHideTimer !== null) {
      clearTimeout(this.rebuildHideTimer);
      this.rebuildHideTimer = null;
    }
    this.rebuildEl.hidden = true;
  }

  dispose(): void {
    this.hotbar.dispose();
    this.minimap.dispose();
    if (this.rebuildHideTimer !== null) { clearTimeout(this.rebuildHideTimer); this.rebuildHideTimer = null; }
    for (const el of [this.crosshairEl, this.breakEl, this.readoutEl, this.clickHintEl, this.healthEl, this.airEl, this.hungerEl, this.armorEl, this.underwaterEl, this.damageVignetteEl, this.weatherEl, this.dayEl, this.rebuildEl]) {
      if (el.parentNode !== null) {
        el.parentNode.removeChild(el);
      }
    }
    this.heartFills = [];
    this.bubbleFills = [];
    this.hungerFills = [];
    this.armorFills = [];
  }
}
