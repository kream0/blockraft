import * as THREE from 'three';

// All tools are built on a diagonal (lower-left → upper-right) by rotating
// the whole group by PI/4 on the Z axis. Parts are laid out as if the tool
// is vertical, then the group rotation tilts the whole silhouette.
//
// Size budget: max ≈ 0.8 in any axis after rotation, centered near origin.

// Wooden tool colors
const HANDLE_COLOR     = 0x6e4923; // dark wood
const HEAD_COLOR       = 0xb6824a; // light wood / planks tan
const STICK_COLOR      = 0x8a5a2b; // stick
const STONE_HEAD_COLOR = 0x9a9a9a; // grey stone tool head

/** Returns a new THREE.Group with the stick mesh. Each Mesh owns its own geometry + material. */
export function buildStickMesh(): THREE.Group {
  const group = new THREE.Group();

  // A single slim elongated box.
  const shaft = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.7, 0.1),
    new THREE.MeshLambertMaterial({ color: STICK_COLOR }),
  );
  shaft.position.set(0, 0, 0);
  group.add(shaft);

  // Diagonal tilt — lower-left to upper-right.
  group.rotation.z = Math.PI / 4;

  return group;
}

/** Returns a new THREE.Group with the pickaxe mesh. */
export function buildPickaxeMesh(headColor: number = HEAD_COLOR): THREE.Group {
  const group = new THREE.Group();

  // Handle: slim vertical bar
  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.58, 0.1),
    new THREE.MeshLambertMaterial({ color: HANDLE_COLOR }),
  );
  handle.position.set(0, -0.04, 0);
  group.add(handle);

  // Pick head: wide thin horizontal bar near the top
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.46, 0.1, 0.12),
    new THREE.MeshLambertMaterial({ color: headColor }),
  );
  head.position.set(0, 0.28, 0);
  group.add(head);

  // Left prong: angled slightly downward
  const prongL = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.14, 0.1),
    new THREE.MeshLambertMaterial({ color: headColor }),
  );
  prongL.position.set(-0.22, 0.18, 0);
  prongL.rotation.z = 0.35;
  group.add(prongL);

  // Right prong
  const prongR = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.14, 0.1),
    new THREE.MeshLambertMaterial({ color: headColor }),
  );
  prongR.position.set(0.22, 0.18, 0);
  prongR.rotation.z = -0.35;
  group.add(prongR);

  // Diagonal tilt
  group.rotation.z = Math.PI / 4;

  return group;
}

export function buildStonePickaxeMesh(): THREE.Group { return buildPickaxeMesh(STONE_HEAD_COLOR); }

/** Returns a new THREE.Group with the axe mesh. */
export function buildAxeMesh(headColor: number = HEAD_COLOR): THREE.Group {
  const group = new THREE.Group();

  // Handle
  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.6, 0.1),
    new THREE.MeshLambertMaterial({ color: HANDLE_COLOR }),
  );
  handle.position.set(0, -0.02, 0);
  group.add(handle);

  // Main head: blocky rectangle on one side (right) near the top
  const headMain = new THREE.Mesh(
    new THREE.BoxGeometry(0.28, 0.3, 0.12),
    new THREE.MeshLambertMaterial({ color: headColor }),
  );
  headMain.position.set(0.17, 0.24, 0);
  group.add(headMain);

  // Smaller angled secondary box for depth
  const headBack = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.16, 0.1),
    new THREE.MeshLambertMaterial({ color: headColor }),
  );
  headBack.position.set(0.08, 0.36, 0);
  headBack.rotation.z = 0.2;
  group.add(headBack);

  // Diagonal tilt
  group.rotation.z = Math.PI / 4;

  return group;
}

export function buildStoneAxeMesh(): THREE.Group { return buildAxeMesh(STONE_HEAD_COLOR); }

/** Returns a new THREE.Group with the shovel mesh. */
export function buildShovelMesh(headColor: number = HEAD_COLOR): THREE.Group {
  const group = new THREE.Group();

  // Handle
  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.6, 0.1),
    new THREE.MeshLambertMaterial({ color: HANDLE_COLOR }),
  );
  handle.position.set(0, -0.05, 0);
  group.add(handle);

  // Flat square blade at the top end
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.22, 0.22, 0.08),
    new THREE.MeshLambertMaterial({ color: headColor }),
  );
  blade.position.set(0, 0.32, 0);
  group.add(blade);

  // Diagonal tilt
  group.rotation.z = Math.PI / 4;

  return group;
}

export function buildStoneShovelMesh(): THREE.Group { return buildShovelMesh(STONE_HEAD_COLOR); }

const IRON_HEAD_COLOR    = 0xd8d8d8; // bright steel
export function buildIronPickaxeMesh(): THREE.Group { return buildPickaxeMesh(IRON_HEAD_COLOR); }
export function buildIronAxeMesh(): THREE.Group { return buildAxeMesh(IRON_HEAD_COLOR); }
export function buildIronShovelMesh(): THREE.Group { return buildShovelMesh(IRON_HEAD_COLOR); }

const DIAMOND_HEAD_COLOR = 0x4FC3F7; // cyan diamond
export function buildDiamondPickaxeMesh(): THREE.Group { return buildPickaxeMesh(DIAMOND_HEAD_COLOR); }
export function buildDiamondAxeMesh(): THREE.Group { return buildAxeMesh(DIAMOND_HEAD_COLOR); }
export function buildDiamondShovelMesh(): THREE.Group { return buildShovelMesh(DIAMOND_HEAD_COLOR); }

/** Returns a new THREE.Group with the sword mesh. bladeColor tints the blade + crossguard; the grip is always dark wood. */
export function buildSwordMesh(bladeColor: number = HEAD_COLOR): THREE.Group {
  const group = new THREE.Group();

  // Grip: short handle at the bottom
  const grip = new THREE.Mesh(
    new THREE.BoxGeometry(0.09, 0.24, 0.09),
    new THREE.MeshLambertMaterial({ color: HANDLE_COLOR }),
  );
  grip.position.set(0, -0.28, 0);
  group.add(grip);

  // Crossguard: short horizontal bar above the grip
  const guard = new THREE.Mesh(
    new THREE.BoxGeometry(0.34, 0.08, 0.1),
    new THREE.MeshLambertMaterial({ color: bladeColor }),
  );
  guard.position.set(0, -0.12, 0);
  group.add(guard);

  // Blade: long vertical bar above the guard
  const blade = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 0.6, 0.06),
    new THREE.MeshLambertMaterial({ color: bladeColor }),
  );
  blade.position.set(0, 0.22, 0);
  group.add(blade);

  // Diagonal tilt — lower-left to upper-right (matches the other tools)
  group.rotation.z = Math.PI / 4;

  return group;
}

export function buildWoodenSwordMesh(): THREE.Group { return buildSwordMesh(HEAD_COLOR); }
export function buildStoneSwordMesh(): THREE.Group { return buildSwordMesh(STONE_HEAD_COLOR); }
export function buildIronSwordMesh(): THREE.Group { return buildSwordMesh(IRON_HEAD_COLOR); }
export function buildDiamondSwordMesh(): THREE.Group { return buildSwordMesh(DIAMOND_HEAD_COLOR); }

const BOW_STAVE_COLOR  = 0x6e4923; // dark wood stave
const BOW_STRING_COLOR = 0xe8e0c8; // pale string

/**
 * Returns a new THREE.Group shaped like a bow: a backwards-C stave made from
 * three angled dark-wood box segments, with a thin pale string box spanning
 * the two tips. Centered near the origin, within roughly a unit cube.
 */
export function buildBowMesh(): THREE.Group {
  const group = new THREE.Group();

  // Center segment (horizontal middle bar of the backwards-C)
  const mid = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.26, 0.08), new THREE.MeshLambertMaterial({ color: BOW_STAVE_COLOR }));
  mid.position.set(-0.20, 0, 0);
  group.add(mid);

  // Top arm — angled upper-right
  const topArm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.34, 0.08), new THREE.MeshLambertMaterial({ color: BOW_STAVE_COLOR }));
  topArm.position.set(-0.08, 0.24, 0);
  topArm.rotation.z = -0.55; // tilt right + up
  group.add(topArm);

  // Bottom arm — angled lower-right (mirror of top)
  const botArm = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.34, 0.08), new THREE.MeshLambertMaterial({ color: BOW_STAVE_COLOR }));
  botArm.position.set(-0.08, -0.24, 0);
  botArm.rotation.z = 0.55;
  group.add(botArm);

  // String: thin vertical box connecting the two stave tips on the right side
  const string = new THREE.Mesh(
    new THREE.BoxGeometry(0.04, 0.70, 0.04),
    new THREE.MeshLambertMaterial({ color: BOW_STRING_COLOR }),
  );
  string.position.set(0.10, 0, 0);
  group.add(string);

  return group;
}

const ARROW_SHAFT_COLOR    = 0x6b5436; // wood shaft
const ARROW_HEAD_COLOR     = 0x3a3a3a; // dark-gray arrowhead
const ARROW_FLETCH_COLOR   = 0xd8d2c0; // pale fletching

/**
 * Returns a new THREE.Group shaped like an arrow item icon: a diagonal shaft
 * with a small arrowhead at the tip and two tiny fletching fins at the tail.
 * Centered near the origin, within roughly a unit cube.
 */
export function buildArrowItemMesh(): THREE.Group {
  const group = new THREE.Group();

  // Long thin shaft along a slight diagonal
  const shaft = new THREE.Mesh(
    new THREE.BoxGeometry(0.06, 0.70, 0.06),
    new THREE.MeshLambertMaterial({ color: ARROW_SHAFT_COLOR }),
  );
  shaft.rotation.z = Math.PI / 6; // ~30° tilt
  group.add(shaft);

  // Small arrowhead at the upper-right tip
  const head = new THREE.Mesh(
    new THREE.BoxGeometry(0.10, 0.14, 0.10),
    new THREE.MeshLambertMaterial({ color: ARROW_HEAD_COLOR }),
  );
  head.position.set(0.18, 0.32, 0);
  head.rotation.z = Math.PI / 6;
  group.add(head);

  // Two tiny fletching fins at the lower-left tail (offset perpendicular to shaft)
  const fletchMat = new THREE.MeshLambertMaterial({ color: ARROW_FLETCH_COLOR });

  const fletchA = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.04), fletchMat);
  fletchA.position.set(-0.20, -0.28, 0.04);
  fletchA.rotation.z = Math.PI / 6;
  group.add(fletchA);

  const fletchB = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.06, 0.04), fletchMat);
  fletchB.position.set(-0.20, -0.28, -0.04);
  fletchB.rotation.z = Math.PI / 6;
  group.add(fletchB);

  return group;
}
