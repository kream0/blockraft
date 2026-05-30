import { BlockId, CHUNK_HEIGHT, CHUNK_SIZE } from '../types';
import { clamp } from '../utils/MathUtils';
import { PerlinNoise } from '../utils/Noise';
import { Chunk } from './Chunk';

const BASE_HEIGHT = Math.floor(CHUNK_HEIGHT / 2) - 4;
const AMPLITUDE = 12;
const SEA_LEVEL = BASE_HEIGHT - 2;

const BIOME_SCALE = 0.004; // low frequency → large, smooth biome regions
// Biome codes (local to terrain generation; no enum needed).
const BIOME_PLAINS = 0;
const BIOME_DESERT = 1;
const BIOME_SNOWY = 2;

// Ore generation tuning. Iron is rarer and deeper than coal.
const ORE_MIN_Y = 2;            // never touch bedrock (y=0) or just above it
const COAL_MAX_Y = 50;
const IRON_MAX_Y = 28;
const COAL_VEINS_PER_CHUNK = 8;
const IRON_VEINS_PER_CHUNK = 5;
const COAL_VEIN_SIZE = 7;       // random-walk steps (ore blocks attempted)
const IRON_VEIN_SIZE = 5;
const ORE_SALT_COAL = 0x1f1f1f1f;
const ORE_SALT_IRON = 0x2e2e2e2e;

/** Deterministic int hash for tree placement, etc. */
function hash3(a: number, b: number, c: number): number {
  return ((Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(c, 83492791)) >>> 0);
}

export class TerrainGenerator {
  private noise: PerlinNoise;
  private biomeNoise: PerlinNoise;
  private seed: number;
  private oreState = 0;

  constructor(seed: number) {
    this.seed = seed >>> 0;
    this.noise = new PerlinNoise(this.seed);
    // Independent biome map: derive a distinct seed so it doesn't correlate with the heightmap.
    this.biomeNoise = new PerlinNoise((this.seed ^ 0x9e3779b9) >>> 0);
  }

  private oreNext(): number {
    this.oreState = (Math.imul(this.oreState, 1664525) + 1013904223) >>> 0;
    return this.oreState;
  }

  /** Scatter `veinCount` random-walk veins of `ore`, replacing ONLY stone within [minY, maxY]. */
  private scatterOre(
    chunk: Chunk,
    ore: BlockId,
    veinCount: number,
    veinSize: number,
    minY: number,
    maxY: number,
    salt: number,
  ): void {
    if (maxY < minY) return;
    const span = maxY - minY + 1;
    for (let i = 0; i < veinCount; i++) {
      // Reseed the LCG per vein so each vein is deterministic from (cx, cz, seed).
      this.oreState = (hash3(chunk.cx, chunk.cz, (this.seed ^ salt) + Math.imul(i, 2654435761)) >>> 0) || 1;
      let x = this.oreNext() % CHUNK_SIZE;
      let z = this.oreNext() % CHUNK_SIZE;
      let y = minY + (this.oreNext() % span);
      for (let step = 0; step < veinSize; step++) {
        if (x >= 0 && x < CHUNK_SIZE && z >= 0 && z < CHUNK_SIZE && y >= minY && y <= maxY) {
          const idx = Chunk.idx(x, y, z);
          if (chunk.blocks[idx] === BlockId.STONE) {
            chunk.blocks[idx] = ore;
          }
        }
        switch (this.oreNext() % 6) {
          case 0: x++; break;
          case 1: x--; break;
          case 2: z++; break;
          case 3: z--; break;
          case 4: y++; break;
          default: y--; break;
        }
      }
    }
  }

  /** Place all ore veins for a chunk. Coal: common, up to mid-depth. Iron: rarer, deep only. */
  private placeOreVeins(chunk: Chunk): void {
    this.scatterOre(chunk, BlockId.COAL_ORE, COAL_VEINS_PER_CHUNK, COAL_VEIN_SIZE, ORE_MIN_Y, COAL_MAX_Y, ORE_SALT_COAL);
    this.scatterOre(chunk, BlockId.IRON_ORE, IRON_VEINS_PER_CHUNK, IRON_VEIN_SIZE, ORE_MIN_Y, IRON_MAX_Y, ORE_SALT_IRON);
  }

  /** Pick a biome for a world column. Smooth low-frequency noise → large regions. */
  private biomeAt(wx: number, wz: number): number {
    const b = this.biomeNoise.noise2D(wx * BIOME_SCALE, wz * BIOME_SCALE);
    if (b < -0.25) return BIOME_DESERT;
    if (b > 0.30) return BIOME_SNOWY;
    return BIOME_PLAINS;
  }

  /** Fill the chunk array with blocks based on noise. Called once at chunk creation. */
  generate(chunk: Chunk): void {
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;

    // Surface heights for each (lx, lz) — reused for tree placement check.
    const heights = new Int16Array(CHUNK_SIZE * CHUNK_SIZE);

    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = baseX + lx;
        const wz = baseZ + lz;
        const n = this.noise.fbm(wx * 0.01, wz * 0.01, 4);
        const raw = BASE_HEIGHT + Math.round(n * AMPLITUDE);
        const h = clamp(raw, 4, CHUNK_HEIGHT - 2);
        heights[lx + lz * CHUNK_SIZE] = h;
        const biome = this.biomeAt(wx, wz);

        for (let y = 0; y <= h; y++) {
          let id: BlockId;
          if (y === 0) {
            id = BlockId.BEDROCK;
          } else if (y < h - 3) {
            id = BlockId.STONE;
          } else if (y < h) {
            id = biome === BIOME_DESERT ? BlockId.SAND : BlockId.DIRT;
          } else {
            // y === h (surface block)
            if (h <= SEA_LEVEL) {
              id = BlockId.SAND;            // beaches & lakebeds stay sand in every biome
            } else if (biome === BIOME_DESERT) {
              id = BlockId.SAND;
            } else if (biome === BIOME_SNOWY) {
              id = BlockId.SNOW;
            } else {
              id = BlockId.GRASS;
            }
          }
          chunk.blocks[Chunk.idx(lx, y, lz)] = id;
        }

        // Fill water column from above the sand surface up to and including sea level.
        if (h < SEA_LEVEL) {
          for (let y = h + 1; y <= SEA_LEVEL; y++) {
            chunk.blocks[Chunk.idx(lx, y, lz)] = BlockId.WATER;
          }
        }
      }
    }

    // Ore veins: placed after all stone columns are set, before trees.
    this.placeOreVeins(chunk);

    // Trees: deterministically place 1-3 trees per chunk.
    const treeCountHash = hash3(chunk.cx, chunk.cz, this.seed);
    const treeCount = (treeCountHash % 3) + 1;
    for (let i = 0; i < treeCount; i++) {
      const h1 = hash3(chunk.cx, chunk.cz, this.seed ^ (i * 2654435761));
      const h2 = hash3(chunk.cx ^ 0x9e3779b9, chunk.cz ^ 0x7f4a7c15, this.seed + i + 1);
      // Restrict to interior so canopy doesn't get cut off at chunk borders.
      const lx = 2 + (h1 % (CHUNK_SIZE - 4));
      const lz = 2 + (h2 % (CHUNK_SIZE - 4));
      const surface = heights[lx + lz * CHUNK_SIZE]!;
      // Skip on sand or below sea level.
      const surfaceId = (chunk.blocks[Chunk.idx(lx, surface, lz)] ?? BlockId.AIR) as BlockId;
      if (surfaceId !== BlockId.GRASS) continue;
      // Need 6 vertical blocks of room (5 trunk + 1 leaves above).
      if (surface + 6 >= CHUNK_HEIGHT) continue;

      // Trunk: 5 blocks of WOOD starting one above the surface.
      const trunkBase = surface + 1;
      const trunkTop = trunkBase + 4; // inclusive
      for (let y = trunkBase; y <= trunkTop; y++) {
        chunk.blocks[Chunk.idx(lx, y, lz)] = BlockId.WOOD;
      }

      // Canopy: 3x3 LEAVES on the top 2 trunk layers, then 1 leaf on top of trunk.
      // Top two layers = trunkTop-1 and trunkTop.
      for (let dy = -1; dy <= 0; dy++) {
        const y = trunkTop + dy;
        for (let dx = -1; dx <= 1; dx++) {
          for (let dz = -1; dz <= 1; dz++) {
            const x = lx + dx;
            const z = lz + dz;
            // Don't overwrite the trunk on the trunk's column.
            if (dx === 0 && dz === 0) continue;
            const idx = Chunk.idx(x, y, z);
            if ((chunk.blocks[idx] ?? BlockId.AIR) === BlockId.AIR) {
              chunk.blocks[idx] = BlockId.LEAVES;
            }
          }
        }
      }
      // 1 leaf on top of the trunk.
      chunk.blocks[Chunk.idx(lx, trunkTop + 1, lz)] = BlockId.LEAVES;
    }

    chunk.dirty = true;
  }
}
