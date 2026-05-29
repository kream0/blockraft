import type { BlockId, PlayerState } from '../types';
import { Hotbar } from './Hotbar';

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
.mc-health { position: absolute; left: 50%; bottom: 96px; transform: translateX(-50%); display: flex; gap: 2px; pointer-events: none; }
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
`;
  document.head.appendChild(style);
}

export class HUD {
  private fpsEl: HTMLElement;
  private posEl: HTMLElement;
  private timeEl: HTMLElement;
  private clickHintEl: HTMLElement;
  private crosshairEl: HTMLElement;
  private readoutEl: HTMLElement;
  private healthEl: HTMLElement;
  private airEl: HTMLElement;
  private damageVignetteEl: HTMLElement;
  private underwaterEl: HTMLElement;
  private heartFills: HTMLElement[] = [];
  private bubbleFills: HTMLElement[] = [];
  hotbar: Hotbar;

  private fpsEma: number = 0;
  private fpsInitialized: boolean = false;

  constructor(container: HTMLElement, hotbarBlocks: BlockId[]) {
    ensureStyle();

    const crosshair = document.createElement('div');
    crosshair.className = 'mc-crosshair';
    container.appendChild(crosshair);
    this.crosshairEl = crosshair;

    const readout = document.createElement('div');
    readout.className = 'mc-readout';
    const fps = document.createElement('div');
    fps.textContent = 'FPS: --';
    const pos = document.createElement('div');
    pos.textContent = 'Pos: 0.0, 0.0, 0.0';
    readout.appendChild(fps);
    readout.appendChild(pos);
    const time = document.createElement('div');
    time.textContent = 'Time: --:--';
    readout.appendChild(time);
    container.appendChild(readout);
    this.readoutEl = readout;
    this.fpsEl = fps;
    this.posEl = pos;
    this.timeEl = time;

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

    const underwater = document.createElement('div');
    underwater.className = 'mc-underwater';
    container.appendChild(underwater);
    this.underwaterEl = underwater;

    const vignette = document.createElement('div');
    vignette.className = 'mc-damage-vignette';
    container.appendChild(vignette);
    this.damageVignetteEl = vignette;

    this.hotbar = new Hotbar(container, hotbarBlocks);
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
    this.fpsEl.textContent = 'FPS: ' + this.fpsEma.toFixed(0);
    const p = player.position;
    this.posEl.textContent =
      'Pos: ' + p.x.toFixed(1) + ', ' + p.y.toFixed(1) + ', ' + p.z.toFixed(1);

    if (this.hotbar.selectedSlot !== player.selectedSlot) {
      this.hotbar.setSelectedSlot(player.selectedSlot);
    }
  }

  /** Update the clock readout from a normalized time of day t in [0, 1): 0=00:00, 0.5=12:00. */
  setTimeOfDay(t: number): void {
    const minutesOfDay = Math.floor((((t % 1) + 1) % 1) * 24 * 60);
    const hh = Math.floor(minutesOfDay / 60) % 24;
    const mm = minutesOfDay % 60;
    this.timeEl.textContent =
      'Time: ' + String(hh).padStart(2, '0') + ':' + String(mm).padStart(2, '0');
  }

  setHealth(hp: number, max: number): void {
    const clamped = Math.max(0, Math.min(max, hp));
    this.healthEl.hidden = false;
    this.heartFills.forEach((fg, i) => {
      const heartValue = clamped - i * 2;          // points for THIS heart
      const fraction = Math.max(0, Math.min(1, heartValue / 2)); // 0, 0.5, or 1
      fg.style.width = (fraction * 16) + 'px';
    });
  }

  setAir(air: number, max: number): void {
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
    this.underwaterEl.style.opacity = active ? '1' : '0';
  }

  setLocked(locked: boolean): void {
    this.clickHintEl.hidden = locked;
  }

  dispose(): void {
    this.hotbar.dispose();
    for (const el of [this.crosshairEl, this.readoutEl, this.clickHintEl, this.healthEl, this.airEl, this.underwaterEl, this.damageVignetteEl]) {
      if (el.parentNode !== null) {
        el.parentNode.removeChild(el);
      }
    }
    this.heartFills = [];
    this.bubbleFills = [];
  }
}
