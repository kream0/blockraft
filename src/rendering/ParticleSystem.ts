import * as THREE from 'three';
import {
  PARTICLE_BURST_COUNT,
  PARTICLE_LIFETIME_S,
  PARTICLE_GRAVITY,
  PARTICLE_SPEED,
  PARTICLE_SIZE,
  PARTICLE_POOL_MAX,
} from '../types';

/**
 * Self-contained burst-particle engine for block-break effects.
 *
 * Design principles:
 * - Zero per-frame heap allocation: all pools are preallocated Float32Arrays.
 * - Dead particles are recycled via swap-remove to keep the live region [0, count) contiguous.
 * - The geometry backing arrays are written in-place and flagged needsUpdate each frame.
 * - frustumCulled=false because the geometry bounding sphere is never recomputed (positions mutate
 *   every frame), so culling would incorrectly hide the whole burst when the camera moves.
 */
export class ParticleSystem {
  readonly object3D: THREE.Points;

  // Geometry backing arrays — positions and colors are interleaved 3-floats-per-particle.
  private readonly positions: Float32Array; // [x0,y0,z0, x1,y1,z1, ...]  length = PARTICLE_POOL_MAX*3
  private readonly colors: Float32Array;    // [r0,g0,b0, r1,g1,b1, ...]  length = PARTICLE_POOL_MAX*3

  // Per-particle velocity and remaining lifetime (one entry per particle slot).
  private readonly velX: Float32Array; // length = PARTICLE_POOL_MAX
  private readonly velY: Float32Array;
  private readonly velZ: Float32Array;
  private readonly life: Float32Array;  // remaining seconds; slot "alive" iff index < count

  private count = 0;

  // Reused scratch Color — avoids a `new THREE.Color()` allocation in spawnBurst.
  private readonly _color = new THREE.Color();

  constructor() {
    // Preallocate all pools.
    this.positions = new Float32Array(PARTICLE_POOL_MAX * 3);
    this.colors    = new Float32Array(PARTICLE_POOL_MAX * 3);
    this.velX      = new Float32Array(PARTICLE_POOL_MAX);
    this.velY      = new Float32Array(PARTICLE_POOL_MAX);
    this.velZ      = new Float32Array(PARTICLE_POOL_MAX);
    this.life      = new Float32Array(PARTICLE_POOL_MAX);

    // Build the BufferGeometry backed by the preallocated arrays.
    const geometry = new THREE.BufferGeometry();

    const posAttr = new THREE.BufferAttribute(this.positions, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', posAttr);

    const colAttr = new THREE.BufferAttribute(this.colors, 3);
    colAttr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('color', colAttr);

    // Nothing alive yet — draw 0 points.
    geometry.setDrawRange(0, 0);

    const material = new THREE.PointsMaterial({
      size: PARTICLE_SIZE,
      vertexColors: true,
      sizeAttenuation: true,
    });

    this.object3D = new THREE.Points(geometry, material);

    // Particle positions change every frame but the geometry bounding sphere is never recomputed.
    // Leaving frustumCulled=true would cause the renderer to discard the entire burst once the
    // stale bounding sphere no longer intersects the frustum, making particles pop out of existence.
    this.object3D.frustumCulled = false;
  }

  /**
   * Spawn a burst of PARTICLE_BURST_COUNT particles centered at (x, y, z) tinted with the
   * sRGB hex color `colorHex`. Particles that would exceed PARTICLE_POOL_MAX are silently dropped.
   */
  spawnBurst(x: number, y: number, z: number, colorHex: number): void {
    this._color.setHex(colorHex);
    const r = this._color.r;
    const g = this._color.g;
    const b = this._color.b;

    const geometry = this.object3D.geometry;

    for (let k = 0; k < PARTICLE_BURST_COUNT; k++) {
      if (this.count >= PARTICLE_POOL_MAX) break; // pool full — drop remainder

      const i = this.count;
      this.count++;

      // Position: small random spread around the block center.
      const px = x + (Math.random() - 0.5) * 0.6;
      const py = y + (Math.random() - 0.5) * 0.6;
      const pz = z + (Math.random() - 0.5) * 0.6;
      this.positions[i * 3 + 0] = px;
      this.positions[i * 3 + 1] = py;
      this.positions[i * 3 + 2] = pz;

      // Velocity: random horizontal burst with an upward bias so particles pop then fall.
      this.velX[i] = (Math.random() * 2 - 1) * PARTICLE_SPEED;
      this.velY[i] = Math.random() * PARTICLE_SPEED + PARTICLE_SPEED * 0.4;
      this.velZ[i] = (Math.random() * 2 - 1) * PARTICLE_SPEED;

      // Color.
      this.colors[i * 3 + 0] = r;
      this.colors[i * 3 + 1] = g;
      this.colors[i * 3 + 2] = b;

      // Lifetime.
      this.life[i] = PARTICLE_LIFETIME_S;
    }

    // Newly written slots must be uploaded to the GPU before the next render.
    geometry.attributes['position']!.needsUpdate = true;
    geometry.attributes['color']!.needsUpdate    = true;
    geometry.setDrawRange(0, this.count);
  }

  /**
   * Advance all live particles by `dt` seconds.
   * Applies gravity to velY, integrates positions, decrements life, and recycles expired
   * particles via swap-remove so the live region stays contiguous at [0, count).
   */
  update(dt: number): void {
    if (this.count === 0) return;

    let removed = false;
    let i = 0;
    while (i < this.count) {
      // Read life once; the ?? 0 satisfies noUncheckedIndexedAccess — index is always in range.
      const remaining = (this.life[i] ?? 0) - dt;

      if (remaining <= 0) {
        // Particle expired: swap-remove from the end of the live region.
        const last = this.count - 1;
        this._swapSlots(i, last);
        this.count--;
        removed = true;
        // Do NOT increment i — the particle now at slot i was just moved here and needs processing.
      } else {
        // Update lifetime.
        this.life[i] = remaining;

        // Apply gravity then integrate position.
        const newVelY = (this.velY[i] ?? 0) - PARTICLE_GRAVITY * dt;
        this.velY[i] = newVelY;

        this.positions[i * 3 + 0] = (this.positions[i * 3 + 0] ?? 0) + (this.velX[i] ?? 0) * dt;
        this.positions[i * 3 + 1] = (this.positions[i * 3 + 1] ?? 0) + newVelY * dt;
        this.positions[i * 3 + 2] = (this.positions[i * 3 + 2] ?? 0) + (this.velZ[i] ?? 0) * dt;

        i++;
      }
    }

    const geometry = this.object3D.geometry;
    geometry.setDrawRange(0, this.count);
    geometry.attributes['position']!.needsUpdate = true;
    if (removed) {
      // A swap-remove copied a (possibly different) color into a recycled slot; re-upload colors.
      geometry.attributes['color']!.needsUpdate = true;
    }
  }

  /** Number of currently live particles (useful for debug/tests). */
  get activeCount(): number {
    return this.count;
  }

  /** Free GPU resources. The caller is responsible for removing object3D from the scene first. */
  dispose(): void {
    this.object3D.geometry.dispose();
    (this.object3D.material as THREE.Material).dispose();
  }

  /**
   * Copy all per-particle data from slot `src` into slot `dst`.
   * Used by swap-remove to keep the live region contiguous.
   * Allocation-free: only typed-array reads and writes.
   */
  private _swapSlots(dst: number, src: number): void {
    // Positions (3 floats each).
    this.positions[dst * 3 + 0] = this.positions[src * 3 + 0] ?? 0;
    this.positions[dst * 3 + 1] = this.positions[src * 3 + 1] ?? 0;
    this.positions[dst * 3 + 2] = this.positions[src * 3 + 2] ?? 0;

    // Colors (3 floats each).
    this.colors[dst * 3 + 0] = this.colors[src * 3 + 0] ?? 0;
    this.colors[dst * 3 + 1] = this.colors[src * 3 + 1] ?? 0;
    this.colors[dst * 3 + 2] = this.colors[src * 3 + 2] ?? 0;

    // Velocities (1 float each).
    this.velX[dst] = this.velX[src] ?? 0;
    this.velY[dst] = this.velY[src] ?? 0;
    this.velZ[dst] = this.velZ[src] ?? 0;

    // Lifetime.
    this.life[dst] = this.life[src] ?? 0;
  }
}
