import {
  BlockId,
  ItemId,
  ToolKind,
  EntityKind,
  MAX_STACK,
  type ItemDef,
  type ToolDef,
  type FoodDef,
  type WeaponDef,
  ArmorSlot,
  type ArmorDef,
} from '../types';
import { isDoorBlock } from '../world/Door';

// === Canonical block swatch colors (copied from Hotbar.ts; integration agent will redirect Hotbar here) ===
export const BLOCK_SWATCH_COLORS: Record<number, string> = {
  [BlockId.AIR]:         '#000000',
  [BlockId.GRASS]:       '#5DAD3A',
  [BlockId.DIRT]:        '#8B5A2B',
  [BlockId.STONE]:       '#888888',
  [BlockId.COBBLESTONE]: '#777777',
  [BlockId.WOOD]:        '#6E4923',
  [BlockId.LEAVES]:      '#3F7E2A',
  [BlockId.PLANKS]:      '#B6824A',
  [BlockId.SAND]:        '#E2D2A0',
  [BlockId.GLASS]:       '#A8D0E6',
  [BlockId.BEDROCK]:     '#4A4A4A',
  [BlockId.SNOW]:        '#EAF2F8',
  [BlockId.WATER]:       '#3B6FCB',
  [BlockId.COAL_ORE]:    '#2B2B2B',
  [BlockId.IRON_ORE]:    '#C8865A',
  [BlockId.FURNACE]:     '#8a7a6a',
  [BlockId.DIAMOND_ORE]: '#4FC3F7',
  [BlockId.CHEST]:       '#8b6e3a',
  [BlockId.GLOWSTONE]:   '#C99A2E',
};

// === Block item identity set — built once at module load ===
const _blockIdSet = new Set<number>(Object.values(BlockId));

/** True if id is one of the BlockId numeric values (0..16). */
export function isBlockItem(id: ItemId): boolean {
  return _blockIdSet.has(id);
}

// === Reverse map: BlockId value → key string (e.g. 3 → 'STONE') ===
const _blockIdToName = new Map<number, string>(
  Object.entries(BlockId).map(([k, v]) => [v as number, k])
);

// === Static defs for non-block items ===
export const ITEM_DEFS: Map<ItemId, ItemDef> = new Map([
  [
    ItemId.STICK,
    {
      id: ItemId.STICK,
      name: 'Stick',
      maxStack: 64,
      swatchColor: '#8a5a2b',
      glyph: '/',
      placeable: null,
      tool: null,
      weapon: null,
      armor: null,
      food: null,
    },
  ],
  [
    ItemId.WOODEN_PICKAXE,
    {
      id: ItemId.WOODEN_PICKAXE,
      name: 'Wooden Pickaxe',
      maxStack: 1,
      swatchColor: '#9c7a4d',
      glyph: 'P',
      placeable: null,
      tool: { kind: ToolKind.PICKAXE, speedMultiplier: 3 } satisfies ToolDef,
      weapon: null,
      armor: null,
      food: null,
    },
  ],
  [
    ItemId.WOODEN_AXE,
    {
      id: ItemId.WOODEN_AXE,
      name: 'Wooden Axe',
      maxStack: 1,
      swatchColor: '#9c7a4d',
      glyph: 'A',
      placeable: null,
      tool: { kind: ToolKind.AXE, speedMultiplier: 3 } satisfies ToolDef,
      weapon: null,
      armor: null,
      food: null,
    },
  ],
  [
    ItemId.WOODEN_SHOVEL,
    {
      id: ItemId.WOODEN_SHOVEL,
      name: 'Wooden Shovel',
      maxStack: 1,
      swatchColor: '#9c7a4d',
      glyph: 'S',
      placeable: null,
      tool: { kind: ToolKind.SHOVEL, speedMultiplier: 3 } satisfies ToolDef,
      weapon: null,
      armor: null,
      food: null,
    },
  ],
  [
    ItemId.STONE_PICKAXE,
    {
      id: ItemId.STONE_PICKAXE,
      name: 'Stone Pickaxe',
      maxStack: 1,
      swatchColor: '#9a9a9a',
      glyph: 'P',
      placeable: null,
      tool: { kind: ToolKind.PICKAXE, speedMultiplier: 5 } satisfies ToolDef,
      weapon: null,
      armor: null,
      food: null,
    },
  ],
  [
    ItemId.STONE_AXE,
    {
      id: ItemId.STONE_AXE,
      name: 'Stone Axe',
      maxStack: 1,
      swatchColor: '#9a9a9a',
      glyph: 'A',
      placeable: null,
      tool: { kind: ToolKind.AXE, speedMultiplier: 5 } satisfies ToolDef,
      weapon: null,
      armor: null,
      food: null,
    },
  ],
  [
    ItemId.STONE_SHOVEL,
    {
      id: ItemId.STONE_SHOVEL,
      name: 'Stone Shovel',
      maxStack: 1,
      swatchColor: '#9a9a9a',
      glyph: 'S',
      placeable: null,
      tool: { kind: ToolKind.SHOVEL, speedMultiplier: 5 } satisfies ToolDef,
      weapon: null,
      armor: null,
      food: null,
    },
  ],
  [ItemId.RAW_BEEF, {
    id: ItemId.RAW_BEEF, name: 'Raw Beef', maxStack: 64,
    swatchColor: '#a83e3e', glyph: 'B', placeable: null, tool: null, weapon: null,
    armor: null,
    food: { hungerRestore: 3 } satisfies FoodDef,
  }],
  [ItemId.RAW_PORKCHOP, {
    id: ItemId.RAW_PORKCHOP, name: 'Raw Porkchop', maxStack: 64,
    swatchColor: '#e6a4a4', glyph: 'O', placeable: null, tool: null, weapon: null,
    armor: null,
    food: { hungerRestore: 3 } satisfies FoodDef,
  }],
  [ItemId.RAW_CHICKEN, {
    id: ItemId.RAW_CHICKEN, name: 'Raw Chicken', maxStack: 64,
    swatchColor: '#e8cf9a', glyph: 'C', placeable: null, tool: null, weapon: null,
    armor: null,
    food: { hungerRestore: 2 } satisfies FoodDef,
  }],
  [ItemId.RAW_MUTTON, {
    id: ItemId.RAW_MUTTON, name: 'Raw Mutton', maxStack: 64,
    swatchColor: '#b85c4e', glyph: 'M', placeable: null, tool: null, weapon: null,
    armor: null,
    food: { hungerRestore: 2 } satisfies FoodDef,
  }],
  [
    ItemId.IRON_PICKAXE,
    {
      id: ItemId.IRON_PICKAXE,
      name: 'Iron Pickaxe',
      maxStack: 1,
      swatchColor: '#cfcfcf',
      glyph: 'P',
      placeable: null,
      tool: { kind: ToolKind.PICKAXE, speedMultiplier: 8 } satisfies ToolDef,
      weapon: null,
      armor: null,
      food: null,
    },
  ],
  [
    ItemId.IRON_AXE,
    {
      id: ItemId.IRON_AXE,
      name: 'Iron Axe',
      maxStack: 1,
      swatchColor: '#cfcfcf',
      glyph: 'A',
      placeable: null,
      tool: { kind: ToolKind.AXE, speedMultiplier: 8 } satisfies ToolDef,
      weapon: null,
      armor: null,
      food: null,
    },
  ],
  [
    ItemId.IRON_SHOVEL,
    {
      id: ItemId.IRON_SHOVEL,
      name: 'Iron Shovel',
      maxStack: 1,
      swatchColor: '#cfcfcf',
      glyph: 'S',
      placeable: null,
      tool: { kind: ToolKind.SHOVEL, speedMultiplier: 8 } satisfies ToolDef,
      weapon: null,
      armor: null,
      food: null,
    },
  ],
  [ItemId.IRON_INGOT, {
    id: ItemId.IRON_INGOT, name: 'Iron Ingot', maxStack: 64,
    swatchColor: '#d8d8d8', glyph: 'I', placeable: null, tool: null, weapon: null, armor: null, food: null,
  }],
  [ItemId.CHARCOAL, {
    id: ItemId.CHARCOAL, name: 'Charcoal', maxStack: 64,
    swatchColor: '#231f1b', glyph: 'c', placeable: null, tool: null, weapon: null, armor: null, food: null,
  }],
  [
    ItemId.WOODEN_SWORD,
    {
      id: ItemId.WOODEN_SWORD,
      name: 'Wooden Sword',
      maxStack: 1,
      swatchColor: '#9c7a4d',
      glyph: 'W',
      placeable: null,
      tool: null,
      weapon: { damage: 6 } satisfies WeaponDef,
      armor: null,
      food: null,
    },
  ],
  [
    ItemId.STONE_SWORD,
    {
      id: ItemId.STONE_SWORD,
      name: 'Stone Sword',
      maxStack: 1,
      swatchColor: '#9a9a9a',
      glyph: 'W',
      placeable: null,
      tool: null,
      weapon: { damage: 7 } satisfies WeaponDef,
      armor: null,
      food: null,
    },
  ],
  [
    ItemId.IRON_SWORD,
    {
      id: ItemId.IRON_SWORD,
      name: 'Iron Sword',
      maxStack: 1,
      swatchColor: '#cfcfcf',
      glyph: 'W',
      placeable: null,
      tool: null,
      weapon: { damage: 9 } satisfies WeaponDef,
      armor: null,
      food: null,
    },
  ],
  [
    ItemId.IRON_HELMET,
    {
      id: ItemId.IRON_HELMET,
      name: 'Iron Helmet',
      maxStack: 1,
      swatchColor: '#c4ccd4',
      glyph: 'H',
      placeable: null,
      tool: null,
      weapon: null,
      armor: { slot: ArmorSlot.HEAD, defense: 2 } satisfies ArmorDef,
      food: null,
    },
  ],
  [
    ItemId.IRON_CHESTPLATE,
    {
      id: ItemId.IRON_CHESTPLATE,
      name: 'Iron Chestplate',
      maxStack: 1,
      swatchColor: '#c4ccd4',
      glyph: 'C',
      placeable: null,
      tool: null,
      weapon: null,
      armor: { slot: ArmorSlot.CHEST, defense: 6 } satisfies ArmorDef,
      food: null,
    },
  ],
  [
    ItemId.IRON_LEGGINGS,
    {
      id: ItemId.IRON_LEGGINGS,
      name: 'Iron Leggings',
      maxStack: 1,
      swatchColor: '#c4ccd4',
      glyph: 'L',
      placeable: null,
      tool: null,
      weapon: null,
      armor: { slot: ArmorSlot.LEGS, defense: 5 } satisfies ArmorDef,
      food: null,
    },
  ],
  [
    ItemId.IRON_BOOTS,
    {
      id: ItemId.IRON_BOOTS,
      name: 'Iron Boots',
      maxStack: 1,
      swatchColor: '#c4ccd4',
      glyph: 'B',
      placeable: null,
      tool: null,
      weapon: null,
      armor: { slot: ArmorSlot.FEET, defense: 2 } satisfies ArmorDef,
      food: null,
    },
  ],
  [ItemId.DIAMOND, {
    id: ItemId.DIAMOND, name: 'Diamond', maxStack: 64,
    swatchColor: '#4FC3F7', glyph: 'D', placeable: null, tool: null, weapon: null, armor: null, food: null,
  }],
  [
    ItemId.DIAMOND_PICKAXE,
    {
      id: ItemId.DIAMOND_PICKAXE,
      name: 'Diamond Pickaxe',
      maxStack: 1,
      swatchColor: '#4FC3F7',
      glyph: 'P',
      placeable: null,
      tool: { kind: ToolKind.PICKAXE, speedMultiplier: 12 } satisfies ToolDef,
      weapon: null,
      armor: null,
      food: null,
    },
  ],
  [
    ItemId.DIAMOND_AXE,
    {
      id: ItemId.DIAMOND_AXE,
      name: 'Diamond Axe',
      maxStack: 1,
      swatchColor: '#4FC3F7',
      glyph: 'A',
      placeable: null,
      tool: { kind: ToolKind.AXE, speedMultiplier: 12 } satisfies ToolDef,
      weapon: null,
      armor: null,
      food: null,
    },
  ],
  [
    ItemId.DIAMOND_SHOVEL,
    {
      id: ItemId.DIAMOND_SHOVEL,
      name: 'Diamond Shovel',
      maxStack: 1,
      swatchColor: '#4FC3F7',
      glyph: 'S',
      placeable: null,
      tool: { kind: ToolKind.SHOVEL, speedMultiplier: 12 } satisfies ToolDef,
      weapon: null,
      armor: null,
      food: null,
    },
  ],
  [
    ItemId.DIAMOND_SWORD,
    {
      id: ItemId.DIAMOND_SWORD,
      name: 'Diamond Sword',
      maxStack: 1,
      swatchColor: '#4FC3F7',
      glyph: 'W',
      placeable: null,
      tool: null,
      weapon: { damage: 11 } satisfies WeaponDef,
      armor: null,
      food: null,
    },
  ],
  [
    ItemId.DIAMOND_HELMET,
    {
      id: ItemId.DIAMOND_HELMET,
      name: 'Diamond Helmet',
      maxStack: 1,
      swatchColor: '#86d9e8',
      glyph: 'H',
      placeable: null,
      tool: null,
      weapon: null,
      armor: { slot: ArmorSlot.HEAD, defense: 3 } satisfies ArmorDef,
      food: null,
    },
  ],
  [
    ItemId.DIAMOND_CHESTPLATE,
    {
      id: ItemId.DIAMOND_CHESTPLATE,
      name: 'Diamond Chestplate',
      maxStack: 1,
      swatchColor: '#86d9e8',
      glyph: 'C',
      placeable: null,
      tool: null,
      weapon: null,
      armor: { slot: ArmorSlot.CHEST, defense: 8 } satisfies ArmorDef,
      food: null,
    },
  ],
  [
    ItemId.DIAMOND_LEGGINGS,
    {
      id: ItemId.DIAMOND_LEGGINGS,
      name: 'Diamond Leggings',
      maxStack: 1,
      swatchColor: '#86d9e8',
      glyph: 'L',
      placeable: null,
      tool: null,
      weapon: null,
      armor: { slot: ArmorSlot.LEGS, defense: 6 } satisfies ArmorDef,
      food: null,
    },
  ],
  [
    ItemId.DIAMOND_BOOTS,
    {
      id: ItemId.DIAMOND_BOOTS,
      name: 'Diamond Boots',
      maxStack: 1,
      swatchColor: '#86d9e8',
      glyph: 'B',
      placeable: null,
      tool: null,
      weapon: null,
      armor: { slot: ArmorSlot.FEET, defense: 3 } satisfies ArmorDef,
      food: null,
    },
  ],
  [ItemId.COOKED_BEEF, {
    id: ItemId.COOKED_BEEF, name: 'Steak', maxStack: 64,
    swatchColor: '#7a4a2a', glyph: 'B', placeable: null, tool: null, weapon: null,
    armor: null,
    food: { hungerRestore: 8 } satisfies FoodDef,
  }],
  [ItemId.COOKED_PORKCHOP, {
    id: ItemId.COOKED_PORKCHOP, name: 'Cooked Porkchop', maxStack: 64,
    swatchColor: '#c98a5a', glyph: 'O', placeable: null, tool: null, weapon: null,
    armor: null,
    food: { hungerRestore: 8 } satisfies FoodDef,
  }],
  [ItemId.COOKED_CHICKEN, {
    id: ItemId.COOKED_CHICKEN, name: 'Cooked Chicken', maxStack: 64,
    swatchColor: '#caa86a', glyph: 'C', placeable: null, tool: null, weapon: null,
    armor: null,
    food: { hungerRestore: 6 } satisfies FoodDef,
  }],
  [ItemId.COOKED_MUTTON, {
    id: ItemId.COOKED_MUTTON, name: 'Cooked Mutton', maxStack: 64,
    swatchColor: '#8a5a3a', glyph: 'M', placeable: null, tool: null, weapon: null,
    armor: null,
    food: { hungerRestore: 6 } satisfies FoodDef,
  }],
  [ItemId.DOOR, {
    id: ItemId.DOOR, name: 'Door', maxStack: 64,
    swatchColor: '#9e7140', glyph: 'D', placeable: null, tool: null, weapon: null,
    armor: null, food: null,
  }],
]);

/** True if id refers to any known item (block or non-block). */
export function isKnownItem(id: ItemId): boolean {
  return isBlockItem(id) || ITEM_DEFS.has(id);
}

// === Direct helpers (no per-call allocation for block-item hot paths) ===

/** sRGB hex swatch color for the given item. */
export function itemSwatchColor(id: ItemId): string {
  const def = ITEM_DEFS.get(id);
  if (def !== undefined) return def.swatchColor;
  return BLOCK_SWATCH_COLORS[id] ?? '#ffffff';
}

/** 1-char glyph for non-block items; '' for block items. */
export function itemGlyph(id: ItemId): string {
  const def = ITEM_DEFS.get(id);
  if (def !== undefined) return def.glyph;
  return '';
}

/** Max stack size for the given item. */
export function itemMaxStack(id: ItemId): number {
  const def = ITEM_DEFS.get(id);
  if (def !== undefined) return def.maxStack;
  return MAX_STACK;
}

/**
 * The BlockId this item places on right-click, or null.
 * For block items (id is a BlockId value) returns the id cast as BlockId.
 * For non-block items returns the def's placeable (null for sticks/tools).
 */
export function itemPlaceableBlock(id: ItemId): BlockId | null {
  const def = ITEM_DEFS.get(id);
  if (def !== undefined) return def.placeable;
  if (isBlockItem(id)) return id as BlockId;
  return null;
}

/** ToolDef if this item is a tool, else null. */
export function itemToolDef(id: ItemId): ToolDef | null {
  const def = ITEM_DEFS.get(id);
  if (def !== undefined) return def.tool;
  return null;
}

/** FoodDef if this item is edible, else null. */
export function itemFoodDef(id: ItemId): FoodDef | null {
  const def = ITEM_DEFS.get(id);
  if (def !== undefined) return def.food;
  return null;
}

/** WeaponDef if this item is a melee weapon, else null. */
export function itemWeaponDef(id: ItemId): WeaponDef | null {
  const def = ITEM_DEFS.get(id);
  if (def !== undefined) return def.weapon;
  return null;
}

/** ArmorDef if this item is wearable armor, else null. */
export function itemArmorDef(id: ItemId): ArmorDef | null {
  const def = ITEM_DEFS.get(id);
  if (def !== undefined) return def.armor;
  return null;
}

/**
 * Returns the static ItemDef for non-block items, or synthesizes one for
 * block items from BLOCK_SWATCH_COLORS + the reverse BlockId name map.
 */
export function getItemDef(id: ItemId): ItemDef {
  const existing = ITEM_DEFS.get(id);
  if (existing !== undefined) return existing;

  // Synthesize a block-item def on the fly (no caching; callers should use
  // the direct helpers above for hot paths).
  const name = _blockIdToName.get(id) ?? `item_${id}`;
  const swatchColor = BLOCK_SWATCH_COLORS[id] ?? '#ffffff';
  return {
    id,
    name,
    maxStack: MAX_STACK,
    swatchColor,
    glyph: '',
    placeable: id as BlockId,
    tool: null,
    weapon: null,
    armor: null,
    food: null,
  };
}

// === Tool-category map: which ToolKind speeds each BlockId ===
export const BLOCK_TOOL_CATEGORY: Partial<Record<BlockId, ToolKind>> = {
  [BlockId.STONE]:       ToolKind.PICKAXE,
  [BlockId.COBBLESTONE]: ToolKind.PICKAXE,
  [BlockId.COAL_ORE]:    ToolKind.PICKAXE,
  [BlockId.IRON_ORE]:    ToolKind.PICKAXE,
  [BlockId.DIAMOND_ORE]: ToolKind.PICKAXE,

  [BlockId.WOOD]:   ToolKind.AXE,
  [BlockId.PLANKS]: ToolKind.AXE,

  [BlockId.DIRT]:  ToolKind.SHOVEL,
  [BlockId.GRASS]: ToolKind.SHOVEL,
  [BlockId.SAND]:  ToolKind.SHOVEL,
  [BlockId.SNOW]:  ToolKind.SHOVEL,

  [BlockId.FURNACE]: ToolKind.PICKAXE,
  [BlockId.CHEST]:   ToolKind.AXE,
};

/**
 * Mining-speed multiplier when heldItem is used on target.
 * Returns the tool's speedMultiplier when the tool category matches,
 * or 1 (base speed) if there is no tool, wrong category, or block has no category.
 */
export function toolMultiplierFor(heldItem: ItemId, target: BlockId): number {
  const tool = itemToolDef(heldItem);
  if (tool === null) return 1;
  const cat = BLOCK_TOOL_CATEGORY[target];
  return cat === tool.kind ? tool.speedMultiplier : 1;
}

/**
 * The item that drops when `block` is mined. Stone drops cobblestone (so
 * cobblestone is obtainable and stone tools are craftable). Diamond ore drops
 * the diamond gem (ItemId.DIAMOND) rather than the ore block itself. Every
 * other block drops itself. Return type is ItemId because gem drops are not
 * block items; BlockId values are valid ItemId numbers so the widening is safe.
 */
export function blockDropFor(block: BlockId): ItemId {
  if (isDoorBlock(block)) return ItemId.DOOR;
  if (block === BlockId.STONE) return BlockId.COBBLESTONE;
  if (block === BlockId.DIAMOND_ORE) return ItemId.DIAMOND;
  return block;
}

/** The food item a passive animal drops on death, or null for non-food mobs. */
export function foodDropForMob(kind: EntityKind): ItemId | null {
  if (kind === EntityKind.COW)     return ItemId.RAW_BEEF;
  if (kind === EntityKind.PIG)     return ItemId.RAW_PORKCHOP;
  if (kind === EntityKind.CHICKEN) return ItemId.RAW_CHICKEN;
  if (kind === EntityKind.SHEEP)   return ItemId.RAW_MUTTON;
  return null;
}
