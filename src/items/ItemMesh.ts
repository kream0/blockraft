import * as THREE from 'three';
import { BlockId, ItemId, type ITextureAtlas } from '../types';
import { isBlockItem, itemSwatchColor } from './ItemRegistry';
import { blockRegistry } from '../world/BlockRegistry';
import { buildStickMesh, buildPickaxeMesh, buildAxeMesh, buildShovelMesh, buildStonePickaxeMesh, buildStoneAxeMesh, buildStoneShovelMesh, buildIronPickaxeMesh, buildIronAxeMesh, buildIronShovelMesh, buildWoodenSwordMesh, buildStoneSwordMesh, buildIronSwordMesh, buildDiamondPickaxeMesh, buildDiamondAxeMesh, buildDiamondShovelMesh, buildDiamondSwordMesh } from './ToolMeshes';

/**
 * Builds a fresh THREE.Object3D for the given item using the provided texture atlas.
 *
 * - Block items: unit cube with per-face atlas UV mapping.
 * - Non-block items: tool mesh built by ToolMeshes factories.
 *
 * The caller is responsible for disposing the returned object when done.
 * Do NOT dispose atlas.texture — it is shared and must outlive this mesh.
 */
export function buildItemMesh(item: ItemId, atlas: ITextureAtlas): THREE.Object3D {
  if (!isBlockItem(item)) {
    // Non-block item — return the appropriate tool mesh.
    switch (item) {
      case ItemId.STICK:           return buildStickMesh();
      case ItemId.WOODEN_PICKAXE:  return buildPickaxeMesh();
      case ItemId.WOODEN_AXE:      return buildAxeMesh();
      case ItemId.WOODEN_SHOVEL:   return buildShovelMesh();
      case ItemId.STONE_PICKAXE:   return buildStonePickaxeMesh();
      case ItemId.STONE_AXE:       return buildStoneAxeMesh();
      case ItemId.STONE_SHOVEL:    return buildStoneShovelMesh();
      case ItemId.IRON_PICKAXE:    return buildIronPickaxeMesh();
      case ItemId.IRON_AXE:        return buildIronAxeMesh();
      case ItemId.IRON_SHOVEL:     return buildIronShovelMesh();
      case ItemId.WOODEN_SWORD:    return buildWoodenSwordMesh();
      case ItemId.STONE_SWORD:     return buildStoneSwordMesh();
      case ItemId.IRON_SWORD:      return buildIronSwordMesh();
      case ItemId.DIAMOND_PICKAXE: return buildDiamondPickaxeMesh();
      case ItemId.DIAMOND_AXE:     return buildDiamondAxeMesh();
      case ItemId.DIAMOND_SHOVEL:  return buildDiamondShovelMesh();
      case ItemId.DIAMOND_SWORD:   return buildDiamondSwordMesh();
      default: {
        const color = new THREE.Color(itemSwatchColor(item));
        return new THREE.Mesh(
          new THREE.BoxGeometry(0.55, 0.55, 0.55),
          new THREE.MeshLambertMaterial({ color }),
        );
      }
    }
  }

  // Block item — unit cube with atlas texture, per-face UV remap.
  const geo = new THREE.BoxGeometry(1, 1, 1);
  const tex = blockRegistry.get(item as BlockId).textures;

  // BoxGeometry face order: [+X, -X, +Y, -Y, +Z, -Z]
  //   → [side, side, top, bottom, side, side]
  const faceTiles = [tex.side, tex.side, tex.top, tex.bottom, tex.side, tex.side];

  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  for (let f = 0; f < 6; f++) {
    const tile = faceTiles[f]!; // noUncheckedIndexedAccess — faceTiles has exactly 6 elements
    const [u0, v0, u1, v1] = atlas.getUV(tile);
    const base = f * 4;
    // Default BoxGeometry UV vertex order per face:
    //   (0,1) (1,1) (0,0) (1,0)  →  map to atlas corners.
    uv.setXY(base + 0, u0, v1);
    uv.setXY(base + 1, u1, v1);
    uv.setXY(base + 2, u0, v0);
    uv.setXY(base + 3, u1, v0);
  }
  uv.needsUpdate = true;

  const mat = new THREE.MeshLambertMaterial({ map: atlas.texture });
  return new THREE.Mesh(geo, mat);
}
