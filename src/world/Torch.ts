import { BlockId } from '../types.js';

/** Atlas tile index for the torch face (wooden post + flame). */
export const TORCH_TILE = 22;

/** Growable vertex arrays the meshers accumulate into (solid buffers). */
export interface TorchMeshArrays {
  positions: number[];
  normals: number[];
  uvs: number[];
  colors: number[];
  indices: number[];
}

/**
 * Emit a thin centered torch post into `out`. World-space origin is the block's min corner (wx,ly,wz).
 * Post: 2/16 wide (half-width 1/16) centered at x+0.5, z+0.5.
 * Height 10/16 (bottom y+0 → top y+0.625). 4 side faces + top cap, NO bottom face.
 * Channel convention: color.r = skyBrightness (day/night-dimmable diffuse), color.g = blockBrightness
 * (scene-light-independent warm emissive), color.b = 0 (unused).
 * tileUV is [u0,v0,u1,v1] for TORCH_TILE.
 */
export function emitTorchGeometry(
  out: TorchMeshArrays,
  wx: number,
  ly: number,
  wz: number,
  tileUV: [number, number, number, number],
  skyBrightness: number,
  blockBrightness: number,
): void {
  const HW = 1 / 16;  // half-width of the post
  const H = 10 / 16;  // height of the post

  // Post X and Z extents (world-space)
  const x0 = wx + 0.5 - HW; // wx + 0.4375
  const x1 = wx + 0.5 + HW; // wx + 0.5625
  const z0 = wz + 0.5 - HW; // wz + 0.4375
  const z1 = wz + 0.5 + HW; // wz + 0.5625

  // Y extents
  const y0 = ly;
  const y1 = ly + H;

  const u0 = tileUV[0];
  const v0 = tileUV[1];
  const u1 = tileUV[2];
  const v1 = tileUV[3];

  // Helper: emit a single quad into out.
  // c0..c3 are the 4 corner positions; nx/ny/nz is the face normal.
  // UV order: v0→(u0,v0), v1→(u1,v0), v2→(u1,v1), v3→(u0,v1) — mirrors Door.ts.
  // Winding: CCW from outside (same convention as Door.ts).
  function quad(
    c0x: number, c0y: number, c0z: number,
    c1x: number, c1y: number, c1z: number,
    c2x: number, c2y: number, c2z: number,
    c3x: number, c3y: number, c3z: number,
    nx: number, ny: number, nz: number,
  ): void {
    const sv = out.positions.length / 3;
    // Fixed per-face directional shade matching the cube mesher (top=1.0, sides=0.8).
    const shade = ny > 0.5 ? 1.0 : 0.8;
    const r = shade * skyBrightness;
    const g = shade * blockBrightness;
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

  // NORTH face (-Z normal): corners CCW when viewed from -Z.
  // Matches Door.ts NORTH winding: [x1,0,z0], [x0,0,z0], [x0,1,z0], [x1,1,z0]
  quad(x1, y0, z0,  x0, y0, z0,  x0, y1, z0,  x1, y1, z0,  0, 0, -1);

  // SOUTH face (+Z normal): corners CCW when viewed from +Z.
  // Matches Door.ts SOUTH winding: [x0,0,z1], [x1,0,z1], [x1,1,z1], [x0,1,z1]
  quad(x0, y0, z1,  x1, y0, z1,  x1, y1, z1,  x0, y1, z1,  0, 0, 1);

  // EAST face (+X normal): corners CCW when viewed from +X.
  // Matches Door.ts EAST winding: [x1,0,z1], [x1,0,z0], [x1,1,z0], [x1,1,z1]
  quad(x1, y0, z1,  x1, y0, z0,  x1, y1, z0,  x1, y1, z1,  1, 0, 0);

  // WEST face (-X normal): corners CCW when viewed from -X.
  // Matches Door.ts WEST winding: [x0,0,z0], [x0,0,z1], [x0,1,z1], [x0,1,z0]
  quad(x0, y0, z0,  x0, y0, z1,  x0, y1, z1,  x0, y1, z0,  -1, 0, 0);

  // TOP face (+Y normal): corners CCW when viewed from above.
  // Matches Door.ts TOP winding: [x0,1,z0], [x0,1,z1], [x1,1,z1], [x1,1,z0]
  quad(x0, y1, z0,  x0, y1, z1,  x1, y1, z1,  x1, y1, z0,  0, 1, 0);

  // BOTTOM face (-Y): never drawn (torch rests on floor — internal face).
}

/** Returns true for BlockId.TORCH and all four wall-torch orientation variants (32..35). */
export function isTorchBlock(id: number): boolean {
  return id === BlockId.TORCH
    || id === BlockId.TORCH_WALL_NORTH
    || id === BlockId.TORCH_WALL_SOUTH
    || id === BlockId.TORCH_WALL_EAST
    || id === BlockId.TORCH_WALL_WEST;
}

/**
 * Returns the lean direction (the way the flame tips) for a wall-torch block id.
 * EAST = {x:1,z:0}, WEST = {x:-1,z:0}, SOUTH = {x:0,z:1}, NORTH = {x:0,z:-1}.
 * Returns {x:0,z:0} for any non-wall-torch id (won't be called in practice).
 */
export function wallTorchLean(id: BlockId): { x: number; z: number } {
  switch (id) {
    case BlockId.TORCH_WALL_EAST:  return { x:  1, z:  0 };
    case BlockId.TORCH_WALL_WEST:  return { x: -1, z:  0 };
    case BlockId.TORCH_WALL_SOUTH: return { x:  0, z:  1 };
    case BlockId.TORCH_WALL_NORTH: return { x:  0, z: -1 };
    default:                       return { x:  0, z:  0 };
  }
}

/**
 * Maps a horizontal face normal (nx, nz) to the appropriate wall-torch BlockId.
 * Dominant horizontal axis determines the variant: |nx| >= |nz| → EAST/WEST, else SOUTH/NORTH.
 * Caller is expected to pass only horizontal normals (from side-face raycasts).
 */
export function wallTorchIdForNormal(nx: number, nz: number): BlockId {
  if (Math.abs(nx) >= Math.abs(nz)) {
    return nx > 0 ? BlockId.TORCH_WALL_EAST : BlockId.TORCH_WALL_WEST;
  }
  return nz > 0 ? BlockId.TORCH_WALL_SOUTH : BlockId.TORCH_WALL_NORTH;
}

/**
 * Emit a canted wall-torch post into `out`. The post leans in the direction (leanX, leanZ)
 * (one of the four cardinal axis-aligned unit vectors) and is anchored against the wall on
 * the OPPOSITE side. Same output format as emitTorchGeometry.
 *
 * @param wx,ly,wz  - block min-corner in world space
 * @param tileUV    - [u0,v0,u1,v1] for TORCH_TILE
 * @param leanX,leanZ - lean direction unit vector (exactly one is ±1, the other is 0)
 */
export function emitWallTorchGeometry(
  out: TorchMeshArrays,
  wx: number,
  ly: number,
  wz: number,
  tileUV: [number, number, number, number],
  skyBrightness: number,
  blockBrightness: number,
  leanX: number,
  leanZ: number,
): void {
  const HW = 1 / 16;   // half-width of the post
  const H = 10 / 16;   // height of the post
  const TILT = 0.42;   // radians ≈ 24°
  const s = Math.sin(TILT);
  const c = Math.cos(TILT);

  // Anchor: the base of the post sits against the wall opposite the lean, partway up the block.
  const ax = wx + 0.5 - leanX * (0.5 - HW - 0.02);
  const az = wz + 0.5 - leanZ * (0.5 - HW - 0.02);
  const ay = ly + 0.20;

  const u0 = tileUV[0];
  const v0 = tileUV[1];
  const u1 = tileUV[2];
  const v1 = tileUV[3];

  /**
   * Transform a local-space vertex position (lpx,lpy,lpz) and normal (nlx,nly,nlz)
   * to world space by rotating about the horizontal axis perpendicular to the lean,
   * then translating to the anchor.
   */
  function transform(
    lpx: number, lpy: number, lpz: number,
    nlx: number, nly: number, nlz: number,
  ): { px: number; py: number; pz: number; nx: number; ny: number; nz: number } {
    let px: number, py: number, pz: number;
    let nx: number, ny: number, nz: number;

    if (leanX !== 0) {
      // Rotate about Z axis (axis perpendicular to leanX)
      px = ax + (lpx * c + leanX * lpy * s);
      py = ay + (-leanX * lpx * s + lpy * c);
      pz = az + lpz;
      nx = nlx * c + leanX * nly * s;
      ny = -leanX * nlx * s + nly * c;
      nz = nlz;
    } else {
      // Rotate about X axis (axis perpendicular to leanZ)
      pz = az + (lpz * c + leanZ * lpy * s);
      py = ay + (-leanZ * lpz * s + lpy * c);
      px = ax + lpx;
      nz = nlz * c + leanZ * nly * s;
      ny = -leanZ * nlz * s + nly * c;
      nx = nlx;
    }

    return { px, py, pz, nx, ny, nz };
  }

  /**
   * Emit a single quad. Local-space corners c0..c3 and face normal are transformed
   * to world space, then pushed into the output arrays in the same winding order as
   * emitTorchGeometry (CCW from outside). The shade rule uses the rotated normal's ny.
   */
  function quad(
    lc0x: number, lc0y: number, lc0z: number,
    lc1x: number, lc1y: number, lc1z: number,
    lc2x: number, lc2y: number, lc2z: number,
    lc3x: number, lc3y: number, lc3z: number,
    lnx: number, lny: number, lnz: number,
  ): void {
    const t0 = transform(lc0x, lc0y, lc0z, lnx, lny, lnz);
    const t1 = transform(lc1x, lc1y, lc1z, lnx, lny, lnz);
    const t2 = transform(lc2x, lc2y, lc2z, lnx, lny, lnz);
    const t3 = transform(lc3x, lc3y, lc3z, lnx, lny, lnz);

    // Use rotated normal's y for shade — top face retains ~cos(24°)≈0.91 > 0.5.
    const shade = t0.ny > 0.5 ? 1.0 : 0.8;
    const r = shade * skyBrightness;
    const g = shade * blockBrightness;

    const wn = { x: t0.nx, y: t0.ny, z: t0.nz };
    const sv = out.positions.length / 3;

    out.positions.push(t0.px, t0.py, t0.pz,  t1.px, t1.py, t1.pz,  t2.px, t2.py, t2.pz,  t3.px, t3.py, t3.pz);
    out.normals.push(wn.x, wn.y, wn.z,  wn.x, wn.y, wn.z,  wn.x, wn.y, wn.z,  wn.x, wn.y, wn.z);
    out.uvs.push(u0, v0,  u1, v0,  u1, v1,  u0, v1);
    out.colors.push(
      r, g, 0,
      r, g, 0,
      r, g, 0,
      r, g, 0,
    );
    out.indices.push(sv, sv + 1, sv + 2,  sv, sv + 2, sv + 3);
  }

  // Define the 4 corners of each local face exactly as emitTorchGeometry does,
  // using the same coordinate names (x0/x1/z0/z1/y0/y1) but in LOCAL space
  // (centred at origin). The transform() helper maps them to world space.
  const lx0 = -HW; const lx1 = HW;
  const lz0 = -HW; const lz1 = HW;
  const ly0 = 0;   const ly1 = H;

  // NORTH face (-Z normal)
  quad(lx1, ly0, lz0,  lx0, ly0, lz0,  lx0, ly1, lz0,  lx1, ly1, lz0,  0, 0, -1);

  // SOUTH face (+Z normal)
  quad(lx0, ly0, lz1,  lx1, ly0, lz1,  lx1, ly1, lz1,  lx0, ly1, lz1,  0, 0,  1);

  // EAST face (+X normal)
  quad(lx1, ly0, lz1,  lx1, ly0, lz0,  lx1, ly1, lz0,  lx1, ly1, lz1,  1, 0,  0);

  // WEST face (-X normal)
  quad(lx0, ly0, lz0,  lx0, ly0, lz1,  lx0, ly1, lz1,  lx0, ly1, lz0,  -1, 0, 0);

  // TOP face (+Y normal)
  quad(lx0, ly1, lz0,  lx0, ly1, lz1,  lx1, ly1, lz1,  lx1, ly1, lz0,  0, 1, 0);

  // BOTTOM face (-Y): not drawn, same as floor torch.
}
