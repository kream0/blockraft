import { BlockId, CHUNK_HEIGHT, CHUNK_SIZE, MAX_SKY_LIGHT } from '../types';
import type { IBlockRegistry, ISkyLightAccess } from '../types';
import { Chunk } from './Chunk';

export class LightEngine {
  constructor(private readonly registry: IBlockRegistry) {}

  private isOpaque(id: BlockId): boolean {
    return id !== BlockId.AIR && !this.registry.isTransparent(id);
  }

  /**
   * Fully recompute sky-light for `chunk` from scratch.
   * Pulls boundary light from already-loaded neighbor chunks via `access`
   * so cross-chunk seams are smooth.
   */
  recomputeChunkLight(chunk: Chunk, access: ISkyLightAccess): void {
    // 1. Clear all sky-light to 0.
    chunk.skyLight.fill(0);

    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;

    // BFS queue: stores Chunk.idx values (numbers in [0, CHUNK_SIZE*CHUNK_HEIGHT*CHUNK_SIZE)).
    // Use a flat array with a head pointer to avoid O(n) Array.shift.
    const queue: number[] = [];
    let head = 0;

    // 2. Seed vertical sunlight columns from the top down.
    for (let lx = 0; lx < CHUNK_SIZE; lx++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        for (let y = CHUNK_HEIGHT - 1; y >= 0; y--) {
          const idx = Chunk.idx(lx, y, lz);
          const blockId = (chunk.blocks[idx] ?? BlockId.AIR) as BlockId;
          if (this.isOpaque(blockId)) {
            // Column is blocked from here downward; stop.
            break;
          }
          chunk.skyLight[idx] = MAX_SKY_LIGHT;
          queue.push(idx);
        }
      }
    }

    // 3a. Inject boundary light from loaded neighbor chunks on the X/Z borders.
    // For each non-opaque cell on a border face, sample the neighbor's sky-light
    // just outside this chunk. If neighborLevel - 1 > current, update and enqueue.
    for (let y = 0; y < CHUNK_HEIGHT; y++) {
      for (let lz = 0; lz < CHUNK_SIZE; lz++) {
        // lx == 0 border: neighbor is at worldX = baseX - 1
        this._injectBoundary(chunk, access, 0, y, lz, baseX - 1, y, baseZ + lz, queue);
        // lx == 15 border: neighbor is at worldX = baseX + CHUNK_SIZE
        this._injectBoundary(chunk, access, CHUNK_SIZE - 1, y, lz, baseX + CHUNK_SIZE, y, baseZ + lz, queue);
      }
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        // lz == 0 border: neighbor is at worldZ = baseZ - 1
        this._injectBoundary(chunk, access, lx, y, 0, baseX + lx, y, baseZ - 1, queue);
        // lz == 15 border: neighbor is at worldZ = baseZ + CHUNK_SIZE
        this._injectBoundary(chunk, access, lx, y, CHUNK_SIZE - 1, baseX + lx, y, baseZ + CHUNK_SIZE, queue);
      }
    }

    // 3b. BFS flood fill (6-neighbor, attenuate by 1).
    const neighbors: [number, number, number][] = [
      [1, 0, 0], [-1, 0, 0],
      [0, 1, 0], [0, -1, 0],
      [0, 0, 1], [0, 0, -1],
    ];

    while (head < queue.length) {
      const idx = queue[head++]!;
      const curLevel = chunk.skyLight[idx] ?? 0;

      if (curLevel <= 1) {
        // Propagating at level 0 is pointless (L-1 = 0 won't improve anything).
        continue;
      }

      // Decode idx back to (lx, ly, lz).
      // idx = lx + lz * CHUNK_SIZE + ly * CHUNK_SIZE * CHUNK_SIZE
      const ly = Math.floor(idx / (CHUNK_SIZE * CHUNK_SIZE));
      const rem = idx - ly * CHUNK_SIZE * CHUNK_SIZE;
      const lz = Math.floor(rem / CHUNK_SIZE);
      const lx = rem - lz * CHUNK_SIZE;

      for (const [dx, dy, dz] of neighbors) {
        const nx = lx + dx;
        const ny = ly + dy;
        const nz = lz + dz;

        // Stay inside this chunk.
        if (nx < 0 || nx >= CHUNK_SIZE || ny < 0 || ny >= CHUNK_HEIGHT || nz < 0 || nz >= CHUNK_SIZE) {
          continue;
        }

        const nIdx = Chunk.idx(nx, ny, nz);
        const neighborBlock = (chunk.blocks[nIdx] ?? BlockId.AIR) as BlockId;

        if (this.isOpaque(neighborBlock)) {
          continue;
        }

        const newLevel = curLevel - 1;
        const existing = chunk.skyLight[nIdx] ?? 0;
        if (existing < newLevel) {
          chunk.skyLight[nIdx] = newLevel;
          if (newLevel > 1) {
            queue.push(nIdx);
          }
        }
      }
    }
  }

  /**
   * Check the neighbor cell just outside this chunk at (neighborWorldX, neighborWorldY, neighborWorldZ).
   * If that neighbor has sky-light and this chunk's cell (lx, ly, lz) is not opaque and could
   * benefit from neighborLevel - 1, update and enqueue the cell.
   */
  private _injectBoundary(
    chunk: Chunk,
    access: ISkyLightAccess,
    lx: number,
    ly: number,
    lz: number,
    neighborWorldX: number,
    neighborWorldY: number,
    neighborWorldZ: number,
    queue: number[],
  ): void {
    const idx = Chunk.idx(lx, ly, lz);
    const blockId = (chunk.blocks[idx] ?? BlockId.AIR) as BlockId;
    if (this.isOpaque(blockId)) {
      return;
    }

    const neighborLevel = access.getSkyLight(neighborWorldX, neighborWorldY, neighborWorldZ);
    const newLevel = neighborLevel - 1;
    if (newLevel <= 0) {
      return;
    }

    const cur = chunk.skyLight[idx] ?? 0;
    if (newLevel > cur) {
      chunk.skyLight[idx] = newLevel;
      queue.push(idx);
    }
  }
}
