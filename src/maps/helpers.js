import * as THREE from 'three';
import * as CANNON from 'cannon-es';

export function makeCheckerTexture(colorA, colorB, tiles = 2) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  const half = size / tiles / 2;
  for (let y = 0; y < tiles; y++) {
    for (let x = 0; x < tiles; x++) {
      ctx.fillStyle = (x + y) % 2 === 0 ? colorA : colorB;
      ctx.fillRect(x * (size / tiles), y * (size / tiles), size / tiles, size / tiles);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

export function addGround(scene, world, { size = 1000, colorA = '#283241', colorB = '#242d3a', repeat = 160, friction = 0.9 } = {}) {
  const tex = makeCheckerTexture(colorA, colorB, 2);
  tex.repeat.set(repeat, repeat);
  const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, metalness: 0.02 });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const groundMat = new CANNON.Material('ground');
  groundMat.friction = friction;
  const body = new CANNON.Body({ mass: 0, shape: new CANNON.Plane(), material: groundMat });
  body.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
  world.addBody(body);
  return { mesh, body, material: groundMat };
}

export function addBox(scene, world, opts) {
  const { size, pos, rot = { x: 0, y: 0, z: 0 }, color = 0x888888, mass = 0, metalness = 0.2, roughness = 0.75, emissive } = opts;
  const geo = new THREE.BoxGeometry(size.x, size.y, size.z);
  const matOpts = { color, metalness, roughness };
  if (emissive) {
    matOpts.emissive = emissive;
    matOpts.emissiveIntensity = 0.6;
  }
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial(matOpts));
  mesh.position.set(pos.x, pos.y, pos.z);
  mesh.rotation.set(rot.x, rot.y, rot.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const shape = new CANNON.Box(new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2));
  const body = new CANNON.Body({ mass });
  body.addShape(shape);
  body.position.set(pos.x, pos.y, pos.z);
  body.quaternion.setFromEuler(rot.x, rot.y, rot.z, 'XYZ');
  world.addBody(body);
  return { mesh, body };
}

export function addCylinder(scene, world, { radiusTop, radiusBottom, height, pos, color = 0x888888, segments = 12, mass = 0 }) {
  const geo = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
  mesh.position.set(pos.x, pos.y, pos.z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);

  const shape = new CANNON.Cylinder(radiusTop, radiusBottom, height, segments);
  const body = new CANNON.Body({ mass });
  const quat = new CANNON.Quaternion();
  body.addShape(shape, new CANNON.Vec3(), quat);
  body.position.set(pos.x, pos.y, pos.z);
  world.addBody(body);
  return { mesh, body };
}

/**
 * A ramp made of a single angled box — simplest launch ramp / landing ramp.
 */
export function addRamp(scene, world, { pos, width = 8, length = 12, height = 4, angleDeg, color = 0x55606e }) {
  const angle = (angleDeg * Math.PI) / 180;
  const thickness = 0.6;
  const { mesh, body } = addBox(scene, world, {
    size: { x: width, y: thickness, z: length },
    pos: { x: pos.x, y: pos.y + Math.sin(angle) * (length / 2) * 0.5, z: pos.z },
    rot: { x: -angle, y: 0, z: 0 },
    color,
  });
  return { mesh, body };
}

/**
 * Curved launch ramp built from N angled planks, rising from flat to maxAngleDeg.
 * Travels along +Z. Returns the world-space end point/angle for chaining.
 */
export function addCurvedRamp(scene, world, { start, width = 8, segmentLength = 2.2, segments = 8, maxAngleDeg = 70, color = 0x55606e }) {
  let pos = new THREE.Vector3(start.x, start.y, start.z);
  let angle = 0;
  const maxAngle = (maxAngleDeg * Math.PI) / 180;
  for (let i = 0; i < segments; i++) {
    const t0 = i / segments;
    const t1 = (i + 1) / segments;
    angle = ((t0 + t1) / 2) * maxAngle;
    const dz = Math.cos(angle) * segmentLength;
    const dy = Math.sin(angle) * segmentLength;
    const center = pos.clone().add(new THREE.Vector3(0, dy / 2, dz / 2));
    addBox(scene, world, {
      size: { x: width, y: 0.5, z: segmentLength + 0.3 },
      pos: { x: center.x, y: center.y, z: center.z },
      rot: { x: -angle, y: 0, z: 0 },
      color,
    });
    pos.add(new THREE.Vector3(0, dy, dz));
  }
  return { end: pos, endAngleDeg: (angle * 180) / Math.PI };
}

/**
 * Full vertical stunt loop, lying in the Y-Z plane so cars drive straight
 * through it along world +Z. Built from flat segments approximating a circle.
 */
export function addLoop(scene, world, { center, radius = 9, trackWidth = 7, thickness = 0.5, segments = 28, color = 0x3a4556 }) {
  const angleStep = (Math.PI * 2) / segments;
  const segLen = 2 * radius * Math.sin(angleStep / 2) * 1.08;
  for (let i = 0; i < segments; i++) {
    const theta = (i + 0.5) * angleStep;
    const outX = 0;
    const outY = -Math.cos(theta);
    const outZ = Math.sin(theta);
    const px = center.x + outX * radius;
    const py = center.y + outY * radius;
    const pz = center.z + outZ * radius;
    addBox(scene, world, {
      size: { x: trackWidth, y: thickness, z: segLen },
      pos: { x: px, y: py, z: pz },
      rot: { x: -theta, y: 0, z: 0 },
      color: i % 2 === 0 ? color : color + 0x0a0a0a,
    });
  }
  // side rails so cars don't slide off the edges mid-loop
  for (const side of [-1, 1]) {
    for (let i = 0; i < segments; i++) {
      const theta = (i + 0.5) * angleStep;
      const px = center.x + side * (trackWidth / 2 + 0.15);
      const py = center.y - Math.cos(theta) * radius;
      const pz = center.z + Math.sin(theta) * radius;
      addBox(scene, world, {
        size: { x: 0.3, y: 1.4, z: segLen },
        pos: { x: px, y: py, z: pz },
        rot: { x: -theta, y: 0, z: 0 },
        color: 0x1b2230,
      });
    }
  }
}

export function addSign(scene, { pos, color = 0xffffff, size = 2 }) {
  const geo = new THREE.ConeGeometry(size * 0.4, size, 4);
  const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 0.4 }));
  mesh.position.set(pos.x, pos.y, pos.z);
  scene.add(mesh);
}

export function scatterInstances(scene, geo, mat, count, areaSize, yFn, excludeRadius = 20) {
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  const dummy = new THREE.Object3D();
  let placed = 0;
  let tries = 0;
  while (placed < count && tries < count * 10) {
    tries++;
    const x = (Math.random() - 0.5) * areaSize;
    const z = (Math.random() - 0.5) * areaSize;
    if (Math.hypot(x, z) < excludeRadius) continue;
    dummy.position.set(x, yFn(), z);
    dummy.rotation.y = Math.random() * Math.PI * 2;
    const s = 0.7 + Math.random() * 0.8;
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    mesh.setMatrixAt(placed, dummy.matrix);
    placed++;
  }
  scene.add(mesh);
  return mesh;
}
