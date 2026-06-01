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
 */
function patchChunkLighting(material: THREE.MeshBasicMaterial): void {
  const daylight = { value: 1 };
  material.userData[DAYLIGHT_UNIFORM_KEY] = daylight;
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uDayNight = daylight;
    shader.fragmentShader = 'uniform float uDayNight;\n' + shader.fragmentShader.replace(
      '#include <color_fragment>',
      [
        '#ifdef USE_COLOR',
        '\tfloat skyLit = vColor.r * mix(' + NIGHT_SKY_FLOOR.toFixed(3) + ', 1.0, uDayNight);',
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
