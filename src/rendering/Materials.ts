import * as THREE from 'three';
import type { ITextureAtlas } from '../types';

/** Darkest the open sky gets at deep night, so nights stay navigable instead of pure black. */
const NIGHT_SKY_FLOOR = 0.15;
/** userData key under which each patched material stashes its live day/night uniform holder. */
const DAYLIGHT_UNIFORM_KEY = 'blockraftDaylight';

/**
 * Patch a vertexColors MeshBasicMaterial so the BAKED voxel light is authoritative.
 * Baked channels (from the mesher):
 *   color.r = faceShade * AO * skyBrightness   (sky light; dimmed by day/night here)
 *   color.g = faceShade * AO * blockBrightness (torch/emitter light; day-independent)
 * Final brightness = max(sky, block): block light only "wins" where sky light is low (caves,
 * night), so torches NEVER tint surfaces already in full daylight. A warm tint is mixed in only
 * in proportion to how much block light exceeds sky light. Because MeshBasicMaterial is UNLIT,
 * the scene's directional + ambient lights never touch terrain, so light cannot leak through walls.
 *
 * Shadow support: Three's shadow includes are injected via onBeforeCompile. MeshBasicMaterial's
 * vertex shader only computes normals inside USE_ENVMAP/USE_SKINNING, so we inject
 * <beginnormal_vertex> + <defaultnormal_vertex> unconditionally (guarded to avoid a double-define
 * under envmap) before <shadowmap_vertex>. The fragment shader multiplies ONLY the sky-lit term
 * by the shadow factor, scaled by daylight — block/torch light is never shadowed.
 */
function patchChunkLighting(material: THREE.MeshBasicMaterial): void {
  const daylight = { value: 1 };
  material.userData[DAYLIGHT_UNIFORM_KEY] = daylight;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uDayNight = daylight;

    // --- Vertex shader: inject shadow coordinate computation ---
    // 1. Add shadow pars after fog pars (both declare varyings, order matters for unrolling).
    shader.vertexShader = shader.vertexShader.replace(
      '#include <fog_pars_vertex>',
      '#include <fog_pars_vertex>\n#include <shadowmap_pars_vertex>',
    );
    // 2. Before fog_vertex: compute normals (not done unconditionally by MeshBasicMaterial —
    //    only done inside USE_ENVMAP || USE_SKINNING), then compute the shadow coords.
    //    Guard with #ifndef USE_ENVMAP so we don't re-declare objectNormal/transformedNormal.
    shader.vertexShader = shader.vertexShader.replace(
      '#include <fog_vertex>',
      [
        '#ifndef USE_ENVMAP',
        '  #include <beginnormal_vertex>',
        '  #include <defaultnormal_vertex>',
        '#endif',
        '#include <shadowmap_vertex>',
        '#include <fog_vertex>',
      ].join('\n'),
    );

    // --- Fragment shader: add shadow machinery + apply to skyLit ---
    // 1. Inject packing + shadow pars immediately after <common> (common must precede them).
    //    uDayNight + receiveShadow are declared here (MeshBasic doesn't auto-declare receiveShadow).
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      [
        '#include <common>',
        '#include <packing>',
        // getShadowMask() (in shadowmask_pars_fragment) references receiveShadow; GLSL is
        // single-pass, so both uniforms must be declared BEFORE that include or they're undeclared.
        'uniform float uDayNight;',
        'uniform bool receiveShadow;',
        '#include <shadowmap_pars_fragment>',
        '#include <shadowmask_pars_fragment>',
      ].join('\n'),
    );
    // 2. Replace <color_fragment> with shadow-aware sky/block lighting.
    //    Shadow is applied ONLY to the sky-lit channel, scaled by daylight so nights are unaffected.
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      [
        '#ifdef USE_COLOR',
        '#ifdef USE_SHADOWMAP',
        '\tfloat shadow = getShadowMask();',
        '\tconst float SHADOW_MIN = 0.35;',
        '\tfloat shadowScale = mix(1.0, SHADOW_MIN, (1.0 - shadow) * uDayNight);',
        '#else',
        '\tfloat shadowScale = 1.0;',
        '#endif',
        '\tfloat skyLit = vColor.r * mix(' + NIGHT_SKY_FLOOR.toFixed(3) + ', 1.0, uDayNight) * shadowScale;',
        '\tfloat blockLit = vColor.g;',
        '\tfloat lum = max(skyLit, blockLit);',
        '\tfloat warmth = clamp((blockLit - skyLit) * 1.5, 0.0, 1.0);',
        '\tvec3 warmTint = mix(vec3(1.0), vec3(1.0, 0.82, 0.55), warmth);',
        '\tdiffuseColor.rgb *= lum * warmTint;',
        '#endif',
      ].join('\n'),
    );
  };
}

/** Single shared opaque chunk material. Unlit; brightness comes from baked vertex light + uDayNight. */
export function createChunkMaterial(atlas: ITextureAtlas): THREE.Material {
  const mat = new THREE.MeshBasicMaterial({
    map: atlas.texture,
    side: THREE.DoubleSide,
    transparent: false,
    // Cutout for cross-quad foliage: discard fully-transparent texels. Safe — every cube tile is
    // fully opaque (alpha 255), so only foliage's transparent background is ever discarded.
    alphaTest: 0.5,
    vertexColors: true,
  });
  patchChunkLighting(mat);
  return mat;
}

/** Translucent water material; shares the atlas + same baked-light shader as opaque terrain. */
export function createWaterMaterial(atlas: ITextureAtlas): THREE.Material {
  const mat = new THREE.MeshBasicMaterial({
    map: atlas.texture,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    alphaTest: 0,
    vertexColors: true,
  });
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
