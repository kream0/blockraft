import * as THREE from 'three';
import { Entity } from './Entity';
import { EntityKind, PLAYER_HEIGHT, PLAYER_RADIUS, type Vec3 } from '../types';

/**
 * Visual-only entity representing another player (multiplayer foundation).
 * No physics, no AI; position/yaw are set externally by network sync. The
 * mesh's origin sits at the entity's feet (y = 0 local).
 */
export class RemotePlayer extends Entity {
  readonly displayName: string;

  constructor(position: Vec3, displayName: string) {
    const mesh = RemotePlayer.buildMesh();
    super(EntityKind.REMOTE_PLAYER, position, mesh);
    this.displayName = displayName;
  }

  private static buildMesh(): THREE.Group {
    const group = new THREE.Group();

    const bodyGeo = new THREE.BoxGeometry(
      PLAYER_RADIUS * 2,
      PLAYER_HEIGHT * 0.6,
      PLAYER_RADIUS * 1.2,
    );
    const bodyMat = new THREE.MeshLambertMaterial({ color: 0x6cc24a });
    const body = new THREE.Mesh(bodyGeo, bodyMat);
    body.position.set(0, PLAYER_HEIGHT * 0.3, 0);
    group.add(body);

    const headGeo = new THREE.BoxGeometry(0.5, 0.5, 0.5);
    const headMat = new THREE.MeshLambertMaterial({ color: 0xf0c298 });
    const head = new THREE.Mesh(headGeo, headMat);
    head.position.set(0, PLAYER_HEIGHT * 0.6 + 0.25, 0);
    group.add(head);

    return group;
  }
}
