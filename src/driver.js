import * as THREE from 'three';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

const MODEL_URL = './assets/models/driver/lowpoly-characters.fbx';
const TARGET_HEIGHT = 1.75;

// Rotation (radians, around the character's own local X axis) that takes the
// bind pose — arms relaxed at the sides — into a seated, hands-forward
// driving stance. Found empirically; there's no "steering" pose baked into
// the source file to build on.
const UPPER_ARM_SWING = -1.75;
const FOREARM_BEND = -0.75;
const STEER_WIGGLE_MAX = 0.5; // extra forearm rotation (radians) at full steering lock

let templatePromise = null;

async function loadTemplate() {
  if (templatePromise) return templatePromise;

  templatePromise = (async () => {
    const loader = new FBXLoader();
    const fbx = await loader.loadAsync(MODEL_URL);
    const mesh = fbx.getObjectByName('M-lowpoly');
    mesh.material = new THREE.MeshStandardMaterial({ color: 0x262a30, roughness: 0.75, metalness: 0.05 });
    mesh.castShadow = true;

    const bones = {
      upL: fbx.getObjectByName('DEFUpArmL'),
      upR: fbx.getObjectByName('DEFUpArmR'),
      armL: fbx.getObjectByName('DEFForArmL'),
      armR: fbx.getObjectByName('DEFForArmR'),
    };
    const bindQuat = {
      upL: bones.upL.quaternion.clone(),
      upR: bones.upR.quaternion.clone(),
      armL: bones.armL.quaternion.clone(),
      armR: bones.armR.quaternion.clone(),
    };
    const worldX = new THREE.Vector3(1, 0, 0);
    const swing = new THREE.Quaternion().setFromAxisAngle(worldX, UPPER_ARM_SWING);
    const bend = new THREE.Quaternion().setFromAxisAngle(worldX, FOREARM_BEND);
    bones.upL.quaternion.copy(bindQuat.upL).premultiply(swing);
    bones.upR.quaternion.copy(bindQuat.upR).premultiply(swing);
    bones.armL.quaternion.copy(bindQuat.armL).premultiply(bend);
    bones.armR.quaternion.copy(bindQuat.armR).premultiply(bend);
    const drivingQuat = {
      armL: bones.armL.quaternion.clone(),
      armR: bones.armR.quaternion.clone(),
    };

    const box = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3();
    box.getSize(size);
    const scale = TARGET_HEIGHT / size.y;

    const wrapper = new THREE.Group();
    wrapper.add(fbx);
    fbx.scale.setScalar(scale);
    fbx.position.set(-box.min.x * scale - (size.x * scale) / 2, -box.min.y * scale, -box.min.z * scale - (size.z * scale) / 2);
    wrapper.rotation.y = Math.PI; // bind pose faces away from the car's forward (+Z); turn it around

    return { wrapper, bones, drivingQuat };
  })();

  return templatePromise;
}

/**
 * Seats the driver in the given car group at an approximate seat position
 * (there's no real interior/seat reference per car, just the chassis box).
 * Returns an `update(steerRatio)` to call each frame so the forearms turn
 * with the current steering input — only one driver is ever active at a
 * time, so this reuses a single loaded instance rather than cloning a
 * skinned mesh (which needs SkeletonUtils to do correctly).
 */
export async function seatDriver(carGroup, def) {
  const { wrapper, bones, drivingQuat } = await loadTemplate();
  if (wrapper.parent) wrapper.parent.remove(wrapper);

  const { w, h, l } = def.dims;
  wrapper.position.set(-w * 0.15, -h * 0.72, -l * 0.03);
  carGroup.add(wrapper);

  const worldZ = new THREE.Vector3(0, 0, 1);
  const tmp = new THREE.Quaternion();
  return {
    update(steerRatio) {
      const angle = STEER_WIGGLE_MAX * THREE.MathUtils.clamp(steerRatio, -1, 1);
      tmp.setFromAxisAngle(worldZ, angle);
      bones.armL.quaternion.copy(drivingQuat.armL).premultiply(tmp);
      bones.armR.quaternion.copy(drivingQuat.armR).premultiply(tmp);
    },
  };
}
