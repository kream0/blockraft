import { BlockId } from '../types';

/** Door facing = the cardinal the closed slab is flush against / faces toward. */
export const DoorFacing = { NORTH: 0, EAST: 1, SOUTH: 2, WEST: 3 } as const;
export type DoorFacing = (typeof DoorFacing)[keyof typeof DoorFacing];

/** Slab thickness as a fraction of a block (3/16, classic door depth). */
export const DOOR_THICKNESS = 3 / 16;

/** Atlas tile indices for the door faces (MUST match the TextureAtlas drawers). */
export const DOOR_TILE_LOWER = 20;
export const DOOR_TILE_UPPER = 21;
export const DOOR_TILE_EDGE = 8; // reuse the planks tile for the thin jamb edges

const DOOR_MIN = BlockId.DOOR_N_CLOSED; // 18
const DOOR_MAX = BlockId.DOOR_W_OPEN;   // 25

/** True iff `id` is any of the 8 door block ids. */
export function isDoorBlock(id: number): boolean {
  return id >= DOOR_MIN && id <= DOOR_MAX;
}

/** Compose a door BlockId from facing (0..3) + open flag. */
export function doorBlockId(facing: DoorFacing, open: boolean): BlockId {
  return (DOOR_MIN + facing * 2 + (open ? 1 : 0)) as BlockId;
}

/** Decode the facing of a door id. */
export function doorFacing(id: BlockId): DoorFacing {
  return (((id - DOOR_MIN) >> 1) & 3) as DoorFacing;
}

/** Decode whether a door id is open. */
export function doorIsOpen(id: BlockId): boolean {
  return ((id - DOOR_MIN) & 1) === 1;
}

/** Same facing, flipped open/closed. */
export function toggledDoor(id: BlockId): BlockId {
  return doorBlockId(doorFacing(id), !doorIsOpen(id));
}

// ---------------------------------------------------------------------------
// Geometry — shared by BOTH meshers (worker core + sync fallback).
// ---------------------------------------------------------------------------

export type DoorUV = readonly [number, number, number, number];

/** Growable vertex arrays the meshers accumulate into (solid buffers). */
export interface DoorMeshArrays {
  positions: number[];
  normals: number[];
  uvs: number[];
  colors: number[];
  indices: number[];
}

/**
 * Emit one door cell's thin oriented slab into `out`.
 * - (wx, ly, wz): the cell's MIN corner. wx/wz are WORLD coords; ly is the LOCAL chunk Y
 *   (both meshers push `ly + corner.y` for the vertex Y, so we mirror that here).
 * - `upper`: top vs bottom half of the 2-cell door. Controls the Y-cap face; the caller also
 *   passes the matching `faceUV` (upper vs lower tile).
 * - `faceUV` textures the two big panel faces; `edgeUV` textures the narrow jamb/top faces.
 * - `skyBrightness`: baked sky-light multiplier (0..1) for this cell.
 *
 * Closed: the slab is flush to the `facing` edge of the cell. Open: it is swung 90° onto a
 * fixed perpendicular edge so the doorway centre is clear. The bottom face is never drawn
 * (lower half rests on the floor; upper half's bottom is internal); the top face is drawn only
 * for the upper half.
 */
export function emitDoorGeometry(
  out: DoorMeshArrays,
  wx: number,
  ly: number,
  wz: number,
  facing: DoorFacing,
  open: boolean,
  upper: boolean,
  faceUV: DoorUV,
  edgeUV: DoorUV,
  skyBrightness: number,
): void {
  const T = DOOR_THICKNESS;
  // Slab footprint within the cell (x,z in [0,1]); y always spans the full cell [0,1].
  let x0 = 0;
  let x1 = 1;
  let z0 = 0;
  let z1 = 1;
  if (!open) {
    switch (facing) {
      case DoorFacing.NORTH: z0 = 0;     z1 = T; break;
      case DoorFacing.SOUTH: z0 = 1 - T; z1 = 1; break;
      case DoorFacing.EAST:  x0 = 1 - T; x1 = 1; break;
      case DoorFacing.WEST:  x0 = 0;     x1 = T; break;
    }
  } else {
    switch (facing) {
      case DoorFacing.NORTH: x0 = 0;     x1 = T; break; // swing onto the west edge
      case DoorFacing.SOUTH: x0 = 1 - T; x1 = 1; break; // swing onto the east edge
      case DoorFacing.EAST:  z0 = 0;     z1 = T; break; // swing onto the north edge
      case DoorFacing.WEST:  z0 = 1 - T; z1 = 1; break; // swing onto the south edge
    }
  }

  // The big panel faces are perpendicular to the slab's thin axis.
  const thinZ = z1 - z0 < 0.5;

  const SHADE_TOP = 1.0;
  const SHADE_BIG = 0.86;
  const SHADE_THIN = 0.7;

  const quad = (
    c0: readonly [number, number, number],
    c1: readonly [number, number, number],
    c2: readonly [number, number, number],
    c3: readonly [number, number, number],
    nx: number,
    ny: number,
    nz: number,
    uv: DoorUV,
    shade: number,
  ): void => {
    const start = out.positions.length / 3;
    const b = shade * skyBrightness;
    const corners: ReadonlyArray<readonly [number, number, number]> = [c0, c1, c2, c3];
    for (const c of corners) {
      out.positions.push(wx + c[0], ly + c[1], wz + c[2]);
      out.normals.push(nx, ny, nz);
      out.colors.push(b, b, b);
    }
    // UV mapping: v0 → (u0,v0), v1 → (u1,v0), v2 → (u1,v1), v3 → (u0,v1)
    out.uvs.push(uv[0], uv[1], uv[2], uv[1], uv[2], uv[3], uv[0], uv[3]);
    out.indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
  };

  // NORTH (−Z) and SOUTH (+Z): big when thinZ, else thin jamb.
  quad([x1, 0, z0], [x0, 0, z0], [x0, 1, z0], [x1, 1, z0], 0, 0, -1, thinZ ? faceUV : edgeUV, thinZ ? SHADE_BIG : SHADE_THIN);
  quad([x0, 0, z1], [x1, 0, z1], [x1, 1, z1], [x0, 1, z1], 0, 0, 1, thinZ ? faceUV : edgeUV, thinZ ? SHADE_BIG : SHADE_THIN);
  // EAST (+X) and WEST (−X): big when NOT thinZ, else thin jamb.
  quad([x1, 0, z1], [x1, 0, z0], [x1, 1, z0], [x1, 1, z1], 1, 0, 0, thinZ ? edgeUV : faceUV, thinZ ? SHADE_THIN : SHADE_BIG);
  quad([x0, 0, z0], [x0, 0, z1], [x0, 1, z1], [x0, 1, z0], -1, 0, 0, thinZ ? edgeUV : faceUV, thinZ ? SHADE_THIN : SHADE_BIG);
  // TOP (+Y): only the upper half caps the door column.
  if (upper) {
    quad([x0, 1, z0], [x0, 1, z1], [x1, 1, z1], [x1, 1, z0], 0, 1, 0, edgeUV, SHADE_TOP);
  }
  // BOTTOM (−Y): never drawn.
}
