import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { addGround, addRamp } from './helpers.js';

export const META = {
  id: 'city',
  name: 'Neon City',
  desc: 'Open world sprawl, rooftop gaps',
  color: 0x2fd1c7,
};

function buildingColor() {
  const palette = [0x3a4150, 0x454e5f, 0x2f3645, 0x4a5366, 0x394256];
  return palette[Math.floor(Math.random() * palette.length)];
}

// Subtle window-grid texture: a dim base with a sparse lattice of lightly lit
// panes — enough facade detail to read as a building, not a bold checkerboard.
function makeWindowTexture(baseHex) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = baseHex;
  ctx.fillRect(0, 0, size, size);
  const cols = 6;
  const rows = 10;
  const cellW = size / cols;
  const cellH = size / rows;
  const padX = cellW * 0.22;
  const padY = cellH * 0.3;
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const lit = Math.random() < 0.4;
      ctx.fillStyle = lit ? 'rgba(210,228,240,0.55)' : 'rgba(10,14,20,0.35)';
      ctx.fillRect(c * cellW + padX, r * cellH + padY, cellW - padX * 2, cellH - padY * 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  return tex;
}

function addBuilding(scene, world, x, z, w, d, h) {
  const baseColor = buildingColor();
  const baseHex = '#' + baseColor.toString(16).padStart(6, '0');
  const windowTex = makeWindowTexture(baseHex);
  windowTex.repeat.set(Math.max(1, Math.round(w / 5)), Math.max(1, Math.round(h / 7)));
  const mat = new THREE.MeshStandardMaterial({ color: baseColor, roughness: 0.75, metalness: 0.08 });
  const sideMat = new THREE.MeshStandardMaterial({ map: windowTex, roughness: 0.5, metalness: 0.15 });
  const geo = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geo, [sideMat, sideMat, mat, mat, sideMat, sideMat]);
  mesh.position.set(x, h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
}

export function build(scene, world) {
  addGround(scene, world, { colorA: '#30363f', colorB: '#2a2f37', size: 1600, repeat: 220 });

  const blockSize = 42;
  const roadWidth = 14;
  const cell = blockSize + roadWidth;
  const grid = 7;
  const half = Math.floor(grid / 2);
  const rng = mulberry32(1337);

  for (let gx = -half; gx <= half; gx++) {
    for (let gz = -half; gz <= half; gz++) {
      const cx = gx * cell;
      const cz = gz * cell;
      if (gx === 0 && gz === 0) continue; // spawn plaza, kept open

      const roll = rng();

      if (roll < 0.18) {
        // open block: ramp to the next block's rooftop for a gap jump
        const dir = rng() < 0.5 ? 1 : -1;
        const h = 8 + rng() * 6;
        addRamp(scene, world, { pos: { x: cx, y: 0, z: cz + dir * (blockSize / 2 - 6) }, width: blockSize * 0.6, length: 16, height: h, angleDeg: 24 });
        continue;
      }

      const count = 1 + Math.floor(rng() * 2);
      for (let i = 0; i < count; i++) {
        const w = 10 + rng() * 14;
        const d = 10 + rng() * 14;
        const h = 10 + rng() * 55;
        const ox = (rng() - 0.5) * (blockSize - w - 2);
        const oz = (rng() - 0.5) * (blockSize - d - 2);
        const mesh = addBuilding(scene, world, cx + ox, cz + oz, w, d, h);
        const shape = new CANNON.Box(new CANNON.Vec3(w / 2, h / 2, d / 2));
        const body = new CANNON.Body({ mass: 0 });
        body.addShape(shape);
        body.position.set(cx + ox, h / 2, cz + oz);
        world.addBody(body);
      }
    }
  }

  // a few street-level jump ramps scattered through the road grid for stunt variety
  for (let i = 0; i < 6; i++) {
    const gx = Math.floor(rng() * grid) - half;
    const gz = Math.floor(rng() * grid) - half;
    addRamp(scene, world, { pos: { x: gx * cell, y: 0, z: gz * cell + 20 }, width: 8, length: 10, height: 3.2, angleDeg: 20, color: 0xff7a1a });
  }

  return {
    spawn: { x: 0, y: 1.2, z: 0 },
    spawnYaw: 0,
    bounds: cell * (half + 1),
  };
}

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
