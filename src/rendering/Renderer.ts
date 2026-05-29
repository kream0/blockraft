import * as THREE from 'three';
import { CHUNK_SIZE, RENDER_DISTANCE, type SkyState } from '../types';

const SKY_COLOR = 0x87ceeb;
const FOG_NEAR = 20;

export class Renderer {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;

  private dirLight: THREE.DirectionalLight;
  private ambient: THREE.AmbientLight;

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
    // Position the light opposite its travel direction; target stays at origin.
    this.dirLight.position.copy(state.sunDirection).multiplyScalar(-100);
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
    this.renderer.dispose();
  }
}
