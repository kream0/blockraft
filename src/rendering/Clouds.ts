import * as THREE from 'three';
import {
  type SkyState,
  CLOUD_ALTITUDE,
  CLOUD_EXTENT,
  CLOUD_DRIFT_SPEED,
  CLOUD_TEXTURE_REPEAT,
  CLOUD_OPACITY,
} from '../types';

/**
 * Flat cloud plane sitting at CLOUD_ALTITUDE (160 blocks) above Y=0. The plane is a square
 * PlaneGeometry that recenters on the camera each frame so it always fills the overhead sky.
 * A scrolling UV offset on the tileable cloud texture makes the layer drift slowly westward.
 * The material color is tinted each frame by the day/night SkyState — white at noon, dark grey
 * at night, warm near dawn/dusk. Scene fog (color = skyColor) dissolves the far plane edges so
 * the hard quad boundary is invisible; depthTest lets solid terrain (hillsides, ceilings) occlude
 * the layer; depthWrite stays off so clouds never occlude water or other later transparent passes.
 *
 * Call update() every frame with the current SkyState, camera position, and frame dt (seconds).
 * The caller (GameSession) adds object3D to the scene and calls dispose() on teardown.
 */
export class Clouds {
  readonly object3D: THREE.Group;
  private readonly mesh: THREE.Mesh;
  private readonly texture: THREE.Texture;

  // Scratch Color instances — built once, mutated each frame; NEVER allocate inside update().
  private readonly _white = new THREE.Color(0xffffff);
  private readonly _tint  = new THREE.Color();

  /** Accumulated UV scroll distance; wrapped to prevent float precision drift over long sessions. */
  private offset = 0;

  constructor() {
    // ── Procedural cloud texture (256×256, seamlessly tileable) ─────────────────────────────
    // Deterministic LCG so the texture is identical every run (same seed, same blobs).
    // The repo draws all procedural textures deterministically — never Math.random.
    const SIZE = 256;
    const canvas = document.createElement('canvas');
    canvas.width  = SIZE;
    canvas.height = SIZE;
    const ctx = canvas.getContext('2d')!;

    ctx.clearRect(0, 0, SIZE, SIZE);

    // Deterministic LCG (matching the repo's Noise.ts / TextureAtlas.ts style).
    let s = 0x1a2b3c4d >>> 0;
    const rnd = (): number => {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return s / 0x100000000;
    };

    // Draw ~18 soft radial-gradient blobs. Each blob is drawn up to 9 times (3×3 offsets of
    // ±SIZE) so blobs that straddle an edge wrap seamlessly onto the opposite side.
    const BLOB_COUNT = 18;
    for (let i = 0; i < BLOB_COUNT; i++) {
      const cx    = rnd() * SIZE;
      const cy    = rnd() * SIZE;
      const r     = 18 + rnd() * 28;   // radius 18–46 px
      const alpha = 0.5 + rnd() * 0.4; // opacity 0.5–0.9

      ctx.globalAlpha = alpha;

      // 9 wrapped copies to guarantee seamless tiling.
      for (const dx of [-SIZE, 0, SIZE]) {
        for (const dy of [-SIZE, 0, SIZE]) {
          const bx = cx + dx;
          const by = cy + dy;
          const grad = ctx.createRadialGradient(bx, by, 0, bx, by, r);
          grad.addColorStop(0,   'rgba(255,255,255,1)');
          grad.addColorStop(0.6, 'rgba(255,255,255,0.6)');
          grad.addColorStop(1,   'rgba(255,255,255,0)');
          ctx.fillStyle = grad;
          ctx.fillRect(bx - r, by - r, r * 2, r * 2);
        }
      }
    }
    ctx.globalAlpha = 1;

    this.texture = new THREE.CanvasTexture(canvas);
    this.texture.wrapS = THREE.RepeatWrapping;
    this.texture.wrapT = THREE.RepeatWrapping;
    this.texture.repeat.set(CLOUD_TEXTURE_REPEAT, CLOUD_TEXTURE_REPEAT);

    // ── Plane geometry ───────────────────────────────────────────────────────────────────────
    const geo = new THREE.PlaneGeometry(2 * CLOUD_EXTENT, 2 * CLOUD_EXTENT);

    const mat = new THREE.MeshBasicMaterial({
      map:         this.texture,
      transparent: true,
      opacity:     CLOUD_OPACITY,
      depthTest:   true,   // terrain (walls, ceilings) occludes the cloud layer for free
      depthWrite:  false,  // clouds never occlude water or later transparent passes
      fog:         true,   // fog dissolves the far plane edges into the sky color
      side:        THREE.DoubleSide, // visible both from below (normal play) and above (freecam)
    });

    this.mesh = new THREE.Mesh(geo, mat);

    // PlaneGeometry lies in the XY plane (normal +Z) by default; rotate -90deg about X so it lies
    // flat in the XZ plane with its normal pointing +Y (DoubleSide keeps it visible from below).
    this.mesh.rotation.x = -Math.PI / 2;

    // renderOrder -9 keeps clouds in the transparent pass just after the sun/moon discs (-10), so a
    // cloud correctly blends in front of the distant sun. Terrain occlusion comes from depthTest
    // (above), not from renderOrder.
    this.mesh.renderOrder = -9;

    // The mesh follows the camera; its bounding sphere would cause view-frustum popping.
    this.mesh.frustumCulled = false;

    this.object3D = new THREE.Group();
    this.object3D.add(this.mesh);
  }

  /**
   * Called every frame by GameSession. Recenters the cloud plane on the camera, advances the
   * UV drift, and retints the material to match the current time-of-day SkyState.
   *
   * Zero per-frame allocation: all scratch objects are pre-built in the constructor.
   *
   * @param state  Current sky/lighting state (SHARED instances — copy values, never retain).
   * @param camPos Current camera world position.
   * @param dt     Frame delta-time in seconds.
   */
  update(state: SkyState, camPos: THREE.Vector3, dt: number): void {
    // Recenter horizontally on the camera at fixed altitude; rotation stays flat.
    this.mesh.position.set(camPos.x, CLOUD_ALTITUDE, camPos.z);

    // Advance UV scroll; slightly different x/y rates so the drift isn't a perfect diagonal.
    this.offset += CLOUD_DRIFT_SPEED * dt;
    // Wrap to avoid floating-point precision drift over a very long session.
    // The texture sampler uses fract(offset) so the visual is unaffected.
    if (this.offset > 1e6) this.offset -= 1e6;
    this.texture.offset.set(this.offset, this.offset * 0.6);

    // Tint: interpolate between dark-grey (night/overcast) and near-white (full day).
    // 0.35 ensures clouds stay a visible dark grey at night rather than disappearing.
    const b = 0.35 + 0.65 * Math.min(1, Math.max(0, state.daylight));

    // Copy state.skyColor into scratch (_tint), lerp a little toward sky color, scale by brightness.
    // state.skyColor is a SHARED instance — copy it, never retain the reference.
    this._tint.copy(this._white).lerp(state.skyColor, 0.25).multiplyScalar(b);

    const mat = this.mesh.material as THREE.MeshBasicMaterial;
    mat.color.copy(this._tint);
    mat.opacity = CLOUD_OPACITY * (0.6 + 0.4 * Math.min(1, Math.max(0, state.daylight)));
  }

  /** Free all GPU resources. The caller must remove object3D from the scene before calling this. */
  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as THREE.MeshBasicMaterial).dispose();
    this.texture.dispose();
  }
}
