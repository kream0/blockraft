import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { SMAAPass } from 'three/examples/jsm/postprocessing/SMAAPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { FXAAShader } from 'three/examples/jsm/shaders/FXAAShader.js';
import {
  CHUNK_HEIGHT,
  CHUNK_SIZE,
  RENDER_DISTANCE,
  AntiAlias,
  ShadowSoftness,
  ToneMapping,
  FogType,
  DEFAULT_SETTINGS,
  type Settings,
  type SkyState,
} from '../types';

const SKY_COLOR = 0x87ceeb;
const FOG_NEAR = 20;

const SHADOW_RADIUS = 80;
const SHADOW_FAR = CHUNK_HEIGHT * 3;
const SHADOW_BIAS = -0.0005;
const SHADOW_NORMAL_BIAS = 0.0;

const TONE_MAP: Record<string, THREE.ToneMapping> = {
  none: THREE.NoToneMapping,
  linear: THREE.LinearToneMapping,
  aces: THREE.ACESFilmicToneMapping,
};

const DEFAULTS = DEFAULT_SETTINGS as Required<Settings>;

function createWebGLRenderer(canvas?: HTMLCanvasElement): THREE.WebGLRenderer {
  const params: THREE.WebGLRendererParameters = { powerPreference: 'high-performance' };
  // NOTE: antialias:true is intentionally DROPPED — anti-aliasing now runs as a composer pass
  // (FXAA/SMAA) so it can be switched at runtime. MSAA is fixed at context creation and can't.
  if (canvas !== undefined) params.canvas = canvas;
  const r = new THREE.WebGLRenderer(params);
  r.setClearColor(SKY_COLOR, 1);
  r.outputColorSpace = THREE.SRGBColorSpace;
  r.shadowMap.enabled = true;
  r.shadowMap.type = THREE.PCFSoftShadowMap;
  return r;
}

export class Renderer {
  renderer: THREE.WebGLRenderer;
  scene: THREE.Scene;

  private dirLight: THREE.DirectionalLight;
  private ambient: THREE.AmbientLight;
  private _sunDir = new THREE.Vector3(0, -1, 0);

  private composer: EffectComposer | null = null;
  private renderPass: RenderPass | null = null;
  private bloomPass: UnrealBloomPass | null = null;
  private aaPass: ShaderPass | SMAAPass | null = null;
  private outputPass: OutputPass | null = null;
  private _w = 1;
  private _h = 1;
  private _pixelRatioCap = 2;
  private _fogFar: number;
  private _lastGraphics: Settings | null = null;

  constructor(canvas?: HTMLCanvasElement, fogFar: number = RENDER_DISTANCE * CHUNK_SIZE) {
    this.renderer = createWebGLRenderer(canvas);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    this._fogFar = fogFar;

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
    this.dirLight.castShadow = true;
    const sc = this.dirLight.shadow.camera as THREE.OrthographicCamera;
    sc.left = -SHADOW_RADIUS;
    sc.right = SHADOW_RADIUS;
    sc.top = SHADOW_RADIUS;
    sc.bottom = -SHADOW_RADIUS;
    sc.near = 0.1;
    sc.far = SHADOW_FAR;
    sc.updateProjectionMatrix();
    this.dirLight.shadow.mapSize.set(1024, 1024);
    this.dirLight.shadow.bias = SHADOW_BIAS;
    this.dirLight.shadow.normalBias = SHADOW_NORMAL_BIAS;
  }

  /**
   * Apply all graphics settings to the renderer and post-processing pipeline.
   * Call once at startup (after the camera exists) and on every settings change.
   * Returns shadowRecompileNeeded=true when chunk + water materials must be recompiled
   * (shadow enabled-state or shadow map type changed at runtime).
   * On the first call (lastGraphics===null) always returns false — materials compile fresh.
   */
  applyGraphics(settings: Settings, camera: THREE.Camera): { shadowRecompileNeeded: boolean } {
    const prev = this._lastGraphics;
    const isFirst = prev === null;
    let shadowRecompileNeeded = false;

    // --- Pixel ratio cap ---
    const cap = settings.pixelRatioCap ?? DEFAULTS.pixelRatioCap;
    if (isFirst || cap !== (prev.pixelRatioCap ?? DEFAULTS.pixelRatioCap)) {
      this._pixelRatioCap = cap;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, cap));
      this.composer?.setPixelRatio(Math.min(window.devicePixelRatio, cap));
    }

    // --- Tone mapping ---
    const tm = settings.toneMapping ?? DEFAULTS.toneMapping;
    if (isFirst || tm !== (prev.toneMapping ?? DEFAULTS.toneMapping)) {
      this.renderer.toneMapping = TONE_MAP[tm] ?? THREE.NoToneMapping;
      this.renderer.toneMappingExposure = 1.0;
    }

    // --- Fog type ---
    const ft = settings.fogType ?? DEFAULTS.fogType;
    if (isFirst || ft !== (prev.fogType ?? DEFAULTS.fogType)) {
      this.setFogType(ft);
    }

    // --- Shadows ---
    const shadowMapSize = settings.shadowMapSize ?? DEFAULTS.shadowMapSize;
    const shadowSoftness = settings.shadowSoftness ?? DEFAULTS.shadowSoftness;
    const prevShadowMapSize = prev?.shadowMapSize ?? DEFAULTS.shadowMapSize;
    const prevShadowSoftness = prev?.shadowSoftness ?? DEFAULTS.shadowSoftness;

    if (isFirst || shadowMapSize !== prevShadowMapSize) {
      const enabledNow = shadowMapSize !== 0;
      const wasEnabled = prevShadowMapSize !== 0;
      this.renderer.shadowMap.enabled = enabledNow;
      if (enabledNow) {
        this.dirLight.shadow.mapSize.set(shadowMapSize, shadowMapSize);
        this.dirLight.shadow.map?.dispose();
        // Force three.js to rebuild the shadow map at the new size on the next frame.
        (this.dirLight.shadow as { map: null }).map = null;
      }
      if (!isFirst && wasEnabled !== enabledNow) {
        shadowRecompileNeeded = true;
      }
    }

    if (isFirst || shadowSoftness !== prevShadowSoftness) {
      this.renderer.shadowMap.type =
        shadowSoftness === ShadowSoftness.PCF_SOFT
          ? THREE.PCFSoftShadowMap
          : THREE.PCFShadowMap;
      // The SHADOWMAP_TYPE define only exists in the material when shadows are on; when
      // they're off, softness is inert and recompiling would just stutter for nothing.
      if (!isFirst && shadowMapSize !== 0) {
        shadowRecompileNeeded = true;
      }
    }

    // --- Composer (structural rebuild) ---
    const aa = settings.antiAlias ?? DEFAULTS.antiAlias;
    const bloom = settings.bloom ?? DEFAULTS.bloom;

    const prevAa = prev?.antiAlias ?? DEFAULTS.antiAlias;
    const prevBloom = prev?.bloom ?? DEFAULTS.bloom;

    const structuralChange = isFirst || aa !== prevAa || bloom !== prevBloom;

    if (structuralChange) {
      this.rebuildComposer(settings, camera);
    }

    // --- Composer (live uniforms, no rebuild) ---
    const bloomIntensity = settings.bloomIntensity ?? DEFAULTS.bloomIntensity;
    const bloomThreshold = settings.bloomThreshold ?? DEFAULTS.bloomThreshold;

    if (this.bloomPass !== null) {
      this.bloomPass.strength = bloomIntensity;
      this.bloomPass.threshold = bloomThreshold;
      this.bloomPass.radius = 0.3;
    }

    this._lastGraphics = settings;
    return { shadowRecompileNeeded };
  }

  private rebuildComposer(settings: Settings, camera: THREE.Camera): void {
    this.disposeComposer();

    const aa = settings.antiAlias ?? DEFAULTS.antiAlias;
    const bloom = settings.bloom ?? DEFAULTS.bloom;
    const bloomIntensity = settings.bloomIntensity ?? DEFAULTS.bloomIntensity;
    const bloomThreshold = settings.bloomThreshold ?? DEFAULTS.bloomThreshold;

    const needComposer = aa !== AntiAlias.OFF || bloom;
    if (!needComposer) {
      // Low preset → direct render, zero composer overhead.
      this.composer = null;
      return;
    }

    const pr = Math.min(window.devicePixelRatio, this._pixelRatioCap);
    const rt = new THREE.WebGLRenderTarget(this._w, this._h, { type: THREE.HalfFloatType });
    this.composer = new EffectComposer(this.renderer, rt);
    this.composer.setPixelRatio(pr);
    this.composer.setSize(this._w, this._h);

    this.renderPass = new RenderPass(this.scene, camera);
    this.composer.addPass(this.renderPass);

    // Bloom pass.
    if (bloom) {
      this.bloomPass = new UnrealBloomPass(
        new THREE.Vector2(this._w, this._h),
        bloomIntensity,
        0.3,
        bloomThreshold,
      );
      this.composer.addPass(this.bloomPass);
    }

    // Anti-aliasing pass.
    if (aa === AntiAlias.FXAA) {
      this.aaPass = new ShaderPass(FXAAShader);
      const u = (this.aaPass as ShaderPass).material.uniforms['resolution'];
      if (u !== undefined) {
        u.value.set(1 / (this._w * pr), 1 / (this._h * pr));
      }
      this.composer.addPass(this.aaPass);
    } else if (aa === AntiAlias.SMAA) {
      this.aaPass = new SMAAPass(this._w * pr, this._h * pr);
      this.composer.addPass(this.aaPass);
    }

    // OutputPass must always be last — applies tone mapping + sRGB conversion to screen.
    // The HDR render target skips that conversion until this pass runs.
    this.outputPass = new OutputPass();
    this.composer.addPass(this.outputPass);
  }

  private disposeComposer(): void {
    this.bloomPass?.dispose?.();
    (this.aaPass as { dispose?: () => void } | null)?.dispose?.();
    this.outputPass?.dispose?.();
    this.composer?.dispose();
    this.composer = null;
    this.renderPass = null;
    this.bloomPass = null;
    this.aaPass = null;
    this.outputPass = null;
  }

  setSize(width: number, height: number): void {
    this._w = width;
    this._h = height;
    const pr = Math.min(window.devicePixelRatio, this._pixelRatioCap);
    this.renderer.setPixelRatio(pr);
    this.renderer.setSize(width, height, false);
    if (this.composer !== null) {
      this.composer.setPixelRatio(pr);
      this.composer.setSize(width, height);
      // FXAAShader has no setSize — refresh its resolution uniform manually.
      const aa = this.aaPass;
      if (aa instanceof ShaderPass) {
        const u = aa.material.uniforms['resolution'];
        if (u !== undefined) {
          u.value.set(1 / (width * pr), 1 / (height * pr));
        }
      }
    }
  }

  /** Update the far plane of the scene fog (linear or exp2). */
  setFogFar(far: number): void {
    this._fogFar = far;
    if (this.scene.fog instanceof THREE.FogExp2) {
      this.scene.fog.density = 2.5 / far;
    } else if (this.scene.fog instanceof THREE.Fog) {
      this.scene.fog.far = far;
    }
  }

  /** Swap scene.fog between THREE.Fog (linear) and THREE.FogExp2, preserving current color. */
  private setFogType(type: FogType): void {
    const prevColor = this.scene.fog ? this.scene.fog.color.getHex() : SKY_COLOR;
    if (type === FogType.EXP2) {
      if (!(this.scene.fog instanceof THREE.FogExp2)) {
        this.scene.fog = new THREE.FogExp2(prevColor, 2.5 / this._fogFar);
      }
    } else {
      // FogExp2 is NOT a subclass of THREE.Fog in three.js, so the instanceof THREE.Fog
      // guard is false for exp2 — the explicit FogExp2 check forces a swap back to linear.
      if (!(this.scene.fog instanceof THREE.Fog) || this.scene.fog instanceof THREE.FogExp2) {
        this.scene.fog = new THREE.Fog(prevColor, FOG_NEAR, this._fogFar);
      }
    }
  }

  /** Apply a day/night sky snapshot to the clear color, background, fog, and lights. */
  applySky(state: SkyState): void {
    this.renderer.setClearColor(state.skyColor, 1);
    if (this.scene.background instanceof THREE.Color) {
      this.scene.background.copy(state.skyColor);
    }
    // Both THREE.Fog and THREE.FogExp2 have .color — update regardless of type.
    if (this.scene.fog !== null) {
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
    if (this.composer !== null) {
      this.composer.render();
    } else {
      this.renderer.render(this.scene, camera);
    }
  }

  dispose(): void {
    this.disposeComposer();
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
