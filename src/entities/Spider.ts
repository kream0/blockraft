import * as THREE from 'three';
import { Mob } from './Mob';
import {
  EntityKind,
  SPIDER_DETECT_RADIUS,
  SPIDER_ATTACK_COOLDOWN_S,
  SPIDER_CHASE_SPEED,
  SPIDER_MAX_HEALTH,
  type IWorld,
  type Vec3,
} from '../types';

/** Spider AABB half-width (blocks). Wider + flatter than humanoid mobs. */
const SPIDER_RADIUS = 0.4;
/** Spider AABB height (blocks). Short, so it fits under 1-block overhangs. */
const SPIDER_HEIGHT = 0.9;
/** Speed while wandering aimlessly (not chasing). */
const SPIDER_WANDER_SPEED = 1.4;
const WANDER_INTERVAL_S = 3;

/**
 * Hostile mob: wanders at night, chases the player within SPIDER_DETECT_RADIUS,
 * and bites when in range (controlled externally via tryBite()). Faster than a
 * zombie but deals less damage per bite.
 */
export class Spider extends Mob {
  private wanderAngle: number = Math.random() * Math.PI * 2;
  private wanderTimer: number = 0;
  private attackTimer: number = 0;

  constructor(position: Vec3) {
    const mesh = Spider.buildMesh();
    super(EntityKind.SPIDER, position, SPIDER_RADIUS, SPIDER_HEIGHT, SPIDER_MAX_HEALTH, mesh);
  }

  protected override think(dt: number, world: IWorld): void {
    // 1. Drain the attack cooldown (clamped to 0 so it never goes negative).
    this.attackTimer = Math.max(0, this.attackTimer - dt);

    // 2. Check for a chase target (the player's feet position, or null).
    const target: Vec3 | null = world.getTrackedTarget();

    if (target !== null) {
      const dx = target.x - this.position.x;
      const dz = target.z - this.position.z;
      const distSq = dx * dx + dz * dz;

      if (distSq <= SPIDER_DETECT_RADIUS * SPIDER_DETECT_RADIUS) {
        // ---- CHASE ----
        const dist = Math.sqrt(distSq);

        if (dist > 1e-4) {
          const nx = dx / dist;
          const nz = dz / dist;

          this.velocity.x = nx * SPIDER_CHASE_SPEED;
          this.velocity.z = nz * SPIDER_CHASE_SPEED;
          // Mesh-forward is (-sin(yaw), 0, -cos(yaw)); face the direction of travel.
          this.yaw = Math.atan2(-this.velocity.x, -this.velocity.z);

          // Step-climb a 1-block ledge in the direction of travel.
          this.tryStepUp(world, nx, nz);
          this.avoidLedge(world, nx, nz);
        } else {
          // Standing essentially on top of the player — stop horizontal movement.
          this.velocity.x = 0;
          this.velocity.z = 0;
        }

        // Chase takes priority over wander this tick.
        return;
      }
    }

    // ---- WANDER (no target, or target beyond detect radius) ----
    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0) {
      this.wanderAngle = Math.random() * Math.PI * 2;
      this.wanderTimer = WANDER_INTERVAL_S;
    }
    this.velocity.x = Math.cos(this.wanderAngle) * SPIDER_WANDER_SPEED;
    this.velocity.z = Math.sin(this.wanderAngle) * SPIDER_WANDER_SPEED;
    // velocity.y is owned by gravity in Mob.update().
    this.yaw = Math.atan2(-this.velocity.x, -this.velocity.z);
    if (this.avoidLedge(world, Math.cos(this.wanderAngle), Math.sin(this.wanderAngle))) {
      this.wanderAngle = Math.random() * Math.PI * 2;
      this.wanderTimer = WANDER_INTERVAL_S;
    }
  }

  /**
   * If off cooldown, arms the cooldown and returns true (a bite lands this instant);
   * otherwise false. Called by GameSession when the spider is within attack range of
   * the player.
   */
  tryBite(): boolean {
    if (this.attackTimer > 0) return false;
    this.attackTimer = SPIDER_ATTACK_COOLDOWN_S;
    return true;
  }

  private static buildMesh(): THREE.Group {
    const group = new THREE.Group();
    const bodyY = SPIDER_HEIGHT * 0.5;

    // Cephalothorax (front, smaller) — faces -z.
    const ceph = new THREE.Mesh(
      new THREE.BoxGeometry(SPIDER_RADIUS * 1.1, SPIDER_HEIGHT * 0.5, SPIDER_RADIUS * 1.1),
      new THREE.MeshLambertMaterial({ color: 0x352f2a }),
    );
    ceph.position.set(0, bodyY, -SPIDER_RADIUS * 0.7);
    group.add(ceph);

    // Abdomen (rear, larger).
    const abdomen = new THREE.Mesh(
      new THREE.BoxGeometry(SPIDER_RADIUS * 1.7, SPIDER_HEIGHT * 0.55, SPIDER_RADIUS * 1.7),
      new THREE.MeshLambertMaterial({ color: 0x231f1c }),
    );
    abdomen.position.set(0, bodyY, SPIDER_RADIUS * 0.85);
    group.add(abdomen);

    // 8 legs: 4 per side, thin dark boxes angled outward + downward from the body.
    const legZs = [-0.28, -0.1, 0.1, 0.28];
    for (const side of [-1, 1]) {
      for (const lz of legZs) {
        const leg = new THREE.Mesh(
          new THREE.BoxGeometry(SPIDER_RADIUS * 1.6, 0.07, 0.07),
          new THREE.MeshLambertMaterial({ color: 0x1a1714 }),
        );
        // Anchor near the body side, tip splays out; tilt so the outer end dips toward the ground.
        leg.position.set(side * SPIDER_RADIUS * 0.9, bodyY - 0.02, lz);
        leg.rotation.z = side * 0.5;
        group.add(leg);
      }
    }

    // Two red eyes on the front face of the cephalothorax.
    for (const side of [-1, 1]) {
      const eye = new THREE.Mesh(
        new THREE.BoxGeometry(0.07, 0.07, 0.07),
        new THREE.MeshLambertMaterial({ color: 0xcc2020 }),
      );
      eye.position.set(side * 0.1, bodyY + SPIDER_HEIGHT * 0.12, -SPIDER_RADIUS * 1.15);
      group.add(eye);
    }

    return group;
  }
}
