import * as THREE from 'three';

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
    id: 'tank',
    name: 'Titan 4x4',
    desc: 'Heavy SUV — stable landings',
    color: 0x3c8f3c,
    accent: 0x111111,
    mass: 2200,
    engineForce: 3900,
    brakeForce: 110,
    maxSteer: 0.42,
    frictionSlip: 2.6,
    rollInfluence: 0.045,
    topSpeedKmh: 180,
    dims: { w: 2.0, h: 1.55, l: 4.5 },
    wheelRadius: 0.5,
    spoiler: false,
    style: 'suv',
    drivetrain: 'awd',
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
];

export function getCar(id) {
  return CARS.find((c) => c.id === id) || CARS[0];
}

function box(w, h, l, color, metalness = 0.55, roughness = 0.4) {
  const geo = new THREE.BoxGeometry(w, h, l);
  const mat = new THREE.MeshStandardMaterial({ color, metalness, roughness });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

/** Builds a low-poly stylized car mesh + 4 wheel meshes, sized to match its physics chassis. */
export function buildCarVisual(def) {
  const { w, h, l } = def.dims;
  const group = new THREE.Group();

  const body = box(w, h * 0.62, l, def.color);
  body.position.y = -h * 0.06;
  group.add(body);

  const cabinLenScale = def.style === 'suv' ? 0.62 : 0.42;
  const cabin = box(w * 0.86, h * 0.5, l * cabinLenScale, def.accent, 0.3, 0.2);
  cabin.position.set(0, h * 0.42, -l * 0.04);
  group.add(cabin);

  const glass = new THREE.MeshStandardMaterial({ color: 0x9fd3e8, metalness: 0.2, roughness: 0.1, transparent: true, opacity: 0.55 });
  const windshield = new THREE.Mesh(new THREE.BoxGeometry(w * 0.82, h * 0.4, l * cabinLenScale * 0.96), glass);
  windshield.position.copy(cabin.position);
  windshield.position.y += 0.02;
  group.add(windshield);

  const bumperMat = new THREE.MeshStandardMaterial({ color: def.accent, metalness: 0.4, roughness: 0.5 });
  const frontBumper = new THREE.Mesh(new THREE.BoxGeometry(w * 0.98, h * 0.22, 0.28), bumperMat);
  frontBumper.position.set(0, -h * 0.18, l / 2 - 0.1);
  group.add(frontBumper);

  if (def.spoiler) {
    const wingMat = new THREE.MeshStandardMaterial({ color: def.accent, metalness: 0.5, roughness: 0.35 });
    const wing = box(w * 0.9, 0.06, 0.4, def.accent, 0.5, 0.35);
    wing.material = wingMat;
    wing.position.set(0, h * 0.5, -l / 2 + 0.3);
    const strutL = box(0.06, 0.22, 0.1, def.accent);
    strutL.position.set(-w * 0.35, h * 0.3, -l / 2 + 0.3);
    const strutR = box(0.06, 0.22, 0.1, def.accent);
    strutR.position.set(w * 0.35, h * 0.3, -l / 2 + 0.3);
    group.add(wing, strutL, strutR);
  }

  if (def.style === 'suv') {
    const rack = box(w * 0.7, 0.06, l * 0.4, 0x151515, 0.3, 0.6);
    rack.position.set(0, h * 0.72, -l * 0.05);
    group.add(rack);
  }

  // Headlights / taillights for extra readability from a distance.
  const headMat = new THREE.MeshStandardMaterial({ color: 0xfff6d8, emissive: 0xfff6d8, emissiveIntensity: 1.2 });
  const tailMat = new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff2020, emissiveIntensity: 1.0 });
  for (const side of [-1, 1]) {
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.06), headMat);
    head.position.set(side * w * 0.32, 0, l / 2 - 0.02);
    group.add(head);
    const tail = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.06), tailMat);
    tail.position.set(side * w * 0.32, 0, -l / 2 + 0.02);
    group.add(tail);
  }

  const wheelGeo = new THREE.CylinderGeometry(def.wheelRadius, def.wheelRadius, 0.32, 20);
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.8 });
  const rimMat = new THREE.MeshStandardMaterial({ color: 0xb8bcc2, metalness: 0.8, roughness: 0.3 });
  const wheels = [];
  for (let i = 0; i < 4; i++) {
    const wheel = new THREE.Group();
    const tire = new THREE.Mesh(wheelGeo, wheelMat);
    tire.rotation.z = Math.PI / 2;
    tire.castShadow = true;
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(def.wheelRadius * 0.55, def.wheelRadius * 0.55, 0.34, 10), rimMat);
    rim.rotation.z = Math.PI / 2;
    wheel.add(tire, rim);
    wheels.push(wheel);
  }

  group.castShadow = true;
  return { group, wheels };
}
