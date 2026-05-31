import * as THREE from 'three';
import type { ITextureAtlas } from '../types';

/**
 * Patch a vertexColors MeshLambertMaterial so color.r = sky brightness (diffuse, day/night-dimmable)
 * and color.g = block light added as warm, scene-light-independent emissive.
 */
function patchChunkLighting(material: THREE.MeshLambertMaterial): void {
  material.onBeforeCompile = (shader) => {
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <color_fragment>', 'diffuseColor.rgb *= vColor.r;')
      .replace(
        '#include <emissivemap_fragment>',
        '#include <emissivemap_fragment>\n\ttotalEmissiveRadiance += vColor.g * vec3( 1.0, 0.82, 0.55 );',
      );
  };
}

/** Returns a single shared material for chunk meshes. Uses the atlas texture, lit by scene lights. */
export function createChunkMaterial(atlas: ITextureAtlas): THREE.Material {
  const mat = new THREE.MeshLambertMaterial({
    map: atlas.texture,
    side: THREE.DoubleSide,
    transparent: false,
    alphaTest: 0,
    vertexColors: true,
  });
  patchChunkLighting(mat);
  return mat;
}

/** Returns a translucent material for water surfaces. Shares the atlas texture with the opaque chunk material. */
export function createWaterMaterial(atlas: ITextureAtlas): THREE.Material {
  const mat = new THREE.MeshLambertMaterial({
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
