import * as THREE from 'three';

const MODES = ['chase', 'hood', 'cinematic'];

export class GameCamera {
  constructor(camera) {
    this.camera = camera;
    this.modeIndex = 0;
    this.distance = 9;
    this.minDistance = 5;
    this.maxDistance = 16;
    this.pos = new THREE.Vector3();
    this.lookAt = new THREE.Vector3();
    this.baseFov = 62;
    this.camera.fov = this.baseFov;

    window.addEventListener('wheel', (e) => {
      if (this.mode !== 'chase') return;
      this.distance = THREE.MathUtils.clamp(this.distance + e.deltaY * 0.01, this.minDistance, this.maxDistance);
    }, { passive: true });
  }

  get mode() {
    return MODES[this.modeIndex];
  }

  cycle() {
    this.modeIndex = (this.modeIndex + 1) % MODES.length;
  }

  snapTo(carGroup) {
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(carGroup.quaternion);
    this.pos.copy(carGroup.position).addScaledVector(forward, -this.distance).add(new THREE.Vector3(0, 3.5, 0));
    this.camera.position.copy(this.pos);
    this.lookAt.copy(carGroup.position);
    this.camera.lookAt(this.lookAt);
  }

  update(dt, carGroup, telemetry) {
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(carGroup.quaternion);
    const up = new THREE.Vector3(0, 1, 0);
    const speedT = THREE.MathUtils.clamp(telemetry.speedRatio, 0, 1);

    if (this.mode === 'hood') {
      const offset = new THREE.Vector3(0, 1.15, 0.4).applyQuaternion(carGroup.quaternion);
      const target = carGroup.position.clone().add(offset);
      this.camera.position.lerp(target, 1 - Math.pow(0.001, dt));
      const lookTarget = carGroup.position.clone().addScaledVector(forward, 10).add(new THREE.Vector3(0, 1.1, 0));
      this.lookAt.lerp(lookTarget, 1 - Math.pow(0.001, dt));
      this.camera.lookAt(this.lookAt);
    } else {
      const dist = this.mode === 'cinematic' ? this.distance * 1.7 : this.distance;
      const height = this.mode === 'cinematic' ? 4.6 : 3.2 + speedT * 0.6;
      const desired = carGroup.position.clone()
        .addScaledVector(forward, -dist)
        .addScaledVector(up, height);

      const smoothing = this.mode === 'cinematic' ? 0.08 : 0.16;
      const k = 1 - Math.pow(1 - smoothing, dt * 60);
      this.pos.lerp(desired, k);
      this.camera.position.copy(this.pos);

      const lookTarget = carGroup.position.clone().addScaledVector(forward, 3).add(new THREE.Vector3(0, 1, 0));
      this.lookAt.lerp(lookTarget, k);
      this.camera.lookAt(this.lookAt);
    }

    const targetFov = this.baseFov + speedT * 14;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 3);
    this.camera.updateProjectionMatrix();
  }
}
