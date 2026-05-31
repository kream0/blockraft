import * as THREE from 'three';
import {
  BlockId,
  REACH,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  type IWorld,
} from '../types';
import { Player } from '../player/Player';
import { isDoorBlock, doorBlockId, DoorFacing } from '../world/Door';

function facingFromDirection(dx: number, dz: number): DoorFacing {
  if (Math.abs(dx) > Math.abs(dz)) return dx > 0 ? DoorFacing.EAST : DoorFacing.WEST;
  return dz > 0 ? DoorFacing.SOUTH : DoorFacing.NORTH;
}

const _tmpVec = new THREE.Vector3();

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

  /** Break the block at exact integer voxel coords (used by hold-to-mine, which already tracked this target by coordinate). Bedrock- and air-guarded. Sets it to AIR and returns the broken voxel + its prior id, or null. */
  breakBlockAt(
    x: number,
    y: number,
    z: number,
  ): { x: number; y: number; z: number; block: BlockId } | null {
    const current = this.world.getBlock(x, y, z);
    if (current === BlockId.BEDROCK || current === BlockId.AIR) return null;
    this.world.setBlock(x, y, z, BlockId.AIR);
    return { x, y, z, block: current };
  }

  /** Raycast from the camera and return the targeted block's integer coords + current id WITHOUT modifying the world. Null on miss. */
  getTargetedBlock(): { x: number; y: number; z: number; block: BlockId } | null {
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

    const block = this.world.getBlock(hit.block.x, hit.block.y, hit.block.z);
    return { x: hit.block.x, y: hit.block.y, z: hit.block.z, block };
  }

  /** True when the unit block cell at (tx,ty,tz) overlaps the player's AABB. */
  private overlapsPlayer(tx: number, ty: number, tz: number): boolean {
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

    return (
      blockMinX < playerMaxX &&
      blockMaxX > playerMinX &&
      blockMinY < playerMaxY &&
      blockMaxY > playerMinY &&
      blockMinZ < playerMaxZ &&
      blockMaxZ > playerMinZ
    );
  }

  /** Raycast; if hit, place selected block at hit.block + hit.normal, but only if that target is currently AIR AND wouldn't overlap the player. Returns true iff a block was placed. */
  placeBlock(): boolean {
    const selected = this.player.getSelectedBlock();
    if (selected === BlockId.AIR) return false;

    const origin = this.player.camera.getWorldPosition(new THREE.Vector3());
    const direction = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(this.player.camera.quaternion)
      .normalize();

    const hit = this.world.raycast(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: direction.x, y: direction.y, z: direction.z },
      REACH,
    );
    if (hit === null) return false;

    const tx = hit.block.x + hit.normal.x;
    const ty = hit.block.y + hit.normal.y;
    const tz = hit.block.z + hit.normal.z;

    // Target must be AIR.
    if (this.world.getBlock(tx, ty, tz) !== BlockId.AIR) return false;

    if (this.overlapsPlayer(tx, ty, tz)) return false;

    this.world.setBlock(tx, ty, tz, selected);
    return true;
  }

  /** Raycast; if hit, place a 2-tall door (lower + upper) at hit.normal offset, if both cells are AIR and rest on solid non-door ground. Returns true iff placed. */
  placeDoor(): boolean {
    const origin = this.player.camera.getWorldPosition(new THREE.Vector3());
    const direction = new THREE.Vector3(0, 0, -1)
      .applyQuaternion(this.player.camera.quaternion)
      .normalize();

    const hit = this.world.raycast(
      { x: origin.x, y: origin.y, z: origin.z },
      { x: direction.x, y: direction.y, z: direction.z },
      REACH,
    );
    if (!hit) return false;

    const lx = hit.block.x + hit.normal.x;
    const ly = hit.block.y + hit.normal.y;
    const lz = hit.block.z + hit.normal.z;

    // Both cells must be AIR.
    if (this.world.getBlock(lx, ly, lz) !== BlockId.AIR) return false;
    if (this.world.getBlock(lx, ly + 1, lz) !== BlockId.AIR) return false;

    // Must rest on a solid, non-door floor.
    const below = this.world.getBlock(lx, ly - 1, lz);
    if (!this.world.isSolid(lx, ly - 1, lz) || isDoorBlock(below)) return false;

    // Don't trap the player inside either cell.
    if (this.overlapsPlayer(lx, ly, lz) || this.overlapsPlayer(lx, ly + 1, lz)) return false;

    // Derive facing from camera's horizontal look direction.
    this.player.camera.getWorldDirection(_tmpVec);
    const facing = facingFromDirection(_tmpVec.x, _tmpVec.z);
    const closed = doorBlockId(facing, false);
    this.world.setBlock(lx, ly, lz, closed);
    this.world.setBlock(lx, ly + 1, lz, closed);
    return true;
  }
}
