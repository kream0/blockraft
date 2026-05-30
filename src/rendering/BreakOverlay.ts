import * as THREE from 'three';
import { BREAK_OVERLAY_STAGES } from '../types';

/**
 * Renders a progressive crack overlay on the block being mined.
 *
 * Implementation uses a horizontal strip texture of width TILE*BREAK_OVERLAY_STAGES × TILE.
 * Each tile in the strip holds a cumulative crack pattern for that stage — stage N+1 contains
 * all of stage N's cracks plus more. Setting texture.offset.x = stage/BREAK_OVERLAY_STAGES
 * slides the UV window (repeat.x = 1/BREAK_OVERLAY_STAGES) to sample exactly one tile,
 * avoiding the need to swap textures or rebuild geometry per stage.
 *
 * The crack pixels are drawn on a fully transparent background so only the dark crack lines
 * overlay the underlying block faces without obscuring their colour.
 */

const TILE = 16;

type Rng = () => number;

function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  return (): number => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/** Generate the cumulative crack strip and return a CanvasTexture. */
function buildCrackTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = TILE * BREAK_OVERLAY_STAGES;
  canvas.height = TILE;
  const ctx = canvas.getContext('2d');
  if (ctx === null) {
    throw new Error('BreakOverlay: failed to get 2D context');
  }
  ctx.imageSmoothingEnabled = false;

  // Start with a fully transparent canvas — clearRect is implicit for new canvas elements,
  // but explicit clear makes the intent clear if canvas is ever reused.
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  const rng = makeRng(0xc0ffee);

  // Build all crack pixels via random walks starting near the tile centre.
  // 8 strokes, each ~10 steps long → ~80 pixels total for 10 stages.
  const STROKE_COUNT = 8;
  const STEPS_PER_STROKE = 10;
  const crackPixels: Array<{ x: number; y: number }> = [];

  for (let s = 0; s < STROKE_COUNT; s++) {
    // Start near the tile centre with a small random offset.
    let px = Math.floor(TILE / 2 + (rng() - 0.5) * 4);
    let py = Math.floor(TILE / 2 + (rng() - 0.5) * 4);

    for (let step = 0; step < STEPS_PER_STROKE; step++) {
      // Clamp to tile bounds.
      px = Math.max(0, Math.min(TILE - 1, px));
      py = Math.max(0, Math.min(TILE - 1, py));
      crackPixels.push({ x: px, y: py });

      // Wander one pixel toward an edge (biased outward from centre).
      const dx = px < TILE / 2 ? -1 : 1;
      const dy = py < TILE / 2 ? -1 : 1;
      const r = rng();
      if (r < 0.35) {
        px += dx;
      } else if (r < 0.70) {
        py += dy;
      } else if (r < 0.85) {
        px += (rng() < 0.5 ? 1 : -1);
      } else {
        py += (rng() < 0.5 ? 1 : -1);
      }
    }
  }

  // Draw each stage cumulatively: stage s shows the first floor(total * (s+1) / stages) pixels.
  for (let stage = 0; stage < BREAK_OVERLAY_STAGES; stage++) {
    const count = Math.floor(crackPixels.length * (stage + 1) / BREAK_OVERLAY_STAGES);
    const offsetX = stage * TILE;

    for (const p of crackPixels.slice(0, count)) {
      // Primary crack pixel — dark.
      ctx.fillStyle = 'rgba(20,20,20,0.85)';
      ctx.fillRect(offsetX + p.x, p.y, 1, 1);
      // Chiseled highlight: one pixel to the right at slightly lighter tone for depth.
      if (p.x + 1 < TILE) {
        ctx.fillStyle = 'rgba(60,60,60,0.5)';
        ctx.fillRect(offsetX + p.x + 1, p.y, 1, 1);
      }
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.generateMipmaps = false; // mipmaps would bleed pixels between tiles in the strip
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.needsUpdate = true;
  // Each face's default UV spans [0,1]; repeat.x=1/stages crops to one tile's width.
  tex.repeat.set(1 / BREAK_OVERLAY_STAGES, 1);
  tex.offset.set(0, 0);
  return tex;
}

export class BreakOverlay {
  readonly object3D: THREE.Mesh;
  private readonly texture: THREE.CanvasTexture;

  constructor() {
    this.texture = buildCrackTexture();

    const material = new THREE.MeshBasicMaterial({
      map: this.texture,
      transparent: true,
      depthWrite: false,
      alphaTest: 0.05,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
      side: THREE.FrontSide,
    });

    // Slightly inflated box so the crack faces sit just outside the block surface.
    const geometry = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    this.object3D = new THREE.Mesh(geometry, material);
    this.object3D.visible = false;
  }

  /**
   * Position the overlay at the mined block and select the crack stage for the current progress.
   * frac must be in [0, 1].
   */
  show(x: number, y: number, z: number, frac: number): void {
    const stage = THREE.MathUtils.clamp(
      Math.floor(frac * BREAK_OVERLAY_STAGES),
      0,
      BREAK_OVERLAY_STAGES - 1,
    );
    // Slide the UV window to the tile for this stage. No needsUpdate required —
    // offset is applied as a shader uniform each render, not a texture upload.
    this.texture.offset.x = stage / BREAK_OVERLAY_STAGES;
    this.object3D.position.set(x + 0.5, y + 0.5, z + 0.5);
    this.object3D.visible = true;
  }

  /** Hide the crack overlay (e.g. mining cancelled or block broken). */
  hide(): void {
    this.object3D.visible = false;
  }

  /** Free GPU resources. The caller is responsible for removing object3D from the scene first. */
  dispose(): void {
    this.object3D.geometry.dispose();
    (this.object3D.material as THREE.Material).dispose();
    this.texture.dispose();
  }
}
