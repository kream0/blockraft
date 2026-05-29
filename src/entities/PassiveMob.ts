import type * as THREE from 'three';
import { Mob } from './Mob';
import type { EntityKind, IWorld, Vec3 } from '../types';

const WALK_MIN_S = 3;
const WALK_MAX_S = 6;
const IDLE_MIN_S = 2;
const IDLE_MAX_S = 5;

/**
 * Shared base for non-hostile animals (Cow, Pig, Sheep). Alternates between
 * walking in a random heading and standing idle. Subclasses supply only their
 * kind, dimensions, walk speed, and mesh.
 */
export abstract class PassiveMob extends Mob {
  private readonly walkSpeed: number;
  private wanderAngle: number = Math.random() * Math.PI * 2;
  private walking: boolean = Math.random() < 0.5;
  private stateTimer: number = Math.random() * WALK_MAX_S;

  constructor(
    kind: EntityKind,
    position: Vec3,
    radius: number,
    height: number,
    walkSpeed: number,
    object3D: THREE.Object3D,
  ) {
    super(kind, position, radius, height, object3D);
    this.walkSpeed = walkSpeed;
  }

  protected override think(dt: number, _world: IWorld): void {
    this.stateTimer -= dt;
    if (this.stateTimer <= 0) {
      this.walking = !this.walking;
      if (this.walking) {
        this.wanderAngle = Math.random() * Math.PI * 2;
        this.stateTimer = WALK_MIN_S + Math.random() * (WALK_MAX_S - WALK_MIN_S);
      } else {
        this.stateTimer = IDLE_MIN_S + Math.random() * (IDLE_MAX_S - IDLE_MIN_S);
      }
    }
    if (this.walking) {
      this.velocity.x = Math.cos(this.wanderAngle) * this.walkSpeed;
      this.velocity.z = Math.sin(this.wanderAngle) * this.walkSpeed;
      // Mesh-forward is (-sin(yaw), 0, -cos(yaw)); face the direction of travel.
      this.yaw = Math.atan2(-this.velocity.x, -this.velocity.z);
    } else {
      this.velocity.x = 0;
      this.velocity.z = 0;
    }
  }
}
