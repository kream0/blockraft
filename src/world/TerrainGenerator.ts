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

// Cave carving tuning. Caves are carved into stone only (so the surface skin, bedrock, and water are untouched).
const CAVE_SCALE_XZ = 0.06;   // horizontal frequency
const CAVE_SCALE_Y = 0.10;    // vertical frequency (higher → flatter, wider caverns)
const CAVE_THRESHOLD = 0.04;  // iso-band half-width around the noise zero-surface; larger → more/bigger caves. Empirically tuned: ~15-19% of stone carved (0.12 carved ~53%, leaving terrain too hollow).
const CAVE_OCTAVES = 2;
const CAVE_MIN_Y = 1;         // keep bedrock at y=0 intact

// Structure generation (deterministic per chunk; confined to chunk interior so structures never span chunks).
const STRUCT_SALT_BOULDER = 0x3b9aca07;
const STRUCT_SALT_DUNGEON = 0x6c8e944f;
const BOULDER_CHANCE = 0.33;       // ~1 in 3 chunks gets a surface boulder
const BOULDER_MAX_RADIUS = 2;      // blob radius in blocks
const DUNGEON_CHANCE = 0.08;       // ~1 in 12 chunks gets a dungeon
const DUNGEON_HALF = 2;            // interior half-extent on X and Z → 5x5 interior footprint
const DUNGEON_INTERIOR_H = 3;      // interior height in blocks
const DUNGEON_MIN_FLOOR_Y = 3;     // keep a stone buffer above bedrock (y=0)
const DUNGEON_SURFACE_COVER = 4;   // min solid cover between the room ceiling and the surface
const DUNGEON_IRON_REWARD = 3;     // IRON_ORE blocks embedded in the floor

/** Deterministic int hash for tree placement, etc. */
function hash3(a: number, b: number, c: number): number {
  return ((Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(c, 83492791)) >>> 0);
}

export class TerrainGenerator {
  private noise: PerlinNoise;
  private biomeNoise: PerlinNoise;
  private caveNoise: PerlinNoise;
  private seed: number;
  private oreState = 0;

  constructor(seed: number) {
    this.seed = seed >>> 0;
    this.noise = new PerlinNoise(this.seed);
    // Independent biome map: derive a distinct seed so it doesn't correlate with the heightmap.
    this.biomeNoise = new PerlinNoise((this.seed ^ 0x9e3779b9) >>> 0);
    // Independent cave noise: distinct magic constant so caves don't alias with biomes or heightmap.
    this.caveNoise = new PerlinNoise((this.seed ^ 0x517cc1e5) >>> 0);
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

  /**
   * Carve cave systems into stone. Uses an iso-band of 3D fractal noise (|n| < threshold) in WORLD
   * coordinates so caves connect seamlessly across chunk borders. Only STONE becomes AIR, which by
   * construction leaves the surface skin (dirt/grass/sand), bedrock (y=0), and water untouched.
   */
  private carveCaves(chunk: Chunk): void {
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        const wx = baseX + lx;
        const wz = baseZ + lz;
        for (let y = CAVE_MIN_Y; y < CHUNK_HEIGHT; y++) {
          const idx = Chunk.idx(lx, y, lz);
          if (chunk.blocks[idx] !== BlockId.STONE) continue;
          const n = this.caveNoise.fbm3D(wx * CAVE_SCALE_XZ, y * CAVE_SCALE_Y, wz * CAVE_SCALE_XZ, CAVE_OCTAVES);
          if (Math.abs(n) < CAVE_THRESHOLD) {
            chunk.blocks[idx] = BlockId.AIR;
          }
        }
      }
    }
  }

  /** Place all ore veins for a chunk. Coal: common, up to mid-depth. Iron: rarer, deep only. */
  private placeOreVeins(chunk: Chunk): void {
    this.scatterOre(chunk, BlockId.COAL_ORE, COAL_VEINS_PER_CHUNK, COAL_VEIN_SIZE, ORE_MIN_Y, COAL_MAX_Y, ORE_SALT_COAL);
    this.scatterOre(chunk, BlockId.IRON_ORE, IRON_VEINS_PER_CHUNK, IRON_VEIN_SIZE, ORE_MIN_Y, IRON_MAX_Y, ORE_SALT_IRON);
  }

  /** Place a rounded cobblestone boulder on the surface if the chunk's roll succeeds. */
  private placeBoulder(chunk: Chunk, heights: Int16Array): void {
    // Reseed deterministically from this chunk so the decision is independent of generation order.
    this.oreState = (hash3(chunk.cx, chunk.cz, (this.seed ^ STRUCT_SALT_BOULDER) >>> 0) >>> 0) || 1;
    const roll = this.oreNext() / 4294967296;
    if (roll >= BOULDER_CHANCE) return;

    // Pick an interior center so a radius-2 blob stays within [0, 16).
    const cxL = 2 + (this.oreNext() % (CHUNK_SIZE - 4));
    const czL = 2 + (this.oreNext() % (CHUNK_SIZE - 4));
    const h = heights[cxL + czL * CHUNK_SIZE]!;
    // No boulders on beaches or underwater columns.
    if (h <= SEA_LEVEL) return;

    const r = 1 + (this.oreNext() % BOULDER_MAX_RADIUS); // 1 or 2
    const cyL = h; // center the blob at the surface

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (dx * dx + dy * dy + dz * dz > r * r + 1) continue; // rounded sphere test
          const x = cxL + dx;
          const y = cyL + dy;
          const z = czL + dz;
          if (y < 1 || y >= CHUNK_HEIGHT) continue;
          if (x < 0 || x >= CHUNK_SIZE || z < 0 || z >= CHUNK_SIZE) continue;
          const idx = Chunk.idx(x, y, z);
          const cur = (chunk.blocks[idx] ?? BlockId.AIR) as BlockId;
          // Only replace natural ground/air blocks — never WATER, WOOD, LEAVES, ores, or existing cobble.
          if (
            cur === BlockId.AIR ||
            cur === BlockId.GRASS ||
            cur === BlockId.DIRT ||
            cur === BlockId.STONE ||
            cur === BlockId.SAND ||
            cur === BlockId.SNOW
          ) {
            chunk.blocks[idx] = BlockId.COBBLESTONE;
          }
        }
      }
    }
  }

  /**
   * Carve a hollow cobblestone-walled dungeon room underground if the chunk's roll succeeds.
   * The room is placed as close to the surface as cover allows, with an iron-ore reward on the floor.
   */
  private placeDungeon(chunk: Chunk, heights: Int16Array): void {
    // Reseed deterministically; independent salt from boulder so the two decisions don't correlate.
    this.oreState = (hash3(chunk.cx, chunk.cz, (this.seed ^ STRUCT_SALT_DUNGEON) >>> 0) >>> 0) || 1;
    if (this.oreNext() / 4294967296 >= DUNGEON_CHANCE) return;

    // Shell half-extent = DUNGEON_HALF + 1 = 3. Center range = [3, 12] so the whole shell fits in [0, 16).
    const range = CHUNK_SIZE - 2 * (DUNGEON_HALF + 1); // = 10
    const cxL = (DUNGEON_HALF + 1) + (this.oreNext() % range);
    const czL = (DUNGEON_HALF + 1) + (this.oreNext() % range);
    // Bounds invariant: cxL,czL ∈ [DUNGEON_HALF+1, CHUNK_SIZE-(DUNGEON_HALF+1)] = [3,12], so the
    // shell footprint (center ±(DUNGEON_HALF+1)=±3) spans [0,15] and the iron reward (center
    // ±DUNGEON_HALF=±2) spans [1,14] — every Chunk.idx write below is in-bounds without a guard.

    // Find the minimum surface height over the full shell footprint to ensure adequate cover.
    let minH = CHUNK_HEIGHT;
    for (let x = cxL - 3; x <= cxL + 3; x++) {
      for (let z = czL - 3; z <= czL + 3; z++) {
        minH = Math.min(minH, heights[x + z * CHUNK_SIZE]!);
      }
    }

    // Place the room as high as cover allows; bail if there isn't enough vertical room.
    const ceilingY = minH - DUNGEON_SURFACE_COVER;
    const floorY = ceilingY - (DUNGEON_INTERIOR_H + 1);
    if (floorY < DUNGEON_MIN_FLOOR_Y) return;

    // Build the shell: cobblestone walls/floor/ceiling; air interior.
    for (let x = cxL - 3; x <= cxL + 3; x++) {
      for (let z = czL - 3; z <= czL + 3; z++) {
        for (let y = floorY; y <= ceilingY; y++) {
          const isShell =
            x === cxL - 3 || x === cxL + 3 ||
            z === czL - 3 || z === czL + 3 ||
            y === floorY  || y === ceilingY;
          chunk.blocks[Chunk.idx(x, y, z)] = isShell ? BlockId.COBBLESTONE : BlockId.AIR;
        }
      }
    }

    // Reward: embed IRON_ORE blocks in interior floor cells.
    for (let i = 0; i < DUNGEON_IRON_REWARD; i++) {
      const ix = (cxL - DUNGEON_HALF) + (this.oreNext() % (2 * DUNGEON_HALF + 1));
      const iz = (czL - DUNGEON_HALF) + (this.oreNext() % (2 * DUNGEON_HALF + 1));
      chunk.blocks[Chunk.idx(ix, floorY, iz)] = BlockId.IRON_ORE;
    }
  }

  /** Dispatch surface boulders and underground dungeons for this chunk. */
  private placeStructures(chunk: Chunk, heights: Int16Array): void {
    this.placeBoulder(chunk, heights);
    this.placeDungeon(chunk, heights);
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

    // Caves: carve stone before ore so ore veins embed in the remaining stone (no floating ore).
    this.carveCaves(chunk);
    // Ore veins: placed after caves are carved, before trees.
    this.placeOreVeins(chunk);
    // Structures: boulders sit on the surface; dungeons are sealed underground (after ores so they overwrite/seal whatever's there).
    this.placeStructures(chunk, heights);

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
