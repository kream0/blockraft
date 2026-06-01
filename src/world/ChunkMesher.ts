import * as THREE from 'three';
import {
  BlockId,
  CHUNK_HEIGHT,
  CHUNK_SIZE,
  MAX_SKY_LIGHT,
  SKY_LIGHT_BRIGHTNESS,
  BLOCK_LIGHT_BRIGHTNESS,
  type IBlockRegistry,
  type ITextureAtlas,
  type IWorld,
} from '../types';
import { Chunk } from './Chunk';
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
import { emitTorchGeometry, isTorchBlock, wallTorchLean, emitWallTorchGeometry, TORCH_TILE } from './Torch';
import { isCrossBlock, crossBlockTile, emitCrossGeometry } from './Foliage';

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

/**
 * Sample the sky-light level for a cell.
 * `lx/ly/lz` are the LOCAL cell coords (may be outside [0, CHUNK_SIZE)
 * on X/Z for cross-chunk faces; Y is absolute world-Y here, NOT chunk-local).
 * - Y >= CHUNK_HEIGHT → open sky → MAX_SKY_LIGHT (15)
 * - Y < 0 → underground → 0
 * - otherwise: delegate to world.getSkyLight with world coords
 */
function sampleSkyLight(
  world: IWorld,
  baseX: number,
  baseZ: number,
  lx: number,
  ly: number,
  lz: number,
): number {
  if (ly >= CHUNK_HEIGHT) return MAX_SKY_LIGHT;
  if (ly < 0) return 0;
  return world.getSkyLight(baseX + lx, ly, baseZ + lz);
}

/** Sample the block-light (emitter) level for a cell. Open sky and underground have NO block light → 0. */
function sampleBlockLight(
  world: IWorld,
  baseX: number,
  baseZ: number,
  lx: number,
  ly: number,
  lz: number,
): number {
  if (ly >= CHUNK_HEIGHT || ly < 0) return 0;
  return world.getBlockLight(baseX + lx, ly, baseZ + lz);
}

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

export class ChunkMesher {
  constructor(
    private atlas: ITextureAtlas,
    private registry: IBlockRegistry,
  ) {}

  /**
   * Build (or rebuild) the mesh for `chunk`, using `world` for cross-chunk neighbor lookups.
   * Returns a solid mesh (always) and an optional water mesh (only when the chunk contains
   * any water faces). Caller disposes any old meshes.
   */
  build(
    chunk: Chunk,
    world: IWorld,
    solidMaterial: THREE.Material,
    waterMaterial: THREE.Material,
  ): { solid: THREE.Mesh; water: THREE.Mesh | null } {
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

    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;

    for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const id = chunk.getBlock(lx, ly, lz);
          if (id === BlockId.AIR) continue;
          if (isDoorBlock(id)) {
            const wx = baseX + lx;
            const wz = baseZ + lz;
            const upper = isDoorBlock(chunk.getBlock(lx, ly - 1, lz));
            const faceUV = this.atlas.getUV(upper ? DOOR_TILE_UPPER : DOOR_TILE_LOWER);
            const edgeUV = this.atlas.getUV(DOOR_TILE_EDGE);
            const sky = sampleSkyLight(world, baseX, baseZ, lx, ly, lz);
            const block = sampleBlockLight(world, baseX, baseZ, lx, ly, lz);
            const skyMul = SKY_LIGHT_BRIGHTNESS[sky] ?? 1.0;
            const blockMul = BLOCK_LIGHT_BRIGHTNESS[block] ?? 0;
            emitDoorGeometry(solidOut, wx, ly, wz, doorFacing(id), doorIsOpen(id), upper, faceUV, edgeUV, skyMul, blockMul);
            continue;
          }
          if (isTorchBlock(id)) {
            const sky = sampleSkyLight(world, baseX, baseZ, lx, ly, lz);
            const block = sampleBlockLight(world, baseX, baseZ, lx, ly, lz);
            const skyMul = SKY_LIGHT_BRIGHTNESS[sky] ?? 1.0;
            const blockMul = BLOCK_LIGHT_BRIGHTNESS[block] ?? 0;
            if (id === BlockId.TORCH) {
              emitTorchGeometry(solidOut, baseX + lx, ly, baseZ + lz, this.atlas.getUV(TORCH_TILE), skyMul, blockMul);
            } else {
              const lean = wallTorchLean(id);
              emitWallTorchGeometry(solidOut, baseX + lx, ly, baseZ + lz, this.atlas.getUV(TORCH_TILE), skyMul, blockMul, lean.x, lean.z);
            }
            continue;
          }
          if (isCrossBlock(id)) {
            const sky = sampleSkyLight(world, baseX, baseZ, lx, ly, lz);
            const block = sampleBlockLight(world, baseX, baseZ, lx, ly, lz);
            const skyMul = SKY_LIGHT_BRIGHTNESS[sky] ?? 1.0;
            const blockMul = BLOCK_LIGHT_BRIGHTNESS[block] ?? 0;
            emitCrossGeometry(solidOut, baseX + lx, ly, baseZ + lz, this.atlas.getUV(crossBlockTile(id)), skyMul, blockMul);
            continue;
          }
          const def = this.registry.get(id);
          const isCurrentTransparent = def.transparent;
          const isWater = id === BlockId.WATER;

          const wx = baseX + lx;
          const wz = baseZ + lz;

          for (const face of ALL_FACES) {
            const data = FACES[face];
            const dx = data.neighbor[0];
            const dy = data.neighbor[1];
            const dz = data.neighbor[2];
            const nx = wx + dx;
            const ny = ly + dy;
            const nz = wz + dz;
            const nlx = lx + dx;
            const nlz = lz + dz;

            // Out-of-vertical-bounds neighbor: treat top as air, bottom as opaque (don't draw bedrock down-face).
            // For in-chunk lookups, skip the world.getBlock indirection.
            let neighborId: BlockId;
            if (ny < 0) {
              neighborId = BlockId.BEDROCK; // anything opaque suppresses the face
            } else if (ny >= CHUNK_HEIGHT) {
              neighborId = BlockId.AIR;
            } else if (nlx >= 0 && nlx < CHUNK_SIZE && nlz >= 0 && nlz < CHUNK_SIZE) {
              neighborId = chunk.getBlock(nlx, ny, nlz);
            } else {
              neighborId = world.getBlock(nx, ny, nz);
            }

            if (!this.shouldDrawFace(id, isCurrentTransparent, neighborId)) continue;

            const tile = this.tileForFace(def.textures, face);
            const uv = this.atlas.getUV(tile);
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

            // Light bake base cell (the cell across the face). Smooth lighting averages this
            // with the 3 plane-neighbors per corner so flat surfaces get a smooth gradient
            // instead of one flat value per face.
            const faceSky = sampleSkyLight(world, baseX, baseZ, baseAOx, baseAOy, baseAOz);
            const faceBlock = sampleBlockLight(world, baseX, baseZ, baseAOx, baseAOy, baseAOz);
            const skyBase = SKY_LIGHT_BRIGHTNESS[faceSky] ?? 1.0;
            const blockBase = BLOCK_LIGHT_BRIGHTNESS[faceBlock] ?? 0;

            // Compute per-vertex AO brightness and accumulate levels for flip-quad decision
            const aoLevels: [number, number, number, number] = [0, 0, 0, 0];
            const aoBrightness: [number, number, number, number] = [1.0, 1.0, 1.0, 1.0];
            const skyMulC: [number, number, number, number] = [skyBase, skyBase, skyBase, skyBase];
            const blockMulC: [number, number, number, number] = [blockBase, blockBase, blockBase, blockBase];

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

              const occ1 = this.sampleOccludes(chunk, world, baseX, baseZ, s1x, s1y, s1z);
              const occ2 = this.sampleOccludes(chunk, world, baseX, baseZ, s2x, s2y, s2z);
              const occC = this.sampleOccludes(chunk, world, baseX, baseZ, scx, scy, scz);

              const level = aoLevel(occ1, occ2, occC);
              aoLevels[c] = level;
              aoBrightness[c] = AO_BRIGHTNESS[level] ?? 1.0;

              const skyS1 = SKY_LIGHT_BRIGHTNESS[sampleSkyLight(world, baseX, baseZ, s1x, s1y, s1z)] ?? 1.0;
              const skyS2 = SKY_LIGHT_BRIGHTNESS[sampleSkyLight(world, baseX, baseZ, s2x, s2y, s2z)] ?? 1.0;
              const skySc = SKY_LIGHT_BRIGHTNESS[sampleSkyLight(world, baseX, baseZ, scx, scy, scz)] ?? 1.0;
              skyMulC[c] = (skyBase + skyS1 + skyS2 + skySc) * 0.25;

              const blockS1 = BLOCK_LIGHT_BRIGHTNESS[sampleBlockLight(world, baseX, baseZ, s1x, s1y, s1z)] ?? 0;
              const blockS2 = BLOCK_LIGHT_BRIGHTNESS[sampleBlockLight(world, baseX, baseZ, s2x, s2y, s2z)] ?? 0;
              const blockSc = BLOCK_LIGHT_BRIGHTNESS[sampleBlockLight(world, baseX, baseZ, scx, scy, scz)] ?? 0;
              blockMulC[c] = (blockBase + blockS1 + blockS2 + blockSc) * 0.25;
            }

            for (let c = 0; c < 4; c++) {
              const corner = data.corners[c]!;
              positions.push(wx + corner[0], ly + corner[1], wz + corner[2]);
              normals.push(normX, normY, normZ);
              const ao = aoBrightness[c] ?? 1.0;
              colors.push(ao * (skyMulC[c] ?? skyBase), ao * (blockMulC[c] ?? blockBase), 0);
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

    const solidGeometry = new THREE.BufferGeometry();
    solidGeometry.setAttribute('position', new THREE.Float32BufferAttribute(solidPositions, 3));
    solidGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(solidNormals, 3));
    solidGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(solidUvs, 2));
    solidGeometry.setAttribute('color', new THREE.Float32BufferAttribute(solidColors, 3));
    solidGeometry.setIndex(solidIndices);
    solidGeometry.computeBoundingSphere();

    const solidMesh = new THREE.Mesh(solidGeometry, solidMaterial);
    solidMesh.name = `chunk_${chunk.cx}_${chunk.cz}`;
    solidMesh.frustumCulled = true;

    let waterMesh: THREE.Mesh | null = null;
    if (waterIndices.length > 0) {
      const waterGeometry = new THREE.BufferGeometry();
      waterGeometry.setAttribute('position', new THREE.Float32BufferAttribute(waterPositions, 3));
      waterGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(waterNormals, 3));
      waterGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(waterUvs, 2));
      waterGeometry.setAttribute('color', new THREE.Float32BufferAttribute(waterColors, 3));
      waterGeometry.setIndex(waterIndices);
      waterGeometry.computeBoundingSphere();

      waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
      waterMesh.name = `chunk_${chunk.cx}_${chunk.cz}_water`;
      waterMesh.frustumCulled = true;
    }

    return { solid: solidMesh, water: waterMesh };
  }

  /**
   * Samples whether a local-coordinate cell (lx, ly, lz) occludes for AO purposes.
   * Uses the in-chunk fast path when the cell's x/z fall inside this chunk; falls back
   * to world.getBlock for cross-chunk cells.  Treats out-of-vertical-bounds as non-occluding
   * (no dark seam at world top/bottom).
   */
  private sampleOccludes(
    chunk: Chunk,
    world: IWorld,
    baseX: number,
    baseZ: number,
    lx: number,
    ly: number,
    lz: number,
  ): boolean {
    if (ly < 0 || ly >= CHUNK_HEIGHT) return false;
    let sampledId: BlockId;
    if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE) {
      sampledId = chunk.getBlock(lx, ly, lz);
    } else {
      sampledId = world.getBlock(baseX + lx, ly, baseZ + lz);
    }
    return this.occludes(sampledId);
  }

  /** A block id contributes AO only when it is solid and not transparent (leaves/glass/water do not). */
  private occludes(id: BlockId): boolean {
    return id !== BlockId.AIR && !this.registry.isTransparent(id);
  }

  private shouldDrawFace(
    currentId: BlockId,
    currentTransparent: boolean,
    neighborId: BlockId,
  ): boolean {
    if (neighborId === BlockId.AIR) return true;
    const neighborTransparent = this.registry.isTransparent(neighborId);
    if (!neighborTransparent) return false;
    // Neighbor is transparent (e.g. leaves, glass).
    // Don't draw between two of the same transparent type (so leaves+leaves looks solid).
    if (neighborId === currentId) return false;
    // If current is also transparent and neighbor is a different transparent type, draw
    // the face (e.g. glass next to leaves).
    // If current is opaque and neighbor is transparent, draw.
    if (!currentTransparent) return true;
    // Both transparent, different ids: draw.
    return true;
  }

  private tileForFace(
    tex: { top: number; bottom: number; side: number },
    face: Face,
  ): number {
    switch (face) {
      case Face.TOP:
        return tex.top;
      case Face.BOTTOM:
        return tex.bottom;
      default:
        return tex.side;
    }
  }
}
