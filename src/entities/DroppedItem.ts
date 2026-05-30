import * as THREE from 'three';
import { Entity } from './Entity';
import { itemSwatchColor } from '../items/ItemRegistry';
import {
  EntityKind,
  GRAVITY,
  MAX_FALL_SPEED,
  DROPPED_ITEM_PICKUP_DELAY_S,
  DROPPED_ITEM_ATTRACT_RADIUS,
  DROPPED_ITEM_ATTRACT_SPEED,
  DROPPED_ITEM_LIFETIME_S,
  type ItemId,
  type IWorld,
  type Vec3,
} from '../types';

// Half-size of the dropped item cube in world units.
const ITEM_SIZE = 0.28;
// How high above the surface the item rests (keeps it sitting on top of the block).
const REST_OFFSET = ITEM_SIZE / 2;
// Initial upward impulse applied at spawn to make the item "pop" out of the broken block.
const SPAWN_POP = 2.2;
// Amplitude of the sinusoidal hover bob (world units).
const BOB_AMPLITUDE = 0.08;
// Angular frequency of the bob oscillation (radians per second).
const BOB_SPEED = 2.5;
// Rotation speed around Y axis (radians per second).
const SPIN_SPEED = 1.6;

export class DroppedItem extends Entity {
  readonly item: ItemId;
  count: number;
  /** Set true on lifetime expiry (handled here) or on collection (set by GameSession). */
  dead = false;

  private age = 0;
  /** Random phase offset so items spawned at the same time don't all bob in unison. */
  private bobPhase = Math.random() * Math.PI * 2;

  constructor(position: Vec3, item: ItemId, count: number) {
    super(EntityKind.DROPPED_ITEM, position, DroppedItem.buildMesh(item));
    this.item = item;
    this.count = count;
    // Pop the item upward on spawn so it bounces out of the broken block face.
    this.velocity.y = SPAWN_POP;
  }

  /** True once the item has been on the ground long enough to be collected. */
  canPickup(): boolean {
    return this.age >= DROPPED_ITEM_PICKUP_DELAY_S;
  }

  override update(dt: number, world: IWorld): void {
    if (this.dead) return;

    this.age += dt;
    if (this.age >= DROPPED_ITEM_LIFETIME_S) {
      this.dead = true;
      return;
    }

    // Player feet position (live reference — read values, don't retain the ref).
    const target = world.getTrackedTarget();

    // Attract toward chest height (feet + 0.8) when close enough and pickup delay elapsed.
    const chestX = target !== null ? target.x : 0;
    const chestY = target !== null ? target.y + 0.8 : 0;
    const chestZ = target !== null ? target.z : 0;

    const dx = chestX - this.position.x;
    const dy = chestY - this.position.y;
    const dz = chestZ - this.position.z;
    const distSq = dx * dx + dy * dy + dz * dz;

    const attracting =
      target !== null &&
      this.canPickup() &&
      distSq <= DROPPED_ITEM_ATTRACT_RADIUS * DROPPED_ITEM_ATTRACT_RADIUS;

    if (attracting) {
      // Fly straight toward chest point; guard against zero-length vector.
      const len = Math.sqrt(distSq) || 1;
      this.position.x += (dx / len) * DROPPED_ITEM_ATTRACT_SPEED * dt;
      this.position.y += (dy / len) * DROPPED_ITEM_ATTRACT_SPEED * dt;
      this.position.z += (dz / len) * DROPPED_ITEM_ATTRACT_SPEED * dt;
      // Clear vertical velocity so it doesn't resume falling after attract ends.
      this.velocity.y = 0;
    } else {
      // Gravity: accelerate downward, clamp to terminal velocity.
      this.velocity.y += GRAVITY * dt;
      if (this.velocity.y < -MAX_FALL_SPEED) this.velocity.y = -MAX_FALL_SPEED;

      let ny = this.position.y + this.velocity.y * dt;

      // Clamp to the top face of the highest solid block in this column.
      const rest =
        this.surfaceBelow(world, Math.floor(this.position.x), ny, Math.floor(this.position.z)) +
        REST_OFFSET;
      if (ny <= rest) {
        ny = rest;
        this.velocity.y = 0;
      }
      this.position.y = ny;
    }

    // Sync mesh position with bob and keep spinning.
    if (this.object3D !== null) {
      this.bobPhase += BOB_SPEED * dt;
      // Suppress bob while being magnetically drawn to the player.
      const bob = attracting ? 0 : Math.sin(this.bobPhase) * BOB_AMPLITUDE;
      this.object3D.position.set(this.position.x, this.position.y + bob, this.position.z);
      this.object3D.rotation.y += SPIN_SPEED * dt;
    }
  }

  /**
   * Returns the Y coordinate of the top face of the highest solid block at or below `ny`
   * in column (bx, bz). Falls back to 0 so items over a void settle at world floor
   * instead of scanning indefinitely.
   */
  private surfaceBelow(world: IWorld, bx: number, ny: number, bz: number): number {
    for (let y = Math.floor(ny); y >= 0; y--) {
      if (world.isSolid(bx, y, bz)) return y + 1;
    }
    return 0;
  }

  /**
   * Builds a small tinted cube mesh colored with the item's swatch color.
   * Each DroppedItem owns its geometry + material so the default Entity.dispose()
   * frees them correctly without extra overriding.
   *
   * Future upgrade: replace with an atlas-textured item cube for per-face block textures.
   */
  private static buildMesh(item: ItemId): THREE.Mesh {
    const geo = new THREE.BoxGeometry(ITEM_SIZE, ITEM_SIZE, ITEM_SIZE);
    const mat = new THREE.MeshLambertMaterial({
      color: new THREE.Color(itemSwatchColor(item)),
    });
    return new THREE.Mesh(geo, mat);
  }
}
