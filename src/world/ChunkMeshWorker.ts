import type { WorkerInitMsg, ChunkMeshRequest, ChunkMeshResult, MeshBuffers } from '../types';
import { buildChunkMeshBuffers } from './chunkMeshCore';

let blockTable: WorkerInitMsg['blockTable'] | null = null;
let atlasParams: WorkerInitMsg['atlasParams'] | null = null;

function buffersTransferList(b: MeshBuffers): ArrayBuffer[] {
  return [
    b.positions.buffer as ArrayBuffer,
    b.normals.buffer as ArrayBuffer,
    b.uvs.buffer as ArrayBuffer,
    b.colors.buffer as ArrayBuffer,
    b.indices.buffer as ArrayBuffer,
  ];
}

self.addEventListener('message', (e: MessageEvent<WorkerInitMsg | ChunkMeshRequest>): void => {
  const msg = e.data;
  if (msg.type === 'init') {
    blockTable = msg.blockTable;
    atlasParams = msg.atlasParams;
    return;
  }
  // msg.type === 'mesh_request'
  if (blockTable === null || atlasParams === null) return;
  const { solid, water } = buildChunkMeshBuffers(msg.cx, msg.cz, msg.halo, msg.lightHalo, blockTable, atlasParams);
  const response: ChunkMeshResult = {
    type: 'mesh_result',
    cx: msg.cx,
    cz: msg.cz,
    version: msg.version,
    solid,
    water,
  };
  const transfer: ArrayBuffer[] = buffersTransferList(solid);
  if (water !== null) transfer.push(...buffersTransferList(water));
  (self as unknown as Worker).postMessage(response, transfer);
});
