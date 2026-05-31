import * as THREE from 'three';
import { BlockId, ItemId, type ITextureAtlas } from '../types';
import { isBlockItem } from '../items/ItemRegistry';
import { buildItemMesh } from '../items/ItemMesh';

/**
 * Off-screen renderer that rasterises a single item mesh into a transparent
 * PNG data-URL. Results are cached per ItemId so each icon is only rendered once.
 *
 * Usage:
 *   const renderer = new ItemIconRenderer(atlas);
 *   const url = renderer.getIcon(ItemId.WOODEN_PICKAXE);
 *   slotEl.style.backgroundImage = `url(${url})`;
 *   // on cleanup:
 *   renderer.dispose();
 */
export class ItemIconRenderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene: THREE.Scene;
  private readonly camera: THREE.OrthographicCamera;
  private readonly atlas: ITextureAtlas;
  private readonly cache = new Map<ItemId, string>();

  constructor(atlas: ITextureAtlas, size = 64) {
    this.atlas = atlas;

    // preserveDrawingBuffer is required so toDataURL() after render() is reliable.
    this.renderer = new THREE.WebGLRenderer({
      alpha: true,
      antialias: true,
      preserveDrawingBuffer: true,
    });
    this.renderer.setSize(size, size);
    this.renderer.setClearColor(0x000000, 0);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();

    // Ambient fill so all faces are visible.
    const ambient = new THREE.AmbientLight(0xffffff, 0.75);
    this.scene.add(ambient);

    // Directional key light for 3D readability.
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.7);
    dirLight.position.set(1, 1.5, 1);
    this.scene.add(dirLight);
    // dirLight.target defaults to the scene origin — correct for centered meshes.

    // Camera bounds are overridden per-item in getIcon(); placeholder values here.
    this.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.1, 100);
  }

  /**
   * Returns a data-URL PNG for the given item, rendering it on first call
   * and returning the cached result on subsequent calls.
   */
  getIcon(item: ItemId): string {
    const cached = this.cache.get(item);
    if (cached !== undefined) return cached;

    const mesh = buildItemMesh(item, this.atlas);

    // Choose camera framing depending on item type.
    if (isBlockItem(item) && item !== BlockId.TORCH) {
      // Corner/isometric view: top + two sides visible.
      this.camera.position.set(2, 2, 2);
      const d = 0.92;
      this.camera.left   = -d;
      this.camera.right  =  d;
      this.camera.top    =  d;
      this.camera.bottom = -d;
    } else {
      // Mostly-front view with slight top-right tilt so the diagonal tool
      // silhouette reads clearly.
      this.camera.position.set(0.5, 0.3, 2.5);
      const d = 0.6;
      this.camera.left   = -d;
      this.camera.right  =  d;
      this.camera.top    =  d;
      this.camera.bottom = -d;
    }

    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();

    this.scene.add(mesh);
    this.renderer.render(this.scene, this.camera);
    const url = this.renderer.domElement.toDataURL();
    this.scene.remove(mesh);

    // Dispose the mesh's own geometry + materials; do NOT dispose atlas.texture
    // (it is shared and must outlive this render).
    this.disposeMesh(mesh);

    this.cache.set(item, url);
    return url;
  }

  /** Traverse and free GPU resources for geometry and materials (not textures). */
  private disposeMesh(obj: THREE.Object3D): void {
    obj.traverse(o => {
      if (o instanceof THREE.Mesh) {
        o.geometry.dispose();
        const m = o.material;
        if (Array.isArray(m)) {
          m.forEach(x => x.dispose());
        } else {
          m.dispose();
        }
      }
    });
  }

  /**
   * Releases the offscreen WebGL context and clears the icon cache.
   * Call this when the game session ends to avoid leaking WebGL contexts.
   */
  dispose(): void {
    this.renderer.forceContextLoss();
    this.renderer.dispose();
    this.cache.clear();
  }
}
