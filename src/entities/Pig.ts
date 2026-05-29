import * as THREE from 'three';
import { PassiveMob } from './PassiveMob';
import { EntityKind, PASSIVE_MOB_HEALTH, type Vec3 } from '../types';

const PIG_RADIUS = 0.4;
const PIG_HEIGHT = 0.9;
const PIG_WALK_SPEED = 1.0;

/**
 * A small pink pig. Wander/idle AI is inherited from PassiveMob.
 * The group origin is the mob's feet (y=0); the snout/head faces −Z (yaw=0).
 */
export class Pig extends PassiveMob {
  constructor(position: Vec3) {
    const mesh = Pig.buildMesh();
    super(EntityKind.PIG, position, PIG_RADIUS, PIG_HEIGHT, PIG_WALK_SPEED, PASSIVE_MOB_HEALTH, mesh);
  }

  private static buildMesh(): THREE.Group {
    const group = new THREE.Group();

    // --- Legs (4) — size (0.16, 0.3, 0.16), center y=0.15 ---
    // Spans y[0, 0.3]. X=±0.24; Z=±0.32.
    // Each leg owns its own geometry and material to avoid double-dispose in Entity.dispose().
    const legPositions: [number, number, number][] = [
      [-0.24, 0.15,  0.32], // rear-left
      [ 0.24, 0.15,  0.32], // rear-right
      [-0.24, 0.15, -0.32], // front-left
      [ 0.24, 0.15, -0.32], // front-right
    ];
    for (const [x, y, z] of legPositions) {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.3, 0.16),
        new THREE.MeshLambertMaterial({ color: 0xc77f86 }),
      );
      leg.position.set(x, y, z);
      group.add(leg);
    }

    // --- Body — size (0.6, 0.5, 0.95), center (0, 0.58, 0) ---
    // Spans y[0.33, 0.83].
    const bodyGeo = new THREE.BoxGeometry(0.6, 0.5, 0.95);
    const body = new THREE.Mesh(bodyGeo, new THREE.MeshLambertMaterial({ color: 0xe89aa0 }));
    body.position.set(0, 0.58, 0);
    group.add(body);

    // --- Head — size (0.42, 0.42, 0.4), center (0, 0.64, -0.6) ---
    // Faces −Z (front). y spans [0.43, 0.85].
    // Owns its own material (same color as body but a separate instance).
    const headGeo = new THREE.BoxGeometry(0.42, 0.42, 0.4);
    const head = new THREE.Mesh(headGeo, new THREE.MeshLambertMaterial({ color: 0xe89aa0 }));
    head.position.set(0, 0.64, -0.6);
    group.add(head);

    // --- Snout — size (0.2, 0.16, 0.1), center (0, 0.6, -0.85) ---
    const snoutGeo = new THREE.BoxGeometry(0.2, 0.16, 0.1);
    const snout = new THREE.Mesh(snoutGeo, new THREE.MeshLambertMaterial({ color: 0xf2b6bb }));
    snout.position.set(0, 0.6, -0.85);
    group.add(snout);

    // --- Ears — small pink boxes on top of the head ---
    // Head top is at y = 0.64 + 0.21 = 0.85. Ear center y = 0.85 + 0.05 = 0.90 → ≈ PIG_HEIGHT.
    // Each ear owns its own geometry and material to avoid double-dispose.
    const leftEar = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.06),
      new THREE.MeshLambertMaterial({ color: 0xd98a90 }),
    );
    leftEar.position.set(-0.14, 0.90, -0.60);
    group.add(leftEar);

    const rightEar = new THREE.Mesh(
      new THREE.BoxGeometry(0.1, 0.1, 0.06),
      new THREE.MeshLambertMaterial({ color: 0xd98a90 }),
    );
    rightEar.position.set(0.14, 0.90, -0.60);
    group.add(rightEar);

    return group;
  }
}
