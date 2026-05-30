import {
  BlockId,
  ItemId,
  ToolKind,
  MAX_STACK,
  type ItemDef,
  type ToolDef,
} from '../types';

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
};

// === Block item identity set — built once at module load ===
const _blockIdSet = new Set<number>(Object.values(BlockId));

/** True if id is one of the BlockId numeric values (0..14). */
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
    },
  ],
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
  };
}

// === Tool-category map: which ToolKind speeds each BlockId ===
export const BLOCK_TOOL_CATEGORY: Partial<Record<BlockId, ToolKind>> = {
  [BlockId.STONE]:       ToolKind.PICKAXE,
  [BlockId.COBBLESTONE]: ToolKind.PICKAXE,
  [BlockId.COAL_ORE]:    ToolKind.PICKAXE,
  [BlockId.IRON_ORE]:    ToolKind.PICKAXE,

  [BlockId.WOOD]:   ToolKind.AXE,
  [BlockId.PLANKS]: ToolKind.AXE,

  [BlockId.DIRT]:  ToolKind.SHOVEL,
  [BlockId.GRASS]: ToolKind.SHOVEL,
  [BlockId.SAND]:  ToolKind.SHOVEL,
  [BlockId.SNOW]:  ToolKind.SHOVEL,
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
