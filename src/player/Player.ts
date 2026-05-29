import * as THREE from 'three';
import { PlayerState, BlockId, PLAYER_EYE, PLAYER_MAX_HEALTH } from '../types';

export class Player {
  state: PlayerState;
  /** The Three.js camera the integration code adds to the scene. */
  camera: THREE.PerspectiveCamera;
  /** Hotbar with 9 slots. Default population set in constructor. */
  hotbar: BlockId[];

  constructor(spawnX: number, spawnY: number, spawnZ: number, fov: number = 75) {
    this.state = {
      position: { x: spawnX, y: spawnY, z: spawnZ },
      velocity: { x: 0, y: 0, z: 0 },
      yaw: 0,
      pitch: 0,
      onGround: false,
      selectedSlot: 0,
      health: PLAYER_MAX_HEALTH,
    };

    this.hotbar = [
      BlockId.GRASS,
      BlockId.DIRT,
      BlockId.STONE,
      BlockId.COBBLESTONE,
      BlockId.WOOD,
      BlockId.LEAVES,
      BlockId.PLANKS,
      BlockId.SAND,
      BlockId.GLASS,
    ];

    this.camera = new THREE.PerspectiveCamera(
      fov,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    this.camera.rotation.order = 'YXZ';
  }

  /** Update the camera's vertical field of view. */
  setFov(fov: number): void {
    this.camera.fov = fov;
    this.camera.updateProjectionMatrix();
  }

  /** Convenience: returns the BlockId currently selected for placement. */
  getSelectedBlock(): BlockId {
    const block = this.hotbar[this.state.selectedSlot];
    return block ?? BlockId.AIR;
  }

  /** 0..8 */
  setSelectedSlot(slot: number): void {
    if (slot < 0 || slot > 8) return;
    this.state.selectedSlot = slot;
  }

  /** Apply yaw/pitch to camera quaternion and position camera at feet+eye. Call after physics each frame. */
  syncCamera(): void {
    this.camera.position.set(
      this.state.position.x,
      this.state.position.y + PLAYER_EYE,
      this.state.position.z,
    );
    this.camera.rotation.set(this.state.pitch, this.state.yaw, 0, 'YXZ');
  }
}
