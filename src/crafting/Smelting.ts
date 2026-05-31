import { BlockId, ItemId, type SmeltingRecipe, type FuelDef } from '../types';

/** input item id -> recipe. Block items use their BlockId numeric value as the item id. */
export const SMELTING_RECIPES: Map<ItemId, SmeltingRecipe> = new Map([
  [BlockId.IRON_ORE,    { input: BlockId.IRON_ORE,    output: ItemId.IRON_INGOT }],
  [BlockId.SAND,        { input: BlockId.SAND,        output: BlockId.GLASS }],
  [BlockId.COBBLESTONE, { input: BlockId.COBBLESTONE, output: BlockId.STONE }],
  [BlockId.WOOD,        { input: BlockId.WOOD,        output: ItemId.CHARCOAL }],
  [ItemId.RAW_BEEF,     { input: ItemId.RAW_BEEF,     output: ItemId.COOKED_BEEF }],
  [ItemId.RAW_PORKCHOP, { input: ItemId.RAW_PORKCHOP, output: ItemId.COOKED_PORKCHOP }],
  [ItemId.RAW_CHICKEN,  { input: ItemId.RAW_CHICKEN,  output: ItemId.COOKED_CHICKEN }],
  [ItemId.RAW_MUTTON,   { input: ItemId.RAW_MUTTON,   output: ItemId.COOKED_MUTTON }],
]);

/** item id -> fuel. burnValue = items smeltable per unit (coal=8). Charcoal is the dedicated fuel item from smelting logs; wooden tools and COAL_ORE, PLANKS, WOOD, STICK also burn. */
export const FUEL_TABLE: Map<ItemId, FuelDef> = new Map([
  [ItemId.STICK,          { burnValue: 0.5 }],
  [BlockId.PLANKS,        { burnValue: 1.5 }],
  [BlockId.WOOD,          { burnValue: 1.5 }],
  [BlockId.COAL_ORE,      { burnValue: 8 }],
  [ItemId.CHARCOAL,       { burnValue: 8 }],
  [ItemId.WOODEN_PICKAXE, { burnValue: 1 }],
  [ItemId.WOODEN_AXE,     { burnValue: 1 }],
  [ItemId.WOODEN_SHOVEL,  { burnValue: 1 }],
  [ItemId.WOODEN_SWORD,   { burnValue: 1 }],
]);

export function getSmeltingRecipe(item: ItemId): SmeltingRecipe | null {
  return SMELTING_RECIPES.get(item) ?? null;
}

export function getFuelDef(item: ItemId): FuelDef | null {
  return FUEL_TABLE.get(item) ?? null;
}
