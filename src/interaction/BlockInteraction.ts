import * as THREE from 'three';
import {
  BlockId,
  REACH,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  type IWorld,
} from '../types';
import { Player } from '../player/Player';

export class BlockInteraction {
  constructor(
    private world: IWorld,
    private player: Player,
  ) {}

  /** Raycast from camera in look direction; if a non-bedrock block is hit, set it to AIR and return the broken voxel + its prior id (for particle spawning). Returns null on miss or bedrock. */
  breakBlock(): { x: number; y: number; z: number; block: BlockId } | null {
    const origin = this.player.camera.getWorldPosition(new THREE.Vector3());
    const direction = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(this.player.camera.quaternion)
      .normalize();

    const hit = this.world.raycast(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: direction.x, y: direction.y, z: direction.z },
      REACH,
    );
    if (hit === null) return null;

    // Don't break bedrock.
    const current = this.world.getBlock(hit.block.x, hit.block.y, hit.block.z);
    if (current === BlockId.BEDROCK) return null;

    this.world.setBlock(hit.block.x, hit.block.y, hit.block.z, BlockId.AIR);
    return { x: hit.block.x, y: hit.block.y, z: hit.block.z, block: current };
  }

  /** Raycast; if hit, place selected block at hit.block + hit.normal, but only if that target is currently AIR AND wouldn't overlap the player. */
  placeBlock(): void {
    const selected = this.player.getSelectedBlock();
    if (selected === BlockId.AIR) return;

    const origin = this.player.camera.getWorldPosition(new THREE.Vector3());
    const direction = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(this.player.camera.quaternion)
      .normalize();

    const hit = this.world.raycast(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: direction.x, y: direction.y, z: direction.z },
      REACH,
    );
    if (hit === null) return;

    const tx = hit.block.x + hit.normal.x;
    const ty = hit.block.y + hit.normal.y;
    const tz = hit.block.z + hit.normal.z;

    // Target must be AIR.
    if (this.world.getBlock(tx, ty, tz) !== BlockId.AIR) return;

    // Player overlap check: AABB of proposed block vs player AABB.
    const blockMinX = tx;
    const blockMaxX = tx + 1;
    const blockMinY = ty;
    const blockMaxY = ty + 1;
    const blockMinZ = tz;
    const blockMaxZ = tz + 1;

    const p = this.player.state.position;
    const playerMinX = p.x - PLAYER_RADIUS;
    const playerMaxX = p.x + PLAYER_RADIUS;
    const playerMinY = p.y;
    const playerMaxY = p.y + PLAYER_HEIGHT;
    const playerMinZ = p.z - PLAYER_RADIUS;
    const playerMaxZ = p.z + PLAYER_RADIUS;

    const overlap =
      blockMinX < playerMaxX &&
      blockMaxX > playerMinX &&
      blockMinY < playerMaxY &&
      blockMaxY > playerMinY &&
      blockMinZ < playerMaxZ &&
      blockMaxZ > playerMinZ;
    if (overlap) return;

    this.world.setBlock(tx, ty, tz, selected);
  }
}
