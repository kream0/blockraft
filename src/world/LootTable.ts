import { BlockId, ItemId, CHEST_SLOTS, MAX_STACK, type ItemStack } from '../types';

// Weighted loot pool entry.
interface PoolEntry {
  item: ItemId;
  weight: number;
  min: number;
  max: number;
}

const POOL: PoolEntry[] = [
  { item: ItemId.IRON_INGOT,      weight: 24, min: 1, max: 4  },
  { item: ItemId.COOKED_BEEF,     weight: 20, min: 1, max: 3  },
  { item: ItemId.STICK,           weight: 14, min: 2, max: 6  },
  { item: BlockId.PLANKS,         weight: 12, min: 4, max: 12 },
  { item: ItemId.STONE_PICKAXE,   weight:  8, min: 1, max: 1  },
  { item: ItemId.IRON_PICKAXE,    weight:  6, min: 1, max: 1  },
  { item: ItemId.IRON_SWORD,      weight:  6, min: 1, max: 1  },
  { item: ItemId.DIAMOND,         weight:  5, min: 1, max: 2  },
  { item: ItemId.IRON_HELMET,     weight:  3, min: 1, max: 1  },
  { item: ItemId.IRON_CHESTPLATE, weight:  3, min: 1, max: 1  },
];

// Pre-compute total weight so it is a compile-time constant (at module init).
const TOTAL_WEIGHT: number = POOL.reduce((acc, e) => acc + e.weight, 0);

/**
 * Roll deterministic dungeon loot for a chest at (x, y, z) in a world with the given seed.
 * Returns an array of length CHEST_SLOTS where rolled stacks occupy distinct slots and the
 * rest are null. Identical (seed, x, y, z) always produces an identical result — no Math.random,
 * no Date.
 */
export function rollDungeonLoot(seed: number, x: number, y: number, z: number): (ItemStack | null)[] {
  // --- Seed the LCG ---
  // Mix all four inputs with Math.imul + xor to derive a non-zero initial state.
  let state = (
    Math.imul(seed | 0, 73856093) ^
    Math.imul(x | 0,    19349663) ^
    Math.imul(y | 0,    83492791) ^
    Math.imul(z | 0,    39916801)
  ) >>> 0;
  // Guarantee non-zero (same idiom as TerrainGenerator).
  state = state || 1;

  // LCG step — mirrors TerrainGenerator.oreNext().
  const next = (): number => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state;
  };

  // --- Build output slots ---
  const slots = new Array<ItemStack | null>(CHEST_SLOTS).fill(null);

  // --- Roll count: 3..6 stacks ---
  const stackCount = 3 + (next() % 4);

  for (let i = 0; i < stackCount; i++) {
    // --- Weighted item pick ---
    const roll = next() % TOTAL_WEIGHT;
    let cumulative = 0;
    let chosen: PoolEntry | undefined;
    for (let j = 0; j < POOL.length; j++) {
      const entry = POOL[j];
      if (entry === undefined) continue;
      cumulative += entry.weight;
      if (roll < cumulative) {
        chosen = entry;
        break;
      }
    }
    // Fallback to first entry if loop completes without selection (shouldn't happen with valid weights).
    if (chosen === undefined) {
      chosen = POOL[0];
    }
    if (chosen === undefined) continue; // POOL is empty — nothing to place

    // --- Count per stack ---
    const range = chosen.max - chosen.min;
    const rawCount = chosen.min + (range > 0 ? next() % (range + 1) : 0);
    const count = Math.min(rawCount, MAX_STACK);

    // --- Slot placement: pick a random empty slot, linear-probe on collision ---
    const startSlot = next() % CHEST_SLOTS;
    let placed = false;
    for (let probe = 0; probe < CHEST_SLOTS; probe++) {
      const slotIdx = (startSlot + probe) % CHEST_SLOTS;
      if (slots[slotIdx] === null) {
        slots[slotIdx] = { item: chosen.item, count };
        placed = true;
        break;
      }
    }
    // If all slots are full (impossible with ≤6 stacks vs 27 slots), just skip.
    if (!placed) continue;
  }

  return slots;
}
