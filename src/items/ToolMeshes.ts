import * as THREE from 'three';

// All tools are built on a diagonal (lower-left → upper-right) by rotating
// the whole group by PI/4 on the Z axis. Parts are laid out as if the tool
// is vertical, then the group rotation tilts the whole silhouette.
//
// Size budget: max ≈ 0.8 in any axis after rotation, centered near origin.

// Wooden tool colors
const HANDLE_COLOR = 0x6e4923; // dark wood
const HEAD_COLOR   = 0xb6824a; // light wood / planks tan
const STICK_COLOR  = 0x8a5a2b; // stick

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
export function buildPickaxeMesh(): THREE.Group {
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
    new THREE.MeshLambertMaterial({ color: HEAD_COLOR }),
  );
  head.position.set(0, 0.28, 0);
  group.add(head);

  // Left prong: angled slightly downward
  const prongL = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.14, 0.1),
    new THREE.MeshLambertMaterial({ color: HEAD_COLOR }),
  );
  prongL.position.set(-0.22, 0.18, 0);
  prongL.rotation.z = 0.35;
  group.add(prongL);

  // Right prong
  const prongR = new THREE.Mesh(
    new THREE.BoxGeometry(0.1, 0.14, 0.1),
    new THREE.MeshLambertMaterial({ color: HEAD_COLOR }),
  );
  prongR.position.set(0.22, 0.18, 0);
  prongR.rotation.z = -0.35;
  group.add(prongR);

  // Diagonal tilt
  group.rotation.z = Math.PI / 4;

  return group;
}

/** Returns a new THREE.Group with the axe mesh. */
export function buildAxeMesh(): THREE.Group {
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
    new THREE.MeshLambertMaterial({ color: HEAD_COLOR }),
  );
  headMain.position.set(0.17, 0.24, 0);
  group.add(headMain);

  // Smaller angled secondary box for depth
  const headBack = new THREE.Mesh(
    new THREE.BoxGeometry(0.14, 0.16, 0.1),
    new THREE.MeshLambertMaterial({ color: HEAD_COLOR }),
  );
  headBack.position.set(0.08, 0.36, 0);
  headBack.rotation.z = 0.2;
  group.add(headBack);

  // Diagonal tilt
  group.rotation.z = Math.PI / 4;

  return group;
}

/** Returns a new THREE.Group with the shovel mesh. */
export function buildShovelMesh(): THREE.Group {
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
    new THREE.MeshLambertMaterial({ color: HEAD_COLOR }),
  );
  blade.position.set(0, 0.32, 0);
  group.add(blade);

  // Diagonal tilt
  group.rotation.z = Math.PI / 4;

  return group;
}
