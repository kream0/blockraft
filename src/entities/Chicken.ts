import * as THREE from 'three';
import { PassiveMob } from './PassiveMob';
import { EntityKind, PASSIVE_MOB_HEALTH, type Vec3 } from '../types';

// Chicken is smaller and lighter than Pig/Sheep; slightly slower than Cow.
const CHICKEN_RADIUS = 0.25;
const CHICKEN_HEIGHT = 0.5;
const CHICKEN_WALK_SPEED = 1.0;

/**
 * A small white chicken. Wander/idle/flee AI is fully inherited from PassiveMob.
 * Group origin is the mob's feet (y=0); beak faces −Z at yaw=0.
 * Overall height ≈ 0.5 (comb pokes a sliver above — same convention as Pig ears).
 */
export class Chicken extends PassiveMob {
  constructor(position: Vec3) {
    const mesh = Chicken.buildMesh();
    super(EntityKind.CHICKEN, position, CHICKEN_RADIUS, CHICKEN_HEIGHT, CHICKEN_WALK_SPEED, PASSIVE_MOB_HEALTH, mesh);
  }

  private static buildMesh(): THREE.Group {
    const group = new THREE.Group();

    // --- Body — center (0, 0.26, 0), spans y[0.13, 0.39] ---
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.26, 0.26, 0.36),
      new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }),
    );
    body.position.set(0, 0.26, 0);
    group.add(body);

    // --- Head — center (0, 0.40, -0.16), top at y=0.50 = CHICKEN_HEIGHT ---
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.20, 0.20, 0.20),
      new THREE.MeshLambertMaterial({ color: 0xf6f6f6 }),
    );
    head.position.set(0, 0.40, -0.16);
    group.add(head);

    // --- Beak — protrudes forward (−Z) from face of head ---
    const beak = new THREE.Mesh(
      new THREE.BoxGeometry(0.08, 0.06, 0.10),
      new THREE.MeshLambertMaterial({ color: 0xe2a400 }),
    );
    beak.position.set(0, 0.40, -0.31);
    group.add(beak);

    // --- Comb — decorative crest on top of head; slight poke above CHICKEN_HEIGHT is intentional ---
    const comb = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.05, 0.12),
      new THREE.MeshLambertMaterial({ color: 0xd83030 }),
    );
    comb.position.set(0, 0.515, -0.14);
    group.add(comb);

    // --- Legs (2) — each owns its own geometry and material (avoid double-dispose) ---
    // Spans y[0, 0.13]; X=±0.07 keeps them under the body.
    const legPositions: [number, number, number][] = [
      [-0.07, 0.065, 0.02], // left
      [ 0.07, 0.065, 0.02], // right
    ];
    for (const [x, y, z] of legPositions) {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.13, 0.05),
        new THREE.MeshLambertMaterial({ color: 0xe2a400 }),
      );
      leg.position.set(x, y, z);
      group.add(leg);
    }

    // --- Wings (2) — flat panels on each side of the body ---
    // Each wing owns its own geometry and material (avoid double-dispose).
    const wingPositions: [number, number, number][] = [
      [-0.155, 0.27, 0.02], // left
      [ 0.155, 0.27, 0.02], // right
    ];
    for (const [x, y, z] of wingPositions) {
      const wing = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.16, 0.24),
        new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }),
      );
      wing.position.set(x, y, z);
      group.add(wing);
    }

    // --- Tail — small upward nub at the rear (+Z) of the body ---
    const tail = new THREE.Mesh(
      new THREE.BoxGeometry(0.06, 0.14, 0.10),
      new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }),
    );
    tail.position.set(0, 0.34, 0.21);
    group.add(tail);

    return group;
  }
}
