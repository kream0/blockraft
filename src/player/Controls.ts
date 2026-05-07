import { InputState } from '../types';

const PITCH_LIMIT = Math.PI / 2 - 0.001;

export class Controls {
  input: InputState;
  /** True when pointer lock is active. */
  isLocked: boolean;
  /** Base sensitivity multiplier (radians per pixel of mouse movement). */
  sensitivity: number = 0.002;
  /** User-tunable multiplier on top of `sensitivity` (typically from Settings.mouseSensitivity). */
  sensitivityScale: number = 1;
  /** When true, vertical mouse movement increases pitch instead of decreasing it. */
  invertY: boolean = false;

  private domElement: HTMLElement;

  private onKeyDown: (e: KeyboardEvent) => void;
  private onKeyUp: (e: KeyboardEvent) => void;
  private onMouseMove: (e: MouseEvent) => void;
  private onClick: () => void;
  private onPointerLockChange: () => void;

  constructor(domElement: HTMLElement) {
    this.domElement = domElement;
    this.isLocked = false;
    this.input = {
      forward: false,
      back: false,
      left: false,
      right: false,
      jump: false,
      sprint: false,
      yaw: 0,
      pitch: 0,
    };

    this.onKeyDown = (e: KeyboardEvent): void => {
      switch (e.code) {
        case 'KeyW':
          this.input.forward = true;
          break;
        case 'KeyS':
          this.input.back = true;
          break;
        case 'KeyA':
          this.input.left = true;
          break;
        case 'KeyD':
          this.input.right = true;
          break;
        case 'Space':
          this.input.jump = true;
          e.preventDefault();
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.input.sprint = true;
          break;
      }
    };

    this.onKeyUp = (e: KeyboardEvent): void => {
      switch (e.code) {
        case 'KeyW':
          this.input.forward = false;
          break;
        case 'KeyS':
          this.input.back = false;
          break;
        case 'KeyA':
          this.input.left = false;
          break;
        case 'KeyD':
          this.input.right = false;
          break;
        case 'Space':
          this.input.jump = false;
          e.preventDefault();
          break;
        case 'ShiftLeft':
        case 'ShiftRight':
          this.input.sprint = false;
          break;
      }
    };

    this.onMouseMove = (e: MouseEvent): void => {
      if (!this.isLocked) return;
      const rate = this.sensitivity * this.sensitivityScale;
      this.input.yaw -= e.movementX * rate;
      this.input.pitch -= e.movementY * rate * (this.invertY ? -1 : 1);
      if (this.input.pitch > PITCH_LIMIT) this.input.pitch = PITCH_LIMIT;
      if (this.input.pitch < -PITCH_LIMIT) this.input.pitch = -PITCH_LIMIT;
    };

    this.onClick = (): void => {
      if (!this.isLocked) {
        this.lock();
      }
    };

    this.onPointerLockChange = (): void => {
      this.isLocked = document.pointerLockElement === this.domElement;
      if (!this.isLocked) {
        this.input.forward = false;
        this.input.back = false;
        this.input.left = false;
        this.input.right = false;
        this.input.jump = false;
        this.input.sprint = false;
      }
    };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    this.domElement.addEventListener('click', this.onClick);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
  }

  /** Set the user-tunable multiplier (usually `Settings.mouseSensitivity`). */
  setSensitivityScale(scale: number): void {
    this.sensitivityScale = scale;
  }

  /** Toggle inverted vertical look. */
  setInvertY(b: boolean): void {
    this.invertY = b;
  }

  /** Request pointer lock on the dom element (call from a click handler). */
  lock(): void {
    if (document.pointerLockElement !== this.domElement) {
      this.domElement.requestPointerLock();
    }
  }

  /** Release pointer lock. */
  unlock(): void {
    if (document.pointerLockElement === this.domElement) {
      document.exitPointerLock();
    }
  }

  /** Detach all listeners. */
  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('mousemove', this.onMouseMove);
    this.domElement.removeEventListener('click', this.onClick);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
  }
}
