import { BlockId, type BlockDef, type IBlockRegistry } from '../types';

const defs: Record<number, BlockDef> = {
  [BlockId.AIR]: {
    id: BlockId.AIR,
    name: 'Air',
    solid: false,
    transparent: true,
    textures: { top: 0, bottom: 0, side: 0 },
  },
  [BlockId.GRASS]: {
    id: BlockId.GRASS,
    name: 'Grass',
    solid: true,
    transparent: false,
    textures: { top: 0, bottom: 1, side: 2 },
  },
  [BlockId.DIRT]: {
    id: BlockId.DIRT,
    name: 'Dirt',
    solid: true,
    transparent: false,
    textures: { top: 1, bottom: 1, side: 1 },
  },
  [BlockId.STONE]: {
    id: BlockId.STONE,
    name: 'Stone',
    solid: true,
    transparent: false,
    textures: { top: 3, bottom: 3, side: 3 },
  },
  [BlockId.COBBLESTONE]: {
    id: BlockId.COBBLESTONE,
    name: 'Cobblestone',
    solid: true,
    transparent: false,
    textures: { top: 4, bottom: 4, side: 4 },
  },
  [BlockId.WOOD]: {
    id: BlockId.WOOD,
    name: 'Wood',
    solid: true,
    transparent: false,
    textures: { top: 5, bottom: 5, side: 6 },
  },
  [BlockId.LEAVES]: {
    id: BlockId.LEAVES,
    name: 'Leaves',
    solid: true,
    transparent: true,
    textures: { top: 7, bottom: 7, side: 7 },
  },
  [BlockId.PLANKS]: {
    id: BlockId.PLANKS,
    name: 'Planks',
    solid: true,
    transparent: false,
    textures: { top: 8, bottom: 8, side: 8 },
  },
  [BlockId.SAND]: {
    id: BlockId.SAND,
    name: 'Sand',
    solid: true,
    transparent: false,
    textures: { top: 9, bottom: 9, side: 9 },
  },
  [BlockId.GLASS]: {
    id: BlockId.GLASS,
    name: 'Glass',
    solid: true,
    transparent: true,
    textures: { top: 10, bottom: 10, side: 10 },
  },
  [BlockId.BEDROCK]: {
    id: BlockId.BEDROCK,
    name: 'Bedrock',
    solid: true,
    transparent: false,
    textures: { top: 11, bottom: 11, side: 11 },
  },
  [BlockId.WATER]: {
    id: BlockId.WATER,
    name: 'water',
    solid: false,
    transparent: true,
    textures: { top: 12, bottom: 12, side: 12 },
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
}

export const blockRegistry: IBlockRegistry = new BlockRegistry();
