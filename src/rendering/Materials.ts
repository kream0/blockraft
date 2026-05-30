import * as THREE from 'three';
import type { ITextureAtlas } from '../types';

/** Returns a single shared material for chunk meshes. Uses the atlas texture, lit by scene lights. */
export function createChunkMaterial(atlas: ITextureAtlas): THREE.Material {
  return new THREE.MeshLambertMaterial({
    map: atlas.texture,
    side: THREE.DoubleSide,
    transparent: false,
    alphaTest: 0,
    vertexColors: true,
  });
}

/** Returns a translucent material for water surfaces. Shares the atlas texture with the opaque chunk material. */
export function createWaterMaterial(atlas: ITextureAtlas): THREE.Material {
  return new THREE.MeshLambertMaterial({
    map: atlas.texture,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
    alphaTest: 0,
    vertexColors: true,
  });
}
