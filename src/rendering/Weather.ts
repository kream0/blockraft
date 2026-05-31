import * as THREE from 'three';
import {
  type SkyState,
  type WeatherKind,
  WEATHER_CLEAR_MIN_S,
  WEATHER_CLEAR_MAX_S,
  WEATHER_PRECIP_MIN_S,
  WEATHER_PRECIP_MAX_S,
  WEATHER_INITIAL_CLEAR_MIN_S,
  WEATHER_INITIAL_CLEAR_MAX_S,
  WEATHER_FADE_S,
  WEATHER_PARTICLE_COUNT,
  WEATHER_VOLUME_RADIUS,
  WEATHER_SNOW_MIN_Y,
} from '../types';

const R = WEATHER_VOLUME_RADIUS;

/**
 * Self-contained ephemeral weather system. Manages a camera-following precipitation
 * cloud (rain or snow) and dims the SkyState toward overcast while precipitating.
 * Not persisted — resets each session like the day/night cycle.
 */
export class WeatherSystem {
  readonly object3D: THREE.Points;

  // Local-space positions within the cube [-R, R]^3. The object3D is moved to the
  // camera each frame, so these stay relative to the cloud centre.
  private readonly positions: Float32Array; // length = COUNT*3
  private readonly driftX: Float32Array;    // per-particle horizontal drift for snow
  private readonly driftZ: Float32Array;

  private precipitating = false;
  private currentKind: WeatherKind = 'clear';
  private lastAppliedKind: WeatherKind | null = null;
  private intensity = 0; // eased 0..1 presence of precip; drives opacity + sky dim
  private timer: number;

  // Scratch Color instances built once — no per-frame heap allocation.
  private readonly _overcast = new THREE.Color(0x9aa3ad);
  private readonly _rainColor = new THREE.Color(0x8fa6bd);
  private readonly _snowColor = new THREE.Color(0xffffff);

  constructor() {
    this.positions = new Float32Array(WEATHER_PARTICLE_COUNT * 3);
    this.driftX    = new Float32Array(WEATHER_PARTICLE_COUNT);
    this.driftZ    = new Float32Array(WEATHER_PARTICLE_COUNT);

    for (let i = 0; i < WEATHER_PARTICLE_COUNT; i++) {
      this.positions[i * 3 + 0] = this.rand(-R, R);
      this.positions[i * 3 + 1] = this.rand(-R, R);
      this.positions[i * 3 + 2] = this.rand(-R, R);
      // Unit-ish drift values; scaled by driftScale at integrate time.
      this.driftX[i] = Math.random() * 2 - 1;
      this.driftZ[i] = Math.random() * 2 - 1;
    }

    const geometry = new THREE.BufferGeometry();
    const posAttr = new THREE.BufferAttribute(this.positions, 3);
    posAttr.setUsage(THREE.DynamicDrawUsage);
    geometry.setAttribute('position', posAttr);
    // Nothing drawn until precip begins.
    geometry.setDrawRange(0, 0);

    const material = new THREE.PointsMaterial({
      size: 0.07,
      transparent: true,
      opacity: 0,
      depthWrite: false, // avoids precipitation punching holes in the depth buffer
      sizeAttenuation: true,
    });
    material.color.copy(this._rainColor);

    this.object3D = new THREE.Points(geometry, material);
    // Positions mutate every frame; the bounding sphere is never recomputed, so
    // frustum culling would pop the entire cloud out when the camera moves.
    this.object3D.frustumCulled = false;

    this.timer = this.rand(WEATHER_INITIAL_CLEAR_MIN_S, WEATHER_INITIAL_CLEAR_MAX_S);
  }

  /** Advance state machine, ease intensity, animate particles, recentre cloud on camera. */
  update(dt: number, camPos: THREE.Vector3): void {
    // --- State machine ---
    this.timer -= dt;
    if (this.timer <= 0) {
      if (this.precipitating) {
        this.precipitating = false;
        this.timer = this.rand(WEATHER_CLEAR_MIN_S, WEATHER_CLEAR_MAX_S);
      } else {
        this.precipitating = true;
        this.timer = this.rand(WEATHER_PRECIP_MIN_S, WEATHER_PRECIP_MAX_S);
      }
    }

    // Kind tracks camera altitude when precipitating; kept for fade-out visuals.
    if (this.precipitating) {
      this.currentKind = camPos.y >= WEATHER_SNOW_MIN_Y ? 'snow' : 'rain';
    }

    // --- Ease intensity ---
    const target = this.precipitating ? 1 : 0;
    const step = dt / WEATHER_FADE_S;
    if (this.intensity < target) {
      this.intensity = Math.min(target, this.intensity + step);
    } else if (this.intensity > target) {
      this.intensity = Math.max(target, this.intensity - step);
    }

    // --- Material ---
    const mat = this.object3D.material as THREE.PointsMaterial;
    mat.opacity = this.intensity; // per-frame: drives fade in/out
    // Color + size only change on a rain<->snow transition, so skip the
    // per-frame Color.copy. PointsMaterial uniforms upload every frame anyway.
    if (this.currentKind !== this.lastAppliedKind) {
      this.lastAppliedKind = this.currentKind;
      if (this.currentKind === 'snow') {
        mat.color.copy(this._snowColor);
        mat.size = 0.13;
      } else {
        mat.color.copy(this._rainColor);
        mat.size = 0.07;
      }
    }

    // Skip integration when effectively clear — matches ParticleSystem's early-return pattern.
    if (this.intensity <= 0.001) {
      this.object3D.geometry.setDrawRange(0, 0);
      return;
    }

    // --- Animate ---
    this.object3D.position.copy(camPos);

    const isSnow = this.currentKind === 'snow';
    const fall       = isSnow ? 3.5  : 22;
    const driftScale = isSnow ? 0.8  : 0;

    for (let i = 0; i < WEATHER_PARTICLE_COUNT; i++) {
      let y = (this.positions[i * 3 + 1] ?? 0) - fall * dt;
      let x = (this.positions[i * 3 + 0] ?? 0) + (this.driftX[i] ?? 0) * driftScale * dt;
      let z = (this.positions[i * 3 + 2] ?? 0) + (this.driftZ[i] ?? 0) * driftScale * dt;

      // Toroidal wrap — keep every particle inside the cloud cube so coverage is uniform.
      if (y < -R) { y += 2 * R; x = this.rand(-R, R); z = this.rand(-R, R); }
      if (x >  R) x -= 2 * R; else if (x < -R) x += 2 * R;
      if (z >  R) z -= 2 * R; else if (z < -R) z += 2 * R;

      this.positions[i * 3 + 0] = x;
      this.positions[i * 3 + 1] = y;
      this.positions[i * 3 + 2] = z;
    }

    const geometry = this.object3D.geometry;
    geometry.setDrawRange(0, WEATHER_PARTICLE_COUNT);
    geometry.attributes['position']!.needsUpdate = true;
  }

  /**
   * Mutate a reused SkyState toward overcast in proportion to current intensity.
   * DayNightCycle recomputes a fresh state each tick, so multiplying intensities here
   * is non-cumulative — no drift over multiple frames.
   */
  dimSky(state: SkyState): void {
    if (this.intensity <= 0.001) return;
    const k = this.intensity;
    // Lerp sky/fog/clear color toward grey. Renderer copies skyColor into fog + clear.
    state.skyColor.lerp(this._overcast, 0.55 * k);
    state.sunIntensity    *= (1 - 0.45 * k);
    state.ambientIntensity *= (1 - 0.25 * k);
  }

  /** 'Clear' when not precipitating; 'Rain' or 'Snow' while active (incl. fade-out tail). Used by the HUD. */
  get label(): string {
    if (!this.precipitating && this.intensity <= 0.001) return 'Clear';
    return this.currentKind === 'snow' ? 'Snow' : 'Rain';
  }

  /** Current kind; reports 'clear' when not precipitating (fade-out tail excluded). */
  get kind(): WeatherKind {
    return this.precipitating ? this.currentKind : 'clear';
  }

  /** Free GPU resources. The caller removes object3D from the scene first. */
  dispose(): void {
    this.object3D.geometry.dispose();
    (this.object3D.material as THREE.Material).dispose();
  }

  private rand(min: number, max: number): number {
    return min + Math.random() * (max - min);
  }
}
