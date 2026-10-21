import * as THREE from 'three';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { MTLLoader } from 'three/addons/loaders/MTLLoader.js';

// Stats are tuned, not flavor text — mass/force/grip all feed the physics
// in vehicle.js directly, so each car actually drives differently.
export const CARS = [
  {
    id: 'raptor',
    name: 'Raptor GT',
    desc: 'Balanced all-rounder',
    color: 0xff7a1a,
    accent: 0x1a1a1a,
    mass: 1250,
    engineForce: 3600,
    brakeForce: 90,
    maxSteer: 0.52,
    frictionSlip: 2.0,
    rollInfluence: 0.02,
    topSpeedKmh: 230,
    dims: { w: 1.85, h: 1.05, l: 4.3 },
    wheelRadius: 0.42,
    spoiler: true,
    style: 'sport',
    drivetrain: 'rwd',
  },
  {
    id: 'viper',
    name: 'Viper RS',
    desc: 'Supercar — blistering, twitchy',
    color: 0xe0122c,
    accent: 0x0a0a0a,
    mass: 1150,
    engineForce: 4500,
    brakeForce: 95,
    maxSteer: 0.48,
    frictionSlip: 1.6,
    rollInfluence: 0.015,
    topSpeedKmh: 280,
    dims: { w: 1.9, h: 0.92, l: 4.5 },
    wheelRadius: 0.4,
    spoiler: true,
    style: 'super',
    drivetrain: 'rwd',
  },
  {
    id: 'bulldog',
    name: 'Bulldog SS',
    desc: 'Muscle car — torque for days',
    color: 0xffce1f,
    accent: 0x222222,
    mass: 1650,
    engineForce: 4100,
    brakeForce: 100,
    maxSteer: 0.46,
    frictionSlip: 2.1,
    rollInfluence: 0.028,
    topSpeedKmh: 210,
    dims: { w: 1.95, h: 1.15, l: 4.6 },
    wheelRadius: 0.44,
    spoiler: false,
    style: 'muscle',
    drivetrain: 'rwd',
  },
  {
    id: 'wraith',
    name: 'Wraith Drift',
    desc: 'Loose grip, built for slides',
    color: 0x8a2be2,
    accent: 0x1a1a1a,
    mass: 1200,
    engineForce: 3400,
    brakeForce: 85,
    maxSteer: 0.62,
    frictionSlip: 1.1,
    rollInfluence: 0.018,
    topSpeedKmh: 215,
    dims: { w: 1.82, h: 1.0, l: 4.25 },
    wheelRadius: 0.41,
    spoiler: true,
    style: 'drift',
    drivetrain: 'rwd',
  },
  {
    id: 'hyperion',
    name: 'Hyperion X',
    desc: 'Hypercar — fastest, least forgiving',
    color: 0x2fd1c7,
    accent: 0x0a0a0a,
    mass: 1100,
    engineForce: 4900,
    brakeForce: 100,
    maxSteer: 0.44,
    frictionSlip: 1.5,
    rollInfluence: 0.012,
    topSpeedKmh: 310,
    dims: { w: 1.95, h: 0.88, l: 4.6 },
    wheelRadius: 0.39,
    spoiler: true,
    style: 'super',
    drivetrain: 'rwd',
  },
  {
    id: 'challenger',
    name: '"89" Challenger',
    desc: 'Classic muscle — heavy and raw',
    color: 0x4d1000,
    accent: 0x151515,
    mass: 1700,
    engineForce: 4300,
    brakeForce: 100,
    maxSteer: 0.44,
    frictionSlip: 1.8,
    rollInfluence: 0.03,
    topSpeedKmh: 225,
    dims: { w: 1.888, h: 1.358, l: 4.9 },
    wheelRadius: 0.4,
    spoiler: false,
    style: 'muscle',
    drivetrain: 'rwd',
    modelUrl: './assets/models/challenger/challenger.obj',
    mtlUrl: './assets/models/challenger/challenger.mtl',
    // Permutation that maps the scan's own axes (X=length, Y=width, Z=height)
    // onto the game's car-local axes (X=width/right, Y=height/up, Z=length/forward).
    modelBasis: {
      x: new THREE.Vector3(0, 0, 1),
      y: new THREE.Vector3(1, 0, 0),
      z: new THREE.Vector3(0, 1, 0),
    },
    engineSoundSet: {
      idle: './assets/audio/hellcat/idle.wav',
      accelerating: './assets/audio/hellcat/accelerating.wav',
      startup: './assets/audio/hellcat/startup.wav',
    },
  },
];

export function getCar(id) {
  return CARS.find((c) => c.id === id) || CARS[0];
}

/** Builds the 4 wheel visual groups shared by every car — procedural model or not. */
function buildWheels(def) {
  const wheelGeo = new THREE.CylinderGeometry(def.wheelRadius, def.wheelRadius, 0.32, 24);
  const wheelMat = new THREE.MeshPhysicalMaterial({ color: 0x141414, roughness: 0.85, clearcoat: 0.2 });
  const rimMat = new THREE.MeshPhysicalMaterial({ color: 0xc7ccd2, metalness: 0.95, roughness: 0.18, clearcoat: 0.5 });
  const wheels = [];
  for (let i = 0; i < 4; i++) {
    const wheel = new THREE.Group();
    const tire = new THREE.Mesh(wheelGeo, wheelMat);
    tire.rotation.z = Math.PI / 2;
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
function buildProceduralCarVisual(def) {
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
  const wheels = buildWheels(def);
  return { group, wheels };
}

// --- model-based body: a real scanned mesh (currently only the Challenger) ------

const modelTemplateCache = new Map();

function classifyScanMaterial(color) {
  const { r, g, b } = color;
  const brightness = (r + g + b) / 3;
  const saturation = Math.max(r, g, b) - Math.min(r, g, b);
  if (saturation > 0.12) {
    // Saturated color -> body paint: deep clearcoat over a metallic base.
    return new THREE.MeshPhysicalMaterial({ color, metalness: 0.6, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.08 });
  }
  if (brightness < 0.12) {
    // Near-black -> rubber seals / grille / matte trim.
    return new THREE.MeshPhysicalMaterial({ color, metalness: 0.15, roughness: 0.8 });
  }
  if (brightness > 0.6) {
    // Bright neutral -> polished chrome trim.
    return new THREE.MeshPhysicalMaterial({ color, metalness: 0.95, roughness: 0.12 });
  }
  // Mid gray -> painted/brushed metal panel.
  return new THREE.MeshPhysicalMaterial({ color, metalness: 0.5, roughness: 0.4 });
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
      child.material = Array.isArray(child.material)
        ? child.material.map((m) => classifyScanMaterial(m.color))
        : classifyScanMaterial(child.material.color);
      child.castShadow = true;
      child.receiveShadow = true;
    });

    const box = new THREE.Box3().setFromObject(raw);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    raw.position.sub(center);

    const scale = def.dims.l / size.x; // scan's local X is the car's length axis
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
  const wheels = buildWheels(def);
  return { group, wheels };
}

/**
 * Builds a car's visual (body + wheels). Procedural cars resolve synchronously;
 * model-backed cars (e.g. the Challenger) return a Promise — `await` works on
 * both since awaiting a non-promise value resolves immediately.
 */
export function buildCarVisual(def) {
  if (def.modelUrl) return buildModelCarVisual(def);
  return buildProceduralCarVisual(def);
}
