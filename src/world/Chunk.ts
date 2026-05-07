import * as THREE from 'three';
import { BlockId, CHUNK_HEIGHT, CHUNK_SIZE } from '../types';

export class Chunk {
  readonly cx: number;
  readonly cz: number;
  readonly blocks: Uint8Array;
  mesh: THREE.Mesh | null = null;
  waterMesh: THREE.Mesh | null = null;
  dirty = true;

  constructor(cx: number, cz: number, generator?: (chunk: Chunk) => void) {
    this.cx = cx;
    this.cz = cz;
    this.blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
    if (generator) {
      generator(this);
    }
  }

  /** Local-coords linear index. x,z in [0, CHUNK_SIZE), y in [0, CHUNK_HEIGHT). */
  static idx(x: number, y: number, z: number): number {
    return x + z * CHUNK_SIZE + y * CHUNK_SIZE * CHUNK_SIZE;
  }

  getBlock(lx: number, ly: number, lz: number): BlockId {
    if (
      lx < 0 ||
      lx >= CHUNK_SIZE ||
      ly < 0 ||
      ly >= CHUNK_HEIGHT ||
      lz < 0 ||
      lz >= CHUNK_SIZE
    ) {
      return BlockId.AIR;
    }
    return (this.blocks[Chunk.idx(lx, ly, lz)] ?? BlockId.AIR) as BlockId;
  }

  setBlock(lx: number, ly: number, lz: number, id: BlockId): void {
    if (
      lx < 0 ||
      lx >= CHUNK_SIZE ||
      ly < 0 ||
      ly >= CHUNK_HEIGHT ||
      lz < 0 ||
      lz >= CHUNK_SIZE
    ) {
      return;
    }
    this.blocks[Chunk.idx(lx, ly, lz)] = id;
    this.dirty = true;
  }

  dispose(): void {
    if (this.mesh) {
      this.mesh.geometry.dispose();
      this.mesh = null;
    }
    if (this.waterMesh) {
      this.waterMesh.geometry.dispose();
      this.waterMesh = null;
    }
  }
}
