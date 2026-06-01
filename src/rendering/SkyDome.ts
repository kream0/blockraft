import * as THREE from 'three';
import { type SkyState, SKY_DOME_RADIUS } from '../types';

const ZENITH_DARKEN = 0.55; // zenith = skyColor * this — overhead reads deeper than the horizon

/**
 * Camera-following gradient sky dome. A large inward-facing sphere drawn behind
 * everything (depth test/write off, renderOrder -1000) so terrain, sun and moon
 * paint over it. Horizon color tracks the live skyColor for a seamless blend with
 * the flat clear color + fog; the zenith is a darkened skyColor for atmospheric
 * depth; a soft warm halo grows around the sun direction and fades out at night.
 */
export class SkyDome {
  readonly object3D: THREE.Mesh;
  private readonly material: THREE.ShaderMaterial;
  private readonly _toSun = new THREE.Vector3();
  private readonly _horizon = { value: new THREE.Color(0x9ec6ff) };
  private readonly _zenith = { value: new THREE.Color(0x3b74d6) };
  private readonly _sunDir = { value: new THREE.Vector3(0, 1, 0) };
  private readonly _sunColor = { value: new THREE.Color(0xffffff) };
  private readonly _sunGlow = { value: 0 };

  constructor() {
    const geometry = new THREE.SphereGeometry(SKY_DOME_RADIUS, 32, 16);
    this.material = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthTest: false,
      depthWrite: false,
      fog: false,
      uniforms: {
        uHorizon: this._horizon,
        uZenith: this._zenith,
        uSunDir: this._sunDir,
        uSunColor: this._sunColor,
        uSunGlow: this._sunGlow,
      },
      vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = position;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 uHorizon;
        uniform vec3 uZenith;
        uniform vec3 uSunDir;
        uniform vec3 uSunColor;
        uniform float uSunGlow;
        varying vec3 vDir;
        void main() {
          vec3 dir = normalize(vDir);
          float t = smoothstep(0.0, 1.0, clamp(dir.y, 0.0, 1.0));
          vec3 col = mix(uHorizon, uZenith, t);
          float d = max(dot(dir, normalize(uSunDir)), 0.0);
          float halo = pow(d, 8.0) * 0.5 + pow(d, 220.0) * 1.3;
          col += uSunColor * halo * uSunGlow;
          gl_FragColor = vec4(col, 1.0);
        }
      `,
    });
    this.object3D = new THREE.Mesh(geometry, this.material);
    this.object3D.frustumCulled = false;
    this.object3D.renderOrder = -1000;
  }

  update(state: SkyState, camPos: THREE.Vector3): void {
    this.object3D.position.copy(camPos);
    this._horizon.value.copy(state.skyColor);
    this._zenith.value.copy(state.skyColor).multiplyScalar(ZENITH_DARKEN);
    this._toSun.copy(state.sunDirection).multiplyScalar(-1);
    this._sunDir.value.copy(this._toSun);
    this._sunColor.value.copy(state.sunColor);
    this._sunGlow.value = state.daylight;
  }

  dispose(): void {
    this.object3D.geometry.dispose();
    this.material.dispose();
  }
}
