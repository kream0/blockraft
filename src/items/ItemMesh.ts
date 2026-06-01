import * as THREE from 'three';
import { BlockId, ItemId, type ITextureAtlas } from '../types';
import { isBlockItem, itemSwatchColor } from './ItemRegistry';
import { blockRegistry } from '../world/BlockRegistry';
import { buildStickMesh, buildPickaxeMesh, buildAxeMesh, buildShovelMesh, buildStonePickaxeMesh, buildStoneAxeMesh, buildStoneShovelMesh, buildIronPickaxeMesh, buildIronAxeMesh, buildIronShovelMesh, buildWoodenSwordMesh, buildStoneSwordMesh, buildIronSwordMesh, buildDiamondPickaxeMesh, buildDiamondAxeMesh, buildDiamondShovelMesh, buildDiamondSwordMesh, buildBowMesh, buildArrowItemMesh } from './ToolMeshes';
import { TORCH_TILE } from '../world/Torch';
import { isCrossBlock, crossBlockTile, isFlowerBlock, flowerPetalTile, FLOWER_STEM_TILE, FLOWER_MODEL_QUADS } from '../world/Foliage';

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
  if (item === BlockId.TORCH) return buildTorchItemMesh(atlas);
  if (isFlowerBlock(item)) return buildFlowerItemMesh(item as BlockId, atlas);
  if (isCrossBlock(item)) return buildCrossItemMesh(item as BlockId, atlas);

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
      case ItemId.BOW:             return buildBowMesh();
      case ItemId.ARROW:           return buildArrowItemMesh();
      case ItemId.CHARCOAL:        return buildCharcoalMesh();
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

/**
 * Torch item mesh: a slim vertical post (not a full cube) textured with the torch
 * tile, so the hotbar/inventory icon and the in-hand model both read as a thin torch
 * with empty (transparent) space around it. Centered at the origin like other item meshes.
 */
function buildTorchItemMesh(atlas: ITextureAtlas): THREE.Object3D {
  const w = 0.2;   // post cross-section (slim)
  const h = 0.78;  // post height (tall, fills the icon vertically)
  const geo = new THREE.BoxGeometry(w, h, w);
  const [u0, v0, u1, v1] = atlas.getUV(TORCH_TILE);
  const uv = geo.getAttribute('uv') as THREE.BufferAttribute;
  for (let f = 0; f < 6; f++) {
    const base = f * 4;
    uv.setXY(base + 0, u0, v1);
    uv.setXY(base + 1, u1, v1);
    uv.setXY(base + 2, u0, v0);
    uv.setXY(base + 3, u1, v0);
  }
  uv.needsUpdate = true;
  const mat = new THREE.MeshLambertMaterial({ map: atlas.texture });
  return new THREE.Mesh(geo, mat);
}

/**
 * 3D flower item mesh (held + inventory icon) — the same stem+petal-head model the world
 * uses (Foliage.FLOWER_MODEL_QUADS), centered at the origin. Atlas-textured, lit.
 */
function buildFlowerItemMesh(item: BlockId, atlas: ITextureAtlas): THREE.Object3D {
  const stemUV = atlas.getUV(FLOWER_STEM_TILE);
  const petalUV = atlas.getUV(flowerPetalTile(item));
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  for (const q of FLOWER_MODEL_QUADS) {
    const [u0, v0, u1, v1] = q.tile === 'stem' ? stemUV : petalUV;
    const sv = positions.length / 3;
    for (let i = 0; i < 4; i++) {
      const c = q.c[i]!;
      positions.push(c[0]! - 0.5, c[1]! - 0.37, c[2]! - 0.5);
    }
    uvs.push(u0, v0, u1, v0, u1, v1, u0, v1);
    indices.push(sv, sv + 1, sv + 2, sv, sv + 2, sv + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(positions), 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uvs), 2));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mat = new THREE.MeshLambertMaterial({ map: atlas.texture, side: THREE.DoubleSide });
  return new THREE.Mesh(geo, mat);
}

/**
 * Cross-quad item mesh for foliage blocks (tall grass + flowers): two crossed
 * vertical quads textured with the plant's atlas tile, instead of a 6-faced cube,
 * so the held model and inventory icon read as a 3D plant rising from the cell.
 * Centered at the origin like other item meshes. Unlit + alpha-test cutout.
 */
function buildCrossItemMesh(item: BlockId, atlas: ITextureAtlas): THREE.Object3D {
  const [u0, v0, u1, v1] = atlas.getUV(crossBlockTile(item));
  const h = 0.5; // half-extent (unit cell, centered at origin)

  // Two quads. Vertex order per quad matches Foliage.emitCrossGeometry:
  //   bottom-start, bottom-end, top-end, top-start  →  uv (u0,v0),(u1,v0),(u1,v1),(u0,v1)
  const positions = new Float32Array([
    // Quad 1: diagonal (-h,-h) -> (+h,+h)
    -h, -h, -h,   h, -h,  h,   h,  h,  h,   -h,  h, -h,
    // Quad 2: diagonal (-h,+h) -> (+h,-h)
    -h, -h,  h,   h, -h, -h,   h,  h, -h,   -h,  h,  h,
  ]);
  const uvs = new Float32Array([
    u0, v0, u1, v0, u1, v1, u0, v1,
    u0, v0, u1, v0, u1, v1, u0, v1,
  ]);
  const indices = [0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7];

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setIndex(indices);

  const mat = new THREE.MeshBasicMaterial({
    map: atlas.texture,
    alphaTest: 0.5,
    side: THREE.DoubleSide,
  });
  return new THREE.Mesh(geo, mat);
}

/**
 * Charcoal icon: a near-black coal lump studded with lighter "reflection" chips
 * so it stays legible against the dark inventory slot. The two unlit (Basic)
 * chips read as specular sparkles regardless of face orientation; the rest are
 * lit so the key light at (1,1.5,1) models the lump.
 */
function buildCharcoalMesh(): THREE.Object3D {
  const group = new THREE.Group();

  // Near-black coal body — two overlapping dark boxes give an irregular lump.
  const core = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.42, 0.42),
    new THREE.MeshLambertMaterial({ color: new THREE.Color('#231f1b') }),
  );
  group.add(core);
  const lobe = new THREE.Mesh(
    new THREE.BoxGeometry(0.3, 0.3, 0.3),
    new THREE.MeshLambertMaterial({ color: new THREE.Color('#1a1714') }),
  );
  lobe.position.set(0.11, 0.11, 0.09);
  group.add(lobe);

  // Reflection chips — lighter facets toward the camera-facing (+z) top-right so
  // the key light catches them. x, y, z, size, color, unlit.
  const chips: ReadonlyArray<readonly [number, number, number, number, string, boolean]> = [
    [ 0.13,  0.17,  0.17, 0.10, '#8a8a8a', false],
    [-0.11,  0.05,  0.21, 0.07, '#6d6d6d', false],
    [ 0.03, -0.11,  0.19, 0.06, '#585858', false],
    [ 0.17,  0.20,  0.12, 0.05, '#e2e8ee', true ],
    [-0.07,  0.19,  0.13, 0.04, '#c4ccd4', true ],
  ];
  for (const [x, y, z, s, color, unlit] of chips) {
    const mat = unlit
      ? new THREE.MeshBasicMaterial({ color: new THREE.Color(color) })
      : new THREE.MeshLambertMaterial({ color: new THREE.Color(color) });
    const chip = new THREE.Mesh(new THREE.BoxGeometry(s, s, s), mat);
    chip.position.set(x, y, z);
    group.add(chip);
  }

  return group;
}
