import {
  BlockId,
  CHUNK_HEIGHT,
  CHUNK_SIZE,
  MAX_SKY_LIGHT,
  SKY_LIGHT_BRIGHTNESS,
  type WorkerBlockTable,
  type WorkerAtlasParams,
  type MeshBuffers,
} from '../types';
import {
  isDoorBlock,
  doorFacing,
  doorIsOpen,
  emitDoorGeometry,
  DOOR_TILE_LOWER,
  DOOR_TILE_UPPER,
  DOOR_TILE_EDGE,
  type DoorMeshArrays,
} from './Door';
import { emitTorchGeometry, TORCH_TILE } from './Torch';

/**
 * Standard voxel AO formula (0fps "Ambient occlusion for Minecraft-like worlds").
 * side1 / side2 are the two edge-adjacent blocks on the face plane; corner is the
 * diagonal block.  Returns 0 (darkest) .. 3 (unoccluded).
 */
export function aoLevel(side1: boolean, side2: boolean, corner: boolean): number {
  if (side1 && side2) return 0; // both edge neighbours solid → fully occluded
  return 3 - ((side1 ? 1 : 0) + (side2 ? 1 : 0) + (corner ? 1 : 0));
}

/** Per-AO-level brightness multipliers: index = level (0 darkest → 3 full bright). */
export const AO_BRIGHTNESS: readonly [number, number, number, number] = [0.5, 0.7, 0.85, 1.0];

/** Face direction tag — used to pick texture (top/bottom/side) and vertices. */
const enum Face {
  TOP = 0,
  BOTTOM = 1,
  NORTH = 2,
  SOUTH = 3,
  EAST = 4,
  WEST = 5,
}

/**
 * Per-face data: the four corner offsets of a unit cube (CCW from outside),
 * the face normal, and the neighbor offset (dx, dy, dz) for occlusion checks.
 *
 * Vertex order maps to UV corners: v0 → (u0,v0), v1 → (u1,v0), v2 → (u1,v1), v3 → (u0,v1).
 */
interface FaceData {
  corners: [
    [number, number, number],
    [number, number, number],
    [number, number, number],
    [number, number, number],
  ];
  normal: [number, number, number];
  neighbor: [number, number, number];
}

const FACES: Record<Face, FaceData> = {
  [Face.TOP]: {
    corners: [
      [0, 1, 0],
      [0, 1, 1],
      [1, 1, 1],
      [1, 1, 0],
    ],
    normal: [0, 1, 0],
    neighbor: [0, 1, 0],
  },
  [Face.BOTTOM]: {
    corners: [
      [0, 0, 0],
      [1, 0, 0],
      [1, 0, 1],
      [0, 0, 1],
    ],
    normal: [0, -1, 0],
    neighbor: [0, -1, 0],
  },
  [Face.NORTH]: {
    corners: [
      [1, 0, 0],
      [0, 0, 0],
      [0, 1, 0],
      [1, 1, 0],
    ],
    normal: [0, 0, -1],
    neighbor: [0, 0, -1],
  },
  [Face.SOUTH]: {
    corners: [
      [0, 0, 1],
      [1, 0, 1],
      [1, 1, 1],
      [0, 1, 1],
    ],
    normal: [0, 0, 1],
    neighbor: [0, 0, 1],
  },
  [Face.EAST]: {
    corners: [
      [1, 0, 1],
      [1, 0, 0],
      [1, 1, 0],
      [1, 1, 1],
    ],
    normal: [1, 0, 0],
    neighbor: [1, 0, 0],
  },
  [Face.WEST]: {
    corners: [
      [0, 0, 0],
      [0, 0, 1],
      [0, 1, 1],
      [0, 1, 0],
    ],
    normal: [-1, 0, 0],
    neighbor: [-1, 0, 0],
  },
};

const ALL_FACES: Face[] = [Face.TOP, Face.BOTTOM, Face.NORTH, Face.SOUTH, Face.EAST, Face.WEST];

// ---------------------------------------------------------------------------
// Halo helpers
// ---------------------------------------------------------------------------

const HALO = CHUNK_SIZE + 2;

/** Sample a block from the halo using CHUNK-LOCAL coords (lx,lz may be -1..CHUNK_SIZE). */
function haloGet(halo: Uint8Array, lx: number, ly: number, lz: number): BlockId {
  if (ly < 0 || ly >= CHUNK_HEIGHT) return BlockId.AIR;
  const hx = lx + 1;
  const hz = lz + 1;
  if (hx < 0 || hx >= HALO || hz < 0 || hz >= HALO) return BlockId.AIR;
  return (halo[hx + hz * HALO + ly * HALO * HALO] ?? BlockId.AIR) as BlockId;
}

function isTransparentId(t: WorkerBlockTable, id: BlockId): boolean {
  return (t.transparent[id] ?? 0) !== 0;
}

/** AO occluder test: not air AND not transparent (matches ChunkMesher.occludes). */
function occludes(t: WorkerBlockTable, id: BlockId): boolean {
  return id !== BlockId.AIR && !isTransparentId(t, id);
}

/** Local-coord AO sample (mirrors ChunkMesher.sampleOccludes, but halo-based). */
function sampleOccludes(t: WorkerBlockTable, halo: Uint8Array, lx: number, ly: number, lz: number): boolean {
  if (ly < 0 || ly >= CHUNK_HEIGHT) return false;
  return occludes(t, haloGet(halo, lx, ly, lz));
}

/**
 * Sample the sky-light level for the AO base cell from the lightHalo array.
 * `lx/ly/lz` are the LOCAL AO base cell coords (same coordinate space as haloGet).
 * - Y >= CHUNK_HEIGHT → open sky → MAX_SKY_LIGHT (15)
 * - Y < 0 → underground → 0
 * - otherwise: read from lightHalo at the same halo index as haloGet
 */
function sampleSkyLight(lightHalo: Uint8Array, lx: number, ly: number, lz: number): number {
  if (ly >= CHUNK_HEIGHT) return MAX_SKY_LIGHT;
  if (ly < 0) return 0;
  const hx = lx + 1;
  const hz = lz + 1;
  if (hx < 0 || hx >= HALO || hz < 0 || hz >= HALO) return 0;
  return lightHalo[hx + hz * HALO + ly * HALO * HALO] ?? 0;
}

/** Face-draw test, mirrors ChunkMesher.shouldDrawFace exactly. */
function shouldDrawFace(t: WorkerBlockTable, currentId: BlockId, currentTransparent: boolean, neighborId: BlockId): boolean {
  if (neighborId === BlockId.AIR) return true;
  const neighborTransparent = isTransparentId(t, neighborId);
  if (!neighborTransparent) return false;
  if (neighborId === currentId) return false;
  return true;
}

function tileForFace(t: WorkerBlockTable, id: BlockId, face: Face): number {
  if (face === Face.TOP) return t.texTop[id] ?? 0;
  if (face === Face.BOTTOM) return t.texBottom[id] ?? 0;
  return t.texSide[id] ?? 0;
}

/** UV for a tile — identical math to TextureAtlas.getUV, parameterised. */
function getUV(p: WorkerAtlasParams, tile: number): [number, number, number, number] {
  const col = tile % p.atlasCols;
  const row = Math.floor(tile / p.atlasCols);
  const u0 = (col * p.tilePixels) / p.atlasSize;
  const u1 = ((col + 1) * p.tilePixels) / p.atlasSize;
  const v1 = 1 - (row * p.tilePixels) / p.atlasSize;
  const v0 = 1 - ((row + 1) * p.tilePixels) / p.atlasSize;
  const eps = 0.5 / p.atlasSize;
  return [u0 + eps, v0 + eps, u1 - eps, v1 - eps];
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function buildChunkMeshBuffers(
  cx: number,
  cz: number,
  halo: Uint8Array,
  lightHalo: Uint8Array,
  blockTable: WorkerBlockTable,
  atlasParams: WorkerAtlasParams,
): { solid: MeshBuffers; water: MeshBuffers | null } {
  const solidPositions: number[] = [];
  const solidNormals: number[] = [];
  const solidUvs: number[] = [];
  const solidColors: number[] = [];
  const solidIndices: number[] = [];

  const solidOut: DoorMeshArrays = {
    positions: solidPositions,
    normals: solidNormals,
    uvs: solidUvs,
    colors: solidColors,
    indices: solidIndices,
  };

  const waterPositions: number[] = [];
  const waterNormals: number[] = [];
  const waterUvs: number[] = [];
  const waterColors: number[] = [];
  const waterIndices: number[] = [];

  const baseX = cx * CHUNK_SIZE;
  const baseZ = cz * CHUNK_SIZE;

  for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const id = haloGet(halo, lx, ly, lz);
        if (id === BlockId.AIR) continue;
        if (isDoorBlock(id)) {
          const wx = baseX + lx;
          const wz = baseZ + lz;
          const upper = isDoorBlock(haloGet(halo, lx, ly - 1, lz));
          const faceUV = getUV(atlasParams, upper ? DOOR_TILE_UPPER : DOOR_TILE_LOWER);
          const edgeUV = getUV(atlasParams, DOOR_TILE_EDGE);
          const level = sampleSkyLight(lightHalo, lx, ly, lz);
          const skyMul = SKY_LIGHT_BRIGHTNESS[level] ?? 1.0;
          emitDoorGeometry(solidOut, wx, ly, wz, doorFacing(id), doorIsOpen(id), upper, faceUV, edgeUV, skyMul);
          continue;
        }
        if (id === BlockId.TORCH) {
          const level = sampleSkyLight(lightHalo, lx, ly, lz); // lightHalo carries combined max(sky,block)
          const b = SKY_LIGHT_BRIGHTNESS[level] ?? 1.0;
          emitTorchGeometry(solidOut, baseX + lx, ly, baseZ + lz, getUV(atlasParams, TORCH_TILE), b);
          continue;
        }
        const isCurrentTransparent = isTransparentId(blockTable, id);
        const isWater = id === BlockId.WATER;

        const wx = baseX + lx;
        const wz = baseZ + lz;

        for (const face of ALL_FACES) {
          const data = FACES[face];
          const dx = data.neighbor[0];
          const dy = data.neighbor[1];
          const dz = data.neighbor[2];
          const ny = ly + dy;
          const nlx = lx + dx;
          const nlz = lz + dz;

          // Out-of-vertical-bounds neighbor: treat top as air, bottom as opaque (don't draw bedrock down-face).
          let neighborId: BlockId;
          if (ny < 0) {
            neighborId = BlockId.BEDROCK; // anything opaque suppresses the face
          } else if (ny >= CHUNK_HEIGHT) {
            neighborId = BlockId.AIR;
          } else {
            neighborId = haloGet(halo, nlx, ny, nlz);
          }

          if (!shouldDrawFace(blockTable, id, isCurrentTransparent, neighborId)) continue;

          const tile = tileForFace(blockTable, id, face);
          const uv = getUV(atlasParams, tile);
          const u0 = uv[0];
          const v0 = uv[1];
          const u1 = uv[2];
          const v1 = uv[3];

          const positions = isWater ? waterPositions : solidPositions;
          const normals = isWater ? waterNormals : solidNormals;
          const uvs = isWater ? waterUvs : solidUvs;
          const colors = isWater ? waterColors : solidColors;
          const indices = isWater ? waterIndices : solidIndices;

          const startVertex = positions.length / 3;

          // --- AO: derive tangent axes from the face normal (programmatic, not hand-tabulated) ---
          // The normal has exactly one non-zero component (±1). The other two axes are the tangents.
          // We identify them by finding which axes are zero in the normal.
          const normX = data.normal[0];
          const normY = data.normal[1];
          const normZ = data.normal[2];

          // AO sampling base: the cell across the face from the current block
          const baseAOx = lx + normX; // local coords of the cell one step in normal direction
          const baseAOy = ly + normY;
          const baseAOz = lz + normZ;

          // Determine the two tangent axis indices (0=X, 1=Y, 2=Z) — the axes where normal=0
          const tangentAxes: [number, number] = normX !== 0
            ? [1, 2] // normal along X → tangents are Y and Z
            : normY !== 0
              ? [0, 2] // normal along Y → tangents are X and Z
              : [0, 1]; // normal along Z → tangents are X and Y
          const uAxis = tangentAxes[0];
          const vAxis = tangentAxes[1];

          // Sky-light bake: one value per face (the AO base cell is the exposed air cell)
          const faceLight = sampleSkyLight(lightHalo, baseAOx, baseAOy, baseAOz);
          const skyMul = SKY_LIGHT_BRIGHTNESS[faceLight] ?? 1.0;

          // Compute per-vertex AO brightness and accumulate levels for flip-quad decision
          const aoLevels: [number, number, number, number] = [0, 0, 0, 0];
          const aoBrightness: [number, number, number, number] = [1.0, 1.0, 1.0, 1.0];

          for (let c = 0; c < 4; c++) {
            const corner = data.corners[c]!;
            // corner[axis] is 0 or 1; map to -1 or +1 sign along each tangent axis
            const sU = (corner[uAxis] ?? 0) === 1 ? 1 : -1;
            const sV = (corner[vAxis] ?? 0) === 1 ? 1 : -1;

            // Sample the three AO neighbors (side1, side2, corner diag) in the AO base plane
            // Each sample offset is applied to the AO base cell along the tangent axes.
            const s1x = baseAOx + (uAxis === 0 ? sU : 0);
            const s1y = baseAOy + (uAxis === 1 ? sU : 0);
            const s1z = baseAOz + (uAxis === 2 ? sU : 0);

            const s2x = baseAOx + (vAxis === 0 ? sV : 0);
            const s2y = baseAOy + (vAxis === 1 ? sV : 0);
            const s2z = baseAOz + (vAxis === 2 ? sV : 0);

            const scx = baseAOx + (uAxis === 0 ? sU : 0) + (vAxis === 0 ? sV : 0);
            const scy = baseAOy + (uAxis === 1 ? sU : 0) + (vAxis === 1 ? sV : 0);
            const scz = baseAOz + (uAxis === 2 ? sU : 0) + (vAxis === 2 ? sV : 0);

            const occ1 = sampleOccludes(blockTable, halo, s1x, s1y, s1z);
            const occ2 = sampleOccludes(blockTable, halo, s2x, s2y, s2z);
            const occC = sampleOccludes(blockTable, halo, scx, scy, scz);

            const level = aoLevel(occ1, occ2, occC);
            aoLevels[c] = level;
            aoBrightness[c] = AO_BRIGHTNESS[level] ?? 1.0;
          }

          for (let c = 0; c < 4; c++) {
            const corner = data.corners[c]!;
            positions.push(wx + corner[0], ly + corner[1], wz + corner[2]);
            normals.push(normX, normY, normZ);
            const b = (aoBrightness[c] ?? 1.0) * skyMul;
            colors.push(b, b, b);
          }
          // UV mapping: v0 → (u0,v0), v1 → (u1,v0), v2 → (u1,v1), v3 → (u0,v1)
          uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);

          // Flip-quad anti-interpolation fix: choose the diagonal that minimises the AO gradient.
          // Compare sums along both diagonals: (a0+a2) vs (a1+a3). Flip when the (0,2) diagonal
          // carries less total AO (i.e. would produce a brighter-to-darker ramp across the face).
          const a0 = aoLevels[0] ?? 3;
          const a1 = aoLevels[1] ?? 3;
          const a2 = aoLevels[2] ?? 3;
          const a3 = aoLevels[3] ?? 3;
          const sv = startVertex;
          if (a0 + a2 < a1 + a3) {
            // Flipped split: (0,1,3) and (1,2,3)
            indices.push(sv, sv + 1, sv + 3, sv + 1, sv + 2, sv + 3);
          } else {
            // Default split: (0,1,2) and (0,2,3)
            indices.push(sv, sv + 1, sv + 2, sv, sv + 2, sv + 3);
          }
        }
      }
    }
  }

  const solid: MeshBuffers = {
    positions: new Float32Array(solidPositions),
    normals: new Float32Array(solidNormals),
    uvs: new Float32Array(solidUvs),
    colors: new Float32Array(solidColors),
    indices: new Uint32Array(solidIndices),
  };
  const water: MeshBuffers | null = waterIndices.length > 0 ? {
    positions: new Float32Array(waterPositions),
    normals: new Float32Array(waterNormals),
    uvs: new Float32Array(waterUvs),
    colors: new Float32Array(waterColors),
    indices: new Uint32Array(waterIndices),
  } : null;
  return { solid, water };
}
