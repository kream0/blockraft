import * as THREE from 'three';
import { type SkyState, SKY_BODY_DISTANCE, SUN_RADIUS, MOON_RADIUS } from '../types';

/**
 * Renders a visible sun and moon that follow the day/night cycle. The two discs are
 * billboarded quads placed at SKY_BODY_DISTANCE (400) from the camera along the sun axis.
 *
 * Occlusion: the disc materials are transparent, so they render in Three.js's transparent
 * pass AFTER all opaque terrain. depthTest is therefore left ENABLED so the depth buffer
 * written by opaque terrain occludes the discs — terrain (including walls and ceilings when
 * the player is indoors) correctly hides the sun/moon, giving free hill/mountain silhouettes.
 * depthWrite is disabled so the discs never occlude each other or later transparent passes
 * (water, weather). SKY_BODY_DISTANCE sits beyond the farthest terrain at max render distance
 * (16 chunks ≈ 362 units) yet well within the camera far plane (1000), so terrain in the line
 * of sight is always closer than the disc and occludes it, while open sky (cleared depth = far)
 * lets it through. fog is disabled so the discs are not fogged out at that distance.
 *
 * Call update() every frame with the current SkyState and camera position.
 * The caller (GameSession) adds object3D to the scene and calls dispose() on teardown.
 */
export class SkyBodies {
  readonly object3D: THREE.Group;
  private readonly sun: THREE.Mesh;
  private readonly moon: THREE.Mesh;
  private readonly disc: THREE.Texture;

  // Scratch: camera-toward-sun direction; avoids per-frame allocation.
  private readonly _sunDir = new THREE.Vector3();
  // Built once — pale blueish moon tint.
  private readonly _moonColor = new THREE.Color(0xcdd6e8);

  constructor() {
    // Build a shared soft-disc sprite texture: 64×64 canvas, radial gradient from
    // white-opaque at center to transparent at the edge. Atlas-independent.
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
    grad.addColorStop(0,    'rgba(255,255,255,1)');
    grad.addColorStop(0.55, 'rgba(255,255,255,0.9)');
    grad.addColorStop(1,    'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 64, 64);
    this.disc = new THREE.CanvasTexture(canvas);

    // Sun mesh — own material instance so color/opacity can differ from the moon.
    const sunGeo = new THREE.PlaneGeometry(2 * SUN_RADIUS, 2 * SUN_RADIUS);
    const sunMat = new THREE.MeshBasicMaterial({
      map: this.disc,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      fog: false,
    });
    this.sun = new THREE.Mesh(sunGeo, sunMat);
    this.sun.renderOrder = -10;
    this.sun.frustumCulled = false;

    // Moon mesh — separate material instance (different tint, separate opacity).
    const moonGeo = new THREE.PlaneGeometry(2 * MOON_RADIUS, 2 * MOON_RADIUS);
    const moonMat = new THREE.MeshBasicMaterial({
      map: this.disc,
      transparent: true,
      depthTest: true,
      depthWrite: false,
      fog: false,
    });
    this.moon = new THREE.Mesh(moonGeo, moonMat);
    this.moon.renderOrder = -10;
    this.moon.frustumCulled = false;

    this.object3D = new THREE.Group();
    this.object3D.add(this.sun);
    this.object3D.add(this.moon);
    // Group transform stays at identity; we set child world positions each frame.
  }

  /**
   * Position and billboard the sun and moon around the camera, fading each body
   * smoothly through the horizon transition. Called every frame by GameSession.
   */
  update(state: SkyState, camPos: THREE.Vector3): void {
    // camera→sun direction = negated sunDirection (sunDirection is sun→scene).
    this._sunDir.copy(state.sunDirection).multiplyScalar(-1);

    // Sun lies along the sun direction; moon is antipodal.
    this.sun.position.copy(camPos).addScaledVector(this._sunDir, SKY_BODY_DISTANCE);
    this.moon.position.copy(camPos).addScaledVector(this._sunDir, -SKY_BODY_DISTANCE);

    // Billboard: orient +Z of the quad toward the camera so the textured face is visible.
    this.sun.lookAt(camPos);
    this.moon.lookAt(camPos);

    // sunUp > 0 → sun above horizon; < 0 → below.
    const sunUp = this._sunDir.y;
    const sunOpacity  = this.smoothstep(-0.10, 0.10,  sunUp);
    const moonOpacity = this.smoothstep(-0.10, 0.10, -sunUp);

    const sunMat  = this.sun.material  as THREE.MeshBasicMaterial;
    const moonMat = this.moon.material as THREE.MeshBasicMaterial;

    sunMat.opacity  = sunOpacity;
    moonMat.opacity = moonOpacity;

    // Sun color mirrors the directional light: warm orange at horizon, white at noon.
    sunMat.color.copy(state.sunColor);
    moonMat.color.copy(this._moonColor);

    // Skip draw calls for fully faded bodies.
    this.sun.visible  = sunOpacity  > 0.001;
    this.moon.visible = moonOpacity > 0.001;
  }

  /** Free all GPU resources. The caller must remove object3D from the scene before calling this. */
  dispose(): void {
    this.sun.geometry.dispose();
    (this.sun.material as THREE.MeshBasicMaterial).dispose();
    this.moon.geometry.dispose();
    (this.moon.material as THREE.MeshBasicMaterial).dispose();
    this.disc.dispose();
  }

  private smoothstep(edge0: number, edge1: number, x: number): number {
    const k = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
    return k * k * (3 - 2 * k);
  }
}
