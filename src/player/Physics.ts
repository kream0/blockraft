import {
  IWorld,
  PlayerState,
  InputState,
  GRAVITY,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  MAX_FALL_SPEED,
  WALK_SPEED,
  SPRINT_SPEED,
  JUMP_VELOCITY,
} from '../types';

const COLLISION_EPSILON = 1e-4;

export class Physics {
  constructor(private world: IWorld) {}

  /** Advance the player one fixed step. Call this with a small dt (e.g. capped to 1/60) from a fixed-timestep loop. */
  update(player: PlayerState, input: InputState, dt: number): void {
    // 1. Compute desired horizontal velocity from input.
    const forwardX = -Math.sin(input.yaw);
    const forwardZ = -Math.cos(input.yaw);
    const rightX = Math.cos(input.yaw);
    const rightZ = -Math.sin(input.yaw);

    const fwd = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
    const strafe = (input.right ? 1 : 0) - (input.left ? 1 : 0);

    let vx = fwd * forwardX + strafe * rightX;
    let vz = fwd * forwardZ + strafe * rightZ;

    const horizLen = Math.hypot(vx, vz);
    if (horizLen > 0) {
      const speed = input.sprint ? SPRINT_SPEED : WALK_SPEED;
      vx = (vx / horizLen) * speed;
      vz = (vz / horizLen) * speed;
    }

    player.velocity.x = vx;
    player.velocity.z = vz;

    // 2. Vertical velocity.
    if (player.onGround && input.jump) {
      player.velocity.y = JUMP_VELOCITY;
      player.onGround = false;
    } else {
      player.velocity.y += GRAVITY * dt;
      if (player.velocity.y < -MAX_FALL_SPEED) {
        player.velocity.y = -MAX_FALL_SPEED;
      }
    }

    // 3. Sweep collision per-axis: Y, then X, then Z.
    const dy = player.velocity.y * dt;
    const yResult = this.moveAxisY(player.position, dy);
    player.position.y = yResult.pos;
    const yBlocked = yResult.collided;
    const wasMovingDown = dy < 0;
    if (yBlocked) {
      player.velocity.y = 0;
    }

    const dx = player.velocity.x * dt;
    const xResult = this.moveAxisX(player.position, dx);
    player.position.x = xResult.pos;
    if (xResult.collided) {
      player.velocity.x = 0;
    }

    const dz = player.velocity.z * dt;
    const zResult = this.moveAxisZ(player.position, dz);
    player.position.z = zResult.pos;
    if (zResult.collided) {
      player.velocity.z = 0;
    }

    // 4. onGround update.
    if (yBlocked && wasMovingDown) {
      player.onGround = true;
    } else {
      player.onGround = false;
    }
  }

  private moveAxisY(
    pos: { x: number; y: number; z: number },
    delta: number,
  ): { pos: number; collided: boolean } {
    if (delta === 0) return { pos: pos.y, collided: false };

    const newY = pos.y + delta;

    // AABB X/Z extents stay the same throughout this axis-only move.
    const minX = pos.x - PLAYER_RADIUS;
    const maxX = pos.x + PLAYER_RADIUS;
    const minZ = pos.z - PLAYER_RADIUS;
    const maxZ = pos.z + PLAYER_RADIUS;

    // Swept Y range = union of old [pos.y, pos.y + PLAYER_HEIGHT] and new [newY, newY + PLAYER_HEIGHT].
    const yLo = Math.min(pos.y, newY);
    const yHi = Math.max(pos.y + PLAYER_HEIGHT, newY + PLAYER_HEIGHT);

    const bxMin = Math.floor(minX);
    const bxMax = Math.floor(maxX - COLLISION_EPSILON);
    const bzMin = Math.floor(minZ);
    const bzMax = Math.floor(maxZ - COLLISION_EPSILON);
    const byMin = Math.floor(yLo);
    const byMax = Math.floor(yHi - COLLISION_EPSILON);

    let resolved = newY;
    let collided = false;

    if (delta > 0) {
      // Moving up: find lowest block ceiling above current head.
      let lowestCeil = Infinity;
      for (let by = byMin; by <= byMax; by++) {
        for (let bx = bxMin; bx <= bxMax; bx++) {
          for (let bz = bzMin; bz <= bzMax; bz++) {
            if (!this.world.isSolid(bx, by, bz)) continue;
            // Block AABB X/Z must overlap player AABB X/Z (strict: max > min).
            if (bx + 1 <= minX || bx >= maxX) continue;
            if (bz + 1 <= minZ || bz >= maxZ) continue;
            // We're moving up, so we hit the bottom face (by) of a block above us.
            if (by >= pos.y + PLAYER_HEIGHT - COLLISION_EPSILON) {
              if (by < lowestCeil) lowestCeil = by;
            }
          }
        }
      }
      const maxAllowedTop = lowestCeil - COLLISION_EPSILON;
      if (newY + PLAYER_HEIGHT > maxAllowedTop) {
        resolved = maxAllowedTop - PLAYER_HEIGHT;
        collided = true;
      }
    } else {
      // Moving down: find highest block top below current feet.
      let highestFloor = -Infinity;
      for (let by = byMax; by >= byMin; by--) {
        for (let bx = bxMin; bx <= bxMax; bx++) {
          for (let bz = bzMin; bz <= bzMax; bz++) {
            if (!this.world.isSolid(bx, by, bz)) continue;
            if (bx + 1 <= minX || bx >= maxX) continue;
            if (bz + 1 <= minZ || bz >= maxZ) continue;
            // Hit the top face (by + 1) of a block below us.
            if (by + 1 <= pos.y + COLLISION_EPSILON) {
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
    pos: { x: number; y: number; z: number },
    delta: number,
  ): { pos: number; collided: boolean } {
    if (delta === 0) return { pos: pos.x, collided: false };

    const newX = pos.x + delta;

    const minY = pos.y;
    const maxY = pos.y + PLAYER_HEIGHT;
    const minZ = pos.z - PLAYER_RADIUS;
    const maxZ = pos.z + PLAYER_RADIUS;

    const xLo = Math.min(pos.x, newX) - PLAYER_RADIUS;
    const xHi = Math.max(pos.x, newX) + PLAYER_RADIUS;

    const bxMin = Math.floor(xLo);
    const bxMax = Math.floor(xHi - COLLISION_EPSILON);
    const byMin = Math.floor(minY);
    const byMax = Math.floor(maxY - COLLISION_EPSILON);
    const bzMin = Math.floor(minZ);
    const bzMax = Math.floor(maxZ - COLLISION_EPSILON);

    let resolved = newX;
    let collided = false;

    if (delta > 0) {
      // Moving +X: find lowest block.x face we'd cross.
      let lowestFace = Infinity;
      for (let bx = bxMin; bx <= bxMax; bx++) {
        for (let by = byMin; by <= byMax; by++) {
          for (let bz = bzMin; bz <= bzMax; bz++) {
            if (!this.world.isSolid(bx, by, bz)) continue;
            if (by + 1 <= minY || by >= maxY) continue;
            if (bz + 1 <= minZ || bz >= maxZ) continue;
            if (bx >= pos.x + PLAYER_RADIUS - COLLISION_EPSILON) {
              if (bx < lowestFace) lowestFace = bx;
            }
          }
        }
      }
      const maxAllowedRight = lowestFace - COLLISION_EPSILON;
      if (newX + PLAYER_RADIUS > maxAllowedRight) {
        resolved = maxAllowedRight - PLAYER_RADIUS;
        collided = true;
      }
    } else {
      let highestFace = -Infinity;
      for (let bx = bxMax; bx >= bxMin; bx--) {
        for (let by = byMin; by <= byMax; by++) {
          for (let bz = bzMin; bz <= bzMax; bz++) {
            if (!this.world.isSolid(bx, by, bz)) continue;
            if (by + 1 <= minY || by >= maxY) continue;
            if (bz + 1 <= minZ || bz >= maxZ) continue;
            if (bx + 1 <= pos.x - PLAYER_RADIUS + COLLISION_EPSILON) {
              if (bx + 1 > highestFace) highestFace = bx + 1;
            }
          }
        }
      }
      const minAllowedLeft = highestFace + COLLISION_EPSILON;
      if (newX - PLAYER_RADIUS < minAllowedLeft) {
        resolved = minAllowedLeft + PLAYER_RADIUS;
        collided = true;
      }
    }

    return { pos: resolved, collided };
  }

  private moveAxisZ(
    pos: { x: number; y: number; z: number },
    delta: number,
  ): { pos: number; collided: boolean } {
    if (delta === 0) return { pos: pos.z, collided: false };

    const newZ = pos.z + delta;

    const minX = pos.x - PLAYER_RADIUS;
    const maxX = pos.x + PLAYER_RADIUS;
    const minY = pos.y;
    const maxY = pos.y + PLAYER_HEIGHT;

    const zLo = Math.min(pos.z, newZ) - PLAYER_RADIUS;
    const zHi = Math.max(pos.z, newZ) + PLAYER_RADIUS;

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
            if (!this.world.isSolid(bx, by, bz)) continue;
            if (bx + 1 <= minX || bx >= maxX) continue;
            if (by + 1 <= minY || by >= maxY) continue;
            if (bz >= pos.z + PLAYER_RADIUS - COLLISION_EPSILON) {
              if (bz < lowestFace) lowestFace = bz;
            }
          }
        }
      }
      const maxAllowedFront = lowestFace - COLLISION_EPSILON;
      if (newZ + PLAYER_RADIUS > maxAllowedFront) {
        resolved = maxAllowedFront - PLAYER_RADIUS;
        collided = true;
      }
    } else {
      let highestFace = -Infinity;
      for (let bz = bzMax; bz >= bzMin; bz--) {
        for (let bx = bxMin; bx <= bxMax; bx++) {
          for (let by = byMin; by <= byMax; by++) {
            if (!this.world.isSolid(bx, by, bz)) continue;
            if (bx + 1 <= minX || bx >= maxX) continue;
            if (by + 1 <= minY || by >= maxY) continue;
            if (bz + 1 <= pos.z - PLAYER_RADIUS + COLLISION_EPSILON) {
              if (bz + 1 > highestFace) highestFace = bz + 1;
            }
          }
        }
      }
      const minAllowedBack = highestFace + COLLISION_EPSILON;
      if (newZ - PLAYER_RADIUS < minAllowedBack) {
        resolved = minAllowedBack + PLAYER_RADIUS;
        collided = true;
      }
    }

    return { pos: resolved, collided };
  }
}
