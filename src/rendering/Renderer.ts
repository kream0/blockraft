import * as THREE from 'three';
import { CHUNK_HEIGHT, CHUNK_SIZE, RENDER_DISTANCE, type SkyState } from '../types';

const SKY_COLOR = 0x87ceeb;
const FOG_NEAR = 20;

const SHADOW_RADIUS = 80;
const SHADOW_MAP_SIZE = 1024;
const SHADOW_FAR = CHUNK_HEIGHT * 3;
const SHADOW_BIAS = -0.0005;
const SHADOW_NORMAL_BIAS = 0.0;

export class Renderer {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;

  private dirLight: THREE.DirectionalLight;
  private ambient: THREE.AmbientLight;
  private _sunDir = new THREE.Vector3(0, -1, 0);

  constructor(canvas?: HTMLCanvasElement, fogFar: number = RENDER_DISTANCE * CHUNK_SIZE) {
    const params: THREE.WebGLRendererParameters = {
      antialias: true,
      powerPreference: 'high-performance',
    };
    if (canvas !== undefined) {
      params.canvas = canvas;
    }
    this.renderer = new THREE.WebGLRenderer(params);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setClearColor(SKY_COLOR, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(SKY_COLOR);
    this.scene.fog = new THREE.Fog(SKY_COLOR, FOG_NEAR, fogFar);

    this.ambient = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(this.ambient);

    this.dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
    this.dirLight.position.set(50, 100, 30);
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    // Enable shadow maps on the renderer and configure the directional light's shadow camera.
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.dirLight.castShadow = true;
    const sc = this.dirLight.shadow.camera as THREE.OrthographicCamera;
    sc.left = -SHADOW_RADIUS;
    sc.right = SHADOW_RADIUS;
    sc.top = SHADOW_RADIUS;
    sc.bottom = -SHADOW_RADIUS;
    sc.near = 0.1;
    sc.far = SHADOW_FAR;
    sc.updateProjectionMatrix();
    this.dirLight.shadow.mapSize.set(SHADOW_MAP_SIZE, SHADOW_MAP_SIZE);
    this.dirLight.shadow.bias = SHADOW_BIAS;
    this.dirLight.shadow.normalBias = SHADOW_NORMAL_BIAS;
  }

  setSize(width: number, height: number): void {
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.setSize(width, height, false);
  }

  /** Update the far plane of the linear fog. */
  setFogFar(far: number): void {
    const fog = this.scene.fog;
    if (fog instanceof THREE.Fog) {
      fog.far = far;
    }
  }

  /** Apply a day/night sky snapshot to the clear color, background, fog, and lights. */
  applySky(state: SkyState): void {
    this.renderer.setClearColor(state.skyColor, 1);
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.copy(state.skyColor);
    }
    if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.color.copy(state.skyColor);
    }
    this.ambient.intensity = state.ambientIntensity;
    this.dirLight.color.copy(state.sunColor);
    this.dirLight.intensity = state.sunIntensity;
    // Store sun direction for per-frame shadow frustum repositioning (updateSunShadow).
    // Initial position is a fallback; the frame loop overrides it via updateSunShadow.
    this._sunDir.copy(state.sunDirection);
    this.dirLight.position.copy(state.sunDirection).multiplyScalar(-150);
  }

  /** Re-center the shadow ortho frustum on the player each frame so shadows track the camera. */
  updateSunShadow(camWorld: THREE.Vector3): void {
    this.dirLight.target.position.copy(camWorld);
    this.dirLight.position.copy(camWorld).addScaledVector(this._sunDir, -150);
    this.dirLight.target.updateMatrixWorld();
  }

  render(camera: THREE.Camera): void {
    this.renderer.render(this.scene, camera);
  }

  dispose(): void {
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.isMesh && mesh.geometry) {
        mesh.geometry.dispose();
      }
    });
    this.scene.remove(this.ambient);
    this.scene.remove(this.dirLight);
    this.scene.remove(this.dirLight.target);
    this.dirLight.shadow.dispose();
    this.renderer.dispose();
  }
}
