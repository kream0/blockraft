import * as THREE from 'three';
import { Mob } from './Mob';
import {
  EntityKind,
  SKELETON_MAX_HEALTH,
  SKELETON_DETECT_RADIUS,
  SKELETON_PREFERRED_MIN,
  SKELETON_PREFERRED_MAX,
  SKELETON_MOVE_SPEED,
  SKELETON_SHOOT_COOLDOWN_S,
  type ArrowShot,
  type IWorld,
  type Vec3,
} from '../types';

const SKELETON_RADIUS = 0.3;
const SKELETON_HEIGHT = 1.8;
/** Launch height (blocks above feet) of the skeleton's bow. */
const BOW_HEIGHT = 1.4;
/** Player eye height above the FEET position from getTrackedTarget(). */
const PLAYER_EYE_HEIGHT = 1.6;
const WANDER_SPEED = 1.0;
const WANDER_INTERVAL_S = 3;

/**
 * Hostile ranged mob: keeps distance from the player (SKELETON_PREFERRED_MIN..MAX)
 * and fires arrows on cooldown when line-of-sight is clear. Uses range-band kiting:
 * backs away when too close, advances when too far, holds position while in band.
 *
 * Arrow shots are produced as ArrowShot specs (origin + dir) and consumed by
 * GameSession via tryFire() — mirrors the Zombie.tryBite() delegation pattern.
 * Physics (gravity, AABB collision) are fully inherited from Mob; think() only sets
 * horizontal velocity and jumpRequested.
 */
export class Skeleton extends Mob {
  private wanderAngle = Math.random() * Math.PI * 2;
  private wanderTimer = 0;
  private shootTimer = 0;
  private pendingShot: ArrowShot | null = null;
  // Scratch Vec3s reused for the LOS raycast so a blocked line-of-sight doesn't
  // allocate a fresh object every tick.
  private readonly _losOrigin: Vec3 = { x: 0, y: 0, z: 0 };
  private readonly _losDir: Vec3 = { x: 0, y: 0, z: 0 };

  constructor(position: Vec3) {
    const mesh = Skeleton.buildMesh();
    super(EntityKind.SKELETON, position, SKELETON_RADIUS, SKELETON_HEIGHT, SKELETON_MAX_HEALTH, mesh);
  }

  protected override think(dt: number, world: IWorld): void {
    this.shootTimer = Math.max(0, this.shootTimer - dt);

    const target = world.getTrackedTarget();
    if (target !== null) {
      const dx = target.x - this.position.x;
      const dz = target.z - this.position.z;
      const distSq = dx * dx + dz * dz;

      if (distSq <= SKELETON_DETECT_RADIUS * SKELETON_DETECT_RADIUS) {
        // ---- ENGAGE ----
        const dist = Math.sqrt(distSq) || 1e-4;
        const nx = dx / dist;
        const nz = dz / dist;
        // Face the player while engaged (yaw convention: -Z is forward at yaw=0).
        this.yaw = Math.atan2(-nx, -nz);

        // Range-band kiting: back away when too close, advance when too far,
        // hold position while inside the preferred band.
        if (dist < SKELETON_PREFERRED_MIN) {
          // Too close — retreat.
          this.velocity.x = -nx * SKELETON_MOVE_SPEED;
          this.velocity.z = -nz * SKELETON_MOVE_SPEED;
          // Guard the backpedal against cliffs. Retreat deliberately does NOT step-climb
          // (tryStepUp is advance-only, per the note below), so a 1-block rise behind the
          // skeleton just stops it — acceptable while kiting.
          this.avoidLedge(world, -nx, -nz);
        } else if (dist > SKELETON_PREFERRED_MAX) {
          // Too far — advance.
          this.velocity.x = nx * SKELETON_MOVE_SPEED;
          this.velocity.z = nz * SKELETON_MOVE_SPEED;
        } else {
          // In preferred band — stand still and shoot.
          this.velocity.x = 0;
          this.velocity.z = 0;
        }

        // Step-climb a 1-block ledge — only while ADVANCING, the only state whose
        // velocity points toward the player. Probing while holding/retreating
        // would cause spurious hops.
        if (dist > SKELETON_PREFERRED_MAX) {
          this.tryStepUp(world, nx, nz);
          this.avoidLedge(world, nx, nz);
        }

        // Fire when off cooldown AND line-of-sight to the player's eye is clear.
        if (this.shootTimer <= 0) {
          const ox = this.position.x;
          const oy = this.position.y + BOW_HEIGHT;
          const oz = this.position.z;
          // Aim at the player's eyes (feet + PLAYER_EYE_HEIGHT).
          const sx = target.x - ox;
          const sy = (target.y + PLAYER_EYE_HEIGHT) - oy;
          const sz = target.z - oz;
          const slen = Math.hypot(sx, sy, sz) || 1e-4;
          const dirx = sx / slen;
          const diry = sy / slen;
          const dirz = sz / slen;

          // Reuse scratch objects for the LOS check — no allocation on a blocked shot.
          this._losOrigin.x = ox;
          this._losOrigin.y = oy;
          this._losOrigin.z = oz;
          this._losDir.x = dirx;
          this._losDir.y = diry;
          this._losDir.z = dirz;

          if (world.raycast(this._losOrigin, this._losDir, slen) === null) {
            // Allocate fresh objects — GameSession retains this until it spawns the Arrow.
            this.pendingShot = {
              origin: { x: ox, y: oy, z: oz },
              dir: { x: dirx, y: diry, z: dirz },
            };
            this.shootTimer = SKELETON_SHOOT_COOLDOWN_S;
          }
        }

        return;
      }
    }

    // ---- WANDER (no target or target beyond detect radius) ----
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
   * Consume-once: if the AI queued a shot this tick, return it and clear the slot.
   * GameSession calls this each fixed step and spawns an Arrow from the spec.
   * Mirrors Zombie.tryBite() — mob decides, GameSession mutates the world.
   */
  tryFire(): ArrowShot | null {
    const shot = this.pendingShot;
    this.pendingShot = null;
    return shot;
  }

  /**
   * Build the skeleton mesh. Bony humanoid with feet at y=0, head facing −Z at yaw=0.
   * Each body part has its OWN geometry and material (Cow.ts pattern) so Entity.dispose()
   * traverses the group and disposes each independently without double-dispose.
   *
   * Bone palette: ~0xe8e6d8 (limbs/body) and ~0xf0eee2 (skull, slightly lighter).
   * Dims keep total height ≈ SKELETON_HEIGHT (1.8) with origin at the feet.
   */
  private static buildMesh(): THREE.Group {
    const group = new THREE.Group();

    // --- Legs (2): Box(0.12, 0.80, 0.12), centers at (±0.12, 0.4, 0) ---
    // Each leg spans y=[0, 0.8]; separated on X for a bipedal stance.
    const legPositions: [number, number, number][] = [
      [-0.12, 0.4, 0], // left leg
      [ 0.12, 0.4, 0], // right leg
    ];
    for (const [lx, ly, lz] of legPositions) {
      const leg = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.80, 0.12),
        new THREE.MeshLambertMaterial({ color: 0xe8e6d8 }),
      );
      leg.position.set(lx, ly, lz);
      group.add(leg);
    }

    // --- Body: Box(0.40, 0.60, 0.18), center (0, 1.10, 0) ---
    // Spans y=[0.8, 1.4]; narrow depth for a skeletal ribcage silhouette.
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.40, 0.60, 0.18),
      new THREE.MeshLambertMaterial({ color: 0xe8e6d8 }),
    );
    body.position.set(0, 1.10, 0);
    group.add(body);

    // --- Arms (2): Box(0.10, 0.60, 0.10), centers at (±0.30, 1.15, 0) ---
    // Hang to either side of the torso; slightly lower center than body for natural droop.
    const armPositions: [number, number, number][] = [
      [-0.30, 1.15, 0], // left arm
      [ 0.30, 1.15, 0], // right arm
    ];
    for (const [ax, ay, az] of armPositions) {
      const arm = new THREE.Mesh(
        new THREE.BoxGeometry(0.10, 0.60, 0.10),
        new THREE.MeshLambertMaterial({ color: 0xe8e6d8 }),
      );
      arm.position.set(ax, ay, az);
      group.add(arm);
    }

    // --- Skull: Box(0.40, 0.40, 0.40), center (0, 1.60, 0) ---
    // Slightly lighter colour distinguishes the head from the darker limb bones.
    // Top sits at y=1.8 = SKELETON_HEIGHT.
    const skull = new THREE.Mesh(
      new THREE.BoxGeometry(0.40, 0.40, 0.40),
      new THREE.MeshLambertMaterial({ color: 0xf0eee2 }),
    );
    skull.position.set(0, 1.60, 0);
    group.add(skull);

    return group;
  }
}
