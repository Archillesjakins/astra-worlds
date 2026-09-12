import * as THREE from 'three';

/**
 * Pointer-lock first-person controls with WASD + mouse look.
 * Space / Shift for up/down (useful on uneven ground).
 */
export class FPSControls {
  readonly object = new THREE.Object3D();
  private readonly euler = new THREE.Euler(0, 0, 0, 'YXZ');
  private readonly velocity = new THREE.Vector3();
  private readonly direction = new THREE.Vector3();
  private readonly keys = new Set<string>();
  private locked = false;
  private readonly dom: HTMLElement;
  private readonly eyeHeight: number;
  private readonly onLockChange: () => void;
  private readonly onMouseMove: (e: MouseEvent) => void;
  private readonly onKeyDown: (e: KeyboardEvent) => void;
  private readonly onKeyUp: (e: KeyboardEvent) => void;
  private readonly onClick: () => void;

  constructor(camera: THREE.Camera, domElement: HTMLElement, eyeHeight = 1.7) {
    this.dom = domElement;
    this.eyeHeight = eyeHeight;
    this.object.add(camera);
    camera.position.set(0, 0, 0);

    this.onLockChange = () => {
      this.locked = document.pointerLockElement === this.dom;
    };
    this.onMouseMove = (e: MouseEvent) => {
      if (!this.locked) return;
      const sens = 0.0022;
      this.euler.setFromQuaternion(this.object.quaternion);
      this.euler.y -= e.movementX * sens;
      this.euler.x -= e.movementY * sens;
      this.euler.x = Math.max(-Math.PI / 2 + 0.05, Math.min(Math.PI / 2 - 0.05, this.euler.x));
      this.object.quaternion.setFromEuler(this.euler);
    };
    this.onKeyDown = (e: KeyboardEvent) => this.keys.add(e.code);
    this.onKeyUp = (e: KeyboardEvent) => this.keys.delete(e.code);
    this.onClick = () => {
      if (!this.locked) this.dom.requestPointerLock();
    };

    document.addEventListener('pointerlockchange', this.onLockChange);
    document.addEventListener('mousemove', this.onMouseMove);
    document.addEventListener('keydown', this.onKeyDown);
    document.addEventListener('keyup', this.onKeyUp);
    this.dom.addEventListener('click', this.onClick);
  }

  setPosition(x: number, y: number, z: number): void {
    this.object.position.set(x, y + this.eyeHeight, z);
  }

  /** Yaw in radians (Three.js Y rotation). Syncs internal look euler. */
  setYaw(yaw: number): void {
    this.euler.set(0, yaw, 0);
    this.object.quaternion.setFromEuler(this.euler);
  }

  get isLocked(): boolean {
    return this.locked;
  }

  update(dt: number, groundY = 0): void {
    const accel = 18;
    const maxSpeed = 8;
    const damping = Math.exp(-6 * dt);

    this.direction.set(0, 0, 0);
    if (this.keys.has('KeyW') || this.keys.has('ArrowUp')) this.direction.z -= 1;
    if (this.keys.has('KeyS') || this.keys.has('ArrowDown')) this.direction.z += 1;
    if (this.keys.has('KeyA') || this.keys.has('ArrowLeft')) this.direction.x -= 1;
    if (this.keys.has('KeyD') || this.keys.has('ArrowRight')) this.direction.x += 1;
    if (this.keys.has('Space')) this.direction.y += 1;
    if (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight')) this.direction.y -= 1;

    if (this.direction.lengthSq() > 0) {
      this.direction.normalize();
      // Move relative to yaw only
      const yaw = this.euler.y;
      const forward = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw));
      const right = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw));
      this.velocity.addScaledVector(forward, this.direction.z * -accel * dt);
      this.velocity.addScaledVector(right, this.direction.x * accel * dt);
      this.velocity.y += this.direction.y * accel * dt;
    }

    this.velocity.x *= damping;
    this.velocity.z *= damping;
    this.velocity.y *= damping;

    const speed = Math.hypot(this.velocity.x, this.velocity.z);
    if (speed > maxSpeed) {
      const s = maxSpeed / speed;
      this.velocity.x *= s;
      this.velocity.z *= s;
    }

    this.object.position.addScaledVector(this.velocity, dt);
    // Soft floor
    const minY = groundY + this.eyeHeight;
    if (this.object.position.y < minY) {
      this.object.position.y = minY;
      this.velocity.y = Math.max(0, this.velocity.y);
    }
  }

  dispose(): void {
    document.removeEventListener('pointerlockchange', this.onLockChange);
    document.removeEventListener('mousemove', this.onMouseMove);
    document.removeEventListener('keydown', this.onKeyDown);
    document.removeEventListener('keyup', this.onKeyUp);
    this.dom.removeEventListener('click', this.onClick);
    if (document.pointerLockElement === this.dom) document.exitPointerLock();
    this.keys.clear();
  }
}
