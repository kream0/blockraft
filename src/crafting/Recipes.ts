import { BlockId, ItemId } from '../types';
import type { ItemStack, Recipe } from '../types';

// ============================================================
// Recipe table
// ============================================================

export const RECIPES: Recipe[] = [
  // 1 Wood -> 4 Planks (shapeless)
  {
    kind: 'shapeless',
    ingredients: [BlockId.WOOD],
    output: { item: BlockId.PLANKS, count: 4 },
  },
  // 2 Planks -> 4 Sticks (shapeless)
  {
    kind: 'shapeless',
    ingredients: [BlockId.PLANKS, BlockId.PLANKS],
    output: { item: ItemId.STICK, count: 4 },
  },
  // Wooden Pickaxe (shaped 3x3)
  // [P, P, P]
  // [_, S, _]
  // [_, S, _]
  {
    kind: 'shaped',
    pattern: [
      BlockId.PLANKS, BlockId.PLANKS, BlockId.PLANKS,
      null,           ItemId.STICK,   null,
      null,           ItemId.STICK,   null,
    ],
    width: 3,
    height: 3,
    output: { item: ItemId.WOODEN_PICKAXE, count: 1 },
  },
  // Wooden Axe (shaped 2x3)
  // [P, P]
  // [P, S]
  // [_, S]
  {
    kind: 'shaped',
    pattern: [
      BlockId.PLANKS, BlockId.PLANKS,
      BlockId.PLANKS, ItemId.STICK,
      null,           ItemId.STICK,
    ],
    width: 2,
    height: 3,
    output: { item: ItemId.WOODEN_AXE, count: 1 },
  },
  // Wooden Shovel (shaped 1x3)
  // [P]
  // [S]
  // [S]
  {
    kind: 'shaped',
    pattern: [
      BlockId.PLANKS,
      ItemId.STICK,
      ItemId.STICK,
    ],
    width: 1,
    height: 3,
    output: { item: ItemId.WOODEN_SHOVEL, count: 1 },
  },
  // Stone Pickaxe (shaped 3x3)
  // [C, C, C]
  // [_, S, _]
  // [_, S, _]
  {
    kind: 'shaped',
    pattern: [
      BlockId.COBBLESTONE, BlockId.COBBLESTONE, BlockId.COBBLESTONE,
      null,                ItemId.STICK,         null,
      null,                ItemId.STICK,         null,
    ],
    width: 3,
    height: 3,
    output: { item: ItemId.STONE_PICKAXE, count: 1 },
  },
  // Stone Axe (shaped 2x3)
  // [C, C]
  // [C, S]
  // [_, S]
  {
    kind: 'shaped',
    pattern: [
      BlockId.COBBLESTONE, BlockId.COBBLESTONE,
      BlockId.COBBLESTONE, ItemId.STICK,
      null,                ItemId.STICK,
    ],
    width: 2,
    height: 3,
    output: { item: ItemId.STONE_AXE, count: 1 },
  },
  // Stone Shovel (shaped 1x3)
  // [C]
  // [S]
  // [S]
  {
    kind: 'shaped',
    pattern: [
      BlockId.COBBLESTONE,
      ItemId.STICK,
      ItemId.STICK,
    ],
    width: 1,
    height: 3,
    output: { item: ItemId.STONE_SHOVEL, count: 1 },
  },
  // Furnace — 8 cobblestone ring, empty center (shaped 3x3)
  // [C, C, C]
  // [C, _, C]
  // [C, C, C]
  {
    kind: 'shaped',
    pattern: [
      BlockId.COBBLESTONE, BlockId.COBBLESTONE, BlockId.COBBLESTONE,
      BlockId.COBBLESTONE, null,                BlockId.COBBLESTONE,
      BlockId.COBBLESTONE, BlockId.COBBLESTONE, BlockId.COBBLESTONE,
    ],
    width: 3,
    height: 3,
    output: { item: BlockId.FURNACE, count: 1 },
  },
  // Chest — 8 planks ring, empty center (shaped 3x3)
  // [P, P, P]
  // [P, _, P]
  // [P, P, P]
  {
    kind: 'shaped',
    pattern: [
      BlockId.PLANKS, BlockId.PLANKS, BlockId.PLANKS,
      BlockId.PLANKS, null,           BlockId.PLANKS,
      BlockId.PLANKS, BlockId.PLANKS, BlockId.PLANKS,
    ],
    width: 3,
    height: 3,
    output: { item: BlockId.CHEST, count: 1 },
  },
  // Iron Pickaxe (shaped 3x3)
  // [I, I, I]
  // [_, S, _]
  // [_, S, _]
  {
    kind: 'shaped',
    pattern: [
      ItemId.IRON_INGOT, ItemId.IRON_INGOT, ItemId.IRON_INGOT,
      null,              ItemId.STICK,       null,
      null,              ItemId.STICK,       null,
    ],
    width: 3,
    height: 3,
    output: { item: ItemId.IRON_PICKAXE, count: 1 },
  },
  // Iron Axe (shaped 2x3)
  // [I, I]
  // [I, S]
  // [_, S]
  {
    kind: 'shaped',
    pattern: [
      ItemId.IRON_INGOT, ItemId.IRON_INGOT,
      ItemId.IRON_INGOT, ItemId.STICK,
      null,              ItemId.STICK,
    ],
    width: 2,
    height: 3,
    output: { item: ItemId.IRON_AXE, count: 1 },
  },
  // Iron Shovel (shaped 1x3)
  // [I]
  // [S]
  // [S]
  {
    kind: 'shaped',
    pattern: [
      ItemId.IRON_INGOT,
      ItemId.STICK,
      ItemId.STICK,
    ],
    width: 1,
    height: 3,
    output: { item: ItemId.IRON_SHOVEL, count: 1 },
  },
  // Wooden Sword (shaped 1x3)
  // [P]
  // [P]
  // [S]
  {
    kind: 'shaped',
    pattern: [
      BlockId.PLANKS,
      BlockId.PLANKS,
      ItemId.STICK,
    ],
    width: 1,
    height: 3,
    output: { item: ItemId.WOODEN_SWORD, count: 1 },
  },
  // Stone Sword (shaped 1x3)
  // [C]
  // [C]
  // [S]
  {
    kind: 'shaped',
    pattern: [
      BlockId.COBBLESTONE,
      BlockId.COBBLESTONE,
      ItemId.STICK,
    ],
    width: 1,
    height: 3,
    output: { item: ItemId.STONE_SWORD, count: 1 },
  },
  // Iron Sword (shaped 1x3)
  // [I]
  // [I]
  // [S]
  {
    kind: 'shaped',
    pattern: [
      ItemId.IRON_INGOT,
      ItemId.IRON_INGOT,
      ItemId.STICK,
    ],
    width: 1,
    height: 3,
    output: { item: ItemId.IRON_SWORD, count: 1 },
  },
  // Iron Helmet (shaped 3x2)
  // [I, I, I]
  // [I, _, I]
  {
    kind: 'shaped',
    pattern: [
      ItemId.IRON_INGOT, ItemId.IRON_INGOT, ItemId.IRON_INGOT,
      ItemId.IRON_INGOT, null,              ItemId.IRON_INGOT,
    ],
    width: 3,
    height: 2,
    output: { item: ItemId.IRON_HELMET, count: 1 },
  },
  // Iron Chestplate (shaped 3x3)
  // [I, _, I]
  // [I, I, I]
  // [I, I, I]
  {
    kind: 'shaped',
    pattern: [
      ItemId.IRON_INGOT, null,              ItemId.IRON_INGOT,
      ItemId.IRON_INGOT, ItemId.IRON_INGOT, ItemId.IRON_INGOT,
      ItemId.IRON_INGOT, ItemId.IRON_INGOT, ItemId.IRON_INGOT,
    ],
    width: 3,
    height: 3,
    output: { item: ItemId.IRON_CHESTPLATE, count: 1 },
  },
  // Iron Leggings (shaped 3x3)
  // [I, I, I]
  // [I, _, I]
  // [I, _, I]
  {
    kind: 'shaped',
    pattern: [
      ItemId.IRON_INGOT, ItemId.IRON_INGOT, ItemId.IRON_INGOT,
      ItemId.IRON_INGOT, null,              ItemId.IRON_INGOT,
      ItemId.IRON_INGOT, null,              ItemId.IRON_INGOT,
    ],
    width: 3,
    height: 3,
    output: { item: ItemId.IRON_LEGGINGS, count: 1 },
  },
  // Iron Boots (shaped 3x2)
  // [I, _, I]
  // [I, _, I]
  {
    kind: 'shaped',
    pattern: [
      ItemId.IRON_INGOT, null,              ItemId.IRON_INGOT,
      ItemId.IRON_INGOT, null,              ItemId.IRON_INGOT,
    ],
    width: 3,
    height: 2,
    output: { item: ItemId.IRON_BOOTS, count: 1 },
  },
  // Diamond Pickaxe (shaped 3x3)
  // [D, D, D]
  // [_, S, _]
  // [_, S, _]
  {
    kind: 'shaped',
    pattern: [
      ItemId.DIAMOND, ItemId.DIAMOND, ItemId.DIAMOND,
      null,           ItemId.STICK,   null,
      null,           ItemId.STICK,   null,
    ],
    width: 3,
    height: 3,
    output: { item: ItemId.DIAMOND_PICKAXE, count: 1 },
  },
  // Diamond Axe (shaped 2x3)
  // [D, D]
  // [D, S]
  // [_, S]
  {
    kind: 'shaped',
    pattern: [
      ItemId.DIAMOND, ItemId.DIAMOND,
      ItemId.DIAMOND, ItemId.STICK,
      null,           ItemId.STICK,
    ],
    width: 2,
    height: 3,
    output: { item: ItemId.DIAMOND_AXE, count: 1 },
  },
  // Diamond Shovel (shaped 1x3)
  // [D]
  // [S]
  // [S]
  {
    kind: 'shaped',
    pattern: [
      ItemId.DIAMOND,
      ItemId.STICK,
      ItemId.STICK,
    ],
    width: 1,
    height: 3,
    output: { item: ItemId.DIAMOND_SHOVEL, count: 1 },
  },
  // Diamond Sword (shaped 1x3)
  // [D]
  // [D]
  // [S]
  {
    kind: 'shaped',
    pattern: [
      ItemId.DIAMOND,
      ItemId.DIAMOND,
      ItemId.STICK,
    ],
    width: 1,
    height: 3,
    output: { item: ItemId.DIAMOND_SWORD, count: 1 },
  },
  // Diamond Helmet (shaped 3x2)
  // [D, D, D]
  // [D, _, D]
  {
    kind: 'shaped',
    pattern: [
      ItemId.DIAMOND, ItemId.DIAMOND, ItemId.DIAMOND,
      ItemId.DIAMOND, null,           ItemId.DIAMOND,
    ],
    width: 3,
    height: 2,
    output: { item: ItemId.DIAMOND_HELMET, count: 1 },
  },
  // Diamond Chestplate (shaped 3x3)
  // [D, _, D]
  // [D, D, D]
  // [D, D, D]
  {
    kind: 'shaped',
    pattern: [
      ItemId.DIAMOND, null,           ItemId.DIAMOND,
      ItemId.DIAMOND, ItemId.DIAMOND, ItemId.DIAMOND,
      ItemId.DIAMOND, ItemId.DIAMOND, ItemId.DIAMOND,
    ],
    width: 3,
    height: 3,
    output: { item: ItemId.DIAMOND_CHESTPLATE, count: 1 },
  },
  // Diamond Leggings (shaped 3x3)
  // [D, D, D]
  // [D, _, D]
  // [D, _, D]
  {
    kind: 'shaped',
    pattern: [
      ItemId.DIAMOND, ItemId.DIAMOND, ItemId.DIAMOND,
      ItemId.DIAMOND, null,           ItemId.DIAMOND,
      ItemId.DIAMOND, null,           ItemId.DIAMOND,
    ],
    width: 3,
    height: 3,
    output: { item: ItemId.DIAMOND_LEGGINGS, count: 1 },
  },
  // Diamond Boots (shaped 3x2)
  // [D, _, D]
  // [D, _, D]
  {
    kind: 'shaped',
    pattern: [
      ItemId.DIAMOND, null,           ItemId.DIAMOND,
      ItemId.DIAMOND, null,           ItemId.DIAMOND,
    ],
    width: 3,
    height: 2,
    output: { item: ItemId.DIAMOND_BOOTS, count: 1 },
  },
  // Door — 2x3 full planks column (shaped) -> 3 doors
  // [P, P]
  // [P, P]
  // [P, P]
  {
    kind: 'shaped',
    pattern: [
      BlockId.PLANKS, BlockId.PLANKS,
      BlockId.PLANKS, BlockId.PLANKS,
      BlockId.PLANKS, BlockId.PLANKS,
    ],
    width: 2,
    height: 3,
    output: { item: ItemId.DOOR, count: 3 },
  },
];

// ============================================================
// Helpers
// ============================================================

/**
 * Build a sorted count map (ItemId -> count) for multiset comparison.
 * Only non-null values are counted.
 */
function buildMultiset(items: (ItemId | null)[]): Map<ItemId, number> {
  const map = new Map<ItemId, number>();
  for (const item of items) {
    if (item !== null) {
      map.set(item, (map.get(item) ?? 0) + 1);
    }
  }
  return map;
}

/** Return true iff two multiset Maps are identical (same keys, same counts). */
function multisetEqual(a: Map<ItemId, number>, b: Map<ItemId, number>): boolean {
  if (a.size !== b.size) return false;
  for (const [id, count] of a) {
    if (b.get(id) !== count) return false;
  }
  return true;
}

// ============================================================
// Public API
// ============================================================

/**
 * Given the current contents of a dim×dim crafting grid (row-major, length dim*dim,
 * null for empty cells), return a fresh clone of the matched recipe's output stack,
 * or null if no recipe matches.
 *
 * Shaped recipes also match their horizontal mirror so that e.g. a left-handed axe
 * layout also crafts an axe.
 */
export function matchRecipe(grid: (ItemId | null)[], dim: number): ItemStack | null {
  // Collect non-null cell indices.
  const occupied: number[] = [];
  for (let i = 0; i < grid.length; i++) {
    const cell = grid[i] ?? null;
    if (cell !== null) {
      occupied.push(i);
    }
  }

  // Empty grid -> no match.
  if (occupied.length === 0) return null;

  // Pre-compute grid multiset once for shapeless checks.
  const gridMultiset = buildMultiset(grid);

  for (const recipe of RECIPES) {
    if (recipe.kind === 'shapeless') {
      const ingredientMultiset = buildMultiset(recipe.ingredients);
      if (multisetEqual(gridMultiset, ingredientMultiset)) {
        return { item: recipe.output.item, count: recipe.output.count };
      }
    } else {
      // shaped
      // Compute bounding box of non-null grid cells.
      let minRow = dim;
      let maxRow = -1;
      let minCol = dim;
      let maxCol = -1;

      for (const idx of occupied) {
        const row = Math.floor(idx / dim);
        const col = idx % dim;
        if (row < minRow) minRow = row;
        if (row > maxRow) maxRow = row;
        if (col < minCol) minCol = col;
        if (col > maxCol) maxCol = col;
      }

      const bw = maxCol - minCol + 1;
      const bh = maxRow - minRow + 1;

      // Bounding box must match recipe dimensions.
      if (bw !== recipe.width || bh !== recipe.height) continue;

      // Extract trimmed sub-grid (row-major, length bw*bh).
      const trimmed: (ItemId | null)[] = [];
      for (let r = 0; r < bh; r++) {
        for (let c = 0; c < bw; c++) {
          const gridIdx = (minRow + r) * dim + (minCol + c);
          trimmed.push(grid[gridIdx] ?? null);
        }
      }

      // Compare trimmed to recipe pattern.
      if (patternMatches(trimmed, recipe.pattern, bw, bh)) {
        return { item: recipe.output.item, count: recipe.output.count };
      }

      // Compare horizontal mirror of trimmed to recipe pattern.
      const mirrored: (ItemId | null)[] = [];
      for (let r = 0; r < bh; r++) {
        for (let c = 0; c < bw; c++) {
          mirrored.push(trimmed[r * bw + (bw - 1 - c)] ?? null);
        }
      }

      if (patternMatches(mirrored, recipe.pattern, bw, bh)) {
        return { item: recipe.output.item, count: recipe.output.count };
      }
    }
  }

  return null;
}

/**
 * Element-wise comparison of two grids of the same dimensions.
 * Both arrays must have length width*height.
 * A cell matches if both are null, or both are the same numeric ItemId.
 */
function patternMatches(
  grid: (ItemId | null)[],
  pattern: (ItemId | null)[],
  width: number,
  height: number,
): boolean {
  const len = width * height;
  for (let i = 0; i < len; i++) {
    const g = grid[i] ?? null;
    const p = pattern[i] ?? null;
    if (g !== p) return false;
  }
  return true;
}
