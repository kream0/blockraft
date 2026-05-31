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
    out.positions.push(c0x, c0y, c0z, c1x, c1y, c1z, c2x, c2y, c2z, c3x, c3y, c3z);
    out.normals.push(nx, ny, nz, nx, ny, nz, nx, ny, nz, nx, ny, nz);
    out.uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
    out.colors.push(
      skyBrightness, blockBrightness, 0,
      skyBrightness, blockBrightness, 0,
      skyBrightness, blockBrightness, 0,
      skyBrightness, blockBrightness, 0,
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
