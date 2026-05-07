import * as THREE from 'three';
import {
  BlockId,
  CHUNK_HEIGHT,
  CHUNK_SIZE,
  type IBlockRegistry,
  type ITextureAtlas,
  type IWorld,
} from '../types';
import { Chunk } from './Chunk';

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
    const solidIndices: number[] = [];

    const waterPositions: number[] = [];
    const waterNormals: number[] = [];
    const waterUvs: number[] = [];
    const waterIndices: number[] = [];

    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;

    for (let ly = 0; ly < CHUNK_HEIGHT; ly++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
          const id = chunk.getBlock(lx, ly, lz);
          if (id === BlockId.AIR) continue;
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
            const indices = isWater ? waterIndices : solidIndices;

            const startVertex = positions.length / 3;

            for (let c = 0; c < 4; c++) {
              const corner = data.corners[c]!;
              positions.push(wx + corner[0], ly + corner[1], wz + corner[2]);
              normals.push(data.normal[0], data.normal[1], data.normal[2]);
            }
            // UV mapping: v0 → (u0,v0), v1 → (u1,v0), v2 → (u1,v1), v3 → (u0,v1)
            uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);

            // Two triangles: (0,1,2) and (0,2,3)
            indices.push(
              startVertex,
              startVertex + 1,
              startVertex + 2,
              startVertex,
              startVertex + 2,
              startVertex + 3,
            );
          }
        }
      }
    }

    const solidGeometry = new THREE.BufferGeometry();
    solidGeometry.setAttribute('position', new THREE.Float32BufferAttribute(solidPositions, 3));
    solidGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(solidNormals, 3));
    solidGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(solidUvs, 2));
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
      waterGeometry.setIndex(waterIndices);
      waterGeometry.computeBoundingSphere();

      waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
      waterMesh.name = `chunk_${chunk.cx}_${chunk.cz}_water`;
      waterMesh.frustumCulled = true;
    }

    return { solid: solidMesh, water: waterMesh };
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
