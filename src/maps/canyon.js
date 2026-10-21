import * as THREE from 'three';
import { addGround, addBox, addRamp, addCurvedRamp, scatterInstances } from './helpers.js';

export const META = {
  id: 'canyon',
  name: 'Red Canyon',
  desc: 'Desert drift roads & dune jumps',
  color: 0xbf7a3d,
};

// waypoints define a winding canyon corridor the walls follow
const PATH = [
  { x: 0, z: 0, heading: 0 },
  { x: 0, z: 70, heading: 0 },
  { x: 35, z: 120, heading: 50 },
  { x: 90, z: 150, heading: 95 },
  { x: 150, z: 140, heading: 150 },
  { x: 190, z: 90, heading: 210 },
  { x: 180, z: 20, heading: 260 },
];

export function build(scene, world) {
  addGround(scene, world, { colorA: '#9a6a43', colorB: '#8f6038', size: 1800, repeat: 200, friction: 0.95 });

  const wallHeight = 14;
  const corridorWidth = 26;
  for (let i = 0; i < PATH.length - 1; i++) {
    const a = PATH[i];
    const b = PATH[i + 1];
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dz);
    const ang = Math.atan2(dx, dz);
    const midX = (a.x + b.x) / 2;
    const midZ = (a.z + b.z) / 2;
    const perpX = Math.cos(ang);
    const perpZ = -Math.sin(ang);

    for (const side of [-1, 1]) {
      addBox(scene, world, {
        size: { x: 6, y: wallHeight, z: len + 4 },
        pos: {
          x: midX + perpX * (corridorWidth / 2 + 3) * side,
          y: wallHeight / 2 - 1,
          z: midZ + perpZ * (corridorWidth / 2 + 3) * side,
        },
        rot: { x: 0, y: ang, z: 0 },
        color: 0x8a5a36,
      });
    }

    // occasional jump ramp mid-segment
    if (i % 2 === 1) {
      addRamp(scene, world, {
        pos: { x: midX, y: 0, z: midZ },
        width: corridorWidth * 0.7,
        length: 10,
        height: 3.4,
        angleDeg: 18,
        color: 0xbf7a3d,
      });
    }
  }

  // big dune launch out in the open desert
  addCurvedRamp(scene, world, { start: { x: -60, y: 0, z: -40 }, width: 12, maxAngleDeg: 48, segments: 7 });
  addBox(scene, world, { size: { x: 30, y: 1, z: 20 }, pos: { x: -60, y: 0.3, z: -5 }, color: 0x8f6038 });

  // scattered boulders across the open desert, kept clear of the canyon corridor and spawn
  scatterInstances(
    scene,
    new THREE.DodecahedronGeometry(1.6, 0),
    new THREE.MeshStandardMaterial({ color: 0x6b4a30, roughness: 0.95 }),
    140,
    900,
    () => 0.8,
    25
  );

  return {
    spawn: { x: 0, y: 1.2, z: -20 },
    spawnYaw: 0,
    bounds: 420,
  };
}
