import * as THREE from 'three';
import { Entity } from './Entity';
import { EntityKind, ARROW_SPEED, ARROW_LIFETIME_S, type IWorld, type Vec3 } from '../types';

export class Arrow extends Entity {
  /** Set true when the arrow should be removed (hit a solid block, or lifetime expired). GameSession sweeps dead arrows. */
  dead = false;
  private life = ARROW_LIFETIME_S;
  /** Normalized flight direction — constant (straight-line). Reused for the per-tick raycast (zero allocation). */
  private readonly dir: THREE.Vector3;

  constructor(origin: Vec3, dir: Vec3) {
    const mesh = Arrow.buildMesh();
    super(EntityKind.ARROW, origin, mesh);
    const d = new THREE.Vector3(dir.x, dir.y, dir.z);
    if (d.lengthSq() < 1e-8) d.set(0, 0, -1); // degenerate-direction guard
    d.normalize();
    this.dir = d;
    this.velocity.x = d.x * ARROW_SPEED;
    this.velocity.y = d.y * ARROW_SPEED;
    this.velocity.z = d.z * ARROW_SPEED;
    // Orient the shaft (+Z long axis) along flight direction, ONCE — direction never changes.
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), d);
  }

  override update(dt: number, world: IWorld): void {
    if (this.dead) return;

    // Block collision: cast over THIS tick's travel segment. A solid block within the step
    // distance stops the arrow (marks dead) — robust against tunneling at any speed.
    const stepLen = ARROW_SPEED * dt;
    if (world.raycast(this.position, this.dir, stepLen) !== null) {
      this.dead = true; // leave position as-is; GameSession despawns it this tick (no visible overshoot)
      return;
    }

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;

    this.life -= dt;
    if (this.life <= 0) this.dead = true;

    // Sync mesh position only (orientation fixed at construction).
    if (this.object3D !== null) {
      this.object3D.position.set(this.position.x, this.position.y, this.position.z);
    }
  }

  private static buildMesh(): THREE.Mesh {
    // Thin shaft elongated along +Z (~0.5 long, 0.05 cross-section), dark-wood colored.
    const geo = new THREE.BoxGeometry(0.05, 0.05, 0.5);
    const mat = new THREE.MeshLambertMaterial({ color: 0x6b5436 });
    return new THREE.Mesh(geo, mat);
  }
}
