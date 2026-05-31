import * as THREE from 'three';
import type { ITextureAtlas } from '../types';

const TILE = 16;
const COLS = 5;
const ROWS = 5;
const SIZE = TILE * COLS;

export const ATLAS_TILE_PIXELS = TILE;
export const ATLAS_COLS = COLS;
export const ATLAS_SIZE = SIZE;

type Rng = () => number;

function makeRng(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

function fillTile(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  baseColor: string,
): void {
  ctx.fillStyle = baseColor;
  ctx.fillRect(col * TILE, row * TILE, TILE, TILE);
}

function speckle(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  color: string,
  count: number,
  rng: Rng,
): void {
  ctx.fillStyle = color;
  for (let i = 0; i < count; i++) {
    const x = col * TILE + Math.floor(rng() * TILE);
    const y = row * TILE + Math.floor(rng() * TILE);
    ctx.fillRect(x, y, 1, 1);
  }
}

function pixel(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  x: number,
  y: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(col * TILE + x, row * TILE + y, 1, 1);
}

function drawGrassTop(ctx: CanvasRenderingContext2D, col: number, row: number, rng: Rng): void {
  fillTile(ctx, col, row, '#5DAD3A');
  speckle(ctx, col, row, '#4A8B2C', 36, rng);
  speckle(ctx, col, row, '#6FBF4D', 12, rng);
}

function drawDirt(ctx: CanvasRenderingContext2D, col: number, row: number, rng: Rng): void {
  fillTile(ctx, col, row, '#8B5A2B');
  speckle(ctx, col, row, '#5C3A1B', 32, rng);
  speckle(ctx, col, row, '#A06B36', 14, rng);
}

function drawGrassSide(ctx: CanvasRenderingContext2D, col: number, row: number, rng: Rng): void {
  fillTile(ctx, col, row, '#8B5A2B');
  speckle(ctx, col, row, '#5C3A1B', 28, rng);
  speckle(ctx, col, row, '#A06B36', 10, rng);
  ctx.fillStyle = '#5DAD3A';
  ctx.fillRect(col * TILE, row * TILE, TILE, 4);
  for (let x = 0; x < TILE; x++) {
    const jag = rng() < 0.5 ? 0 : 1;
    pixel(ctx, col, row, x, 4 + jag, '#5DAD3A');
    if (rng() < 0.35) {
      pixel(ctx, col, row, x, 3, '#4A8B2C');
    }
  }
}

function drawStone(ctx: CanvasRenderingContext2D, col: number, row: number, rng: Rng): void {
  fillTile(ctx, col, row, '#888888');
  speckle(ctx, col, row, '#666666', 30, rng);
  speckle(ctx, col, row, '#AAAAAA', 18, rng);
}

function drawCobblestone(ctx: CanvasRenderingContext2D, col: number, row: number, rng: Rng): void {
  fillTile(ctx, col, row, '#777777');
  // Outline grid lines first
  ctx.fillStyle = '#444444';
  ctx.fillRect(col * TILE, row * TILE + 7, TILE, 1);
  ctx.fillRect(col * TILE + 7, row * TILE, 1, 8);
  ctx.fillRect(col * TILE + 5, row * TILE + 8, 1, TILE - 8);
  // Rocks: roughly four quadrants with darker fill
  const rocks: Array<[number, number, number, number]> = [
    [1, 1, 5, 5],
    [9, 1, 5, 5],
    [1, 9, 4, 6],
    [7, 9, 7, 6],
  ];
  for (const [x, y, w, h] of rocks) {
    ctx.fillStyle = '#555555';
    ctx.fillRect(col * TILE + x, row * TILE + y, w, h);
    ctx.fillStyle = '#666666';
    ctx.fillRect(col * TILE + x + 1, row * TILE + y + 1, w - 2, h - 2);
    if (rng() < 0.8) {
      ctx.fillStyle = '#7A7A7A';
      ctx.fillRect(col * TILE + x + 2, row * TILE + y + 2, Math.max(1, w - 4), Math.max(1, h - 4));
    }
  }
}

function drawWoodTop(ctx: CanvasRenderingContext2D, col: number, row: number, rng: Rng): void {
  fillTile(ctx, col, row, '#A07242');
  const cx = col * TILE + TILE / 2;
  const cy = row * TILE + TILE / 2;
  // Concentric rings
  for (let r = 1; r <= 7; r++) {
    if (r % 2 === 0) continue;
    ctx.fillStyle = '#7A4F2A';
    for (let a = 0; a < 64; a++) {
      const t = (a / 64) * Math.PI * 2;
      const x = Math.round(cx + Math.cos(t) * r);
      const y = Math.round(cy + Math.sin(t) * r);
      if (
        x >= col * TILE &&
        x < col * TILE + TILE &&
        y >= row * TILE &&
        y < row * TILE + TILE
      ) {
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }
  speckle(ctx, col, row, '#8C5E36', 6, rng);
}

function drawWoodSide(ctx: CanvasRenderingContext2D, col: number, row: number, rng: Rng): void {
  fillTile(ctx, col, row, '#6E4923');
  for (let x = 0; x < TILE; x++) {
    if (rng() < 0.35) {
      const h = 6 + Math.floor(rng() * 8);
      const y0 = Math.floor(rng() * (TILE - h));
      ctx.fillStyle = '#5A3A1B';
      ctx.fillRect(col * TILE + x, row * TILE + y0, 1, h);
    } else if (rng() < 0.25) {
      ctx.fillStyle = '#8A5C2D';
      ctx.fillRect(col * TILE + x, row * TILE, 1, TILE);
    }
  }
}

function drawLeaves(ctx: CanvasRenderingContext2D, col: number, row: number, rng: Rng): void {
  fillTile(ctx, col, row, '#3F7E2A');
  speckle(ctx, col, row, '#2E6320', 40, rng);
  speckle(ctx, col, row, '#55A03A', 24, rng);
  speckle(ctx, col, row, '#1F4A18', 12, rng);
}

function drawPlanks(ctx: CanvasRenderingContext2D, col: number, row: number, rng: Rng): void {
  for (let y = 0; y < TILE; y++) {
    const band = Math.floor(y / 4);
    ctx.fillStyle = band % 2 === 0 ? '#B6824A' : '#9E7140';
    ctx.fillRect(col * TILE, row * TILE + y, TILE, 1);
  }
  // Vertical seams
  ctx.fillStyle = '#6E4923';
  for (let y = 0; y < TILE; y += 4) {
    const offset = (y / 4) % 2 === 0 ? 5 : 11;
    ctx.fillRect(col * TILE + offset, row * TILE + y, 1, 4);
  }
  // Horizontal seams between bands
  ctx.fillStyle = '#6E4923';
  for (let y = 4; y < TILE; y += 4) {
    ctx.fillRect(col * TILE, row * TILE + y - 1, TILE, 1);
  }
  speckle(ctx, col, row, '#8A6038', 8, rng);
}

function drawSand(ctx: CanvasRenderingContext2D, col: number, row: number, rng: Rng): void {
  fillTile(ctx, col, row, '#E2D2A0');
  speckle(ctx, col, row, '#C9B786', 30, rng);
  speckle(ctx, col, row, '#F0E2B5', 18, rng);
}

function drawSnow(ctx: CanvasRenderingContext2D, col: number, row: number, rng: Rng): void {
  fillTile(ctx, col, row, '#EAF2F8');
  speckle(ctx, col, row, '#FFFFFF', 22, rng);
  speckle(ctx, col, row, '#CFE0EC', 14, rng);
}

function drawCoalOre(ctx: CanvasRenderingContext2D, col: number, row: number, rng: Rng): void {
  drawStone(ctx, col, row, rng);
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(rng() * (TILE - 3));
    const y = Math.floor(rng() * (TILE - 3));
    const w = 2 + Math.floor(rng() * 2);
    const h = 2 + Math.floor(rng() * 2);
    ctx.fillStyle = '#1A1A1A';
    ctx.fillRect(col * TILE + x, row * TILE + y, w, h);
  }
  speckle(ctx, col, row, '#000000', 10, rng);
}

function drawIronOre(ctx: CanvasRenderingContext2D, col: number, row: number, rng: Rng): void {
  drawStone(ctx, col, row, rng);
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(rng() * (TILE - 3));
    const y = Math.floor(rng() * (TILE - 3));
    const w = 2 + Math.floor(rng() * 2);
    const h = 2 + Math.floor(rng() * 2);
    ctx.fillStyle = '#C8865A';
    ctx.fillRect(col * TILE + x, row * TILE + y, w, h);
  }
  speckle(ctx, col, row, '#A8703E', 10, rng);
}

function drawDiamondOre(ctx: CanvasRenderingContext2D, col: number, row: number, rng: Rng): void {
  drawStone(ctx, col, row, rng);
  for (let i = 0; i < 5; i++) {
    const x = Math.floor(rng() * (TILE - 3));
    const y = Math.floor(rng() * (TILE - 3));
    const w = 2 + Math.floor(rng() * 2);
    const h = 2 + Math.floor(rng() * 2);
    ctx.fillStyle = '#4FC3F7';
    ctx.fillRect(col * TILE + x, row * TILE + y, w, h);
  }
  speckle(ctx, col, row, '#29B6F6', 10, rng);
}

function drawFurnaceSide(ctx: CanvasRenderingContext2D, col: number, row: number, rng: Rng): void {
  // Stone-grey furnace body — used for top and bottom faces
  fillTile(ctx, col, row, '#6b6b6b');
  speckle(ctx, col, row, '#555555', 24, rng);
  speckle(ctx, col, row, '#7d7d7d', 12, rng);
  // Horizontal mortar lines for a brick look
  ctx.fillStyle = '#4a4a4a';
  ctx.fillRect(col * TILE, row * TILE + 5,  TILE, 1);
  ctx.fillRect(col * TILE, row * TILE + 10, TILE, 1);
  ctx.fillRect(col * TILE, row * TILE + 15, TILE, 1);
}

function drawFurnaceFront(ctx: CanvasRenderingContext2D, col: number, row: number, rng: Rng): void {
  // Same grey body as drawFurnaceSide
  fillTile(ctx, col, row, '#6b6b6b');
  speckle(ctx, col, row, '#555555', 24, rng);
  speckle(ctx, col, row, '#7d7d7d', 12, rng);
  ctx.fillStyle = '#4a4a4a';
  ctx.fillRect(col * TILE, row * TILE + 5,  TILE, 1);
  ctx.fillRect(col * TILE, row * TILE + 10, TILE, 1);
  // Lintel bar just above the mouth
  ctx.fillStyle = '#8a8a8a';
  ctx.fillRect(col * TILE + 4, row * TILE + 6, 8, 1);
  // Dark recessed mouth opening x∈[4,12), y∈[7,13)
  ctx.fillStyle = '#2a2a2a';
  ctx.fillRect(col * TILE + 4, row * TILE + 7, 8, 6);
  // Ember glow pixels in the lower part of the mouth
  pixel(ctx, col, row, 5,  11, '#d2691e');
  pixel(ctx, col, row, 7,  12, '#ff8c1a');
  pixel(ctx, col, row, 10, 11, '#d2691e');
}

function drawGlass(ctx: CanvasRenderingContext2D, col: number, row: number, _rng: Rng): void {
  // Mostly transparent-looking pale tint
  ctx.fillStyle = '#C5DDED';
  ctx.fillRect(col * TILE, row * TILE, TILE, TILE);
  ctx.fillStyle = '#A8D0E6';
  // 1px outline inset by 1
  ctx.fillRect(col * TILE + 1, row * TILE + 1, TILE - 2, 1);
  ctx.fillRect(col * TILE + 1, row * TILE + TILE - 2, TILE - 2, 1);
  ctx.fillRect(col * TILE + 1, row * TILE + 1, 1, TILE - 2);
  ctx.fillRect(col * TILE + TILE - 2, row * TILE + 1, 1, TILE - 2);
  // A subtle highlight
  ctx.fillStyle = '#D6EAF5';
  ctx.fillRect(col * TILE + 2, row * TILE + 2, 4, 1);
}

function drawBedrock(ctx: CanvasRenderingContext2D, col: number, row: number, rng: Rng): void {
  fillTile(ctx, col, row, '#4A4A4A');
  // Jagged dark blotches
  for (let i = 0; i < 6; i++) {
    const x = Math.floor(rng() * (TILE - 4));
    const y = Math.floor(rng() * (TILE - 4));
    const w = 2 + Math.floor(rng() * 3);
    const h = 2 + Math.floor(rng() * 3);
    ctx.fillStyle = '#222222';
    ctx.fillRect(col * TILE + x, row * TILE + y, w, h);
  }
  speckle(ctx, col, row, '#333333', 20, rng);
  speckle(ctx, col, row, '#5A5A5A', 12, rng);
}

function drawWater(ctx: CanvasRenderingContext2D, col: number, row: number, rng: Rng): void {
  fillTile(ctx, col, row, '#3B6FCB');
  // 8 lighter horizontal wave streaks
  ctx.fillStyle = '#5A8AE0';
  for (let i = 0; i < 8; i++) {
    const len = 2 + Math.floor(rng() * 2); // 2-3 px
    const x = Math.floor(rng() * (TILE - len));
    const y = Math.floor(rng() * TILE);
    ctx.fillRect(col * TILE + x, row * TILE + y, len, 1);
  }
  // 4 darker horizontal wave streaks
  ctx.fillStyle = '#2D5AA8';
  for (let i = 0; i < 4; i++) {
    const len = 2 + Math.floor(rng() * 2); // 2-3 px
    const x = Math.floor(rng() * (TILE - len));
    const y = Math.floor(rng() * TILE);
    ctx.fillRect(col * TILE + x, row * TILE + y, len, 1);
  }
}

function drawChest(ctx: CanvasRenderingContext2D, col: number, row: number, rng: Rng): void {
  // Planks-like wood-brown base — alternating horizontal bands like drawPlanks
  for (let y = 0; y < TILE; y++) {
    const band = Math.floor(y / 4);
    ctx.fillStyle = band % 2 === 0 ? '#b6824a' : '#9e7140';
    ctx.fillRect(col * TILE, row * TILE + y, TILE, 1);
  }
  // Vertical seams (offset per band, same pattern as drawPlanks)
  ctx.fillStyle = '#6e4923';
  for (let y = 0; y < TILE; y += 4) {
    const offset = (y / 4) % 2 === 0 ? 5 : 11;
    ctx.fillRect(col * TILE + offset, row * TILE + y, 1, 4);
  }
  // Horizontal seams between bands
  ctx.fillStyle = '#6e4923';
  for (let y = 4; y < TILE; y += 4) {
    ctx.fillRect(col * TILE, row * TILE + y - 1, TILE, 1);
  }
  // Lid seam: darker horizontal line across the middle (y=7)
  ctx.fillStyle = '#3d2a10';
  ctx.fillRect(col * TILE, row * TILE + 7, TILE, 1);
  // Metal latch: small rectangle centered on the seam (3×3 centered at x=6..8, y=6..8)
  ctx.fillStyle = '#c8a84b';
  ctx.fillRect(col * TILE + 6, row * TILE + 6, 4, 3);
  ctx.fillStyle = '#a08030';
  ctx.fillRect(col * TILE + 7, row * TILE + 7, 2, 1);
  speckle(ctx, col, row, '#8a6038', 6, rng);
}

function drawDoorLower(ctx: CanvasRenderingContext2D, col: number, row: number, rng: Rng): void {
  // Vertical wood planks
  for (let x = 0; x < TILE; x++) {
    const band = Math.floor(x / 5);
    ctx.fillStyle = band % 2 === 0 ? '#9E7140' : '#82602F';
    ctx.fillRect(col * TILE + x, row * TILE, 1, TILE);
  }
  // Outer frame (left/right/bottom darker)
  ctx.fillStyle = '#5C3A1B';
  ctx.fillRect(col * TILE, row * TILE, 1, TILE);
  ctx.fillRect(col * TILE + TILE - 1, row * TILE, 1, TILE);
  ctx.fillRect(col * TILE, row * TILE + TILE - 1, TILE, 1);
  // Inset lower panel
  ctx.fillStyle = '#6E4923';
  ctx.fillRect(col * TILE + 3, row * TILE + 2, TILE - 6, TILE - 4);
  ctx.fillStyle = '#A6794A';
  ctx.fillRect(col * TILE + 4, row * TILE + 3, TILE - 8, TILE - 6);
  // Handle knob near the right edge, mid-height
  ctx.fillStyle = '#2B2B2B';
  ctx.fillRect(col * TILE + TILE - 4, row * TILE + 7, 2, 2);
  speckle(ctx, col, row, '#8A6038', 6, rng);
}

function drawTorch(ctx: CanvasRenderingContext2D, col: number, row: number, rng: Rng): void {
  const x0 = col * TILE;
  const y0 = row * TILE;
  // Opaque wooden handle fills the whole tile — NO black background. The torch
  // renders on a thin (~2px) post whose 4 side faces each receive the full tile UV
  // under NearestFilter, so only the vertical layering reads reliably at distance;
  // horizontal detail is mostly averaged away. Hence a row-by-row design.
  ctx.fillStyle = '#6E4923';
  ctx.fillRect(x0, y0, TILE, TILE);
  // Rounded-stick shading: lighter central grain band, darker flanks.
  ctx.fillStyle = '#83592B';
  ctx.fillRect(x0 + 4, y0, 8, TILE);
  ctx.fillStyle = '#553619';
  ctx.fillRect(x0, y0, 3, TILE);
  ctx.fillRect(x0 + TILE - 3, y0, 3, TILE);
  // Subtle vertical grain streaks down the handle.
  ctx.fillStyle = '#4E3115';
  for (let x = 0; x < TILE; x++) {
    if (rng() < 0.22) {
      ctx.fillRect(x0 + x, y0 + 6, 1, TILE - 6);
    }
  }
  // Flame on top — layered warm gradient (overwrites the handle in the top rows).
  ctx.fillStyle = '#C2480A'; ctx.fillRect(x0, y0 + 4, TILE, 2);          // ember base
  ctx.fillStyle = '#FF8A1E'; ctx.fillRect(x0, y0 + 3, TILE, 1);          // orange
  ctx.fillStyle = '#FFB02A'; ctx.fillRect(x0 + 1, y0 + 2, TILE - 2, 1);  // amber
  ctx.fillStyle = '#FFD24A'; ctx.fillRect(x0 + 3, y0 + 1, TILE - 6, 1);  // yellow core
  ctx.fillStyle = '#FFF3B0'; ctx.fillRect(x0 + 4, y0, 8, 1);             // white-hot tip
  // A few warm sparkles around the flame.
  speckle(ctx, col, row, '#FFE680', 3, rng);
}

function drawGlowstone(ctx: CanvasRenderingContext2D, col: number, row: number, rng: Rng): void {
  fillTile(ctx, col, row, '#C99A2E');                 // warm gold base
  speckle(ctx, col, row, '#9C7320', 26, rng);         // darker amber grains
  speckle(ctx, col, row, '#F2C84B', 30, rng);         // bright gold grains
  speckle(ctx, col, row, '#FFF0A8', 14, rng);         // hot near-white highlights
  // A few darker "cell" cracks dividing the block into glowstone-like cells.
  ctx.fillStyle = '#7A5616';
  ctx.fillRect(col * TILE, row * TILE + 6, TILE, 1);
  ctx.fillRect(col * TILE + 6, row * TILE, 1, 7);
  ctx.fillRect(col * TILE + 10, row * TILE + 7, 1, TILE - 7);
}

function drawBed(ctx: CanvasRenderingContext2D, col: number, row: number, rng: Rng): void {
  const x0 = col * TILE;
  const y0 = row * TILE;
  // Red quilt base
  fillTile(ctx, col, row, '#A93B36');
  speckle(ctx, col, row, '#922F2B', 24, rng);
  speckle(ctx, col, row, '#C24A44', 16, rng);
  // Stitched quilt seams (a simple cross grid in the lower mattress area)
  ctx.fillStyle = '#7C2622';
  ctx.fillRect(x0, y0 + 8, TILE, 1);
  ctx.fillRect(x0 + 7, y0 + 8, 1, TILE - 8);
  // Cream pillow band across the top (drawn last so it sits above the speckle)
  ctx.fillStyle = '#ECE6D8';
  ctx.fillRect(x0, y0, TILE, 5);
  ctx.fillStyle = '#D2C9B4';
  ctx.fillRect(x0, y0 + 5, TILE, 1); // pillow shadow line
  speckle(ctx, col, row, '#F4EEE0', 6, rng); // faint pillow highlights (top area only matters visually)
}

function drawDoorUpper(ctx: CanvasRenderingContext2D, col: number, row: number, rng: Rng): void {
  // Vertical wood planks (same palette as lower)
  for (let x = 0; x < TILE; x++) {
    const band = Math.floor(x / 5);
    ctx.fillStyle = band % 2 === 0 ? '#9E7140' : '#82602F';
    ctx.fillRect(col * TILE + x, row * TILE, 1, TILE);
  }
  // Outer frame (left/right/top darker)
  ctx.fillStyle = '#5C3A1B';
  ctx.fillRect(col * TILE, row * TILE, 1, TILE);
  ctx.fillRect(col * TILE + TILE - 1, row * TILE, 1, TILE);
  ctx.fillRect(col * TILE, row * TILE, TILE, 1);
  // Window recess with two pale-blue panes near the top
  ctx.fillStyle = '#3A2A10';
  ctx.fillRect(col * TILE + 3, row * TILE + 2, TILE - 6, 6);
  ctx.fillStyle = '#A8D0E6';
  ctx.fillRect(col * TILE + 4, row * TILE + 3, 3, 4);
  ctx.fillRect(col * TILE + 9, row * TILE + 3, 3, 4);
  // Lower panel hint
  ctx.fillStyle = '#6E4923';
  ctx.fillRect(col * TILE + 3, row * TILE + 9, TILE - 6, TILE - 11);
  speckle(ctx, col, row, '#8A6038', 6, rng);
}

function drawBlank(ctx: CanvasRenderingContext2D, col: number, row: number): void {
  fillTile(ctx, col, row, '#000000');
}

export class TextureAtlas implements ITextureAtlas {
  texture: THREE.Texture;
  readonly tileCount = COLS * ROWS;

  constructor() {
    const canvas = document.createElement('canvas');
    canvas.width = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d');
    if (ctx === null) {
      throw new Error('TextureAtlas: failed to get 2D context');
    }
    ctx.imageSmoothingEnabled = false;

    const rng = makeRng(0xdeadbeef);

    // 5x5 grid: index = row * COLS + col
    // Tiles 0..24 are real.
    const drawers: Array<(c: CanvasRenderingContext2D, col: number, row: number, r: Rng) => void> = [
      drawGrassTop,
      drawDirt,
      drawGrassSide,
      drawStone,
      drawCobblestone,
      drawWoodTop,
      drawWoodSide,
      drawLeaves,
      drawPlanks,
      drawSand,
      drawGlass,
      drawBedrock,
      drawWater,
      drawSnow,
      drawCoalOre,
      drawIronOre,
      drawFurnaceFront,  // tile 16 — furnace mouth face (used for all 4 vertical sides)
      drawFurnaceSide,   // tile 17 — plain stone face (used for top and bottom)
      drawDiamondOre,    // tile 18 — diamond ore (cyan speckled stone)
      drawChest,         // tile 19 — wooden chest face
      drawDoorLower,     // tile 20 — door lower half
      drawDoorUpper,     // tile 21 — door upper half
      drawTorch,         // tile 22 — torch (wooden post + flame)
      drawGlowstone,     // tile 23 — glowstone (warm gold glowing cells)
      drawBed,           // tile 24 — bed (red quilt + cream pillow)
    ];

    for (let i = 0; i < this.tileCount; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const drawer = drawers[i];
      if (drawer !== undefined) {
        drawer(ctx, col, row, rng);
      } else {
        drawBlank(ctx, col, row);
      }
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.needsUpdate = true;
    this.texture = tex;
  }

  getUV(tileIndex: number): [number, number, number, number] {
    const col = tileIndex % COLS;
    const row = Math.floor(tileIndex / COLS);
    const u0 = (col * TILE) / SIZE;
    const u1 = ((col + 1) * TILE) / SIZE;
    const v1 = 1 - (row * TILE) / SIZE;
    const v0 = 1 - ((row + 1) * TILE) / SIZE;
    const eps = 0.5 / SIZE;
    return [u0 + eps, v0 + eps, u1 - eps, v1 - eps];
  }
}
