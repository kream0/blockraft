import * as THREE from 'three';
import type { ITextureAtlas } from '../types';
import { EdgeRounding } from '../types';

/** Darkest the open sky gets at deep night, so nights stay navigable instead of pure black. */
const NIGHT_SKY_FLOOR = 0.15;
/** userData key under which each patched material stashes its live day/night uniform holder. */
const DAYLIGHT_UNIFORM_KEY = 'blockraftDaylight';
/** Normal-map bevel strength: how prominently the per-tile normal map tilts the surface. */
const BEVEL_NORMAL_SCALE = 0.6;

/** Options for chunk/water material creation. All fields are optional; defaults match legacy behaviour (no normal map, no analytic bevel). */
export interface ChunkMaterialOptions {
  normalMaps?: boolean;
  edgeRounding?: EdgeRounding;
}

/**
 * Patch a vertexColors MeshStandardMaterial so BAKED voxel light is authoritative for
 * diffuse, while the real scene DirectionalLight drives specular highlights only.
 *
 * Baked channels (from the mesher):
 *   vColor.r = faceShade * AO * skyBrightness   (sky light; dimmed by day/night here)
 *   vColor.g = faceShade * AO * blockBrightness (torch/emitter light; day-independent)
 *
 * Final brightness = max(sky, block).  A warm tint is mixed in only where block light
 * exceeds sky light.  Because we zero out reflectedLight.directDiffuse /
 * reflectedLight.indirectDiffuse and replace them with our baked term, the scene's
 * Directional + Ambient lights never contribute diffuse to terrain — no through-wall
 * light leak.  directSpecular is left intact so the sun produces a physically-plausible
 * specular glint shaped by roughnessMap / normalMap.
 *
 * Shadow support: shadow is sampled from getShadowMask() and applied ONLY to the sky
 * channel, scaled by daylight — block/torch light is never shadowed, and night surfaces
 * are unaffected because shadowScale mixes toward 1.0 as uDayNight → 0.
 *
 * MeshStandardMaterial NOTE: the physical fragment preamble already pulls in <packing> and
 * <shadowmap_pars_fragment> (getShadow + shadow uniforms) but NOT <shadowmask_pars_fragment>,
 * the chunk that defines getShadowMask().  We therefore (a) inject our uDayNight uniform +
 * ANALYTIC_BEVEL varying after <common>, and (b) inject <shadowmask_pars_fragment> right
 * after <shadowmap_pars_fragment> so getShadowMask() is defined with all its dependencies in
 * scope.  We do NOT re-inject <packing> (already present; re-including would double-define it).
 */
function patchChunkLighting(material: THREE.MeshStandardMaterial): void {
  const daylight = { value: 1 };
  material.userData[DAYLIGHT_UNIFORM_KEY] = daylight;

  material.onBeforeCompile = (shader) => {
    shader.uniforms['uDayNight'] = daylight;

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
      ].join('\n'),
    );

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

    // The injection point is AFTER <roughnessmap_fragment> and <normal_fragment_maps>,
    // just BEFORE <lights_fragment_begin>.
    // In Three 0.160's meshphysical_frag.glsl the order is:
    //   ... roughnessmap_fragment ... normal_fragment_maps ... lights_physical_pars_fragment ...
    //   lights_fragment_begin ... lights_fragment_maps ... lights_fragment_end ...
    // We target <lights_fragment_begin> and prepend before it.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_begin>',
      bakedDiffuseBlock + '\n#include <lights_fragment_begin>',
    );

    // -------------------------------------------------------------------------
    // FRAGMENT SHADER — step 4: replace diffuse with baked term; keep specular
    // -------------------------------------------------------------------------
    // After <lights_fragment_end> the reflectedLight struct is fully accumulated.
    // We zero out both diffuse channels and substitute our baked term, then leave
    // directSpecular intact for the sun glint.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <lights_fragment_end>',
      [
        '#include <lights_fragment_end>',
        '// blockraft: override diffuse with baked voxel lighting; keep sun specular only',
        'reflectedLight.directDiffuse   = vec3(0.0);',
        'reflectedLight.indirectDiffuse = bakedDiffuse;',
        'reflectedLight.indirectSpecular = vec3(0.0);',
        '// reflectedLight.directSpecular is left intact — that is the sun specular glint',
      ].join('\n'),
    );
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

  patchChunkLighting(mat);
  return mat;
}

/** Translucent water material; shares the atlas + same baked-light shader as opaque terrain.
 * @param atlas - The texture atlas.
 * @param opts  - Optional material features; all default to off for backward-compat.
 */
export function createWaterMaterial(atlas: ITextureAtlas, opts: ChunkMaterialOptions = {}): THREE.Material {
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

  patchChunkLighting(mat);
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
