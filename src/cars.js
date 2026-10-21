import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';
import { FBXLoader } from 'three/addons/loaders/FBXLoader.js';

export const CATEGORY_LABELS = {
  sport: 'Sport',
  super: 'Supercar',
  muscle: 'Muscle',
  drift: 'Drift',
};

// Stats are tuned, not flavor text — mass/force/grip all feed the physics
// in vehicle.js directly, so each car actually drives differently.
export const CARS = [
  {
    id: 'challenger',
    icon: './assets/icons/challenger.png',
    name: 'Hellcat Challenger',
    desc: 'Classic muscle, heavy and raw — real recorded engine audio and a fully modeled Hellcat body.',
    category: 'muscle',
    color: 0x0a0a0a,
    accent: 0x151515,
    mass: 1700,
    engineForce: 4300,
    brakeForce: 100,
    maxSteer: 0.44,
    frictionSlip: 1.8,
    rollInfluence: 0.03,
    topSpeedKmh: 225,
    dims: { w: 2.115, h: 1.288, l: 4.9 },
    wheelRadius: 0.4,
    spoiler: false,
    style: 'muscle',
    drivetrain: 'rwd',
    modelUrl: './assets/models/challenger/challenger.obj',
    mtlUrl: './assets/models/challenger/challenger.mtl',
    // This scan came from a proper Blender/FBX scene export (not a raw scan)
    // and is already Y-up with Z-forward — same convention the game uses, so
    // this is an identity basis, unlike every other model here.
    modelBasis: {
      x: new THREE.Vector3(1, 0, 0),
      y: new THREE.Vector3(0, 1, 0),
      z: new THREE.Vector3(0, 0, 1),
    },
    engineSoundSet: {
      layers: [
        { key: 'idle', url: './assets/audio/hellcat/idle.wav', at: 0 },
        { key: 'accelerating', url: './assets/audio/hellcat/accelerating.wav', at: 1 },
      ],
      startup: './assets/audio/hellcat/startup.wav',
    },
  },
  {
    id: 'lada',
    icon: './assets/icons/lada.png',
    name: 'Samara GT',
    desc: 'A cheap, light hatchback with just enough power to swing the back end out — the underground drift favorite.',
    category: 'drift',
    color: 0x1a3fae,
    accent: 0x111111,
    mass: 980,
    engineForce: 3100,
    brakeForce: 80,
    maxSteer: 0.58,
    frictionSlip: 1.0,
    rollInfluence: 0.016,
    topSpeedKmh: 195,
    dims: { w: 1.633, h: 1.078, l: 4.0 },
    wheelRadius: 0.32,
    spoiler: false,
    style: 'drift',
    drivetrain: 'rwd',
    modelUrl: './assets/models/vaz2108/vaz2108.obj',
    mtlUrl: './assets/models/vaz2108/vaz2108.mtl',
    // This scan's own axes are X=length, Y=height, Z=width — a straight
    // X/Z swap would mirror the model (determinant -1), so Z is also
    // negated to keep the mapping a proper rotation.
    modelBasis: {
      x: new THREE.Vector3(0, 0, -1),
      y: new THREE.Vector3(0, 1, 0),
      z: new THREE.Vector3(1, 0, 0),
    },
    // This scan's paint panels have no color data (lost texture references,
    // flat gray Kd fallback) — mid-gray, unsaturated materials get tinted
    // with this color instead of rendering as bare primer.
    paintTint: 0x1a3fae,
  },
];

export function getCar(id) {
  return CARS.find((c) => c.id === id) || CARS[0];
}

const WHEEL_MODEL_URL = './assets/models/wheel/neova.fbx';
let wheelTemplatePromise = null;

/**
 * Loads the real tire mesh once (a hollow tread ring — no hub/rim modeled,
 * and its texture references are missing like every other scan here, so it
 * gets a flat rubber material). Cached geometry, cloned per wheel below.
 */
function loadWheelTemplate() {
  if (wheelTemplatePromise) return wheelTemplatePromise;
  wheelTemplatePromise = (async () => {
    const fbx = await new FBXLoader().loadAsync(WHEEL_MODEL_URL);
    const mesh = fbx.getObjectByName('Circle');
    mesh.geometry.computeVertexNormals();
    const box = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3();
    box.getSize(size);
    return { geometry: mesh.geometry, diameter: size.y }; // native axle axis is local X already
  })();
  return wheelTemplatePromise;
}

/** Builds the 4 wheel visual groups shared by every car — procedural model or not. */
async function buildWheels(def) {
  const { geometry, diameter } = await loadWheelTemplate();
  const scale = (def.wheelRadius * 2) / diameter;
  const tireMat = new THREE.MeshPhysicalMaterial({ color: 0x141414, roughness: 0.85, clearcoat: 0.2 });
  const rimMat = new THREE.MeshPhysicalMaterial({ color: 0xc7ccd2, metalness: 0.95, roughness: 0.18, clearcoat: 0.5 });
  const wheels = [];
  for (let i = 0; i < 4; i++) {
    const wheel = new THREE.Group();
    const tire = new THREE.Mesh(geometry, tireMat);
    tire.scale.setScalar(scale);
    tire.castShadow = true;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(def.wheelRadius * 0.55, def.wheelRadius * 0.55, 0.34, 12), rimMat);
    rim.rotation.z = Math.PI / 2;
    wheel.add(tire, rim);
    wheels.push(wheel);
  }
  return wheels;
}

// --- procedural body: smooth, rounded panels instead of flat boxes --------------

function roundedBox(w, h, l, radius, color, metalness, roughness, clearcoat = 0.9) {
  const r = Math.min(radius, w / 2 - 0.01, l / 2 - 0.01);
  const shape = new THREE.Shape();
  const hw = w / 2, hl = l / 2;
  shape.moveTo(-hw + r, -hl);
  shape.lineTo(hw - r, -hl);
  shape.quadraticCurveTo(hw, -hl, hw, -hl + r);
  shape.lineTo(hw, hl - r);
  shape.quadraticCurveTo(hw, hl, hw - r, hl);
  shape.lineTo(-hw + r, hl);
  shape.quadraticCurveTo(-hw, hl, -hw, hl - r);
  shape.lineTo(-hw, -hl + r);
  shape.quadraticCurveTo(-hw, -hl, -hw + r, -hl);

  const geo = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: true, bevelThickness: r * 0.6, bevelSize: r * 0.6, bevelSegments: 4, curveSegments: 8 });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, -h / 2, 0);
  geo.computeVertexNormals();

  const mat = new THREE.MeshPhysicalMaterial({ color, metalness, roughness, clearcoat, clearcoatRoughness: 0.1 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Builds a smooth, rounded-panel stylized car mesh + 4 wheel meshes, sized to its physics chassis. */
async function buildProceduralCarVisual(def) {
  const { w, h, l } = def.dims;
  const group = new THREE.Group();

  const body = roundedBox(w, h * 0.6, l, 0.22, def.color, 0.65, 0.22, 1.0);
  body.position.y = -h * 0.08;
  group.add(body);

  const cabinLenScale = def.style === 'drift' ? 0.46 : 0.42;
  const cabin = roundedBox(w * 0.84, h * 0.48, l * cabinLenScale, 0.16, def.accent, 0.3, 0.3, 0.6);
  cabin.position.set(0, h * 0.4, -l * 0.04);
  group.add(cabin);

  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x18222a, metalness: 0.1, roughness: 0.05, transmission: 0.85, thickness: 0.05,
    transparent: true, opacity: 0.92, envMapIntensity: 1.2,
  });
  const windshield = roundedBox(w * 0.8, h * 0.4, l * cabinLenScale * 0.94, 0.14, 0x18222a, 0, 0, 0);
  windshield.material = glass;
  windshield.position.copy(cabin.position);
  windshield.position.y += 0.02;
  group.add(windshield);

  const bumperMat = new THREE.MeshPhysicalMaterial({ color: def.accent, metalness: 0.5, roughness: 0.35, clearcoat: 0.6 });
  const frontBumper = new THREE.Mesh(new THREE.CylinderGeometry(h * 0.11, h * 0.11, w * 0.98, 12), bumperMat);
  frontBumper.rotation.z = Math.PI / 2;
  frontBumper.position.set(0, -h * 0.2, l / 2 - 0.08);
  group.add(frontBumper);

  if (def.spoiler) {
    const wingMat = new THREE.MeshPhysicalMaterial({ color: def.accent, metalness: 0.55, roughness: 0.25, clearcoat: 0.7 });
    const wing = new THREE.Mesh(new THREE.BoxGeometry(w * 0.9, 0.05, 0.42), wingMat);
    wing.position.set(0, h * 0.5, -l / 2 + 0.3);
    wing.castShadow = true;
    const strutL = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.22, 0.09), wingMat);
    strutL.position.set(-w * 0.35, h * 0.3, -l / 2 + 0.3);
    const strutR = strutL.clone();
    strutR.position.x = w * 0.35;
    group.add(wing, strutL, strutR);
  }

  // Headlights / taillights for extra readability from a distance.
  const headMat = new THREE.MeshPhysicalMaterial({ color: 0xfff6d8, emissive: 0xfff6d8, emissiveIntensity: 1.4, roughness: 0.2, clearcoat: 1 });
  const tailMat = new THREE.MeshPhysicalMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 1.2, roughness: 0.2, clearcoat: 1 });
  for (const side of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.09, 0.05), headMat);
    head.position.set(side * w * 0.32, -h * 0.02, l / 2 - 0.02);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.1, 0.05), tailMat);
    tail.position.set(side * w * 0.32, -h * 0.02, -l / 2 + 0.02);
    group.add(tail);
  }

  group.castShadow = true;
  const wheels = await buildWheels(def);
  return { group, wheels };
}

// --- model-based body: real scanned meshes (Challenger, Samara GT) --------------

const modelTemplateCache = new Map();

function classifyScanMaterial(color, paintTint) {
  const { r, g, b } = color;
  const brightness = (r + g + b) / 3;
  const saturation = Math.max(r, g, b) - Math.min(r, g, b);

  // DoubleSide: aggressive decimation on these scans flips triangle winding
  // on a scattered subset of faces, which single-sided rendering shows as
  // sharp-edged black patches (the face is lit from its invisible backside).
  if (paintTint !== undefined && saturation < 0.06 && brightness > 0.25 && brightness < 0.78) {
    // This scan lost its paint texture and left a flat gray fallback —
    // tint it with the car's chosen paint color instead of rendering bare primer.
    const tint = new THREE.Color(paintTint);
    return new THREE.MeshPhysicalMaterial({ color: tint, metalness: 0.6, roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide });
  }
  if (saturation > 0.12) {
    // Saturated color -> body paint: deep clearcoat over a metallic base.
    return new THREE.MeshPhysicalMaterial({ color, metalness: 0.6, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08, side: THREE.DoubleSide });
  }
  if (brightness < 0.12) {
    // Near-black -> rubber seals / grille / matte trim.
    return new THREE.MeshPhysicalMaterial({ color, metalness: 0.15, roughness: 0.8, side: THREE.DoubleSide });
  }
  if (brightness > 0.6) {
    // Bright neutral -> polished chrome trim.
    return new THREE.MeshPhysicalMaterial({ color, metalness: 0.95, roughness: 0.12, side: THREE.DoubleSide });
  }
  // Mid gray -> painted/brushed metal panel.
  return new THREE.MeshPhysicalMaterial({ color, metalness: 0.5, roughness: 0.4, side: THREE.DoubleSide });
}

async function loadModelTemplate(def) {
  if (modelTemplateCache.has(def.modelUrl)) return modelTemplateCache.get(def.modelUrl);

  const promise = (async () => {
    const mtlLoader = new MTLLoader();
    const materials = await mtlLoader.loadAsync(def.mtlUrl);
    materials.preload();
    const objLoader = new OBJLoader();
    objLoader.setMaterials(materials);
    const raw = await objLoader.loadAsync(def.modelUrl);

    raw.traverse((child) => {
      if (!child.isMesh) return;
      child.geometry.computeVertexNormals(); // decimation leaves some source normals noisy/stale
      child.material = Array.isArray(child.material)
        ? child.material.map((m) => classifyScanMaterial(m.color, def.paintTint))
        : classifyScanMaterial(child.material.color, def.paintTint);
      child.castShadow = true;
      child.receiveShadow = true;
    });

    const box = new THREE.Box3().setFromObject(raw);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    raw.position.sub(center);

    // Scale off whichever source axis modelBasis maps to the game's forward
    // (Z) axis — that's the scan's own length axis, but which raw XYZ
    // component that is isn't consistent between different artists' exports.
    const lengthAxis = ['x', 'y', 'z'].find((k) => Math.abs(def.modelBasis[k].z) > 0.5);
    const scale = def.dims.l / size[lengthAxis];
    const wrapper = new THREE.Group();
    wrapper.add(raw);
    wrapper.matrixAutoUpdate = false;
    wrapper.matrix.makeBasis(def.modelBasis.x, def.modelBasis.y, def.modelBasis.z).scale(new THREE.Vector3(scale, scale, scale));
    wrapper.castShadow = true;
    return wrapper;
  })();

  modelTemplateCache.set(def.modelUrl, promise);
  return promise;
}

async function buildModelCarVisual(def) {
  const template = await loadModelTemplate(def);
  const group = new THREE.Group();
  group.add(template.clone(true));
  const wheels = await buildWheels(def);
  return { group, wheels };
}

/** Builds a car's visual (body + wheels) — always async (model and wheel assets are loaded/cached, not baked in). */
export function buildCarVisual(def) {
  if (def.modelUrl) return buildModelCarVisual(def);
  return buildProceduralCarVisual(def);
}
