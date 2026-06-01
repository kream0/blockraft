import { BlockId, CHUNK_HEIGHT, CHUNK_SIZE, LAVA_GEN_MAX_Y } from '../types';
import { clamp } from '../utils/MathUtils';
import { PerlinNoise } from '../utils/Noise';
import { Chunk } from './Chunk';
import { doorBlockId, DoorFacing } from './Door';

const BASE_HEIGHT = Math.floor(CHUNK_HEIGHT / 2) - 4;
const AMPLITUDE = 12;
const SEA_LEVEL = BASE_HEIGHT - 2;

const BIOME_SCALE = 0.004; // low frequency → large, smooth biome regions
// Biome codes (local to terrain generation; no enum needed).
const BIOME_PLAINS = 0;
const BIOME_DESERT = 1;
const BIOME_SNOWY = 2;

// Mountains: a low-frequency elevation mask raises regional terrain into snow-capped peaks.
const MOUNTAIN_SCALE = 0.0025;     // lower than biome scale → very large mountain ranges
const MOUNTAIN_START = 0.15;       // mask noise below this → flat lowland
const MOUNTAIN_FULL = 0.55;        // mask noise at/above this → full mountain height
const MOUNTAIN_AMPLITUDE = 32;     // max blocks added to the heightmap at full mask
const MOUNTAIN_STONE_LINE = 60;    // surface at/above this (and below snow) is bare STONE
const SNOW_LINE = 72;              // surface at/above this is SNOW-capped, regardless of biome

// Ore generation tuning. Iron is rarer and deeper than coal.
const ORE_MIN_Y = 2;            // never touch bedrock (y=0) or just above it
const COAL_MAX_Y = 50;
const IRON_MAX_Y = 28;
const DIAMOND_MAX_Y = 12;
const COAL_VEINS_PER_CHUNK = 8;
const IRON_VEINS_PER_CHUNK = 5;
const DIAMOND_VEINS_PER_CHUNK = 2;
const COAL_VEIN_SIZE = 7;       // random-walk steps (ore blocks attempted)
const IRON_VEIN_SIZE = 5;
const DIAMOND_VEIN_SIZE = 4;
const ORE_SALT_COAL = 0x1f1f1f1f;
const ORE_SALT_IRON = 0x2e2e2e2e;
const ORE_SALT_DIAMOND = 0x3d3d3d3d;

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

// Villages: rare surface hamlets of small plank huts. Deterministic per chunk; each hut is confined to the chunk interior.
const STRUCT_SALT_VILLAGE = 0x5ee7c0de;
const VILLAGE_CHANCE = 0.05;        // ~1 in 20 chunks anchors a village
const HUT_HALF = 2;                 // 5x5 footprint (center ± HUT_HALF)
const HUT_WALL_H = 3;               // wall height in blocks
const VILLAGE_MAX_SLOPE = 2;        // max (maxH - minH) over a footprint to allow building on it
const VILLAGE_MAX_HUTS = 2;         // up to this many huts per village chunk
// Candidate hut centers within the chunk interior. Each 5x5 footprint (center ± 2) must stay in [0, CHUNK_SIZE)
// and the four candidates must not overlap, so a village can place up to 2 non-touching huts.
const HUT_CENTERS: ReadonlyArray<readonly [number, number]> = [[5, 5], [11, 11], [5, 11], [11, 5]];

// Cacti: sparse desert plants. Deterministic per chunk; 1-3 blocks tall on sand dunes above sea level.
const STRUCT_SALT_CACTUS = 0x5ca7c715;
const CACTUS_CANDIDATES = 4;   // candidate interior spots tried per chunk
const CACTUS_MIN_H = 1;        // min column height (blocks above the surface)
const CACTUS_MAX_H = 3;        // max column height

// Desert Temple: stepped sandstone pyramid on flat desert sand with a buried treasure chamber below.
// Rare landmark (~1 in 25 desert chunks; rarer overall because of the desert biome gate).
const STRUCT_SALT_TEMPLE = 0x7e3d10c5; // distinct from boulder/dungeon/village/cactus salts
const TEMPLE_CHANCE = 0.04;       // ~1 in 25 desert chunks anchors a temple (desert-gated, so rarer overall)
const TEMPLE_HALF = 4;            // 9x9 pyramid base (center +/- 4)
const TEMPLE_MAX_SLOPE = 2;       // max (maxH - minH) over the footprint to allow building
const TEMPLE_CHAMBER_HALF = 2;    // 5x5 chamber shell -> 3x3 interior
const TEMPLE_CHAMBER_H = 2;       // chamber interior height in rows

/** Deterministic int hash for tree placement, etc. */
function hash3(a: number, b: number, c: number): number {
  return ((Math.imul(a, 73856093) ^ Math.imul(b, 19349663) ^ Math.imul(c, 83492791)) >>> 0);
}

export class TerrainGenerator {
  private noise: PerlinNoise;
  private biomeNoise: PerlinNoise;
  private caveNoise: PerlinNoise;
  private mountainNoise: PerlinNoise;
  private seed: number;
  private oreState = 0;

  constructor(seed: number) {
    this.seed = seed >>> 0;
    this.noise = new PerlinNoise(this.seed);
    // Independent biome map: derive a distinct seed so it doesn't correlate with the heightmap.
    this.biomeNoise = new PerlinNoise((this.seed ^ 0x9e3779b9) >>> 0);
    // Independent cave noise: distinct magic constant so caves don't alias with biomes or heightmap.
    this.caveNoise = new PerlinNoise((this.seed ^ 0x517cc1e5) >>> 0);
    // Independent low-frequency mountain mask: distinct magic so peaks don't alias with heightmap/biomes/caves.
    this.mountainNoise = new PerlinNoise((this.seed ^ 0x2f6a1d3b) >>> 0);
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

  /** Flood the bottom of carved caves with lava: any cave-air cell at or below LAVA_GEN_MAX_Y
   *  becomes lava (deep underground only). Runs after carveCaves so it fills the carved air,
   *  and before ore placement (ores only replace stone, so no conflict). Deterministic. */
  private floodDeepLava(chunk: Chunk): void {
    for (let lz = 0; lz < CHUNK_SIZE; lz++) {
      for (let lx = 0; lx < CHUNK_SIZE; lx++) {
        for (let y = 1; y <= LAVA_GEN_MAX_Y; y++) {   // y starts at 1 — never touch bedrock at y=0
          const idx = Chunk.idx(lx, y, lz);
          if (chunk.blocks[idx] === BlockId.AIR) {
            chunk.blocks[idx] = BlockId.LAVA;
          }
        }
      }
    }
  }

  /** Place all ore veins for a chunk. Coal: common, up to mid-depth. Iron: rarer, deep only. Diamond: very rare, very deep. */
  private placeOreVeins(chunk: Chunk): void {
    this.scatterOre(chunk, BlockId.COAL_ORE, COAL_VEINS_PER_CHUNK, COAL_VEIN_SIZE, ORE_MIN_Y, COAL_MAX_Y, ORE_SALT_COAL);
    this.scatterOre(chunk, BlockId.IRON_ORE, IRON_VEINS_PER_CHUNK, IRON_VEIN_SIZE, ORE_MIN_Y, IRON_MAX_Y, ORE_SALT_IRON);
    this.scatterOre(chunk, BlockId.DIAMOND_ORE, DIAMOND_VEINS_PER_CHUNK, DIAMOND_VEIN_SIZE, ORE_MIN_Y, DIAMOND_MAX_Y, ORE_SALT_DIAMOND);
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

    // Loot chest: stand a CHEST on the room floor at the room center (floorY is the cobble
    // floor; floorY+1 is the first interior AIR row). Record its WORLD position so the world
    // can seed deterministic loot exactly once. cxL,czL ∈ [3,12] → always in-bounds.
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;
    chunk.blocks[Chunk.idx(cxL, floorY + 1, czL)] = BlockId.CHEST;
    chunk.lootChests.push({ x: baseX + cxL, y: floorY + 1, z: baseZ + czL });
  }

  /**
   * Build one 5x5 plank hut centered at (cxL, czL) if the ground is flat and dry enough.
   * Bounds invariant: with HUT_CENTERS ∈ {5,11} and HUT_HALF = 2, every footprint x/z is in
   * [3, 13] ⊆ [0, CHUNK_SIZE), and the suitability gate guarantees 1 <= floorY and
   * roofY <= CHUNK_HEIGHT - 2, so every Chunk.idx write below is in-bounds without per-write guards.
   */
  private buildHut(chunk: Chunk, heights: Int16Array, cxL: number, czL: number): void {
    // Suitability gate: measure terrain flatness and dryness over the 5x5 footprint.
    let minH = CHUNK_HEIGHT;
    let maxH = 0;
    for (let x = cxL - HUT_HALF; x <= cxL + HUT_HALF; x++) {
      for (let z = czL - HUT_HALF; z <= czL + HUT_HALF; z++) {
        const h = heights[x + z * CHUNK_SIZE]!;
        if (h < minH) minH = h;
        if (h > maxH) maxH = h;
      }
    }
    if (minH <= SEA_LEVEL) return;                        // no huts on beaches or water columns
    if (maxH - minH > VILLAGE_MAX_SLOPE) return;          // ground too uneven
    const floorY = maxH;
    const roofY = floorY + HUT_WALL_H + 1;
    if (roofY >= CHUNK_HEIGHT - 1) return;                // not enough vertical room

    // Foundation fill: raise low columns with DIRT so the floor doesn't float.
    for (let x = cxL - HUT_HALF; x <= cxL + HUT_HALF; x++) {
      for (let z = czL - HUT_HALF; z <= czL + HUT_HALF; z++) {
        const cs = heights[x + z * CHUNK_SIZE]!;
        for (let y = cs + 1; y <= floorY - 1; y++) {
          chunk.blocks[Chunk.idx(x, y, z)] = BlockId.DIRT;
        }
      }
    }

    // Floor: PLANKS across the whole 5x5 footprint.
    for (let x = cxL - HUT_HALF; x <= cxL + HUT_HALF; x++) {
      for (let z = czL - HUT_HALF; z <= czL + HUT_HALF; z++) {
        chunk.blocks[Chunk.idx(x, floorY, z)] = BlockId.PLANKS;
      }
    }

    // Walls: build up HUT_WALL_H layers above the floor.
    for (let y = floorY + 1; y <= floorY + HUT_WALL_H; y++) {
      for (let x = cxL - HUT_HALF; x <= cxL + HUT_HALF; x++) {
        for (let z = czL - HUT_HALF; z <= czL + HUT_HALF; z++) {
          const onPerimX = x === cxL - HUT_HALF || x === cxL + HUT_HALF;
          const onPerimZ = z === czL - HUT_HALF || z === czL + HUT_HALF;
          if (onPerimX || onPerimZ) {
            // Perimeter cell: corner posts are WOOD, edge planks are PLANKS.
            chunk.blocks[Chunk.idx(x, y, z)] = (onPerimX && onPerimZ) ? BlockId.WOOD : BlockId.PLANKS;
          } else {
            // Interior 3x3: clear to AIR.
            chunk.blocks[Chunk.idx(x, y, z)] = BlockId.AIR;
          }
        }
      }
    }

    // Windows: midpoint of each wall at y = floorY + 2 (mid-wall level).
    const winY = floorY + 2;
    chunk.blocks[Chunk.idx(cxL,        winY, czL - HUT_HALF)] = BlockId.GLASS; // -Z wall
    chunk.blocks[Chunk.idx(cxL,        winY, czL + HUT_HALF)] = BlockId.GLASS; // +Z wall
    chunk.blocks[Chunk.idx(cxL - HUT_HALF, winY, czL)]        = BlockId.GLASS; // -X wall
    chunk.blocks[Chunk.idx(cxL + HUT_HALF, winY, czL)]        = BlockId.GLASS; // +X wall

    // Door: a closed door on a deterministically chosen wall, slab flush to its outer face.
    // Applied after windows so it cleanly overwrites the window on the chosen side.
    const doorSide = this.oreNext() % 4;
    let doorX: number;
    let doorZ: number;
    if (doorSide === 0) { doorX = cxL;            doorZ = czL - HUT_HALF; } // -Z wall
    else if (doorSide === 1) { doorX = cxL;       doorZ = czL + HUT_HALF; } // +Z wall
    else if (doorSide === 2) { doorX = cxL - HUT_HALF; doorZ = czL;       } // -X wall
    else                     { doorX = cxL + HUT_HALF; doorZ = czL;       } // +X wall
    const doorFacing: DoorFacing =
      doorSide === 0 ? DoorFacing.NORTH :
      doorSide === 1 ? DoorFacing.SOUTH :
      doorSide === 2 ? DoorFacing.WEST :
      DoorFacing.EAST;
    const closedDoor = doorBlockId(doorFacing, false);
    chunk.blocks[Chunk.idx(doorX, floorY + 1, doorZ)] = closedDoor; // lower half
    chunk.blocks[Chunk.idx(doorX, floorY + 2, doorZ)] = closedDoor; // upper half

    // Roof: WOOD across the whole 5x5 footprint at roofY.
    for (let x = cxL - HUT_HALF; x <= cxL + HUT_HALF; x++) {
      for (let z = czL - HUT_HALF; z <= czL + HUT_HALF; z++) {
        chunk.blocks[Chunk.idx(x, roofY, z)] = BlockId.WOOD;
      }
    }
  }

  /**
   * Place a village (cluster of 1–2 plank huts) on flat, dry ground if the chunk's roll succeeds.
   * Uses a distinct salt from boulder and dungeon so the three decisions don't correlate.
   */
  private placeVillage(chunk: Chunk, heights: Int16Array): void {
    // Reseed deterministically; independent salt from boulder and dungeon so decisions don't correlate.
    this.oreState = (hash3(chunk.cx, chunk.cz, (this.seed ^ STRUCT_SALT_VILLAGE) >>> 0) >>> 0) || 1;
    if (this.oreNext() / 4294967296 >= VILLAGE_CHANCE) return;

    const hutCount = 1 + (this.oreNext() % VILLAGE_MAX_HUTS); // 1 or 2

    // Partial Fisher–Yates shuffle to choose hutCount distinct centers from HUT_CENTERS.
    const centers: [number, number][] = HUT_CENTERS.map(([cx, cz]) => [cx, cz]);
    for (let i = 0; i < hutCount; i++) {
      const j = i + (this.oreNext() % (centers.length - i));
      const tmp = centers[i]!;
      centers[i] = centers[j]!;
      centers[j] = tmp;
    }

    for (let i = 0; i < hutCount; i++) {
      const [hcx, hcz] = centers[i]!;
      this.buildHut(chunk, heights, hcx, hcz);
    }
  }

  /**
   * Place a stepped sandstone pyramid with a buried treasure chamber on flat desert sand if the
   * chunk's roll succeeds. The pyramid sits on the surface (floorY = maxH over the footprint) and
   * rises TEMPLE_HALF steps; the sealed chamber is directly below floorY.
   *
   * Bounds invariant: cxL,czL ∈ [TEMPLE_HALF, CHUNK_SIZE-1-TEMPLE_HALF] = [4, 11], so:
   *   - Pyramid footprint (center ±TEMPLE_HALF = ±4) spans [0, 15] ⊆ [0, CHUNK_SIZE).
   *   - Chamber footprint (center ±TEMPLE_CHAMBER_HALF = ±2) spans [2, 13] ⊆ [0, CHUNK_SIZE).
   *   - chamberFloorY >= 2 (gate at step 12).
   *   - floorY + TEMPLE_HALF <= CHUNK_HEIGHT - 2 (gate at step 11).
   * Every Chunk.idx write below is therefore in-bounds without a per-write guard.
   */
  private placeDesertTemple(chunk: Chunk, heights: Int16Array): void {
    // 1. Reseed deterministically; independent salt from all other structures.
    this.oreState = (hash3(chunk.cx, chunk.cz, (this.seed ^ STRUCT_SALT_TEMPLE) >>> 0) >>> 0) || 1;
    // 2. Chance roll — bail early before any computation if the chunk doesn't win.
    if (this.oreNext() / 4294967296 >= TEMPLE_CHANCE) return;

    // 3. Pick an interior center so the 9x9 footprint (center ±4) stays within [0, CHUNK_SIZE).
    const range = CHUNK_SIZE - 2 * TEMPLE_HALF; // = 8; valid center range ∈ [4, 11]
    const cxL = TEMPLE_HALF + (this.oreNext() % range);
    const czL = TEMPLE_HALF + (this.oreNext() % range);

    // 4. World-space base for loot chest registration.
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;

    // 5. Desert biome gate (world coordinates required for noise-based query).
    if (this.biomeAt(baseX + cxL, baseZ + czL) !== BIOME_DESERT) return;

    // 6. Terrain flatness: measure min/max surface height over the full 9x9 footprint.
    let minH = CHUNK_HEIGHT;
    let maxH = 0;
    for (let x = cxL - TEMPLE_HALF; x <= cxL + TEMPLE_HALF; x++) {
      for (let z = czL - TEMPLE_HALF; z <= czL + TEMPLE_HALF; z++) {
        const h = heights[x + z * CHUNK_SIZE]!;
        if (h < minH) minH = h;
        if (h > maxH) maxH = h;
      }
    }

    // 7. No temple on beaches or submerged columns.
    if (minH <= SEA_LEVEL) return;
    // 8. Slope gate: reject if the ground is too uneven.
    if (maxH - minH > TEMPLE_MAX_SLOPE) return;

    // 9. Sand-surface gate at the center column.
    const sH = heights[cxL + czL * CHUNK_SIZE]!;
    const surfaceId = (chunk.blocks[Chunk.idx(cxL, sH, czL)] ?? BlockId.AIR) as BlockId;
    if (surfaceId !== BlockId.SAND) return;

    // 10. The pyramid base sits flush with the highest column in the footprint.
    const floorY = maxH;

    // 11. Vertical headroom: pyramid tip (floorY + TEMPLE_HALF) must fit below the chunk ceiling.
    if (floorY + TEMPLE_HALF >= CHUNK_HEIGHT - 1) return;

    // 12. Chamber geometry: sealed sandstone box sits just below floorY.
    const chamberCeilY = floorY - 1;
    const chamberFloorY = chamberCeilY - (TEMPLE_CHAMBER_H + 1);
    if (chamberFloorY < 2) return;

    // --- All gates passed; no more early returns below. ---

    // A. Foundation fill: raise lower columns with SANDSTONE so the base is flush.
    for (let x = cxL - TEMPLE_HALF; x <= cxL + TEMPLE_HALF; x++) {
      for (let z = czL - TEMPLE_HALF; z <= czL + TEMPLE_HALF; z++) {
        const cs = heights[x + z * CHUNK_SIZE]!;
        for (let y = cs + 1; y <= floorY - 1; y++) {
          chunk.blocks[Chunk.idx(x, y, z)] = BlockId.SANDSTONE;
        }
      }
    }

    // B. Buried chamber: sealed sandstone shell, AIR interior, one loot chest.
    for (let x = cxL - TEMPLE_CHAMBER_HALF; x <= cxL + TEMPLE_CHAMBER_HALF; x++) {
      for (let z = czL - TEMPLE_CHAMBER_HALF; z <= czL + TEMPLE_CHAMBER_HALF; z++) {
        for (let y = chamberFloorY; y <= chamberCeilY; y++) {
          const isShell =
            x === cxL - TEMPLE_CHAMBER_HALF || x === cxL + TEMPLE_CHAMBER_HALF ||
            z === czL - TEMPLE_CHAMBER_HALF || z === czL + TEMPLE_CHAMBER_HALF ||
            y === chamberFloorY || y === chamberCeilY;
          chunk.blocks[Chunk.idx(x, y, z)] = isShell ? BlockId.SANDSTONE : BlockId.AIR;
        }
      }
    }
    // Loot chest on the chamber floor, one cell above the stone floor slab (chamberFloorY+1 is interior AIR).
    chunk.blocks[Chunk.idx(cxL, chamberFloorY + 1, czL)] = BlockId.CHEST;
    chunk.lootChests.push({ x: baseX + cxL, y: chamberFloorY + 1, z: baseZ + czL });

    // C. Stepped pyramid: solid sandstone. k=0 is the full 9x9 base layer at floorY; each step
    //    narrows by 1 on every side and rises 1 block, forming TEMPLE_HALF+1 tiers total.
    for (let k = 0; k <= TEMPLE_HALF; k++) {
      const y = floorY + k;
      const half = TEMPLE_HALF - k;
      for (let x = cxL - half; x <= cxL + half; x++) {
        for (let z = czL - half; z <= czL + half; z++) {
          chunk.blocks[Chunk.idx(x, y, z)] = BlockId.SANDSTONE;
        }
      }
    }
  }

  /** Place sparse cactus columns in the desert biome. Desert-only, sand-surface, above sea level, interior positions, AIR-only writes. */
  private placeCacti(chunk: Chunk, heights: Int16Array): void {
    const baseX = chunk.cx * CHUNK_SIZE;
    const baseZ = chunk.cz * CHUNK_SIZE;
    for (let i = 0; i < CACTUS_CANDIDATES; i++) {
      // Derive two independent hashes for x and z using distinct salts so cacti don't correlate with trees.
      const h1 = hash3(chunk.cx, chunk.cz, this.seed ^ STRUCT_SALT_CACTUS ^ (i * 1299709));
      const h2 = hash3(chunk.cx ^ 0x6b43a9b5, chunk.cz ^ 0x35fbe3a1, this.seed ^ STRUCT_SALT_CACTUS ^ (i * 2396957));
      const h3 = hash3(chunk.cx ^ 0x1b873593, chunk.cz ^ 0xcc9e2d51, this.seed ^ STRUCT_SALT_CACTUS ^ (i * 999983));
      // Interior-only: lx,lz ∈ [2, CHUNK_SIZE-3] so a single-column cactus never touches a chunk border.
      const lx = 2 + (h1 % (CHUNK_SIZE - 4));
      const lz = 2 + (h2 % (CHUNK_SIZE - 4));
      const surface = heights[lx + lz * CHUNK_SIZE]!;
      // Desert biome gate: world coordinates required for the noise-based biome query.
      if (this.biomeAt(baseX + lx, baseZ + lz) !== BIOME_DESERT) continue;
      // Surface must be SAND (not stone, snow, grass, or water) and above sea level.
      const surfaceId = (chunk.blocks[Chunk.idx(lx, surface, lz)] ?? BlockId.AIR) as BlockId;
      if (surfaceId !== BlockId.SAND) continue;
      if (surface <= SEA_LEVEL) continue;
      // Column height: 1-3 blocks (uses h3, an independent hash, to decorrelate height from x-position).
      const h = CACTUS_MIN_H + (h3 % (CACTUS_MAX_H - CACTUS_MIN_H + 1));
      // Vertical room: need h free cells above the surface block.
      if (surface + h >= CHUNK_HEIGHT) continue;
      // Place cactus column — AIR-only writes so we never overwrite trees, structures, or terrain.
      for (let y = surface + 1; y <= surface + h; y++) {
        const idx = Chunk.idx(lx, y, lz);
        if ((chunk.blocks[idx] ?? BlockId.AIR) === BlockId.AIR) {
          chunk.blocks[idx] = BlockId.CACTUS;
        }
      }
    }
  }

  /** Dispatch surface boulders, underground dungeons, villages, and desert temples for this chunk. */
  private placeStructures(chunk: Chunk, heights: Int16Array): void {
    this.placeBoulder(chunk, heights);
    this.placeDungeon(chunk, heights);
    this.placeVillage(chunk, heights);
    this.placeDesertTemple(chunk, heights);
  }

  /** Regional mountain mask in [0,1]: 0 in lowlands, smoothly ramps to 1 where the low-frequency mountain noise is high. */
  private mountainMaskAt(wx: number, wz: number): number {
    const m = this.mountainNoise.noise2D(wx * MOUNTAIN_SCALE, wz * MOUNTAIN_SCALE); // ~[-1, 1]
    const t = clamp((m - MOUNTAIN_START) / (MOUNTAIN_FULL - MOUNTAIN_START), 0, 1);
    return t * t * (3 - 2 * t); // smoothstep
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
        const mountain = this.mountainMaskAt(wx, wz);
        const raw = BASE_HEIGHT + Math.round(n * AMPLITUDE) + Math.round(mountain * MOUNTAIN_AMPLITUDE);
        const h = clamp(raw, 4, CHUNK_HEIGHT - 2);
        heights[lx + lz * CHUNK_SIZE] = h;
        const biome = this.biomeAt(wx, wz);
        // Altitude-driven surface override (any biome): bare rock on high slopes, snow on peaks.
        const isPeak = h >= SNOW_LINE;
        const isRocky = !isPeak && h >= MOUNTAIN_STONE_LINE;

        for (let y = 0; y <= h; y++) {
          let id: BlockId;
          if (y === 0) {
            id = BlockId.BEDROCK;
          } else if (y < h - 3) {
            id = BlockId.STONE;
          } else if (y < h) {
            // Sub-surface band: solid rock under rocky/peak columns, else dirt (desert: sand at h-1, sandstone below).
            id = (isPeak || isRocky) ? BlockId.STONE : (biome === BIOME_DESERT ? (y === h - 1 ? BlockId.SAND : BlockId.SANDSTONE) : BlockId.DIRT);
          } else {
            // y === h (surface block)
            if (h <= SEA_LEVEL) {
              id = BlockId.SAND;            // beaches & lakebeds stay sand in every biome
            } else if (isPeak) {
              id = BlockId.SNOW;            // snow-capped peak (overrides biome skin)
            } else if (isRocky) {
              id = BlockId.STONE;           // bare rock slope (overrides biome skin)
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
    // Lava: flood the bottom of carved caves before ores (ores only replace stone, so no conflict).
    this.floodDeepLava(chunk);
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
      // Trees only grow on grass — skip sand, stone, snow, or anything below sea level.
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

    // Cacti: sparse desert plants on sand dunes (after trees; desert-only).
    this.placeCacti(chunk, heights);

    chunk.dirty = true;
  }
}
