import * as THREE from 'three';

const SKIN_COLOR = 0xe0ac69;
const SLEEVE_COLOR = 0x3aafa9;

// Rest pose in camera-local space: arm sits lower-right, angled toward screen center.
const REST_POS = new THREE.Vector3(0.34, -0.42, -0.62);
const REST_ROT = new THREE.Euler(-0.5, 0.32, 0.1, 'XYZ');

const SWING_DURATION = 0.22; // seconds per swing cycle
const SWING_ROT_X = 1.15;    // peak extra downward pitch (radians)
const SWING_DIP_Y = 0.12;    // peak downward dip
const SWING_PUSH_Z = 0.06;   // peak forward push

/** First-person view-model: a simple swinging arm meant to be parented to the camera. Drawn over the world (depthTest off). */
export class ViewModel {
  readonly object3D: THREE.Group;
  private geometries: THREE.BufferGeometry[] = [];
  private materials: THREE.Material[] = [];
  private phase = 0;        // 0..1 within the current swing cycle
  private active = false;   // a swing is currently playing
  private looping = false;  // keep restarting cycles (held mining)

  constructor() {
    this.object3D = new THREE.Group();
    this.object3D.position.copy(REST_POS);
    this.object3D.rotation.copy(REST_ROT);
    this.object3D.renderOrder = 10;

    const sleeve = this.makePart(0.22, 0.3, 0.22, SLEEVE_COLOR);
    sleeve.position.set(0, 0.12, 0);
    const skin = this.makePart(0.2, 0.34, 0.2, SKIN_COLOR);
    skin.position.set(0, -0.16, 0);

    this.object3D.add(sleeve);
    this.object3D.add(skin);
  }

  private makePart(w: number, h: number, d: number, color: number): THREE.Mesh {
    const geo = new THREE.BoxGeometry(w, h, d);
    const mat = new THREE.MeshLambertMaterial({ color });
    mat.depthTest = false;
    mat.depthWrite = false;
    const mesh = new THREE.Mesh(geo, mat);
    mesh.renderOrder = 10;
    this.geometries.push(geo);
    this.materials.push(mat);
    return mesh;
  }

  triggerSwing(): void {
    this.active = true;
    this.phase = 0;
  }

  setMining(active: boolean): void {
    this.looping = active;
    if (active && !this.active) {
      this.active = true;
      this.phase = 0;
    }
  }

  update(dt: number): void {
    if (!this.active) {
      this.object3D.position.copy(REST_POS);
      this.object3D.rotation.copy(REST_ROT);
      return;
    }
    this.phase += dt / SWING_DURATION;
    if (this.phase >= 1) {
      if (this.looping) {
        this.phase -= 1;
      } else {
        this.active = false;
        this.phase = 0;
        this.object3D.position.copy(REST_POS);
        this.object3D.rotation.copy(REST_ROT);
        return;
      }
    }
    const s = Math.sin(this.phase * Math.PI); // 0 -> 1 -> 0 over the cycle
    this.object3D.rotation.set(REST_ROT.x - s * SWING_ROT_X, REST_ROT.y, REST_ROT.z, 'XYZ');
    this.object3D.position.set(REST_POS.x, REST_POS.y - s * SWING_DIP_Y, REST_POS.z + s * SWING_PUSH_Z);
  }

  dispose(): void {
    this.object3D.parent?.remove(this.object3D);
    for (const geo of this.geometries) geo.dispose();
    for (const mat of this.materials) mat.dispose();
    this.geometries = [];
    this.materials = [];
  }
}
