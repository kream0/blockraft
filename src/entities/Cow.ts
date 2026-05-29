import * as THREE from 'three';
import { PassiveMob } from './PassiveMob';
import { EntityKind, PASSIVE_MOB_HEALTH, type Vec3 } from '../types';

const COW_RADIUS = 0.45;
const COW_HEIGHT = 1.3;
const COW_WALK_SPEED = 0.8;

/**
 * A four-legged farm cow that wanders passively.
 * AI (wander/idle alternation) is inherited from PassiveMob.
 * The mesh origin is at the cow's feet (y=0); head faces −Z (yaw=0).
 */
export class Cow extends PassiveMob {
  constructor(position: Vec3) {
    const mesh = Cow.buildMesh();
    super(EntityKind.COW, position, COW_RADIUS, COW_HEIGHT, COW_WALK_SPEED, PASSIVE_MOB_HEALTH, mesh);
  }

  private static buildMesh(): THREE.Group {
    const group = new THREE.Group();

    // --- Per-part materials (each Mesh owns its own material) ---
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2f });
    const headMat = new THREE.MeshLambertMaterial({ color: 0x7a5a3f });
    const muzzleMat = new THREE.MeshLambertMaterial({ color: 0xc8a890 });

    // --- Legs (4): size (0.18, 0.6, 0.18), center y=0.3 ---
    // y spans [0, 0.6]; X=±0.28; Z=±0.38 (−Z = front, +Z = back)
    // Each leg gets its own geometry and material to avoid double-dispose in Entity.dispose().
    const legPositions: [number, number, number][] = [
      [-0.28, 0.3, -0.38], // front-left
      [ 0.28, 0.3, -0.38], // front-right
      [-0.28, 0.3,  0.38], // back-left
      [ 0.28, 0.3,  0.38], // back-right
    ];
    for (const [lx, ly, lz] of legPositions) {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.18, 0.6, 0.18),
        new THREE.MeshLambertMaterial({ color: 0x4a3320 }),
      );
      leg.position.set(lx, ly, lz);
      group.add(leg);
    }

    // --- Body: size (0.7, 0.6, 1.1), center (0, 0.9, 0.05) ---
    // y spans [0.6, 1.2]
    const bodyGeo = new THREE.BoxGeometry(0.7, 0.6, 1.1);
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0, 0.9, 0.05);
    group.add(body);

    // --- White patches on body sides (optional spotted look) ---
    // Each patch has its own geometry AND material to avoid double-dispose.
    // Left-side patch, sitting just proud of body surface (x = -0.351)
    const patchL = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.28, 0.32),
      new THREE.MeshLambertMaterial({ color: 0xf0ece2 }),
    );
    patchL.position.set(-0.351, 0.95, -0.05);
    group.add(patchL);

    // Right-side patch
    const patchR = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.22, 0.25),
      new THREE.MeshLambertMaterial({ color: 0xf0ece2 }),
    );
    patchR.position.set(0.351, 0.85, 0.15);
    group.add(patchR);

    // --- Head: size (0.45, 0.45, 0.45), center (0, 1.0, -0.7) ---
    const headGeo = new THREE.BoxGeometry(0.45, 0.45, 0.45);
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, 1.0, -0.7);
    group.add(head);

    // --- Muzzle: size (0.3, 0.22, 0.12), center (0, 0.92, -0.95) ---
    const muzzleGeo = new THREE.BoxGeometry(0.3, 0.22, 0.12);
    const muzzle = new THREE.Mesh(muzzleGeo, muzzleMat);
    muzzle.position.set(0, 0.92, -0.95);
    group.add(muzzle);

    // --- Horns (2): size (0.08, 0.12, 0.08), centers (±0.16, 1.28, -0.62) ---
    // Each horn has its own geometry and material to avoid double-dispose.
    const hornL = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.12, 0.08),
      new THREE.MeshLambertMaterial({ color: 0xe8e0c8 }),
    );
    hornL.position.set(-0.16, 1.28, -0.62);
    group.add(hornL);

    const hornR = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.12, 0.08),
      new THREE.MeshLambertMaterial({ color: 0xe8e0c8 }),
    );
    hornR.position.set(0.16, 1.28, -0.62);
    group.add(hornR);

    return group;
  }
}
