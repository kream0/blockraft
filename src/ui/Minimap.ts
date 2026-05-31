import type { IWorld } from '../types';
import { BlockId, CHUNK_HEIGHT, MINIMAP_RADIUS_BLOCKS, MINIMAP_SIZE_PX, MINIMAP_REBUILD_INTERVAL_S } from '../types';
import { BLOCK_SWATCH_COLORS } from '../items/ItemRegistry';

const STYLE_ID = 'mc-minimap-style';
const GRID = MINIMAP_RADIUS_BLOCKS * 2 + 1; // 49 cells across
const VOID_COLOR = '#1a1d24';               // unloaded / all-air column

function ensureStyle(): void {
  if (document.getElementById(STYLE_ID) !== null) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `.mc-minimap { position: absolute; top: 8px; right: 8px; width: ${MINIMAP_SIZE_PX}px; height: ${MINIMAP_SIZE_PX}px; border: 2px solid rgba(0,0,0,0.6); border-radius: 3px; box-shadow: 0 0 4px rgba(0,0,0,0.5); image-rendering: pixelated; pointer-events: none; background: #1a1d24; }`;
  document.head.appendChild(style);
}

export class Minimap {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private terrain: HTMLCanvasElement;
  private terrainCtx: CanvasRenderingContext2D;
  private rebuildTimer: number = MINIMAP_REBUILD_INTERVAL_S;

  constructor(container: HTMLElement) {
    ensureStyle();

    this.canvas = document.createElement('canvas');
    this.canvas.width = MINIMAP_SIZE_PX;
    this.canvas.height = MINIMAP_SIZE_PX;
    this.canvas.className = 'mc-minimap';

    const ctx = this.canvas.getContext('2d');
    if (ctx === null) throw new Error('Minimap: 2D context unavailable');
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;

    container.appendChild(this.canvas);

    this.terrain = document.createElement('canvas');
    this.terrain.width = GRID;
    this.terrain.height = GRID;

    const terrainCtx = this.terrain.getContext('2d');
    if (terrainCtx === null) throw new Error('Minimap: 2D context unavailable for terrain canvas');
    this.terrainCtx = terrainCtx;
  }

  update(world: IWorld, px: number, pz: number, yaw: number, dtMs: number): void {
    this.rebuildTimer += dtMs / 1000;
    const cx = Math.floor(px);
    const cz = Math.floor(pz);
    if (this.rebuildTimer >= MINIMAP_REBUILD_INTERVAL_S) {
      this.rebuildTimer = 0;
      this.rebuildTerrain(world, cx, cz);
    }
    this.draw(yaw);
  }

  private rebuildTerrain(world: IWorld, cx: number, cz: number): void {
    for (let gz = 0; gz < GRID; gz++) {
      const wz = cz - MINIMAP_RADIUS_BLOCKS + gz;
      for (let gx = 0; gx < GRID; gx++) {
        const wx = cx - MINIMAP_RADIUS_BLOCKS + gx;
        let colorHex = VOID_COLOR;
        for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
          const id = world.getBlock(wx, y, wz);
          if (id !== BlockId.AIR) {
            colorHex = BLOCK_SWATCH_COLORS[id] ?? '#ffffff';
            break;
          }
        }
        this.terrainCtx.fillStyle = colorHex;
        this.terrainCtx.fillRect(gx, gz, 1, 1);
      }
    }
  }

  private draw(yaw: number): void {
    const ctx = this.ctx;
    const S = MINIMAP_SIZE_PX;
    ctx.clearRect(0, 0, S, S);
    ctx.drawImage(this.terrain, 0, 0, GRID, GRID, 0, 0, S, S);

    ctx.save();
    ctx.translate(S / 2, S / 2);
    ctx.rotate(-yaw);
    ctx.beginPath();
    ctx.moveTo(0, -6);   // tip (north at yaw 0)
    ctx.lineTo(-4, 5);
    ctx.lineTo(4, 5);
    ctx.closePath();
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  dispose(): void {
    if (this.canvas.parentNode !== null) {
      this.canvas.parentNode.removeChild(this.canvas);
    }
  }
}
