import { BlockId, GLOWSTONE_LIGHT, LAVA_LIGHT, TORCH_LIGHT, type BlockDef, type IBlockRegistry } from '../types';

const defs: Record<number, BlockDef> = {
  [BlockId.AIR]: {
    id: BlockId.AIR,
    name: 'Air',
    solid: false,
    transparent: true,
    textures: { top: 0, bottom: 0, side: 0 },
    particleColor: 0x000000,
    hardness: 0,
  },
  [BlockId.GRASS]: {
    id: BlockId.GRASS,
    name: 'Grass',
    solid: true,
    transparent: false,
    textures: { top: 0, bottom: 1, side: 2 },
    particleColor: 0x5DAD3A,
    hardness: 0.6,
  },
  [BlockId.DIRT]: {
    id: BlockId.DIRT,
    name: 'Dirt',
    solid: true,
    transparent: false,
    textures: { top: 1, bottom: 1, side: 1 },
    particleColor: 0x8B5A2B,
    hardness: 0.6,
  },
  [BlockId.STONE]: {
    id: BlockId.STONE,
    name: 'Stone',
    solid: true,
    transparent: false,
    textures: { top: 3, bottom: 3, side: 3 },
    particleColor: 0x888888,
    hardness: 1.8,
  },
  [BlockId.COBBLESTONE]: {
    id: BlockId.COBBLESTONE,
    name: 'Cobblestone',
    solid: true,
    transparent: false,
    textures: { top: 4, bottom: 4, side: 4 },
    particleColor: 0x777777,
    hardness: 2.0,
  },
  [BlockId.WOOD]: {
    id: BlockId.WOOD,
    name: 'Wood',
    solid: true,
    transparent: false,
    textures: { top: 5, bottom: 5, side: 6 },
    particleColor: 0x6E4923,
    hardness: 1.5,
  },
  [BlockId.LEAVES]: {
    id: BlockId.LEAVES,
    name: 'Leaves',
    solid: true,
    transparent: true,
    textures: { top: 7, bottom: 7, side: 7 },
    particleColor: 0x3F7E2A,
    hardness: 0.3,
  },
  [BlockId.PLANKS]: {
    id: BlockId.PLANKS,
    name: 'Planks',
    solid: true,
    transparent: false,
    textures: { top: 8, bottom: 8, side: 8 },
    particleColor: 0xB6824A,
    hardness: 1.5,
  },
  [BlockId.SAND]: {
    id: BlockId.SAND,
    name: 'Sand',
    solid: true,
    transparent: false,
    textures: { top: 9, bottom: 9, side: 9 },
    particleColor: 0xE2D2A0,
    hardness: 0.6,
  },
  [BlockId.GLASS]: {
    id: BlockId.GLASS,
    name: 'Glass',
    solid: true,
    transparent: true,
    textures: { top: 10, bottom: 10, side: 10 },
    particleColor: 0xC5DDED,
    hardness: 0.4,
  },
  [BlockId.BEDROCK]: {
    id: BlockId.BEDROCK,
    name: 'Bedrock',
    solid: true,
    transparent: false,
    textures: { top: 11, bottom: 11, side: 11 },
    particleColor: 0x4A4A4A,
    hardness: Infinity,
  },
  [BlockId.WATER]: {
    id: BlockId.WATER,
    name: 'water',
    solid: false,
    transparent: true,
    textures: { top: 12, bottom: 12, side: 12 },
    particleColor: 0x3B6FCB,
    hardness: 0,
  },
  [BlockId.SNOW]: {
    id: BlockId.SNOW,
    name: 'Snow',
    solid: true,
    transparent: false,
    textures: { top: 13, bottom: 13, side: 13 },
    particleColor: 0xEAF2F8,
    hardness: 0.3,
  },
  [BlockId.COAL_ORE]: {
    id: BlockId.COAL_ORE,
    name: 'Coal Ore',
    solid: true,
    transparent: false,
    textures: { top: 14, bottom: 14, side: 14 },
    particleColor: 0x2B2B2B,
    hardness: 3.0,
  },
  [BlockId.IRON_ORE]: {
    id: BlockId.IRON_ORE,
    name: 'Iron Ore',
    solid: true,
    transparent: false,
    textures: { top: 15, bottom: 15, side: 15 },
    particleColor: 0xC8865A,
    hardness: 3.5,
  },
  [BlockId.FURNACE]: {
    id: BlockId.FURNACE,
    name: 'Furnace',
    solid: true,
    transparent: false,
    textures: { top: 17, bottom: 17, side: 16 },
    particleColor: 0x6b6b6b,
    hardness: 3.5,
  },
  [BlockId.DIAMOND_ORE]: {
    id: BlockId.DIAMOND_ORE,
    name: 'Diamond Ore',
    solid: true,
    transparent: false,
    textures: { top: 18, bottom: 18, side: 18 },
    particleColor: 0x4FC3F7,
    hardness: 4.0,
  },
  [BlockId.CHEST]: {
    id: BlockId.CHEST,
    name: 'Chest',
    solid: true,
    transparent: false,
    textures: { top: 19, bottom: 19, side: 19 },
    particleColor: 0x8b6e3a,
    hardness: 2.5,
  },
  [BlockId.DOOR_N_CLOSED]: {
    id: BlockId.DOOR_N_CLOSED, name: 'Door', solid: true, transparent: true,
    textures: { top: 20, bottom: 20, side: 8 }, particleColor: 0x9E7140, hardness: 1.5,
  },
  [BlockId.DOOR_N_OPEN]: {
    id: BlockId.DOOR_N_OPEN, name: 'Door', solid: false, transparent: true,
    textures: { top: 20, bottom: 20, side: 8 }, particleColor: 0x9E7140, hardness: 1.5,
  },
  [BlockId.DOOR_E_CLOSED]: {
    id: BlockId.DOOR_E_CLOSED, name: 'Door', solid: true, transparent: true,
    textures: { top: 20, bottom: 20, side: 8 }, particleColor: 0x9E7140, hardness: 1.5,
  },
  [BlockId.DOOR_E_OPEN]: {
    id: BlockId.DOOR_E_OPEN, name: 'Door', solid: false, transparent: true,
    textures: { top: 20, bottom: 20, side: 8 }, particleColor: 0x9E7140, hardness: 1.5,
  },
  [BlockId.DOOR_S_CLOSED]: {
    id: BlockId.DOOR_S_CLOSED, name: 'Door', solid: true, transparent: true,
    textures: { top: 20, bottom: 20, side: 8 }, particleColor: 0x9E7140, hardness: 1.5,
  },
  [BlockId.DOOR_S_OPEN]: {
    id: BlockId.DOOR_S_OPEN, name: 'Door', solid: false, transparent: true,
    textures: { top: 20, bottom: 20, side: 8 }, particleColor: 0x9E7140, hardness: 1.5,
  },
  [BlockId.DOOR_W_CLOSED]: {
    id: BlockId.DOOR_W_CLOSED, name: 'Door', solid: true, transparent: true,
    textures: { top: 20, bottom: 20, side: 8 }, particleColor: 0x9E7140, hardness: 1.5,
  },
  [BlockId.DOOR_W_OPEN]: {
    id: BlockId.DOOR_W_OPEN, name: 'Door', solid: false, transparent: true,
    textures: { top: 20, bottom: 20, side: 8 }, particleColor: 0x9E7140, hardness: 1.5,
  },
  [BlockId.TORCH]: {
    id: BlockId.TORCH,
    name: 'Torch',
    solid: false,
    transparent: true,
    textures: { top: 22, bottom: 22, side: 22 },
    particleColor: 0xFFB347,
    hardness: 0.3,
    light: TORCH_LIGHT,
  },
  [BlockId.GLOWSTONE]: {
    id: BlockId.GLOWSTONE,
    name: 'Glowstone',
    solid: true,
    transparent: false,
    textures: { top: 23, bottom: 23, side: 23 },
    particleColor: 0xE8C840,
    hardness: 0.3,
    light: GLOWSTONE_LIGHT,
  },
  [BlockId.BED]: {
    id: BlockId.BED,
    name: 'Bed',
    solid: true,
    transparent: false,
    textures: { top: 24, bottom: 24, side: 24 },
    particleColor: 0xA93B36,
    hardness: 0.4,
  },
  [BlockId.LAVA]: {
    id: BlockId.LAVA,
    name: 'Lava',
    solid: false,
    transparent: false,
    textures: { top: 25, bottom: 25, side: 25 },
    particleColor: 0xE2541E,
    hardness: 0,
    light: LAVA_LIGHT,
  },
};

const AIR_DEF: BlockDef = defs[BlockId.AIR]!;

class BlockRegistry implements IBlockRegistry {
  get(id: BlockId): BlockDef {
    return defs[id] ?? AIR_DEF;
  }

  isSolid(id: BlockId): boolean {
    return (defs[id] ?? AIR_DEF).solid;
  }

  isTransparent(id: BlockId): boolean {
    return (defs[id] ?? AIR_DEF).transparent;
  }

  getLightEmission(id: BlockId): number {
    return (defs[id] ?? AIR_DEF).light ?? 0;
  }
}

export const blockRegistry: IBlockRegistry = new BlockRegistry();
