import { BlockId } from '../types.js';

/** Atlas tile indices for the three foliage textures (drawn by TextureAtlas at these slots). */
export const TALL_GRASS_TILE = 30;
export const FLOWER_RED_TILE = 31;
export const FLOWER_YELLOW_TILE = 32;

// Atlas tile-slot indices (0-based into the 6x6 atlas grid), a DIFFERENT namespace
// from BlockId — the numeric overlap with BlockId.TORCH_WALL_* (33/34/35) is coincidental.
/** Atlas tiles for the 3D flower model (drawn by TextureAtlas at these slots). */
export const FLOWER_STEM_TILE = 33;
export const FLOWER_PETALS_RED_TILE = 34;
export const FLOWER_PETALS_YELLOW_TILE = 35;

/** True for the 3D-model flower blocks (red + yellow). Tall grass is NOT a flower. */
export function isFlowerBlock(id: number): boolean {
  return id === BlockId.FLOWER_RED || id === BlockId.FLOWER_YELLOW;
}

/** Petal-tile index for a flower block id. */
export function flowerPetalTile(id: BlockId): number {
  return id === BlockId.FLOWER_YELLOW ? FLOWER_PETALS_YELLOW_TILE : FLOWER_PETALS_RED_TILE;
}

/** One quad of the static flower model: 4 cell-local corners [0,1]^3 (order: bottom-start,
 *  bottom-end, top-end, top-start so UVs map (u0,v0),(u1,v0),(u1,v1),(u0,v1)) + which texture. */
interface FlowerQuad { c: [number, number, number][]; tile: 'stem' | 'petal'; }

/** Thin green stem box (x,z in [0.44,0.56], y 0->0.50) + flat petal head box
 *  (x,z in [0.28,0.72], y 0.46->0.66), centered at the cell bottom-center. */
export const FLOWER_MODEL_QUADS: ReadonlyArray<FlowerQuad> = [
  // Stem box — 4 side faces (sx0=0.44 sx1=0.56 sz0=0.44 sz1=0.56 sy0=0 sy1=0.5)
  { tile: 'stem', c: [[0.44,0,0.56],[0.56,0,0.56],[0.56,0.5,0.56],[0.44,0.5,0.56]] }, // +Z
  { tile: 'stem', c: [[0.56,0,0.44],[0.44,0,0.44],[0.44,0.5,0.44],[0.56,0.5,0.44]] }, // -Z
  { tile: 'stem', c: [[0.56,0,0.56],[0.56,0,0.44],[0.56,0.5,0.44],[0.56,0.5,0.56]] }, // +X
  { tile: 'stem', c: [[0.44,0,0.44],[0.44,0,0.56],[0.44,0.5,0.56],[0.44,0.5,0.44]] }, // -X
  // Petal head box — 4 sides + top (bx0=0.28 bx1=0.72 bz0=0.28 bz1=0.72 by0=0.46 by1=0.66)
  { tile: 'petal', c: [[0.28,0.46,0.72],[0.72,0.46,0.72],[0.72,0.66,0.72],[0.28,0.66,0.72]] }, // +Z
  { tile: 'petal', c: [[0.72,0.46,0.28],[0.28,0.46,0.28],[0.28,0.66,0.28],[0.72,0.66,0.28]] }, // -Z
  { tile: 'petal', c: [[0.72,0.46,0.72],[0.72,0.46,0.28],[0.72,0.66,0.28],[0.72,0.66,0.72]] }, // +X
  { tile: 'petal', c: [[0.28,0.46,0.28],[0.28,0.46,0.72],[0.28,0.66,0.72],[0.28,0.66,0.28]] }, // -X
  { tile: 'petal', c: [[0.28,0.66,0.28],[0.72,0.66,0.28],[0.72,0.66,0.72],[0.28,0.66,0.72]] }, // +Y top
];

/**
 * Emit the 3D flower model into the SOLID mesh arrays. Mirrors emitCrossGeometry's
 * conventions: positions are absolute (cell-local + the wx,ly,wz min-corner), UVs map the
 * full tile per quad, colors carry baked light (r=sky, g=block) — material is UNLIT.
 * @param stemUV   atlas.getUV(FLOWER_STEM_TILE)
 * @param petalUV  atlas.getUV(flowerPetalTile(id))
 */
export function emitFlowerGeometry(
  out: CrossMeshArrays,
  wx: number, ly: number, wz: number,
  stemUV: [number, number, number, number],
  petalUV: [number, number, number, number],
  skyBrightness: number,
  blockBrightness: number,
): void {
  const r = skyBrightness;
  const g = blockBrightness;
  for (const q of FLOWER_MODEL_QUADS) {
    const uv = q.tile === 'stem' ? stemUV : petalUV;
    const [u0, v0, u1, v1] = uv;
    const sv = out.positions.length / 3;
    for (let i = 0; i < 4; i++) {
      const corner = q.c[i]!;
      out.positions.push(wx + corner[0]!, ly + corner[1]!, wz + corner[2]!);
      out.normals.push(0, 1, 0); // cosmetic — unlit material ignores normals
      out.colors.push(r, g, 0);
    }
    out.uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
    out.indices.push(sv, sv + 1, sv + 2, sv, sv + 2, sv + 3);
  }
}

/** Growable vertex arrays the mesher accumulates into (solid buffers). */
export interface CrossMeshArrays {
  positions: number[];
  normals: number[];
  uvs: number[];
  colors: number[];
  indices: number[];
}

/** True for the cross-quad foliage blocks (tall grass + flowers). */
export function isCrossBlock(id: number): boolean {
  return id === BlockId.TALL_GRASS || id === BlockId.FLOWER_RED || id === BlockId.FLOWER_YELLOW;
}

/** Atlas tile index for a given foliage block id. */
export function crossBlockTile(id: BlockId): number {
  if (id === BlockId.FLOWER_RED) return FLOWER_RED_TILE;
  if (id === BlockId.FLOWER_YELLOW) return FLOWER_YELLOW_TILE;
  return TALL_GRASS_TILE;
}

/**
 * Emit two crossed vertical quads (an "X" footprint) filling the voxel cell.
 * @param out   mesh arrays to append into (the SOLID mesh arrays)
 * @param wx,ly,wz  world X, local-or-world Y, world Z of the cell's MIN corner (integer block coords)
 * @param tileUV  [u0,v0,u1,v1] from atlas.getUV(tile)
 * @param skyBrightness   goes into color.r (day/night-dimmable sky light multiplier)
 * @param blockBrightness goes into color.g (emitter/block light multiplier)
 */
export function emitCrossGeometry(
  out: CrossMeshArrays,
  wx: number,
  ly: number,
  wz: number,
  tileUV: [number, number, number, number],
  skyBrightness: number,
  blockBrightness: number,
): void {
  const x0 = wx;
  const x1 = wx + 1;
  const z0 = wz;
  const z1 = wz + 1;
  const y0 = ly;
  const y1 = ly + 1;

  const u0 = tileUV[0];
  const v0 = tileUV[1];
  const u1 = tileUV[2];
  const v1 = tileUV[3];

  // Foliage is unlit (MeshBasicMaterial + DoubleSide), so no per-face shading — flat cutout.
  const r = skyBrightness;
  const g = blockBrightness;

  // Helper: emit a single quad into out. Normals are cosmetic (DoubleSide material).
  // UV order matches Torch.ts: v0→(u0,v0), v1→(u1,v0), v2→(u1,v1), v3→(u0,v1).
  // Index winding: sv, sv+1, sv+2, sv, sv+2, sv+3.
  function quad(
    c0x: number, c0y: number, c0z: number,
    c1x: number, c1y: number, c1z: number,
    c2x: number, c2y: number, c2z: number,
    c3x: number, c3y: number, c3z: number,
    nx: number, ny: number, nz: number,
  ): void {
    const sv = out.positions.length / 3;
    out.positions.push(c0x, c0y, c0z, c1x, c1y, c1z, c2x, c2y, c2z, c3x, c3y, c3z);
    out.normals.push(nx, ny, nz, nx, ny, nz, nx, ny, nz, nx, ny, nz);
    out.uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
    out.colors.push(
      r, g, 0,
      r, g, 0,
      r, g, 0,
      r, g, 0,
    );
    out.indices.push(sv, sv + 1, sv + 2, sv, sv + 2, sv + 3);
  }

  // Quad 1: diagonal from (x0,z0) to (x1,z1). Normal perpendicular to the diagonal: normalize(-1,0,1).
  quad(x0, y0, z0,  x1, y0, z1,  x1, y1, z1,  x0, y1, z0,  -0.7071, 0, 0.7071);

  // Quad 2: diagonal from (x0,z1) to (x1,z0). Normal perpendicular to the diagonal: normalize(1,0,1).
  quad(x0, y0, z1,  x1, y0, z0,  x1, y1, z0,  x0, y1, z1,   0.7071, 0, 0.7071);
}
