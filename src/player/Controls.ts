import { InputState, type Keybindings, type KeyBindableAction, KEYBINDABLE_ACTIONS, DEFAULT_KEYBINDINGS } from '../types';

const PITCH_LIMIT = Math.PI / 2 - 0.001;
const DOUBLE_TAP_SPRINT_MS = 300;

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
  /** Current action→code map. Swapped live via setKeybindings (usually from Settings). */
  keybindings: Keybindings = { ...DEFAULT_KEYBINDINGS };

  private domElement: HTMLElement;

  private sprintFromKey = false;
  private sprintFromDoubleTap = false;
  private forwardHeld = false;
  private lastForwardTapMs = 0;

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
      const action = this.codeToAction(e.code);
      if (action === null) return;
      if (action === 'forward') {
        if (!this.forwardHeld) {
          const now = performance.now();
          if (now - this.lastForwardTapMs <= DOUBLE_TAP_SPRINT_MS) {
            this.sprintFromDoubleTap = true;
            this.updateSprint();
          }
          this.lastForwardTapMs = now;
        }
        this.forwardHeld = true;
      }
      if (this.applyAction(action, true) && action === 'jump') e.preventDefault();
    };

    this.onKeyUp = (e: KeyboardEvent): void => {
      const action = this.codeToAction(e.code);
      if (action === null) return;
      if (action === 'forward') {
        this.forwardHeld = false;
        this.sprintFromDoubleTap = false;
        this.updateSprint();
      }
      if (this.applyAction(action, false) && action === 'jump') e.preventDefault();
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
        this.sprintFromKey = false;
        this.sprintFromDoubleTap = false;
        this.forwardHeld = false;
        this.lastForwardTapMs = 0;
      }
    };

    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('mousemove', this.onMouseMove);
    this.domElement.addEventListener('click', this.onClick);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
  }

  /** Compose both sprint sources into the shared input flag. */
  private updateSprint(): void {
    this.input.sprint = this.sprintFromKey || this.sprintFromDoubleTap;
  }

  /** Reverse lookup: which bound action (if any) owns this physical code. */
  private codeToAction(code: string): KeyBindableAction | null {
    for (const action of KEYBINDABLE_ACTIONS) {
      if (this.keybindings[action] === code) return action;
    }
    return null;
  }

  /**
   * Apply a pressed/released action to the input state.
   * Returns true if this is a movement action Controls owns (so the caller knows
   * whether to preventDefault). 'inventory' is owned by GameSession, not Controls —
   * it is intentionally ignored here.
   */
  private applyAction(action: KeyBindableAction, pressed: boolean): boolean {
    switch (action) {
      case 'forward':   this.input.forward = pressed; return true;
      case 'back':      this.input.back = pressed;    return true;
      case 'left':      this.input.left = pressed;    return true;
      case 'right':     this.input.right = pressed;   return true;
      case 'jump':      this.input.jump = pressed;    return true;
      case 'sprint':    this.sprintFromKey = pressed; this.updateSprint(); return true;
      case 'inventory': return false;
    }
  }

  /** Set the user-tunable multiplier (usually `Settings.mouseSensitivity`). */
  setSensitivityScale(scale: number): void {
    this.sensitivityScale = scale;
  }

  /** Toggle inverted vertical look. */
  setInvertY(b: boolean): void {
    this.invertY = b;
  }

  /** Swap the active keybindings (usually from Settings). */
  setKeybindings(kb: Keybindings): void {
    this.keybindings = kb;
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
