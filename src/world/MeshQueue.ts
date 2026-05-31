import * as THREE from 'three';
import {
  MESH_WORKER_CONCURRENCY,
  MESH_UPLOAD_PER_FRAME,
  type WorkerInitMsg,
  type ChunkMeshRequest,
  type ChunkMeshResult,
  type MeshBuffers,
} from '../types';

export function buildGeometryFromBuffers(buffers: MeshBuffers): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(buffers.positions, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(buffers.normals, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(buffers.uvs, 2));
  g.setAttribute('color', new THREE.BufferAttribute(buffers.colors, 3));
  g.setIndex(new THREE.BufferAttribute(buffers.indices, 1));
  g.computeBoundingSphere();
  return g;
}

export type MeshUploadCallback = (result: ChunkMeshResult) => void;

export class MeshQueue {
  private worker: Worker;
  private queue: ChunkMeshRequest[] = [];
  private results: ChunkMeshResult[] = [];
  private inFlight = 0;
  private onUpload: MeshUploadCallback;

  constructor(initMsg: WorkerInitMsg, onUpload: MeshUploadCallback) {
    this.onUpload = onUpload;
    this.worker = new Worker(new URL('./ChunkMeshWorker.ts', import.meta.url), { type: 'module' });
    this.worker.onmessage = (e: MessageEvent<ChunkMeshResult>): void => {
      this.inFlight--;
      this.results.push(e.data);
    };
    this.worker.postMessage(initMsg);
  }

  enqueue(req: ChunkMeshRequest): void {
    this.queue.push(req);
  }

  cancelChunk(cx: number, cz: number): void {
    this.queue = this.queue.filter((r) => r.cx !== cx || r.cz !== cz);
  }

  tick(): void {
    while (this.inFlight < MESH_WORKER_CONCURRENCY && this.queue.length > 0) {
      const req = this.queue.shift()!;
      this.inFlight++;
      this.worker.postMessage(req, [req.halo.buffer, req.lightHalo.buffer]);
    }

    let uploaded = 0;
    while (uploaded < MESH_UPLOAD_PER_FRAME && this.results.length > 0) {
      const res = this.results.shift()!;
      this.onUpload(res);
      uploaded++;
    }
  }

  dispose(): void {
    this.worker.terminate();
    this.queue = [];
    this.results = [];
    this.inFlight = 0;
  }
}
