import * as THREE from 'three';
import {
  BlockId,
  CHUNK_HEIGHT,
  CHUNK_SIZE,
  RENDER_DISTANCE,
  WORLD_SEED,
  type BlockHit,
  type ChunkOverrides,
  type IBlockRegistry,
  type ITextureAtlas,
  type IWorld,
  type Vec3,
} from '../types';
import { floorDiv, mod } from '../utils/MathUtils';
import { Chunk } from './Chunk';
import { ChunkMesher } from './ChunkMesher';
import { TerrainGenerator } from './TerrainGenerator';
import { EntityManager } from '../entities/EntityManager';

const MAX_NEW_CHUNKS_PER_UPDATE = 2;
const MAX_REMESH_PER_UPDATE = 4;
const MIN_RENDER_DISTANCE = 2;
const MAX_RENDER_DISTANCE = 16;

export class World implements IWorld {
  readonly group: THREE.Group;
  readonly entityManager: EntityManager;
  private chunks = new Map<string, Chunk>();
  private dirtyChunks = new Set<Chunk>();
  private terrainGen: TerrainGenerator;
  private mesher: ChunkMesher;
  private material: THREE.Material;
  private waterMaterial: THREE.Material;
  private registry: IBlockRegistry;
  private renderDistance: number;
  /** chunkKey ("cx,cz") -> linearIndex -> blockId. Sparse map of player edits per chunk. */
  private overrides: Map<string, Map<number, BlockId>> = new Map();
  private trackedTarget: Vec3 | null = null;

  constructor(
    atlas: ITextureAtlas,
    material: THREE.Material,
    waterMaterial: THREE.Material,
    registry: IBlockRegistry,
    seed: number = WORLD_SEED,
    initialOverrides: ChunkOverrides = {},
    renderDistance: number = RENDER_DISTANCE,
  ) {
    this.material = material;
    this.waterMaterial = waterMaterial;
    this.registry = registry;
    this.terrainGen = new TerrainGenerator(seed);
    this.mesher = new ChunkMesher(atlas, registry);
    this.group = new THREE.Group();
    this.group.name = 'WorldChunks';
    this.renderDistance = this.clampRenderDistance(renderDistance);

    // Hydrate initial overrides into the internal map for O(1) per-chunk lookup on load.
    for (const [key, edits] of Object.entries(initialOverrides)) {
      const inner = new Map<number, BlockId>();
      for (const [idx, id] of edits) {
        inner.set(idx, id);
      }
      this.overrides.set(key, inner);
    }

    this.entityManager = new EntityManager(this.group);
  }

  private clampRenderDistance(d: number): number {
    if (!Number.isFinite(d)) return RENDER_DISTANCE;
    const r = Math.round(d);
    if (r < MIN_RENDER_DISTANCE) return MIN_RENDER_DISTANCE;
    if (r > MAX_RENDER_DISTANCE) return MAX_RENDER_DISTANCE;
    return r;
  }

  getRenderDistance(): number {
    return this.renderDistance;
  }

  setRenderDistance(d: number): void {
    this.renderDistance = this.clampRenderDistance(d);
  }

  /** Returns a JSON-friendly snapshot of current overrides. */
  getOverrides(): ChunkOverrides {
    const out: ChunkOverrides = {};
    for (const [key, inner] of this.overrides) {
      const arr: [number, BlockId][] = [];
      for (const [idx, id] of inner) {
        arr.push([idx, id]);
      }
      out[key] = arr;
    }
    return out;
  }

  private static key(cx: number, cz: number): string {
    return `${cx},${cz}`;
  }

  private getChunk(cx: number, cz: number): Chunk | undefined {
    return this.chunks.get(World.key(cx, cz));
  }

  getBlock(x: number, y: number, z: number): BlockId {
    if (y < 0 || y >= CHUNK_HEIGHT) return BlockId.AIR;
    const cx = floorDiv(x, CHUNK_SIZE);
    const cz = floorDiv(z, CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return BlockId.AIR;
    const lx = mod(x, CHUNK_SIZE);
    const lz = mod(z, CHUNK_SIZE);
    return chunk.getBlock(lx, y, lz);
  }

  setBlock(x: number, y: number, z: number, id: BlockId): void {
    if (y < 0 || y >= CHUNK_HEIGHT) return;
    const cx = floorDiv(x, CHUNK_SIZE);
    const cz = floorDiv(z, CHUNK_SIZE);
    const chunk = this.getChunk(cx, cz);
    if (!chunk) return;
    const lx = mod(x, CHUNK_SIZE);
    const lz = mod(z, CHUNK_SIZE);
    chunk.setBlock(lx, y, lz, id);

    // Record the edit in the overrides map AFTER the block has been applied to the chunk.
    const key = World.key(cx, cz);
    let inner = this.overrides.get(key);
    if (inner === undefined) {
      inner = new Map<number, BlockId>();
      this.overrides.set(key, inner);
    }
    inner.set(Chunk.idx(lx, y, lz), id);

    const affected = new Set<Chunk>();
    chunk.dirty = true;
    this.dirtyChunks.add(chunk);
    affected.add(chunk);

    // Mark neighbor chunks dirty if we touched a border block.
    if (lx === 0) {
      const n = this.getChunk(cx - 1, cz);
      if (n) {
        n.dirty = true;
        this.dirtyChunks.add(n);
        affected.add(n);
      }
    } else if (lx === CHUNK_SIZE - 1) {
      const n = this.getChunk(cx + 1, cz);
      if (n) {
        n.dirty = true;
        this.dirtyChunks.add(n);
        affected.add(n);
      }
    }
    if (lz === 0) {
      const n = this.getChunk(cx, cz - 1);
      if (n) {
        n.dirty = true;
        this.dirtyChunks.add(n);
        affected.add(n);
      }
    } else if (lz === CHUNK_SIZE - 1) {
      const n = this.getChunk(cx, cz + 1);
      if (n) {
        n.dirty = true;
        this.dirtyChunks.add(n);
        affected.add(n);
      }
    }

    // Re-mesh only the chunks we just touched so player edits feel instantaneous;
    // leave the long-tail backlog for the streaming update() path.
    for (const c of affected) {
      this.remeshChunk(c);
    }
  }

  isSolid(x: number, y: number, z: number): boolean {
    return this.registry.isSolid(this.getBlock(x, y, z));
  }

  getTrackedTarget(): Vec3 | null {
    return this.trackedTarget;
  }

  /** Set the hostile-mob chase target. Pass the player's LIVE position object so mobs always read the current value. */
  setTrackedTarget(target: Vec3 | null): void {
    this.trackedTarget = target;
  }

  /**
   * Amanatides & Woo voxel DDA. Returns the first solid block hit within `maxDistance`,
   * or null. The returned normal points back toward the ray (i.e. is the face normal of
   * the side that was hit; -stepDir on the axis we just stepped along).
   */
  raycast(origin: Vec3, direction: Vec3, maxDistance: number): BlockHit | null {
    let dx = direction.x;
    let dy = direction.y;
    let dz = direction.z;
    const lenSq = dx * dx + dy * dy + dz * dz;
    if (lenSq <= 1e-12) return null;
    const invLen = 1 / Math.sqrt(lenSq);
    dx *= invLen;
    dy *= invLen;
    dz *= invLen;

    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    const stepX = dx > 0 ? 1 : dx < 0 ? -1 : 0;
    const stepY = dy > 0 ? 1 : dy < 0 ? -1 : 0;
    const stepZ = dz > 0 ? 1 : dz < 0 ? -1 : 0;

    const tDeltaX = stepX !== 0 ? Math.abs(1 / dx) : Number.POSITIVE_INFINITY;
    const tDeltaY = stepY !== 0 ? Math.abs(1 / dy) : Number.POSITIVE_INFINITY;
    const tDeltaZ = stepZ !== 0 ? Math.abs(1 / dz) : Number.POSITIVE_INFINITY;

    // Distance from origin to the first voxel boundary on each axis.
    let tMaxX: number;
    let tMaxY: number;
    let tMaxZ: number;
    if (stepX > 0) {
      tMaxX = (x + 1 - origin.x) / dx;
    } else if (stepX < 0) {
      tMaxX = (origin.x - x) / -dx;
    } else {
      tMaxX = Number.POSITIVE_INFINITY;
    }
    if (stepY > 0) {
      tMaxY = (y + 1 - origin.y) / dy;
    } else if (stepY < 0) {
      tMaxY = (origin.y - y) / -dy;
    } else {
      tMaxY = Number.POSITIVE_INFINITY;
    }
    if (stepZ > 0) {
      tMaxZ = (z + 1 - origin.z) / dz;
    } else if (stepZ < 0) {
      tMaxZ = (origin.z - z) / -dz;
    } else {
      tMaxZ = Number.POSITIVE_INFINITY;
    }

    // If the origin is already inside a solid block, there is no well-defined face
    // normal to return — bail out so callers get consistent semantics.
    if (this.isSolid(x, y, z)) {
      return null;
    }

    let distance = 0;
    let lastAxis: 0 | 1 | 2 = 0; // 0=X, 1=Y, 2=Z

    // Hard safety cap on iterations, in case of pathological inputs.
    const maxIters = Math.ceil(maxDistance * 3) + 8;
    for (let i = 0; i < maxIters; i++) {
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX;
        distance = tMaxX;
        tMaxX += tDeltaX;
        lastAxis = 0;
      } else if (tMaxY < tMaxZ) {
        y += stepY;
        distance = tMaxY;
        tMaxY += tDeltaY;
        lastAxis = 1;
      } else {
        z += stepZ;
        distance = tMaxZ;
        tMaxZ += tDeltaZ;
        lastAxis = 2;
      }

      if (distance > maxDistance) return null;

      if (this.isSolid(x, y, z)) {
        const nx = lastAxis === 0 ? -stepX : 0;
        const ny = lastAxis === 1 ? -stepY : 0;
        const nz = lastAxis === 2 ? -stepZ : 0;
        return {
          block: { x, y, z },
          normal: { x: nx, y: ny, z: nz },
          point: {
            x: origin.x + dx * distance,
            y: origin.y + dy * distance,
            z: origin.z + dz * distance,
          },
          distance,
        };
      }
    }
    return null;
  }

  update(playerPos: Vec3): void {
    const pcx = floorDiv(Math.floor(playerPos.x), CHUNK_SIZE);
    const pcz = floorDiv(Math.floor(playerPos.z), CHUNK_SIZE);

    // 1. Unload chunks outside (renderDistance + 1) chebyshev distance.
    const unloadRadius = this.renderDistance + 1;
    const toUnload: string[] = [];
    for (const [key, chunk] of this.chunks) {
      const ddx = Math.abs(chunk.cx - pcx);
      const ddz = Math.abs(chunk.cz - pcz);
      if (ddx > unloadRadius || ddz > unloadRadius) {
        toUnload.push(key);
      }
    }
    for (const key of toUnload) {
      const chunk = this.chunks.get(key);
      if (!chunk) continue;
      if (chunk.mesh) {
        this.group.remove(chunk.mesh);
      }
      if (chunk.waterMesh) {
        this.group.remove(chunk.waterMesh);
      }
      chunk.dispose();
      this.dirtyChunks.delete(chunk);
      this.chunks.delete(key);
    }

    // 2. Find missing chunks in range; sort by distance from player; load up to MAX_NEW_CHUNKS_PER_UPDATE.
    type Pending = { cx: number; cz: number; dist2: number };
    const pending: Pending[] = [];
    for (let dz = -this.renderDistance; dz <= this.renderDistance; dz++) {
      for (let dx = -this.renderDistance; dx <= this.renderDistance; dx++) {
        const cx = pcx + dx;
        const cz = pcz + dz;
        if (this.chunks.has(World.key(cx, cz))) continue;
        pending.push({ cx, cz, dist2: dx * dx + dz * dz });
      }
    }
    pending.sort((a, b) => a.dist2 - b.dist2);

    const loadCount = Math.min(MAX_NEW_CHUNKS_PER_UPDATE, pending.length);
    for (let i = 0; i < loadCount; i++) {
      const p = pending[i]!;
      this.loadChunk(p.cx, p.cz);
    }

    // 3. Flush some dirty chunks.
    this.flushDirty(MAX_REMESH_PER_UPDATE);
  }

  private loadChunk(cx: number, cz: number): void {
    const chunk = new Chunk(cx, cz, (c) => this.terrainGen.generate(c));
    // Apply any persisted overrides BEFORE the initial mesh build.
    const inner = this.overrides.get(World.key(cx, cz));
    if (inner !== undefined) {
      for (const [idx, id] of inner) {
        chunk.blocks[idx] = id;
      }
    }
    this.chunks.set(World.key(cx, cz), chunk);
    // Mark all four neighbors dirty so their borders re-mesh against this new chunk.
    const neighbors: [number, number][] = [
      [cx - 1, cz],
      [cx + 1, cz],
      [cx, cz - 1],
      [cx, cz + 1],
    ];
    for (const [ncx, ncz] of neighbors) {
      const n = this.getChunk(ncx, ncz);
      if (n) {
        n.dirty = true;
        this.dirtyChunks.add(n);
      }
    }
    // Build initial mesh for the new chunk.
    this.remeshChunk(chunk);
  }

  private remeshChunk(chunk: Chunk): void {
    if (chunk.mesh) {
      this.group.remove(chunk.mesh);
      chunk.mesh.geometry.dispose();
      chunk.mesh = null;
    }
    if (chunk.waterMesh) {
      this.group.remove(chunk.waterMesh);
      chunk.waterMesh.geometry.dispose();
      chunk.waterMesh = null;
    }
    const { solid, water } = this.mesher.build(
      chunk,
      this,
      this.material,
      this.waterMaterial,
    );
    chunk.mesh = solid;
    this.group.add(solid);
    if (water) {
      chunk.waterMesh = water;
      this.group.add(water);
    }
    chunk.dirty = false;
    this.dirtyChunks.delete(chunk);
  }

  private flushDirty(limit: number): void {
    if (this.dirtyChunks.size === 0) return;
    let n = 0;
    // Pull a snapshot so deletion during iteration is safe.
    const snapshot: Chunk[] = [];
    for (const c of this.dirtyChunks) {
      snapshot.push(c);
      if (snapshot.length >= limit) break;
    }
    for (const chunk of snapshot) {
      if (!this.chunks.has(World.key(chunk.cx, chunk.cz))) {
        // Was unloaded since being marked dirty.
        this.dirtyChunks.delete(chunk);
        continue;
      }
      this.remeshChunk(chunk);
      n++;
      if (n >= limit) break;
    }
  }

  /** Despawn all entities and remove all chunk meshes. Idempotent. */
  dispose(): void {
    this.entityManager.clear();
    for (const [, chunk] of this.chunks) {
      if (chunk.mesh) {
        this.group.remove(chunk.mesh);
      }
      if (chunk.waterMesh) {
        this.group.remove(chunk.waterMesh);
      }
      chunk.dispose();
    }
    this.chunks.clear();
    this.dirtyChunks.clear();
  }
}
