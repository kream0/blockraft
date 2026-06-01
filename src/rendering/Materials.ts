import * as THREE from 'three';
import type { ITextureAtlas } from '../types';
import { EdgeRounding, WaterQuality } from '../types';

/** Darkest the open sky gets at deep night, so nights stay navigable instead of pure black. */
const NIGHT_SKY_FLOOR = 0.15;
/** userData key under which each patched material stashes its live day/night uniform holder. */
const DAYLIGHT_UNIFORM_KEY = 'blockraftDaylight';
/** Normal-map bevel strength: how prominently the per-tile normal map tilts the surface. */
const BEVEL_NORMAL_SCALE = 0.6;
/** userData key: live water animation time (seconds), pushed each frame. */
const WATER_TIME_UNIFORM_KEY = 'blockraftWaterTime';
/** userData key: live water animation enable flag (0 = static "basic", 1 = animated). */
const WATER_ANIM_UNIFORM_KEY = 'blockraftWaterAnim';
/** userData key: live emissive bloom strength (0 = off, EMISSIVE_BLOOM_STRENGTH = on). */
const EMISSIVE_BLOOM_UNIFORM_KEY = 'blockraftEmissiveBloom';
/** How strongly block-lit faces exceed 1.0 in HDR when emissive bloom is on.
 * smoothstep(0.55, 1.0, blockLit) gates the effect so only torch/glowstone/lava-level faces glow. */
const EMISSIVE_BLOOM_STRENGTH = 1.8;

/** Options for chunk/water material creation. All fields are optional; defaults match legacy behaviour (no normal map, no analytic bevel). */
export interface ChunkMaterialOptions {
  normalMaps?: boolean;
  edgeRounding?: EdgeRounding;
  /** When true the solid chunk shader emits block-lit faces past 1.0 HDR so UnrealBloomPass blooms them. */
  emissiveBloom?: boolean;
}

/** Water-specific material options. `waterQuality` selects static (basic) vs animated ripple vs reflective sky-tint. */
export interface WaterMaterialOptions extends ChunkMaterialOptions {
  waterQuality?: WaterQuality;
}

/**
 * Patch a vertexColors MeshStandardMaterial so BAKED voxel light is authoritative for
 * diffuse. The real scene DirectionalLight drives specular on WATER only; opaque terrain
 * is fully matte (see Specular policy below).
 *
 * Baked channels (from the mesher):
 *   vColor.r = faceShade * AO * skyBrightness   (sky light; dimmed by day/night here)
 *   vColor.g = faceShade * AO * blockBrightness (torch/emitter light; day-independent)
 *
 * Final brightness = max(sky, block).  A warm tint is mixed in only where block light
 * exceeds sky light.  Because we zero out reflectedLight.directDiffuse /
 * reflectedLight.indirectDiffuse and replace them with our baked term, the scene's
 * Directional + Ambient lights never contribute diffuse to terrain — no through-wall
 * light leak.
 *
 * Shadow support: shadow is sampled from getShadowMask() and applied ONLY to the sky
 * channel, scaled by daylight — block/torch light is never shadowed, and night surfaces
 * are unaffected because shadowScale mixes toward 1.0 as uDayNight → 0.
 *
 * Specular policy: the OPAQUE chunk material zeroes reflectedLight.directSpecular so terrain
 * is fully matte — this eliminates the sweeping sun-highlight band and the dielectric
 * grazing-angle Fresnel sheen on distant vertical faces. Only the WATER material retains
 * directSpecular so water surfaces still read as wet with a visible sun glint.
 *
 * MeshStandardMaterial NOTE: the physical fragment preamble already pulls in <packing> and
 * <shadowmap_pars_fragment> (getShadow + shadow uniforms) but NOT <shadowmask_pars_fragment>,
 * the chunk that defines getShadowMask().  We therefore (a) inject our uDayNight uniform +
 * ANALYTIC_BEVEL varying after <common>, and (b) inject <shadowmask_pars_fragment> right
 * after <shadowmap_pars_fragment> so getShadowMask() is defined with all its dependencies in
 * scope.  We do NOT re-inject <packing> (already present; re-including would double-define it).
 */
function patchChunkLighting(material: THREE.MeshStandardMaterial, water?: { animated: boolean }, initialEmissiveBloom = false): void {
  const daylight = { value: 1 };
  material.userData[DAYLIGHT_UNIFORM_KEY] = daylight;

  const emissiveBloom = { value: initialEmissiveBloom ? EMISSIVE_BLOOM_STRENGTH : 0.0 };
  material.userData[EMISSIVE_BLOOM_UNIFORM_KEY] = emissiveBloom;

  const waterTime = { value: 0 };
  const waterAnim = { value: 0 };
  if (water !== undefined) {
    waterAnim.value = water.animated ? 1 : 0;
    material.userData[WATER_TIME_UNIFORM_KEY] = waterTime;
    material.userData[WATER_ANIM_UNIFORM_KEY] = waterAnim;
  }

  material.onBeforeCompile = (shader) => {
    shader.uniforms['uDayNight'] = daylight;
    shader.uniforms['uEmissiveBloom'] = emissiveBloom;

    if (water !== undefined) {
      shader.uniforms['uWaterTime'] = waterTime;
      shader.uniforms['uWaterAnim'] = waterAnim;
    }

    // -------------------------------------------------------------------------
    // VERTEX SHADER — analytic bevel world-position varying
    // -------------------------------------------------------------------------
    // Inject vBkWorldPos varying declaration (guarded by ANALYTIC_BEVEL define).
    // MeshStandard already sets up normals, shadow coords, etc., so we only add
    // what analytic bevel needs.
    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      [
        '#include <common>',
        '#ifdef ANALYTIC_BEVEL',
        '  varying vec3 vBkWorldPos;',
        '#endif',
      ].join('\n'),
    );

    if (water !== undefined) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        '#include <common>\nvarying vec3 vWaterWorldPos;',
      );
    }

    // After <begin_vertex> the `transformed` local is available.
    // We compute world position here before projection.
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      [
        '#include <begin_vertex>',
        '#ifdef ANALYTIC_BEVEL',
        '  vBkWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
        '#endif',
      ].join('\n'),
    );

    if (water !== undefined) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\nvWaterWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;',
      );
    }

    // -------------------------------------------------------------------------
    // FRAGMENT SHADER — step 1: uniforms + world-pos varying after <common>
    // -------------------------------------------------------------------------
    // The meshphysical fragment preamble already pulls in <packing>, so we must
    // NOT re-include it (no include guards → double-definition). It does NOT,
    // however, define getShadowMask() — that comes from <shadowmask_pars_fragment>,
    // which we inject separately below. Here we add only our uDayNight uniform and
    // the ANALYTIC_BEVEL world-pos varying.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      [
        '#include <common>',
        '#ifdef ANALYTIC_BEVEL',
        '  varying vec3 vBkWorldPos;',
        '#endif',
        'uniform float uDayNight;',
        'uniform float uEmissiveBloom;',
      ].join('\n'),
    );

    if (water !== undefined) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        '#include <common>\nuniform float uWaterTime;\nuniform float uWaterAnim;\nvarying vec3 vWaterWorldPos;',
      );
    }

    // -------------------------------------------------------------------------
    // FRAGMENT SHADER — define getShadowMask() for the baked sky-shadow term.
    // -------------------------------------------------------------------------
    // The meshphysical preamble includes <shadowmap_pars_fragment> (getShadow()
    // plus the shadow uniforms/structs/varyings) but NOT <shadowmask_pars_fragment>
    // (which defines getShadowMask()). Inject the latter directly AFTER the former
    // so getShadowMask()'s body sees every symbol it depends on (declaration before
    // use), matching the ordering Three's own shadow material uses.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <shadowmap_pars_fragment>',
      '#include <shadowmap_pars_fragment>\n#include <shadowmask_pars_fragment>',
    );

    // -------------------------------------------------------------------------
    // FRAGMENT SHADER — step 2: suppress the standard vertexColors fold
    // -------------------------------------------------------------------------
    // With vertexColors:true, Three's <color_fragment> does diffuseColor *= vColor
    // which would corrupt albedo with the raw baked color.  We replace it with a
    // no-op so diffuseColor stays equal to the sampled atlas texel after <map_fragment>.
    // We read vColor ourselves in the baked-diffuse block below.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      '/* blockraft: color_fragment replaced — vColor consumed in baked-diffuse block */',
    );

    // -------------------------------------------------------------------------
    // FRAGMENT SHADER — step 3: baked diffuse computation
    // Injected AFTER <roughnessmap_fragment> and <normal_fragment_maps> so the
    // final shading normal is known (analytic bevel perturbs it here too), and
    // BEFORE <lights_fragment_begin> so bakedDiffuse is in scope for step 4.
    // -------------------------------------------------------------------------
    const bakedDiffuseBlock = [
      // --- baked diffuse ---
      '#ifdef USE_COLOR',
      '  #ifdef USE_SHADOWMAP',
      '    float bkShadow = getShadowMask();',
      '    const float SHADOW_MIN = 0.35;',
      '    float bkShadowScale = mix(1.0, SHADOW_MIN, (1.0 - bkShadow) * uDayNight);',
      '  #else',
      '    float bkShadowScale = 1.0;',
      '  #endif',
      '  float skyLit   = vColor.r * mix(' + NIGHT_SKY_FLOOR.toFixed(3) + ', 1.0, uDayNight) * bkShadowScale;',
      '  float blockLit = vColor.g;',
      '  float lum      = max(skyLit, blockLit);',
      '  float warmth   = clamp((blockLit - skyLit) * 1.5, 0.0, 1.0);',
      '  vec3 warmTint  = mix(vec3(1.0), vec3(1.0, 0.82, 0.55), warmth);',
      '  // Emissive block glow: strongly block-lit faces (torch/glowstone/lava) emit past 1.0 so the',
      '  // HDR bloom pass blooms them. Gated on blockLit so sky-lit daytime faces never glow.',
      '  float emissiveAmt = smoothstep(0.55, 1.0, blockLit);',
      '  totalEmissiveRadiance += diffuseColor.rgb * warmTint * emissiveAmt * uEmissiveBloom;',
      '  vec3 bakedDiffuse = diffuseColor.rgb * lum * warmTint;',
      '#else',
      '  vec3 bakedDiffuse = diffuseColor.rgb;',
      '#endif',
      // --- analytic bevel: perturb the shading normal near block edges ---
      '#ifdef ANALYTIC_BEVEL',
      '  {',
      '    const float BEVEL_BAND = 0.08;',
      '    const float BEVEL_SLOPE = 0.5;',
      '    vec3 absNorm = abs(normal);',
      '    vec3 wPos    = vBkWorldPos;',
      '    vec3 f       = fract(wPos);',
      '    // For each in-face axis (where |normal| component is small) compute edge proximity.',
      '    // We perturb normal outward along that axis by slope when near an edge.',
      '    vec3 perturbation = vec3(0.0);',
      '    if (absNorm.x < 0.5) {',
      '      float dx = min(f.x, 1.0 - f.x);',
      '      perturbation.x += mix(BEVEL_SLOPE, 0.0, smoothstep(0.0, BEVEL_BAND, dx)) * sign(f.x - 0.5);',
      '    }',
      '    if (absNorm.y < 0.5) {',
      '      float dy = min(f.y, 1.0 - f.y);',
      '      perturbation.y += mix(BEVEL_SLOPE, 0.0, smoothstep(0.0, BEVEL_BAND, dy)) * sign(f.y - 0.5);',
      '    }',
      '    if (absNorm.z < 0.5) {',
      '      float dz = min(f.z, 1.0 - f.z);',
      '      perturbation.z += mix(BEVEL_SLOPE, 0.0, smoothstep(0.0, BEVEL_BAND, dz)) * sign(f.z - 0.5);',
      '    }',
      '    normal = normalize(normal + mat3(viewMatrix) * perturbation);',
      '  }',
      '#endif',
    ].join('\n');

    // --- P4 water: time-scrolled ripple perturbs the shading normal (top faces only) ---
    const waterRippleBlock = water === undefined ? '' : [
      '// --- P4 water: time-scrolled ripple perturbs the shading normal (top faces only) ---',
      'if (uWaterAnim > 0.5) {',
      '  vec3 dpx = dFdx(vWaterWorldPos);',
      '  vec3 dpy = dFdy(vWaterWorldPos);',
      '  vec3 geomWorldN = normalize(cross(dpx, dpy));',
      '  if (abs(geomWorldN.y) > 0.5) {',
      '    vec2 wp = vWaterWorldPos.xz;',
      '    float t = uWaterTime;',
      '    const float K1 = 0.85;',
      '    const float K2 = 0.55;',
      '    const float S1 = 1.30;',
      '    const float S2 = 0.90;',
      '    const float RIPPLE_STRENGTH = 0.22;',
      '    vec2 grad = vec2(',
      '      K1 * cos(wp.x * K1 + t * S1) + K2 * cos((wp.x + wp.y) * K2 + t * S2),',
      '      K1 * cos(wp.y * K1 - t * S1) + K2 * cos((wp.x + wp.y) * K2 - t * S2)',
      '    );',
      '    vec3 perturbWorld = vec3(-grad.x, 0.0, -grad.y) * RIPPLE_STRENGTH;',
      '    normal = normalize(normal + mat3(viewMatrix) * perturbWorld);',
      '  }',
      '}',
    ].join('\n');

    // The injection point is AFTER <roughnessmap_fragment> and <normal_fragment_maps>,
    // just BEFORE <lights_fragment_begin>.
    // In Three 0.160's meshphysical_frag.glsl the order is:
    //   ... roughnessmap_fragment ... normal_fragment_maps ... lights_physical_pars_fragment ...
    //   lights_fragment_begin ... lights_fragment_maps ... lights_fragment_end ...
    // We target <lights_fragment_begin> and prepend before it.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_begin>',
      bakedDiffuseBlock + waterRippleBlock + '\n#include <lights_fragment_begin>',
    );

    // -------------------------------------------------------------------------
    // FRAGMENT SHADER — step 4: replace diffuse with baked term; conditionally zero specular
    // -------------------------------------------------------------------------
    // After <lights_fragment_end> the reflectedLight struct is fully accumulated.
    // We zero out both diffuse channels and substitute our baked term.
    // directSpecular: zeroed for opaque terrain (fully matte — prevents the sweeping sun-band
    // and grazing-angle Fresnel sheen); left intact for water so it still looks wet.
    const isWater = water !== undefined;
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_end>',
      [
        '#include <lights_fragment_end>',
        '// blockraft: override diffuse with baked voxel lighting',
        'reflectedLight.directDiffuse   = vec3(0.0);',
        'reflectedLight.indirectDiffuse = bakedDiffuse;',
        'reflectedLight.indirectSpecular = vec3(0.0);',
        isWater
          ? '// water keeps directSpecular — the sun glint reads as a wet sheen on the surface'
          : 'reflectedLight.directSpecular = vec3(0.0); // opaque terrain is fully matte: no sun mirror/sheen',
      ].join('\n'),
    );

    // -------------------------------------------------------------------------
    // FRAGMENT SHADER — P4 water: Fresnel opacity + reflective sky tint
    // -------------------------------------------------------------------------
    // Inject after <opaque_fragment> (which sets gl_FragColor), before tonemapping.
    if (water !== undefined) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <opaque_fragment>',
        [
          '#include <opaque_fragment>',
          '// --- P4 water: Fresnel-driven opacity (+ reflective sky tint) ---',
          'if (uWaterAnim > 0.5) {',
          '  vec3 Vdir = normalize(vViewPosition);',
          '  float ndv = clamp(dot(normalize(normal), Vdir), 0.0, 1.0);',
          '  float fres = pow(1.0 - ndv, 5.0);',
          '  const float FRESNEL_OPACITY = 0.5;',
          '  gl_FragColor.a = clamp(mix(diffuseColor.a, 1.0, fres * FRESNEL_OPACITY), 0.0, 1.0);',
          '  #ifdef WATER_REFLECTIVE',
          '    vec3 skyTint = vec3(0.55, 0.72, 0.95) * mix(' + NIGHT_SKY_FLOOR.toFixed(3) + ', 1.0, uDayNight);',
          '    const float REFLECT_STRENGTH = 0.6;',
          '    gl_FragColor.rgb = mix(gl_FragColor.rgb, skyTint, fres * REFLECT_STRENGTH);',
          '    gl_FragColor.a = clamp(mix(gl_FragColor.a, 1.0, fres * 0.35), 0.0, 1.0);',
          '  #endif',
          '}',
        ].join('\n'),
      );
    }
  };
}

/** Single shared opaque chunk material.
 * Baked vertex light drives diffuse; real sun specular is additive on top.
 * @param atlas - The texture atlas.
 * @param opts  - Optional material features; all default to off for backward-compat.
 */
export function createChunkMaterial(atlas: ITextureAtlas, opts: ChunkMaterialOptions = {}): THREE.Material {
  const useNormalMap = opts.normalMaps === true || opts.edgeRounding === EdgeRounding.NORMALMAP;
  const useAnalyticBevel = opts.edgeRounding === EdgeRounding.ANALYTIC;

  const matParams: THREE.MeshStandardMaterialParameters = {
    map: atlas.texture,
    side: THREE.DoubleSide,
    transparent: false,
    // Cutout for cross-quad foliage: discard fully-transparent texels.
    alphaTest: 0.5,
    vertexColors: true,
    roughnessMap: atlas.roughnessTexture,
    roughness: 1.0, // roughnessMap fully drives roughness
    metalness: 0.0,
    envMapIntensity: 0,
  };

  if (useNormalMap) {
    matParams.normalMap = atlas.normalTexture;
    matParams.normalScale = new THREE.Vector2(BEVEL_NORMAL_SCALE, BEVEL_NORMAL_SCALE);
  }

  const mat = new THREE.MeshStandardMaterial(matParams);

  if (useAnalyticBevel) {
    mat.defines = { ...mat.defines, ANALYTIC_BEVEL: '' };
  }

  patchChunkLighting(mat, undefined, opts.emissiveBloom === true);
  return mat;
}

/** Translucent water material; shares the atlas + same baked-light shader as opaque terrain.
 * Supports time-scrolled ripple (animated/reflective quality tiers) via `waterQuality`.
 * @param atlas - The texture atlas.
 * @param opts  - Optional material features; all default to off for backward-compat.
 */
export function createWaterMaterial(atlas: ITextureAtlas, opts: WaterMaterialOptions = {}): THREE.Material {
  const useNormalMap = opts.normalMaps === true || opts.edgeRounding === EdgeRounding.NORMALMAP;
  const useAnalyticBevel = opts.edgeRounding === EdgeRounding.ANALYTIC;

  const matParams: THREE.MeshStandardMaterialParameters = {
    map: atlas.texture,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    alphaTest: 0,
    vertexColors: true,
    roughnessMap: atlas.roughnessTexture,
    roughness: 1.0,
    metalness: 0.0,
    envMapIntensity: 0,
  };

  if (useNormalMap) {
    matParams.normalMap = atlas.normalTexture;
    matParams.normalScale = new THREE.Vector2(BEVEL_NORMAL_SCALE, BEVEL_NORMAL_SCALE);
  }

  const mat = new THREE.MeshStandardMaterial(matParams);

  if (useAnalyticBevel) {
    mat.defines = { ...mat.defines, ANALYTIC_BEVEL: '' };
  }

  const waterQuality = opts.waterQuality ?? WaterQuality.BASIC;
  const animated = waterQuality !== WaterQuality.BASIC;
  const reflective = waterQuality === WaterQuality.REFLECTIVE;

  if (reflective) {
    mat.defines = { ...mat.defines, WATER_REFLECTIVE: '' };
  }

  patchChunkLighting(mat, { animated });
  return mat;
}

/**
 * Push the current normalized daylight (0..1) into a material created by this module.
 * Safe no-op for any other material. Call each frame from the sky-update path.
 */
export function setChunkDaylight(material: THREE.Material, value: number): void {
  const holder = material.userData[DAYLIGHT_UNIFORM_KEY] as { value: number } | undefined;
  if (holder !== undefined) holder.value = value;
}

/** Push the running water animation time (seconds) into a water material. No-op for non-water materials. Call each frame when water is animated. */
export function setWaterTime(material: THREE.Material, seconds: number): void {
  const holder = material.userData[WATER_TIME_UNIFORM_KEY] as { value: number } | undefined;
  if (holder !== undefined) holder.value = seconds;
}

/** Toggle water surface animation live (basic <-> animated) without a shader recompile. No-op for non-water materials. */
export function setWaterAnimated(material: THREE.Material, on: boolean): void {
  const holder = material.userData[WATER_ANIM_UNIFORM_KEY] as { value: number } | undefined;
  if (holder !== undefined) holder.value = on ? 1 : 0;
}

/**
 * Toggle emissive block bloom on the solid chunk material without a shader recompile.
 * When `on`, strongly block-lit faces (torch / glowstone / lava level) emit past 1.0 HDR
 * so UnrealBloomPass blooms them. When `off`, uEmissiveBloom = 0 → term is exactly 0 (no-op).
 * No-op for non-chunk materials (e.g. water).
 */
export function setChunkEmissiveBloom(material: THREE.Material, on: boolean): void {
  const holder = material.userData[EMISSIVE_BLOOM_UNIFORM_KEY] as { value: number } | undefined;
  if (holder !== undefined) holder.value = on ? EMISSIVE_BLOOM_STRENGTH : 0.0;
}
