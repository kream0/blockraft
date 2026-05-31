import * as THREE from 'three';
import { Mob } from './Mob';
import {
  EntityKind,
  CREEPER_MAX_HEALTH,
  CREEPER_DETECT_RADIUS,
  CREEPER_MOVE_SPEED,
  CREEPER_IGNITE_RANGE,
  CREEPER_FUSE_S,
  type IWorld,
  type Vec3,
} from '../types';

const CREEPER_RADIUS = 0.3;   // matches Skeleton; keeps speed/60 < radius (no tunneling)
const CREEPER_HEIGHT = 1.7;
const WANDER_SPEED = 1.0;
const WANDER_INTERVAL_S = 3;

/**
 * Hostile melee mob: chases the player on sight and triggers an explosion when
 * it closes to CREEPER_IGNITE_RANGE. When the mob enters ignite range it freezes,
 * burns a fuse for CREEPER_FUSE_S seconds, and raises `exploded = true` on the
 * completing tick. GameSession polls `exploded` after entityManager.update(),
 * detonates at this.position, then despawns — mirroring Skeleton.tryFire().
 *
 * A swell + blink emissive telegraph is applied to the mesh while the fuse burns so
 * the player has a visual window to react. The fuse resets if the player escapes
 * ignite range before it completes.
 */
export class Creeper extends Mob {
  /** Raised true on the tick the fuse completes. GameSession polls this after
   *  entityManager.update, detonates at this.position, then despawns. Mirrors
   *  Skeleton.tryFire delegation: mob decides, GameSession mutates the world. */
  exploded = false;

  private fuseTimer = 0;     // seconds the fuse has been burning (0 = unlit)
  private wanderAngle = Math.random() * Math.PI * 2;
  private wanderTimer = 0;

  constructor(position: Vec3) {
    const mesh = Creeper.buildMesh();
    super(EntityKind.CREEPER, position, CREEPER_RADIUS, CREEPER_HEIGHT, CREEPER_MAX_HEALTH, mesh);
  }

  protected override think(dt: number, world: IWorld): void {
    const target = world.getTrackedTarget();
    if (target !== null) {
      const dx = target.x - this.position.x;
      const dz = target.z - this.position.z;
      const distSq = dx * dx + dz * dz;

      if (distSq <= CREEPER_DETECT_RADIUS * CREEPER_DETECT_RADIUS) {
        // ---- ENGAGE ----
        const dist = Math.sqrt(distSq) || 1e-4;
        const nx = dx / dist;
        const nz = dz / dist;
        // Face the player while engaged (yaw convention: -Z is forward at yaw=0).
        this.yaw = Math.atan2(-nx, -nz);

        if (dist <= CREEPER_IGNITE_RANGE) {
          // ---- FUSE: player is in blast range — freeze and burn the fuse ----
          this.velocity.x = 0;
          this.velocity.z = 0;
          this.fuseTimer += dt;
          this.updateFuseVisual(this.fuseTimer / CREEPER_FUSE_S);
          if (this.fuseTimer >= CREEPER_FUSE_S) {
            this.exploded = true;
          }
          return;
        }

        // ---- CHASE: in detect radius but outside ignite range ----
        // If the fuse was lit while we were closer, reset it now that we're far enough.
        if (this.fuseTimer > 0) {
          this.fuseTimer = 0;
          this.updateFuseVisual(0);
        }
        this.velocity.x = nx * CREEPER_MOVE_SPEED;
        this.velocity.z = nz * CREEPER_MOVE_SPEED;
        this.tryStepUp(world, nx, nz);
        this.avoidLedge(world, nx, nz);
        return;
      }
    }

    // ---- WANDER (no target or target beyond detect radius) ----
    // Also reset the fuse if it was burning — player escaped.
    if (this.fuseTimer > 0) {
      this.fuseTimer = 0;
      this.updateFuseVisual(0);
    }
    this.wanderTimer -= dt;
    if (this.wanderTimer <= 0) {
      this.wanderAngle = Math.random() * Math.PI * 2;
      this.wanderTimer = WANDER_INTERVAL_S;
    }
    this.velocity.x = Math.cos(this.wanderAngle) * WANDER_SPEED;
    this.velocity.z = Math.sin(this.wanderAngle) * WANDER_SPEED;
    this.yaw = Math.atan2(-this.velocity.x, -this.velocity.z);
    if (this.avoidLedge(world, Math.cos(this.wanderAngle), Math.sin(this.wanderAngle))) {
      this.wanderAngle = Math.random() * Math.PI * 2;
      this.wanderTimer = WANDER_INTERVAL_S;
    }
  }

  /**
   * Apply swell + emissive blink to the mesh proportional to fuse progress.
   * `t` is fuse progress in [0, 1]; values above 1 are clamped internally.
   * When `t <= 0` the telegraph is cleared (scale reset to 1, emissive to 0).
   *
   * NOTE: Mob's hurt-stun flash also writes emissive (red), but think() — and thus
   * this method — is suppressed during the stun window, so there is no conflict.
   * When stun ends, Mob restores emissive to 0, matching the off-state here.
   */
  private updateFuseVisual(t: number): void {
    if (this.object3D === null) return;

    if (t <= 0) {
      // Fuse reset / not lit — restore to neutral.
      this.object3D.scale.setScalar(1);
      this.object3D.traverse((obj: THREE.Object3D) => {
        if (!(obj instanceof THREE.Mesh)) return;
        const mat = obj.material;
        if (mat instanceof THREE.MeshLambertMaterial) {
          mat.emissive.setScalar(0);
        }
      });
      return;
    }

    const clamped = Math.min(t, 1);

    // Swell: scale ramps from 1.0 to 1.30 as the fuse burns.
    const scale = 1 + 0.30 * clamped;
    this.object3D.scale.setScalar(scale);

    // Blink: frequency increases with fuse progress so the strobing is gentle
    // early and frantic just before detonation.
    const blink = 0.5 + 0.5 * Math.sin(this.fuseTimer * (8 + 30 * clamped));
    const glow = clamped * (0.25 + 0.75 * blink);

    this.object3D.traverse((obj: THREE.Object3D) => {
      if (!(obj instanceof THREE.Mesh)) return;
      const mat = obj.material;
      if (mat instanceof THREE.MeshLambertMaterial) {
        mat.emissive.setScalar(glow);
      }
    });
  }

  /**
   * Build the Creeper mesh. Green quad-legged silhouette with feet at y=0 and top
   * of head at y=CREEPER_HEIGHT (1.7). Head faces −Z at yaw=0. Plain solid-colour
   * boxes only (no texture/face art). Each part has its OWN geometry and material
   * so Entity.dispose() traverses the group and frees each independently, and the
   * fuse emissive tint works per-mesh without aliasing.
   *
   * Colour palette:
   *   Legs  — 0x3f8f3f (darker green)
   *   Body  — 0x4faf4f
   *   Head  — 0x5cbf5c (slightly brighter green)
   */
  private static buildMesh(): THREE.Group {
    const group = new THREE.Group();

    // --- Legs (4): Box(0.16, 0.40, 0.16), centers at (±0.15, 0.20, ±0.12) ---
    // Each leg spans y=[0, 0.4]; quad stance for the classic four-legged silhouette.
    const legPositions: [number, number, number][] = [
      [-0.15, 0.20, -0.12], // front-left
      [ 0.15, 0.20, -0.12], // front-right
      [-0.15, 0.20,  0.12], // back-left
      [ 0.15, 0.20,  0.12], // back-right
    ];
    for (const [lx, ly, lz] of legPositions) {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.16, 0.40, 0.16),
        new THREE.MeshLambertMaterial({ color: 0x3f8f3f }),
      );
      leg.position.set(lx, ly, lz);
      group.add(leg);
    }

    // --- Body: Box(0.50, 0.80, 0.34), center (0, 0.80, 0) ---
    // Spans y=[0.4, 1.2]; wide and deep for a stocky torso.
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.50, 0.80, 0.34),
      new THREE.MeshLambertMaterial({ color: 0x4faf4f }),
    );
    body.position.set(0, 0.80, 0);
    group.add(body);

    // --- Head: Box(0.50, 0.50, 0.50), center (0, 1.45, 0) ---
    // Spans y=[1.2, 1.7]; top at 1.7 = CREEPER_HEIGHT.
    const head = new THREE.Mesh(
      new THREE.BoxGeometry(0.50, 0.50, 0.50),
      new THREE.MeshLambertMaterial({ color: 0x5cbf5c }),
    );
    head.position.set(0, 1.45, 0);
    group.add(head);

    return group;
  }
}
