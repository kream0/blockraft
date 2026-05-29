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

  setLocked(locked: boolean): void {
    this.clickHintEl.hidden = locked;
  }

  dispose(): void {
    this.hotbar.dispose();
    for (const el of [this.crosshairEl, this.readoutEl, this.clickHintEl]) {
      if (el.parentNode !== null) {
        el.parentNode.removeChild(el);
      }
    }
  }
}
