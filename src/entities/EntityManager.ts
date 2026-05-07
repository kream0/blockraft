import * as THREE from 'three';
import type { IEntity, IEntityManager, IWorld } from '../types';

/**
 * Owns the lifecycle of all non-player entities: id assignment, scene attachment,
 * per-tick updates, and disposal. World.update() should call update(); World
 * unload should call clear().
 */
export class EntityManager implements IEntityManager {
  private entities = new Map<number, IEntity>();
  private nextId: number = 1;
  private group: THREE.Group;

  constructor(group: THREE.Group) {
    this.group = group;
  }

  spawn(entity: IEntity): number {
    const assigned = this.nextId++;
    entity.id = assigned;
    if (entity.object3D !== null) {
      this.group.add(entity.object3D);
    }
    this.entities.set(assigned, entity);
    return assigned;
  }

  despawn(id: number): void {
    const entity = this.entities.get(id);
    if (entity === undefined) return;
    if (entity.object3D !== null) {
      this.group.remove(entity.object3D);
    }
    entity.dispose();
    this.entities.delete(id);
  }

  get(id: number): IEntity | undefined {
    return this.entities.get(id);
  }

  get all(): ReadonlyArray<IEntity> {
    return Array.from(this.entities.values());
  }

  update(dt: number, world: IWorld): void {
    // Snapshot so an entity that despawns another (or itself) during update
    // doesn't break iteration.
    const snapshot = Array.from(this.entities.values());
    for (const entity of snapshot) {
      try {
        entity.update(dt, world);
      } catch (err) {
        console.error(`Entity ${entity.id} (${entity.kind}) update failed:`, err);
      }
    }
  }

  clear(): void {
    const ids = Array.from(this.entities.keys());
    for (const id of ids) {
      this.despawn(id);
    }
  }
}
