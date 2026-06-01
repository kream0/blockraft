import * as THREE from 'three';
import type { ITextureAtlas, WorkerAtlasParams } from '../types';

const TILE = 16;
const COLS = 6;
const ROWS = 6;
const SIZE = TILE * COLS;

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

function drawLava(ctx: CanvasRenderingContext2D, col: number, row: number, rng: Rng): void {
  // Deep orange-red molten base
  fillTile(ctx, col, row, '#D8401A');
  // Glowing crack streaks — bright orange/amber horizontal lines
  ctx.fillStyle = '#FF8A1E';
  for (let i = 0; i < 6; i++) {
    const len = 2 + Math.floor(rng() * 4); // 2-5 px
    const x = Math.floor(rng() * (TILE - len));
    const y = Math.floor(rng() * TILE);
    ctx.fillRect(col * TILE + x, row * TILE + y, len, 1);
  }
  // Brighter amber cracks
  ctx.fillStyle = '#FFB02A';
  for (let i = 0; i < 4; i++) {
    const len = 2 + Math.floor(rng() * 3); // 2-4 px
    const x = Math.floor(rng() * (TILE - len));
    const y = Math.floor(rng() * TILE);
    ctx.fillRect(col * TILE + x, row * TILE + y, len, 1);
  }
  // Near-white-hot glowing pixels at crack intersections
  speckle(ctx, col, row, '#FFE08A', 5, rng);
  // Dark crust spots
  speckle(ctx, col, row, '#7A2208', 8, rng);
}

function drawCactusSide(ctx: CanvasRenderingContext2D, col: number, row: number, rng: Rng): void {
  // Cactus stem side — ribbed green column
  fillTile(ctx, col, row, '#3C7D32');
  // 3 darker vertical grooves/ribs (1-2px wide, full tile height)
  const grooveCount = 3;
  const grooveXs = [
    Math.floor(rng() * 4) + 1,
    Math.floor(rng() * 4) + 6,
    Math.floor(rng() * 4) + 11,
  ];
  ctx.fillStyle = '#2E5F26';
  for (let g = 0; g < grooveCount; g++) {
    const gx = grooveXs[g] ?? (g * 5 + 2);
    const gw = rng() < 0.5 ? 1 : 2;
    ctx.fillRect(col * TILE + gx, row * TILE, gw, TILE);
  }
  // 2 lighter vertical highlights
  ctx.fillStyle = '#57A347';
  ctx.fillRect(col * TILE + Math.floor(rng() * 3) + 3, row * TILE, 1, TILE);
  ctx.fillRect(col * TILE + Math.floor(rng() * 3) + 9, row * TILE, 1, TILE);
  // Sparse pale spines (1px dots/dashes) scattered across the face
  ctx.fillStyle = '#D8E8C0';
  for (let i = 0; i < 6; i++) {
    const sx = Math.floor(rng() * TILE);
    const sy = Math.floor(rng() * TILE);
    const len = rng() < 0.5 ? 1 : 2;
    ctx.fillRect(col * TILE + sx, row * TILE + sy, Math.min(len, TILE - sx), 1);
  }
}

function drawCactusTop(ctx: CanvasRenderingContext2D, col: number, row: number, rng: Rng): void {
  // Cactus top cross-section — slightly darker green with central areole
  fillTile(ctx, col, row, '#356E2C');
  // Faint lighter rim (1px inset border)
  ctx.fillStyle = '#3C7D32';
  ctx.fillRect(col * TILE + 1, row * TILE + 1, TILE - 2, 1);
  ctx.fillRect(col * TILE + 1, row * TILE + TILE - 2, TILE - 2, 1);
  ctx.fillRect(col * TILE + 1, row * TILE + 1, 1, TILE - 2);
  ctx.fillRect(col * TILE + TILE - 2, row * TILE + 1, 1, TILE - 2);
  // Small darker center areole (3x3 cluster near center)
  ctx.fillStyle = '#264F20';
  const cx = col * TILE + Math.floor(rng() * 3) + 6;
  const cy = row * TILE + Math.floor(rng() * 3) + 6;
  ctx.fillRect(cx, cy, 3, 3);
  ctx.fillRect(cx + 1, cy + 1, 1, 1);
  // A couple of spine dots near the rim
  ctx.fillStyle = '#D8E8C0';
  for (let i = 0; i < 4; i++) {
    const sx = Math.floor(rng() * (TILE - 2)) + 1;
    const sy = Math.floor(rng() * (TILE - 2)) + 1;
    ctx.fillRect(col * TILE + sx, row * TILE + sy, 1, 1);
  }
}

function drawSandstoneTop(ctx: CanvasRenderingContext2D, col: number, row: number, rng: Rng): void {
  // Sandstone top cross-section — pale tan with faint inset rim and grain speckles
  fillTile(ctx, col, row, '#D9CB94');
  // 1px inset rim in a slightly darker tan (mirrors drawCactusTop rim technique)
  ctx.fillStyle = '#C9B97E';
  ctx.fillRect(col * TILE + 1, row * TILE + 1, TILE - 2, 1);
  ctx.fillRect(col * TILE + 1, row * TILE + TILE - 2, TILE - 2, 1);
  ctx.fillRect(col * TILE + 1, row * TILE + 1, 1, TILE - 2);
  ctx.fillRect(col * TILE + TILE - 2, row * TILE + 1, 1, TILE - 2);
  // ~10 grain speckles
  speckle(ctx, col, row, '#C9B97E', 10, rng);
}

function drawSandstoneSide(ctx: CanvasRenderingContext2D, col: number, row: number, rng: Rng): void {
  // Sandstone side face — layered sedimentary bands
  fillTile(ctx, col, row, '#D9CB94');
  // Horizontal mid band — y offset jittered slightly via rng
  const bandY = 6 + Math.floor(rng() * 2); // 6 or 7
  ctx.fillStyle = '#C9B97E';
  ctx.fillRect(col * TILE, row * TILE + bandY, TILE, 3);
  // Thin darker sediment line just above the band
  ctx.fillStyle = '#B8A86A';
  ctx.fillRect(col * TILE, row * TILE + bandY - 1, TILE, 1);
  // Faint grain speckles across the whole face
  speckle(ctx, col, row, '#C9B97E', 6, rng);
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

// Slot 33 — flower stem: solid stem-green with a couple lighter vertical streaks.
function drawFlowerStem(ctx: CanvasRenderingContext2D, col: number, row: number, _r: Rng): void {
  fillTile(ctx, col, row, '#3E7D27');
  for (let y = 0; y < 16; y++) {
    pixel(ctx, col, row, 6, y, '#5DAD3A');
    pixel(ctx, col, row, 10, y, '#357021');
  }
}

// Slot 34 — red flower petals: red field with a yellow center cluster (reads as a bloom).
function drawFlowerPetalsRed(ctx: CanvasRenderingContext2D, col: number, row: number, rng: Rng): void {
  fillTile(ctx, col, row, '#D9402F');
  speckle(ctx, col, row, '#B83323', 10, rng); // darker petal separations
  for (let y = 6; y <= 9; y++) for (let x = 6; x <= 9; x++) pixel(ctx, col, row, x, y, '#F2C84B'); // center
}

// Slot 35 — yellow flower petals: yellow field with an amber center cluster.
function drawFlowerPetalsYellow(ctx: CanvasRenderingContext2D, col: number, row: number, rng: Rng): void {
  fillTile(ctx, col, row, '#F2C84B');
  speckle(ctx, col, row, '#D8AE38', 10, rng);
  for (let y = 6; y <= 9; y++) for (let x = 6; x <= 9; x++) pixel(ctx, col, row, x, y, '#E08A1E');
}

// Slot 30 — tall grass tuft: 4 blades, transparent background.
// Roots cluster at high canvas-y (14–15 = bottom of tile = root of cross-quad).
// Tips taper to low canvas-y (2–5 = top of tile = tip of cross-quad).
function drawTallGrass(ctx: CanvasRenderingContext2D, col: number, row: number, _r: Rng): void {
  // Each blade: [rootX, leanDir, height] — rootX is tile-local, leanDir ±1
  const blades: Array<[number, number, number]> = [
    [6,  -1, 12],  // left-center blade, leans left, 12px tall
    [8,   1, 13],  // right-center blade, leans right, 13px tall
    [5,  -1, 10],  // far-left blade, leans left, shorter
    [9,   1, 11],  // far-right blade, leans right
    [7,   0, 14],  // center blade, straight, tallest
  ];
  const baseGreen = '#5DAD3A';
  const darkGreen  = '#3E7D27';
  for (let b = 0; b < blades.length; b++) {
    const blade = blades[b];
    if (blade === undefined) continue;
    const [rootX, lean, height] = blade;
    const color = b % 2 === 0 ? baseGreen : darkGreen;
    ctx.fillStyle = color;
    for (let step = 0; step < height; step++) {
      // Canvas y = 15 at root, decreasing to tip. Lean shifts x by 1 every 5px.
      const canvasY = 15 - step;
      const canvasX = rootX + lean * Math.floor(step / 5);
      if (canvasX < 0 || canvasX >= TILE) continue;
      pixel(ctx, col, row, canvasX, canvasY, color);
    }
  }
}

// Slot 31 — red flower: green stem from root (canvas-y 15) to canvas-y 7,
// small red blossom (plus-shape) centered at canvas-y 4, yellow center pixel.
// Transparent background — only stem and petal pixels are painted.
function drawRedFlower(ctx: CanvasRenderingContext2D, col: number, row: number, _r: Rng): void {
  const stemX = 8;
  const stemColor  = '#3E7D27';
  const petalColor = '#D9402F';
  const centerColor = '#F2C84B';
  // Stem: canvas-y 7 down to 15
  ctx.fillStyle = stemColor;
  for (let y = 7; y <= 15; y++) {
    pixel(ctx, col, row, stemX, y, stemColor);
  }
  // Two small leaves on the stem at mid-height
  pixel(ctx, col, row, stemX - 1, 11, stemColor);
  pixel(ctx, col, row, stemX + 1, 10, stemColor);
  // Blossom centered at (stemX, 4): a 5-pixel plus shape
  const bx = stemX;
  const by = 4;
  pixel(ctx, col, row, bx,     by,     petalColor); // center
  pixel(ctx, col, row, bx - 1, by,     petalColor); // left
  pixel(ctx, col, row, bx + 1, by,     petalColor); // right
  pixel(ctx, col, row, bx,     by - 1, petalColor); // top
  pixel(ctx, col, row, bx,     by + 1, petalColor); // bottom
  // Outer petal tips for a slightly fuller flower
  pixel(ctx, col, row, bx - 1, by - 1, petalColor);
  pixel(ctx, col, row, bx + 1, by - 1, petalColor);
  pixel(ctx, col, row, bx - 1, by + 1, petalColor);
  pixel(ctx, col, row, bx + 1, by + 1, petalColor);
  // Yellow center pixel
  pixel(ctx, col, row, bx, by, centerColor);
}

// Slot 32 — yellow flower: identical construction to red flower,
// yellow petals with amber center. Roots at high canvas-y (15), tips at canvas-y ~3.
function drawYellowFlower(ctx: CanvasRenderingContext2D, col: number, row: number, _r: Rng): void {
  const stemX = 8;
  const stemColor   = '#3E7D27';
  const petalColor  = '#F2C84B';
  const centerColor = '#E08A1E';
  // Stem: canvas-y 7 down to 15
  ctx.fillStyle = stemColor;
  for (let y = 7; y <= 15; y++) {
    pixel(ctx, col, row, stemX, y, stemColor);
  }
  // Two small leaves offset opposite to the red flower for variety
  pixel(ctx, col, row, stemX + 1, 11, stemColor);
  pixel(ctx, col, row, stemX - 1, 10, stemColor);
  // Blossom centered at (stemX, 4)
  const bx = stemX;
  const by = 4;
  pixel(ctx, col, row, bx,     by,     petalColor);
  pixel(ctx, col, row, bx - 1, by,     petalColor);
  pixel(ctx, col, row, bx + 1, by,     petalColor);
  pixel(ctx, col, row, bx,     by - 1, petalColor);
  pixel(ctx, col, row, bx,     by + 1, petalColor);
  pixel(ctx, col, row, bx - 1, by - 1, petalColor);
  pixel(ctx, col, row, bx + 1, by - 1, petalColor);
  pixel(ctx, col, row, bx - 1, by + 1, petalColor);
  pixel(ctx, col, row, bx + 1, by + 1, petalColor);
  // Amber center pixel
  pixel(ctx, col, row, bx, by, centerColor);
}

export class TextureAtlas implements ITextureAtlas {
  texture: THREE.Texture;
  readonly tileCount = COLS * ROWS;

  private currentTileSize = TILE;
  private gutter = 0;
  private atlasSize = SIZE;
  private anisotropy = 1;

  private _normalTexture: THREE.CanvasTexture;
  private _roughnessTexture: THREE.CanvasTexture;

  get normalTexture(): THREE.Texture { return this._normalTexture; }
  get roughnessTexture(): THREE.Texture { return this._roughnessTexture; }

  constructor(tileSize: number = TILE) {
    const canvas = this.paint(tileSize);
    const tex = new THREE.CanvasTexture(canvas);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestMipmapLinearFilter;
    tex.generateMipmaps = true;
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    tex.anisotropy = this.anisotropy;
    tex.needsUpdate = true;
    this.texture = tex;

    const normalCanvas = this.paintNormal(tileSize);
    const normalTex = new THREE.CanvasTexture(normalCanvas);
    normalTex.magFilter = THREE.LinearFilter;
    normalTex.minFilter = THREE.LinearMipmapLinearFilter;
    normalTex.generateMipmaps = true;
    normalTex.colorSpace = THREE.NoColorSpace;
    normalTex.wrapS = THREE.ClampToEdgeWrapping;
    normalTex.wrapT = THREE.ClampToEdgeWrapping;
    normalTex.anisotropy = this.anisotropy;
    normalTex.needsUpdate = true;
    this._normalTexture = normalTex;

    const roughnessCanvas = this.paintRoughness(tileSize);
    const roughnessTex = new THREE.CanvasTexture(roughnessCanvas);
    roughnessTex.magFilter = THREE.LinearFilter;
    roughnessTex.minFilter = THREE.LinearMipmapLinearFilter;
    roughnessTex.generateMipmaps = true;
    roughnessTex.colorSpace = THREE.NoColorSpace;
    roughnessTex.wrapS = THREE.ClampToEdgeWrapping;
    roughnessTex.wrapT = THREE.ClampToEdgeWrapping;
    roughnessTex.anisotropy = this.anisotropy;
    roughnessTex.needsUpdate = true;
    this._roughnessTexture = roughnessTex;
  }

  /** Repaint the atlas at a new tile size, reusing the same THREE.Texture (materials keep their binding). */
  rebuild(tileSize: number): void {
    const canvas = this.paint(tileSize);
    this.texture.image = canvas;
    this.texture.anisotropy = this.anisotropy;
    this.texture.needsUpdate = true;

    const normalCanvas = this.paintNormal(tileSize);
    this._normalTexture.image = normalCanvas;
    this._normalTexture.anisotropy = this.anisotropy;
    this._normalTexture.needsUpdate = true;

    const roughnessCanvas = this.paintRoughness(tileSize);
    this._roughnessTexture.image = roughnessCanvas;
    this._roughnessTexture.anisotropy = this.anisotropy;
    this._roughnessTexture.needsUpdate = true;
  }

  /** Live anisotropy (caller resolves 0=>max and clamps to GPU max). */
  setAnisotropy(level: number): void {
    this.anisotropy = level;
    this.texture.anisotropy = level;
    this.texture.needsUpdate = true;
    this._normalTexture.anisotropy = level;
    this._normalTexture.needsUpdate = true;
    this._roughnessTexture.anisotropy = level;
    this._roughnessTexture.needsUpdate = true;
  }

  getAtlasParams(): WorkerAtlasParams {
    return {
      tilePixels: this.currentTileSize,
      atlasCols: COLS,
      atlasRows: ROWS,
      atlasSize: this.atlasSize,
      gutterPixels: this.gutter,
    };
  }

  /**
   * Shared gutter-extrude step: copies tile edge pixels into the surrounding gutter region
   * so mip/trilinear sampling never crosses tile boundaries. Identical math to albedo.
   */
  private static extrudeGutters(
    ctx: CanvasRenderingContext2D,
    canvas: HTMLCanvasElement,
    tileCount: number,
    tileSize: number,
    gutter: number,
  ): void {
    if (gutter === 0) return;
    const cellPitch = tileSize + 2 * gutter;
    for (let i = 0; i < tileCount; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const x = col * cellPitch + gutter;
      const y = row * cellPitch + gutter;
      const s = tileSize;
      ctx.drawImage(canvas, x, y, s, 1, x, y - gutter, s, gutter);              // top
      ctx.drawImage(canvas, x, y + s - 1, s, 1, x, y + s, s, gutter);           // bottom
      ctx.drawImage(canvas, x, y, 1, s, x - gutter, y, gutter, s);              // left
      ctx.drawImage(canvas, x + s - 1, y, 1, s, x + s, y, gutter, s);           // right
      ctx.drawImage(canvas, x, y, 1, 1, x - gutter, y - gutter, gutter, gutter);        // TL
      ctx.drawImage(canvas, x + s - 1, y, 1, 1, x + s, y - gutter, gutter, gutter);    // TR
      ctx.drawImage(canvas, x, y + s - 1, 1, 1, x - gutter, y + s, gutter, gutter);    // BL
      ctx.drawImage(canvas, x + s - 1, y + s - 1, 1, 1, x + s, y + s, gutter, gutter); // BR
    }
  }

  /** Paints a fresh albedo canvas; updates currentTileSize/gutter/atlasSize; returns the canvas. */
  private paint(tileSize: number): HTMLCanvasElement {
    const gutter = TextureAtlas.gutterFor(tileSize);
    const cellPitch = tileSize + 2 * gutter;
    const atlasSize = COLS * cellPitch;
    const canvas = document.createElement('canvas');
    canvas.width = atlasSize;
    canvas.height = atlasSize;
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('TextureAtlas: failed to get 2D context');
    ctx.imageSmoothingEnabled = false;

    const rng = makeRng(0xdeadbeef);
    const scale = tileSize / TILE;

    // 6x6 grid: index = row * COLS + col
    // Tiles 0..29 are real.
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
      drawLava,          // tile 25 — lava (molten orange)
      drawCactusSide,    // tile 26 — cactus stem side (ribbed green)
      drawCactusTop,        // tile 27 — cactus top cross-section
      drawSandstoneTop,  // tile 28 — sandstone top (pale tan, speckled)
      drawSandstoneSide, // tile 29 — sandstone side (layered sediment bands)
      drawTallGrass,     // tile 30 — tall grass tuft (transparent, cross-quad foliage)
      drawRedFlower,     // tile 31 — red flower (transparent, cross-quad foliage)
      drawYellowFlower,  // tile 32 — yellow flower (transparent, cross-quad foliage)
      drawFlowerStem,          // tile 33 — flower stem (opaque green, 3D flower model)
      drawFlowerPetalsRed,     // tile 34 — red flower petals (opaque, 3D flower model)
      drawFlowerPetalsYellow,  // tile 35 — yellow flower petals (opaque, 3D flower model)
    ];

    for (let i = 0; i < this.tileCount; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const originX = col * cellPitch + gutter;
      const originY = row * cellPitch + gutter;
      ctx.setTransform(scale, 0, 0, scale, originX, originY);
      const drawer = drawers[i];
      if (drawer !== undefined) drawer(ctx, 0, 0, rng);
      else drawBlank(ctx, 0, 0);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);

    // Edge-extrude each tile's content into its gutter so mip/trilinear sampling
    // never crosses a tile boundary (no bleed from neighbors or transparent black).
    TextureAtlas.extrudeGutters(ctx, canvas, this.tileCount, tileSize, gutter);

    this.currentTileSize = tileSize;
    this.gutter = gutter;
    this.atlasSize = atlasSize;
    return canvas;
  }

  /**
   * Paints the normal-map atlas: a soft chamfer bevel on every tile edge.
   * All 36 tiles get the same procedural bevel — tangent-space, OpenGL +Y-up convention.
   * Center = flat (128,128,255). Border band tilts outward with a smoothstep ramp.
   * Uses a single ImageData pass for efficiency, then extrudes gutters.
   */
  private paintNormal(tileSize: number): HTMLCanvasElement {
    const gutter = TextureAtlas.gutterFor(tileSize);
    const cellPitch = tileSize + 2 * gutter;
    const atlasSize = COLS * cellPitch;
    const canvas = document.createElement('canvas');
    canvas.width = atlasSize;
    canvas.height = atlasSize;
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('TextureAtlas: failed to get 2D context (normal)');
    ctx.imageSmoothingEnabled = false;

    // band width in output pixels: 2@16, 4@32, 8@64
    const band = Math.max(2, Math.round(tileSize / 8));
    // Max tilt slope: normal at the very edge ≈ normalize(±0.5, ±0.5, 1)
    const maxSlope = 0.5;

    // Pre-compute per-output-pixel normal values for a single tile (reused for all 36 tiles)
    // px, py are in [0, tileSize)
    const tileNormals = new Uint8Array(tileSize * tileSize * 4);
    for (let py = 0; py < tileSize; py++) {
      for (let px = 0; px < tileSize; px++) {
        const dLeft   = px;
        const dRight  = tileSize - 1 - px;
        const dTop    = py;    // canvas top = small y; +G toward smaller canvas-y = OpenGL +Y
        const dBottom = tileSize - 1 - py;

        // Ramp factor [0,1]: 0 at edge, 1 at band inner boundary
        const tLeft   = dLeft   < band ? dLeft   / band : 1;
        const tRight  = dRight  < band ? dRight  / band : 1;
        const tTop    = dTop    < band ? dTop    / band : 1;
        const tBottom = dBottom < band ? dBottom / band : 1;

        // Smoothstep for soft chamfer
        const sLeft   = tLeft   * tLeft   * (3 - 2 * tLeft);
        const sRight  = tRight  * tRight  * (3 - 2 * tRight);
        const sTop    = tTop    * tTop    * (3 - 2 * tTop);
        const sBottom = tBottom * tBottom * (3 - 2 * tBottom);

        // Tilt: left edge → -X, right → +X, top (small canvas-y) → +Y, bottom → -Y
        let nx = 0;
        let ny = 0;
        if (dLeft   < band) nx += -(1 - sLeft)   * maxSlope;
        if (dRight  < band) nx +=  (1 - sRight)  * maxSlope;
        if (dTop    < band) ny +=  (1 - sTop)    * maxSlope;
        if (dBottom < band) ny += -(1 - sBottom) * maxSlope;

        const nz = 1.0;
        const len = Math.sqrt(nx * nx + ny * ny + nz * nz);

        const r = Math.round(Math.min(255, Math.max(0, (nx / len * 0.5 + 0.5) * 255)));
        const g = Math.round(Math.min(255, Math.max(0, (ny / len * 0.5 + 0.5) * 255)));
        const b = Math.round(Math.min(255, Math.max(0, (nz / len * 0.5 + 0.5) * 255)));

        const pi = (py * tileSize + px) * 4;
        tileNormals[pi]     = r;
        tileNormals[pi + 1] = g;
        tileNormals[pi + 2] = b;
        tileNormals[pi + 3] = 255;
      }
    }

    // Write the same bevel tile into every atlas slot in one ImageData pass
    const imageData = ctx.createImageData(atlasSize, atlasSize);
    const data = imageData.data;

    for (let i = 0; i < this.tileCount; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const originX = col * cellPitch + gutter;
      const originY = row * cellPitch + gutter;

      for (let py = 0; py < tileSize; py++) {
        for (let px = 0; px < tileSize; px++) {
          const pi = (py * tileSize + px) * 4;
          const ci = ((originY + py) * atlasSize + (originX + px)) * 4;
          data[ci]     = tileNormals[pi]     ?? 128;
          data[ci + 1] = tileNormals[pi + 1] ?? 128;
          data[ci + 2] = tileNormals[pi + 2] ?? 255;
          data[ci + 3] = 255;
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
    TextureAtlas.extrudeGutters(ctx, canvas, this.tileCount, tileSize, gutter);
    return canvas;
  }

  /**
   * Paints the roughness atlas. Roughness written to R+G+B (greyscale; MeshStandardMaterial
   * reads roughness from .g). Default 0.85 (matte). Glossy tile overrides via index.
   * A faint LCG speckle (seeded per-tile) avoids perfectly uniform fills.
   */
  private paintRoughness(tileSize: number): HTMLCanvasElement {
    const gutter = TextureAtlas.gutterFor(tileSize);
    const cellPitch = tileSize + 2 * gutter;
    const atlasSize = COLS * cellPitch;
    const canvas = document.createElement('canvas');
    canvas.width = atlasSize;
    canvas.height = atlasSize;
    const ctx = canvas.getContext('2d');
    if (ctx === null) throw new Error('TextureAtlas: failed to get 2D context (roughness)');
    ctx.imageSmoothingEnabled = false;

    // Per-tile roughness overrides (index → roughness in [0,1])
    const roughnessOverrides: Record<number, number> = {
      10: 0.25,  // glass
      12: 0.30,  // water
      15: 0.55,  // ironOre
      18: 0.40,  // diamondOre
      23: 0.55,  // glowstone
      25: 0.50,  // lava
      4:  0.95,  // cobblestone
      9:  0.92,  // sand
      13: 0.80,  // snow
    };
    const defaultRoughness = 0.85;
    const speckleStrength = 0.04; // ±4% roughness variation → byte range ±10

    const imageData = ctx.createImageData(atlasSize, atlasSize);
    const data = imageData.data;

    for (let i = 0; i < this.tileCount; i++) {
      const col = i % COLS;
      const row = Math.floor(i / COLS);
      const originX = col * cellPitch + gutter;
      const originY = row * cellPitch + gutter;

      const roughness = roughnessOverrides[i] ?? defaultRoughness;
      const baseByte = Math.round(Math.min(255, Math.max(0, roughness * 255)));
      const speckleRange = Math.round(speckleStrength * 255);

      // Per-tile seeded RNG for consistent, deterministic speckle
      const tileRng = makeRng((0xabcd1234 + i * 2654435761) >>> 0);

      for (let py = 0; py < tileSize; py++) {
        for (let px = 0; px < tileSize; px++) {
          const delta = Math.round((tileRng() * 2 - 1) * speckleRange);
          const byte = Math.min(255, Math.max(0, baseByte + delta));
          const ci = ((originY + py) * atlasSize + (originX + px)) * 4;
          data[ci]     = byte;
          data[ci + 1] = byte;
          data[ci + 2] = byte;
          data[ci + 3] = 255;
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
    TextureAtlas.extrudeGutters(ctx, canvas, this.tileCount, tileSize, gutter);
    return canvas;
  }

  private static gutterFor(tileSize: number): number {
    return tileSize <= TILE ? 0 : Math.round(tileSize / TILE); // 0 @16, 2 @32, 4 @64
  }

  getUV(tileIndex: number): [number, number, number, number] {
    const col = tileIndex % COLS;
    const row = Math.floor(tileIndex / COLS);
    const cellPitch = this.currentTileSize + 2 * this.gutter;
    const x0 = col * cellPitch + this.gutter;
    const x1 = x0 + this.currentTileSize;
    const yTop = row * cellPitch + this.gutter;
    const yBot = yTop + this.currentTileSize;
    const size = this.atlasSize;
    const u0 = x0 / size;
    const u1 = x1 / size;
    const v1 = 1 - yTop / size;
    const v0 = 1 - yBot / size;
    const eps = 0.5 / size;
    return [u0 + eps, v0 + eps, u1 - eps, v1 - eps];
  }
}
