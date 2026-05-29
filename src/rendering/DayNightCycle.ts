import * as THREE from 'three';
import { DAY_LENGTH_SECONDS, type SkyState } from '../types';

// Palette (sRGB hex).
const NIGHT_SKY = 0x0a0e1a;
const DAY_SKY = 0x87ceeb;
const DUSK_SKY = 0xff7e42;
const SUN_WARM = 0xffb066;
const SUN_WHITE = 0xffffff;

const AMBIENT_NIGHT = 0.2;
const AMBIENT_DAY = 0.55;
const SUN_MAX = 0.9;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const k = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return k * k * (3 - 2 * k);
}

/**
 * Drives sky/light parameters from a normalized time-of-day t in [0, 1):
 * t=0 midnight, 0.25 sunrise, 0.5 noon, 0.75 sunset. Produces a single reused
 * SkyState (no per-frame allocations). GameSession ticks update(dt) each frame
 * and feeds getSkyState() to Renderer.applySky().
 */
export class DayNightCycle {
  private t: number;
  private readonly state: SkyState;

  // Palette scratch instances (constructed once).
  private readonly nightSky = new THREE.Color(NIGHT_SKY);
  private readonly daySky = new THREE.Color(DAY_SKY);
  private readonly duskSky = new THREE.Color(DUSK_SKY);
  private readonly sunWarm = new THREE.Color(SUN_WARM);
  private readonly sunWhite = new THREE.Color(SUN_WHITE);

  constructor(initialT: number = 0.3) {
    this.t = ((initialT % 1) + 1) % 1;
    this.state = {
      skyColor: new THREE.Color(),
      sunColor: new THREE.Color(),
      sunIntensity: 0,
      ambientIntensity: 0,
      sunDirection: new THREE.Vector3(),
    };
    this.recompute();
  }

  /** Normalized time of day in [0, 1). */
  get normalizedTime(): number {
    return this.t;
  }

  /** True during the dark hours (after dusk / before dawn) — when hostiles spawn. */
  get isNight(): boolean {
    return this.t < 0.23 || this.t > 0.77;
  }

  /** Jump to a specific time (used for testing / future commands). */
  setNormalizedTime(t: number): void {
    this.t = ((t % 1) + 1) % 1;
    this.recompute();
  }

  /** Advance time by dt real seconds and recompute the sky state. */
  update(dt: number): void {
    this.t = (((this.t + dt / DAY_LENGTH_SECONDS) % 1) + 1) % 1;
    this.recompute();
  }

  /** The current (reused) sky/light snapshot. Do not retain the THREE references. */
  getSkyState(): SkyState {
    return this.state;
  }

  private recompute(): void {
    const angle = 2 * Math.PI * (this.t - 0.25);
    const elevation = Math.sin(angle); // -1 (midnight) .. +1 (noon)

    // Sun on a slightly tilted arc. sunDirection = direction light TRAVELS (sun -> origin),
    // so it is the negated, normalized sun position. Renderer places the light at -sunDirection.
    this.state.sunDirection
      .set(Math.cos(angle), Math.sin(angle), 0.25)
      .normalize()
      .multiplyScalar(-1);

    const day = smoothstep(-0.15, 0.25, elevation); // 0 deep night .. 1 full day
    const twilight = Math.max(0, 1 - Math.abs(elevation) / 0.15); // peaks at the horizon (dawn & dusk)

    // Sky: lerp night->day by daylight, then tint toward dusk-orange near the horizon.
    this.state.skyColor.copy(this.nightSky).lerp(this.daySky, day);
    this.state.skyColor.lerp(this.duskSky, twilight * 0.7);

    // Sun warms near the horizon, white at noon.
    this.state.sunColor.copy(this.sunWarm).lerp(this.sunWhite, day);

    this.state.sunIntensity = day * SUN_MAX;
    this.state.ambientIntensity = AMBIENT_NIGHT + (AMBIENT_DAY - AMBIENT_NIGHT) * day;
  }
}
