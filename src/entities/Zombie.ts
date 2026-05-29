import * as THREE from 'three';
import { Mob } from './Mob';
import {
  EntityKind,
  ZOMBIE_DETECT_RADIUS,
  ZOMBIE_ATTACK_COOLDOWN_S,
  ZOMBIE_CHASE_SPEED,
  type IWorld,
  type Vec3,
} from '../types';

const ZOMBIE_RADIUS = 0.3;
const ZOMBIE_HEIGHT = 1.8;
/** Speed while wandering aimlessly (not chasing). */
const ZOMBIE_WANDER_SPEED = 1.2;
const WANDER_INTERVAL_S = 3;

/**
 * Hostile mob: wanders at night, chases the player within ZOMBIE_DETECT_RADIUS,
 * and bites when in range (controlled externally via tryBite()).
 */
export class Zombie extends Mob {
  private wanderAngle: number = Math.random() * Math.PI * 2;
  private wanderTimer: number = 0;
  private attackTimer: number = 0;

  constructor(position: Vec3) {
    const mesh = Zombie.buildMesh();
    super(EntityKind.ZOMBIE, position, ZOMBIE_RADIUS, ZOMBIE_HEIGHT, mesh);
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

      if (distSq <= ZOMBIE_DETECT_RADIUS * ZOMBIE_DETECT_RADIUS) {
        // ---- CHASE ----
        const dist = Math.sqrt(distSq);

        if (dist > 1e-4) {
          const nx = dx / dist;
          const nz = dz / dist;

          this.velocity.x = nx * ZOMBIE_CHASE_SPEED;
          this.velocity.z = nz * ZOMBIE_CHASE_SPEED;
          // Mesh-forward is (-sin(yaw), 0, -cos(yaw)); face the direction of travel.
          this.yaw = Math.atan2(-this.velocity.x, -this.velocity.z);

          // Step-climb: if a solid block is directly ahead at feet level but the
          // block above it is clear, request a jump so the zombie can walk up steps.
          const aheadX = Math.floor(this.position.x + nx * (this.radius + 0.3));
          const aheadZ = Math.floor(this.position.z + nz * (this.radius + 0.3));
          const feetY = Math.floor(this.position.y);
          if (
            this.onGround &&
            world.isSolid(aheadX, feetY, aheadZ) &&
            !world.isSolid(aheadX, feetY + 1, aheadZ)
          ) {
            this.jumpRequested = true;
          }
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
    this.velocity.x = Math.cos(this.wanderAngle) * ZOMBIE_WANDER_SPEED;
    this.velocity.z = Math.sin(this.wanderAngle) * ZOMBIE_WANDER_SPEED;
    // velocity.y is owned by gravity in Mob.update().
    this.yaw = Math.atan2(-this.velocity.x, -this.velocity.z);
  }

  /**
   * If off cooldown, arms the cooldown and returns true (a bite lands this instant);
   * otherwise false. Called by GameSession when the zombie is within attack range of
   * the player.
   */
  tryBite(): boolean {
    if (this.attackTimer > 0) return false;
    this.attackTimer = ZOMBIE_ATTACK_COOLDOWN_S;
    return true;
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
