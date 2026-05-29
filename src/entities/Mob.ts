import * as THREE from 'three';
import { Entity } from './Entity';
import { GRAVITY, MAX_FALL_SPEED, EntityKind, type IWorld, type Vec3 } from '../types';

const COLLISION_EPSILON = 1e-4;
/** Vertical kick when a mob jumps. Slightly weaker than the player's jump. */
const MOB_JUMP_VELOCITY = 8;

/**
 * Abstract subclass of Entity that adds gravity-bound, AABB-collided movement.
 * Subclasses implement think() to set velocity / request jumps; physics here
 * keeps them on the ground and out of walls.
 */
export abstract class Mob extends Entity {
  /** Half-extent on X/Z for AABB. */
  readonly radius: number;
  /** Total height (feet to top of head). */
  readonly height: number;
  /** Set by physics; mobs do not jump unless their AI sets jumpRequested. */
  onGround: boolean = false;
  /** AI hook: set true to make the mob jump next tick if onGround. Reset by physics each tick. */
  protected jumpRequested: boolean = false;

  constructor(
    kind: EntityKind,
    position: Vec3,
    radius: number,
    height: number,
    object3D: THREE.Object3D | null,
  ) {
    super(kind, position, object3D);
    this.radius = radius;
    this.height = height;
  }

  /** Subclass: think/decide. Called before physics each tick. Default: noop. */
  protected think(_dt: number, _world: IWorld): void {
    // default: do nothing
  }

  override update(dt: number, world: IWorld): void {
    // 1. AI decides desired velocity / jumpRequested.
    this.think(dt, world);

    // 2. Vertical: apply gravity (or jump impulse).
    if (this.onGround && this.jumpRequested) {
      this.velocity.y = MOB_JUMP_VELOCITY;
      this.onGround = false;
    } else {
      this.velocity.y += GRAVITY * dt;
      if (this.velocity.y < -MAX_FALL_SPEED) {
        this.velocity.y = -MAX_FALL_SPEED;
      }
    }
    this.jumpRequested = false;

    // 3. Per-axis swept move: Y, then X, then Z.
    const dy = this.velocity.y * dt;
    const yResult = this.moveAxisY(world, dy);
    this.position.y = yResult.pos;
    const yBlocked = yResult.collided;
    const wasMovingDown = dy < 0;
    if (yBlocked) {
      this.velocity.y = 0;
    }

    const dx = this.velocity.x * dt;
    const xResult = this.moveAxisX(world, dx);
    this.position.x = xResult.pos;
    if (xResult.collided) {
      this.velocity.x = 0;
    }

    const dz = this.velocity.z * dt;
    const zResult = this.moveAxisZ(world, dz);
    this.position.z = zResult.pos;
    if (zResult.collided) {
      this.velocity.z = 0;
    }

    // 4. onGround update.
    this.onGround = yBlocked && wasMovingDown;

    // 5. Sync visual.
    super.update(dt, world);
  }

  // === Private collision helpers (mirrors Physics.ts but parameterized by radius/height) ===

  private moveAxisY(
    world: IWorld,
    delta: number,
  ): { pos: number; collided: boolean } {
    if (delta === 0) return { pos: this.position.y, collided: false };

    const newY = this.position.y + delta;

    const minX = this.position.x - this.radius;
    const maxX = this.position.x + this.radius;
    const minZ = this.position.z - this.radius;
    const maxZ = this.position.z + this.radius;

    const yLo = Math.min(this.position.y, newY);
    const yHi = Math.max(this.position.y + this.height, newY + this.height);

    const bxMin = Math.floor(minX);
    const bxMax = Math.floor(maxX - COLLISION_EPSILON);
    const bzMin = Math.floor(minZ);
    const bzMax = Math.floor(maxZ - COLLISION_EPSILON);
    const byMin = Math.floor(yLo);
    const byMax = Math.floor(yHi - COLLISION_EPSILON);

    let resolved = newY;
    let collided = false;

    if (delta > 0) {
      let lowestCeil = Infinity;
      for (let by = byMin; by <= byMax; by++) {
        for (let bx = bxMin; bx <= bxMax; bx++) {
          for (let bz = bzMin; bz <= bzMax; bz++) {
            if (!world.isSolid(bx, by, bz)) continue;
            if (bx + 1 <= minX || bx >= maxX) continue;
            if (bz + 1 <= minZ || bz >= maxZ) continue;
            if (by >= this.position.y + this.height - COLLISION_EPSILON) {
              if (by < lowestCeil) lowestCeil = by;
            }
          }
        }
      }
      const maxAllowedTop = lowestCeil - COLLISION_EPSILON;
      if (newY + this.height > maxAllowedTop) {
        resolved = maxAllowedTop - this.height;
        collided = true;
      }
    } else {
      let highestFloor = -Infinity;
      for (let by = byMax; by >= byMin; by--) {
        for (let bx = bxMin; bx <= bxMax; bx++) {
          for (let bz = bzMin; bz <= bzMax; bz++) {
            if (!world.isSolid(bx, by, bz)) continue;
            if (bx + 1 <= minX || bx >= maxX) continue;
            if (bz + 1 <= minZ || bz >= maxZ) continue;
            if (by + 1 <= this.position.y + COLLISION_EPSILON) {
              if (by + 1 > highestFloor) highestFloor = by + 1;
            }
          }
        }
      }
      const minAllowedFeet = highestFloor + COLLISION_EPSILON;
      if (newY < minAllowedFeet) {
        resolved = minAllowedFeet;
        collided = true;
      }
    }

    return { pos: resolved, collided };
  }

  private moveAxisX(
    world: IWorld,
    delta: number,
  ): { pos: number; collided: boolean } {
    if (delta === 0) return { pos: this.position.x, collided: false };

    const newX = this.position.x + delta;

    const minY = this.position.y;
    const maxY = this.position.y + this.height;
    const minZ = this.position.z - this.radius;
    const maxZ = this.position.z + this.radius;

    const xLo = Math.min(this.position.x, newX) - this.radius;
    const xHi = Math.max(this.position.x, newX) + this.radius;

    const bxMin = Math.floor(xLo);
    const bxMax = Math.floor(xHi - COLLISION_EPSILON);
    const byMin = Math.floor(minY);
    const byMax = Math.floor(maxY - COLLISION_EPSILON);
    const bzMin = Math.floor(minZ);
    const bzMax = Math.floor(maxZ - COLLISION_EPSILON);

    let resolved = newX;
    let collided = false;

    if (delta > 0) {
      let lowestFace = Infinity;
      for (let bx = bxMin; bx <= bxMax; bx++) {
        for (let by = byMin; by <= byMax; by++) {
          for (let bz = bzMin; bz <= bzMax; bz++) {
            if (!world.isSolid(bx, by, bz)) continue;
            if (by + 1 <= minY || by >= maxY) continue;
            if (bz + 1 <= minZ || bz >= maxZ) continue;
            if (bx >= this.position.x + this.radius - COLLISION_EPSILON) {
              if (bx < lowestFace) lowestFace = bx;
            }
          }
        }
      }
      const maxAllowedRight = lowestFace - COLLISION_EPSILON;
      if (newX + this.radius > maxAllowedRight) {
        resolved = maxAllowedRight - this.radius;
        collided = true;
      }
    } else {
      let highestFace = -Infinity;
      for (let bx = bxMax; bx >= bxMin; bx--) {
        for (let by = byMin; by <= byMax; by++) {
          for (let bz = bzMin; bz <= bzMax; bz++) {
            if (!world.isSolid(bx, by, bz)) continue;
            if (by + 1 <= minY || by >= maxY) continue;
            if (bz + 1 <= minZ || bz >= maxZ) continue;
            if (bx + 1 <= this.position.x - this.radius + COLLISION_EPSILON) {
              if (bx + 1 > highestFace) highestFace = bx + 1;
            }
          }
        }
      }
      const minAllowedLeft = highestFace + COLLISION_EPSILON;
      if (newX - this.radius < minAllowedLeft) {
        resolved = minAllowedLeft + this.radius;
        collided = true;
      }
    }

    return { pos: resolved, collided };
  }

  private moveAxisZ(
    world: IWorld,
    delta: number,
  ): { pos: number; collided: boolean } {
    if (delta === 0) return { pos: this.position.z, collided: false };

    const newZ = this.position.z + delta;

    const minX = this.position.x - this.radius;
    const maxX = this.position.x + this.radius;
    const minY = this.position.y;
    const maxY = this.position.y + this.height;

    const zLo = Math.min(this.position.z, newZ) - this.radius;
    const zHi = Math.max(this.position.z, newZ) + this.radius;

    const bxMin = Math.floor(minX);
    const bxMax = Math.floor(maxX - COLLISION_EPSILON);
    const byMin = Math.floor(minY);
    const byMax = Math.floor(maxY - COLLISION_EPSILON);
    const bzMin = Math.floor(zLo);
    const bzMax = Math.floor(zHi - COLLISION_EPSILON);

    let resolved = newZ;
    let collided = false;

    if (delta > 0) {
      let lowestFace = Infinity;
      for (let bz = bzMin; bz <= bzMax; bz++) {
        for (let bx = bxMin; bx <= bxMax; bx++) {
          for (let by = byMin; by <= byMax; by++) {
            if (!world.isSolid(bx, by, bz)) continue;
            if (bx + 1 <= minX || bx >= maxX) continue;
            if (by + 1 <= minY || by >= maxY) continue;
            if (bz >= this.position.z + this.radius - COLLISION_EPSILON) {
              if (bz < lowestFace) lowestFace = bz;
            }
          }
        }
      }
      const maxAllowedFront = lowestFace - COLLISION_EPSILON;
      if (newZ + this.radius > maxAllowedFront) {
        resolved = maxAllowedFront - this.radius;
        collided = true;
      }
    } else {
      let highestFace = -Infinity;
      for (let bz = bzMax; bz >= bzMin; bz--) {
        for (let bx = bxMin; bx <= bxMax; bx++) {
          for (let by = byMin; by <= byMax; by++) {
            if (!world.isSolid(bx, by, bz)) continue;
            if (bx + 1 <= minX || bx >= maxX) continue;
            if (by + 1 <= minY || by >= maxY) continue;
            if (bz + 1 <= this.position.z - this.radius + COLLISION_EPSILON) {
              if (bz + 1 > highestFace) highestFace = bz + 1;
            }
          }
        }
      }
      const minAllowedBack = highestFace + COLLISION_EPSILON;
      if (newZ - this.radius < minAllowedBack) {
        resolved = minAllowedBack + this.radius;
        collided = true;
      }
    }

    return { pos: resolved, collided };
  }
}
