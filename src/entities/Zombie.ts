import * as THREE from 'three';
import { Mob } from './Mob';
import type { IWorld, Vec3 } from '../types';

const ZOMBIE_RADIUS = 0.3;
const ZOMBIE_HEIGHT = 1.8;
const ZOMBIE_WALK_SPEED = 1.5;
const WANDER_INTERVAL_S = 3;

/**
 * Example mob: wanders slowly in a deterministic-ish pattern.
 * Demonstrates the Mob -> Entity contract. Not balanced or scary.
 */
export class Zombie extends Mob {
  private wanderAngle: number = Math.random() * Math.PI * 2;
  private wanderTimer: number = 0;

  constructor(position: Vec3) {
    const mesh = Zombie.buildMesh();
    super(position, ZOMBIE_RADIUS, ZOMBIE_HEIGHT, mesh);
  }

  protected override think(dt: number, _world: IWorld): void {
    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0) {
      this.wanderAngle = Math.random() * Math.PI * 2;
      this.wanderTimer = WANDER_INTERVAL_S;
    }
    this.velocity.x = Math.cos(this.wanderAngle) * ZOMBIE_WALK_SPEED;
    this.velocity.z = Math.sin(this.wanderAngle) * ZOMBIE_WALK_SPEED;
    // velocity.y is owned by gravity in Mob.update().
    // Three.js convention: mesh-forward is (-sin(yaw), 0, -cos(yaw)). Derive yaw from
    // the actual horizontal velocity so the mesh always faces the direction of travel.
    this.yaw = Math.atan2(-this.velocity.x, -this.velocity.z);
  }

  private static buildMesh(): THREE.Group {
    const group = new THREE.Group();

    const bodyGeo = new THREE.BoxGeometry(
      ZOMBIE_RADIUS * 2,
      ZOMBIE_HEIGHT * 0.6,
      ZOMBIE_RADIUS * 1.2,
    );
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x3e7a32 });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0, ZOMBIE_HEIGHT * 0.3, 0);
    group.add(body);

    const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const headMat = new THREE.MeshLambertMaterial({ color: 0x7a8a7a });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, ZOMBIE_HEIGHT * 0.6 + 0.25, 0);
    group.add(head);

    return group;
  }
}
