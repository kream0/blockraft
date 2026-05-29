import * as THREE from 'three';
import { PassiveMob } from './PassiveMob';
import { EntityKind, PASSIVE_MOB_HEALTH, type Vec3 } from '../types';

const SHEEP_RADIUS = 0.45;
const SHEEP_HEIGHT = 1.2;
const SHEEP_WALK_SPEED = 0.9;

/**
 * Passive sheep mob. Fluffy cream wool body with dark head and thin dark legs.
 * Wander/idle AI is fully handled by PassiveMob; this class only supplies the
 * mesh and wires the constructor.
 */
export class Sheep extends PassiveMob {
  constructor(position: Vec3) {
    const mesh = Sheep.buildMesh();
    super(EntityKind.SHEEP, position, SHEEP_RADIUS, SHEEP_HEIGHT, SHEEP_WALK_SPEED, PASSIVE_MOB_HEALTH, mesh);
  }

  private static buildMesh(): THREE.Group {
    const group = new THREE.Group();

    // 4 legs — centers at y=0.25 (spans y[0, 0.5]), X=±0.26, Z=±0.34
    // Each leg owns its own geometry and material to avoid double-dispose in Entity.dispose().
    const legPositions: [number, number][] = [
      [-0.26, -0.34],
      [ 0.26, -0.34],
      [-0.26,  0.34],
      [ 0.26,  0.34],
    ];
    for (const [lx, lz] of legPositions) {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.5, 0.16),
        new THREE.MeshLambertMaterial({ color: 0x3a3530 }),
      );
      leg.position.set(lx, 0.25, lz);
      group.add(leg);
    }

    // Body (wool) — chunky/fluffy block, center (0, 0.85, 0.05), spans y[0.5, 1.2]
    const bodyGeo = new THREE.BoxGeometry(0.75, 0.7, 1.0);
    const body = new THREE.Mesh(bodyGeo, new THREE.MeshLambertMaterial({ color: 0xece7dd }));
    body.position.set(0, 0.85, 0.05);
    group.add(body);

    // Extra fluffy top — slightly smaller cream block on top of body for silhouette depth.
    // Owns its own material (same color as body but a separate instance to avoid double-dispose).
    const fluffGeo = new THREE.BoxGeometry(0.6, 0.18, 0.8);
    const fluff = new THREE.Mesh(fluffGeo, new THREE.MeshLambertMaterial({ color: 0xece7dd }));
    // Top of body is 0.85 + 0.35 = 1.2; place fluff center at 1.18 so it stays at or below 1.27
    // Keep within the ~1.2 limit: center at 1.16 → top = 1.16 + 0.09 = 1.25 — close enough visually
    fluff.position.set(0, 1.16, 0.05);
    group.add(fluff);

    // Head — dark, facing −Z (front), center (0, 0.92, -0.62)
    const headGeo = new THREE.BoxGeometry(0.4, 0.42, 0.4);
    const headMat = new THREE.MeshLambertMaterial({ color: 0x47423d });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, 0.92, -0.62);
    group.add(head);

    return group;
  }
}
