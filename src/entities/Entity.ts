import * as THREE from 'three';
import type { IEntity, EntityKind, IWorld, Vec3 } from '../types';

/**
 * Abstract base for all entities. Provides id/kind/transform fields and a default
 * update that syncs the optional Three.js representation. EntityManager owns id
 * assignment and scene attachment; subclasses focus on behavior.
 */
export abstract class Entity implements IEntity {
  /** Set by EntityManager.spawn(); 0 means not yet spawned. */
  id: number = 0;
  readonly kind: EntityKind;
  position: Vec3;
  velocity: Vec3 = { x: 0, y: 0, z: 0 };
  yaw: number = 0;
  pitch: number = 0;
  /** Optional Three.js representation. EntityManager handles add/remove from scene. */
  readonly object3D: THREE.Object3D | null;

  constructor(
    kind: EntityKind,
    position: Vec3,
    object3D: THREE.Object3D | null = null,
  ) {
    this.kind = kind;
    this.position = { x: position.x, y: position.y, z: position.z };
    this.object3D = object3D;
  }

  /**
   * Default: copies position/yaw to object3D if present. Subclasses can override
   * but should call super.update() to keep the visual in sync.
   * Pitch is intentionally ignored here; camera-driven entities (e.g. local player)
   * handle pitch separately. Mob/RemotePlayer meshes only rotate around Y.
   */
  update(_dt: number, _world: IWorld): void {
    if (this.object3D !== null) {
      this.object3D.position.set(this.position.x, this.position.y, this.position.z);
      this.object3D.rotation.set(0, this.yaw, 0);
    }
  }

  /**
   * Default: disposes geometries and materials of any THREE.Mesh in the object3D
   * subtree. Textures are not disposed — they are shared via the atlas.
   */
  dispose(): void {
    if (this.object3D === null) return;
    this.object3D.traverse((obj: THREE.Object3D) => {
      if (obj instanceof THREE.Mesh) {
        const mesh = obj as THREE.Mesh;
        mesh.geometry.dispose();
        const mat = mesh.material;
        if (Array.isArray(mat)) {
          for (const m of mat) {
            m.dispose();
          }
        } else {
          mat.dispose();
        }
      }
    });
  }
}
