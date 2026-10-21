import * as THREE from 'three';
import { addGround, addBox, addRamp, addCurvedRamp, addLoop, addCylinder, addSign } from './helpers.js';

export const META = {
  id: 'stuntpark',
  name: 'Stunt Park',
  desc: 'Loops, launch ramps & big air',
  color: 0xff7a1a,
};

export function build(scene, world) {
  addGround(scene, world, { colorA: '#2d3748', colorB: '#273142', size: 1400 });

  // central loop, straight down the park's main strip (+Z)
  addLoop(scene, world, { center: { x: 0, y: 9, z: 0 }, radius: 9, trackWidth: 7.5 });

  // approach + exit runway through the loop
  addBox(scene, world, { size: { x: 7.6, y: 0.3, z: 40 }, pos: { x: 0, y: 0.05, z: -28 }, color: 0x374257 });
  addBox(scene, world, { size: { x: 7.6, y: 0.3, z: 40 }, pos: { x: 0, y: 0.05, z: 28 }, color: 0x374257 });

  // launch ramp series, increasing difficulty, fanned out to the east
  addCurvedRamp(scene, world, { start: { x: 30, y: 0, z: -40 }, width: 9, maxAngleDeg: 55, segments: 7 });
  addCurvedRamp(scene, world, { start: { x: 55, y: 0, z: -40 }, width: 9, maxAngleDeg: 68, segments: 8, segmentLength: 2.6 });
  addRamp(scene, world, { pos: { x: 80, y: 0, z: -40 }, width: 10, length: 10, height: 5, angleDeg: 32 });

  // landing mounds for the ramps
  for (const z of [-5, 10, 30]) {
    addBox(scene, world, { size: { x: 20, y: 1.2, z: 16 }, pos: { x: 30 + (z + 5), y: 0.4, z }, color: 0x303a4b });
  }

  // half-pipe style dual ramp to the west
  addCurvedRamp(scene, world, { start: { x: -40, y: 0, z: -30 }, width: 14, maxAngleDeg: 72, segments: 8 });
  addBox(scene, world, { size: { x: 14, y: 0.3, z: 24 }, pos: { x: -40, y: 0.05, z: -5 }, color: 0x374257 });

  // stacked-car style jump gap (like MSC's classic "jump the pile" stunt)
  for (let i = 0; i < 4; i++) {
    addBox(scene, world, { size: { x: 2.2, y: 1.1, z: 4.4 }, pos: { x: -40, y: 0.6 + i * 1.15, z: 10 + i * 0.3 }, color: 0x8a2be2 });
  }

  // elevated figure-8 platform with ramps on both ends
  addBox(scene, world, { size: { x: 16, y: 1, z: 60 }, pos: { x: 0, y: 6, z: 70 }, color: 0x3a4556 });
  addRamp(scene, world, { pos: { x: 0, y: 0, z: 42 }, width: 16, length: 16, height: 6, angleDeg: 22 });
  addRamp(scene, world, { pos: { x: 0, y: 0, z: 98 }, width: 16, length: 16, height: 6, angleDeg: 22 });

  // decoration: pylons marking the park perimeter + glowing signs
  const colors = [0xff7a1a, 0x2fd1c7, 0xff4d5e];
  for (let i = 0; i < 24; i++) {
    const ang = (i / 24) * Math.PI * 2;
    const r = 180;
    addCylinder(scene, world, {
      radiusTop: 0.4, radiusBottom: 0.4, height: 6,
      pos: { x: Math.cos(ang) * r, y: 3, z: Math.sin(ang) * r },
      color: colors[i % colors.length],
    });
  }
  addSign(scene, { pos: { x: 0, y: 14, z: -70 }, color: 0xff7a1a, size: 6 });

  return {
    spawn: { x: 0, y: 1.2, z: -70 },
    spawnYaw: 0,
    bounds: 380,
  };
}
