import * as THREE from 'three';
import * as CANNON from 'cannon-es';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

import { settings, saveSettings } from './storage.js';
import { input } from './input.js';
import { carAudio } from './audio.js';
import { Vehicle } from './vehicle.js';
import { getCar, buildCarVisual } from './cars.js';
import { getMap } from './maps/index.js';
import { GameCamera } from './camera.js';
import { Hud } from './hud.js';
import { Menus } from './menus.js';

const canvas = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = settings.shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0xaecbe8, settings.drawDistance * 0.3, settings.drawDistance);

const camera = new THREE.PerspectiveCamera(62, window.innerWidth / window.innerHeight, 0.1, settings.drawDistance * 1.4);
const gameCamera = new GameCamera(camera);

// --- sky dome + sun -------------------------------------------------------------
// A vertical-gradient sky dome reads cleanly at any exposure and keeps the
// same crisp, stylized look as the low-poly world — a full atmospheric
// scattering shader fights tone mapping and tends to blow out near the horizon.
function makeSkyGradientTexture() {
  const c = document.createElement('canvas');
  c.width = 2;
  c.height = 256;
  const ctx = c.getContext('2d');
  const grad = ctx.createLinearGradient(0, 0, 0, 256);
  grad.addColorStop(0, '#2f6fb0');
  grad.addColorStop(0.45, '#7fb3dd');
  grad.addColorStop(0.75, '#cfe6f2');
  grad.addColorStop(1, '#eef6f9');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 2, 256);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const skyDome = new THREE.Mesh(
  new THREE.SphereGeometry(2000, 24, 16),
  new THREE.MeshBasicMaterial({ map: makeSkyGradientTexture(), side: THREE.BackSide, fog: false, depthWrite: false })
);
scene.add(skyDome);

const sunDir = new THREE.Vector3();
const sunElevation = 42;
const sunAzimuth = 150;
sunDir.setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - sunElevation), THREE.MathUtils.degToRad(sunAzimuth));

const sunLight = new THREE.DirectionalLight(0xfff2d9, 1.9);
sunLight.position.copy(sunDir).multiplyScalar(300);
sunLight.castShadow = settings.shadows;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.near = 10;
sunLight.shadow.camera.far = 400;
sunLight.shadow.camera.left = -120;
sunLight.shadow.camera.right = 120;
sunLight.shadow.camera.top = 120;
sunLight.shadow.camera.bottom = -120;
sunLight.shadow.bias = -0.0015;
scene.add(sunLight);
scene.add(sunLight.target);

const hemi = new THREE.HemisphereLight(0xaecbe8, 0x3a3226, 0.65);
scene.add(hemi);
const ambient = new THREE.AmbientLight(0xffffff, 0.12);
scene.add(ambient);

// --- postprocessing ---------------------------------------------------------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.45, 0.4, 0.88);
composer.addPass(bloomPass);

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  composer.setSize(w, h);
}
window.addEventListener('resize', resize);

function applyGraphicsSettings() {
  renderer.shadowMap.enabled = settings.shadows;
  sunLight.castShadow = settings.shadows;
  const presetRes = { low: 512, medium: 1024, high: 2048, ultra: 3072 }[settings.graphicsPreset] || 2048;
  if (sunLight.shadow.mapSize.x !== presetRes) {
    sunLight.shadow.mapSize.set(presetRes, presetRes);
    sunLight.shadow.map?.dispose();
    sunLight.shadow.map = null;
  }
  const dpr = (settings.pixelRatioPct / 100) * Math.min(2, window.devicePixelRatio || 1);
  renderer.setPixelRatio(dpr);
  camera.far = Math.max(settings.drawDistance * 1.4, 2600);
  camera.updateProjectionMatrix();
  scene.fog.near = settings.drawDistance * 0.3;
  scene.fog.far = settings.drawDistance;
  bloomPass.enabled = settings.bloom;
  resize();
}

// --- physics world ------------------------------------------------------------
const world = new CANNON.World({ gravity: new CANNON.Vec3(0, -9.82, 0) });
world.broadphase = new CANNON.SAPBroadphase(world);
world.solver.iterations = 14;
world.defaultContactMaterial.friction = 0.6;

// --- level/vehicle state --------------------------------------------------------
const state = {
  mode: 'loading',
  levelGroup: null,
  levelBodies: [],
  vehicle: null,
  carGroup: null,
  wheelMeshes: null,
  mapBounds: 300,
  airborne: false,
  airStart: 0,
  airRot: 0,
};

function clearLevel() {
  if (state.levelGroup) scene.remove(state.levelGroup);
  if (state.levelBodies) for (const b of state.levelBodies) world.removeBody(b);
  state.levelBodies = [];
  if (state.vehicle) state.vehicle.vehicle.removeFromWorld(world);
  if (state.carGroup) scene.remove(state.carGroup);
  state.vehicle = null;
  state.carGroup = null;
  state.wheelMeshes = null;
}

function loadLevel(mapId, carId) {
  clearLevel();

  const levelGroup = new THREE.Group();
  scene.add(levelGroup);
  const sceneProxy = { add: (o) => levelGroup.add(o) };
  const bodyCountBefore = world.bodies.length;

  const mapDef = getMap(mapId);
  const result = mapDef.build(sceneProxy, world);
  state.levelGroup = levelGroup;
  state.levelBodies = world.bodies.slice(bodyCountBefore);
  state.mapBounds = result.bounds || 300;

  const carDef = getCar(carId);
  const vehicle = new Vehicle(world, carDef, result.spawn, result.spawnYaw || 0);
  state.vehicle = vehicle;

  const { group, wheels } = buildCarVisual(carDef);
  scene.add(group);
  for (const wheel of wheels) scene.add(wheel);
  state.carGroup = group;
  state.wheelMeshes = wheels;

  vehicle.chassisBody.addEventListener('collide', (e) => {
    const impact = Math.abs(e.contact.getImpactVelocityAlongNormal());
    if (impact > 3) carAudio.playThump(impact / 15);
  });

  sunLight.target.position.copy(result.spawn);

  gameCamera.distance = 9;
  gameCamera.snapTo(group);
  state.airborne = false;
}

// --- menus / UI ---------------------------------------------------------------
const hud = new Hud(document.getElementById('hud-canvas'));
const menus = new Menus({
  onStart(mapId, carId) {
    loadLevel(mapId, carId);
    state.mode = 'playing';
    menus.show('hud');
  },
  onResume() {
    state.mode = 'playing';
    menus.show('hud');
  },
  onRespawn() {
    if (state.vehicle) state.vehicle.resetUpright();
  },
  onQuit() {
    state.mode = 'menu';
    clearLevel();
    menus.show('main');
  },
  onGraphicsChange: applyGraphicsSettings,
});

applyGraphicsSettings();
resize();

setTimeout(() => {
  menus.setLoadProgress(100, 'Ready');
  setTimeout(() => {
    state.mode = 'menu';
    menus.show('main');
  }, 250);
}, 350);
menus.setLoadProgress(55, 'Preparing world...');

// --- gameplay helpers -----------------------------------------------------------
function syncCarVisual() {
  const v = state.vehicle;
  state.carGroup.position.copy(v.chassisBody.position);
  state.carGroup.quaternion.copy(v.chassisBody.quaternion);
  for (let i = 0; i < 4; i++) {
    v.vehicle.updateWheelTransform(i);
    const t = v.vehicle.wheelInfos[i].worldTransform;
    state.wheelMeshes[i].position.copy(t.position);
    state.wheelMeshes[i].quaternion.copy(t.quaternion);
  }
}

function estimateRpm(telem) {
  const base = input.isDown('throttle') ? 0.32 : 0.12;
  return Math.min(1, base + telem.speedRatio * 0.72);
}

function updateStuntTracking(dt, telem, nowSec) {
  if (!telem.grounded) {
    if (!state.airborne) {
      state.airborne = true;
      state.airStart = nowSec;
      state.airRot = 0;
    }
    state.airRot += state.vehicle.chassisBody.angularVelocity.length() * dt;
  } else if (state.airborne) {
    state.airborne = false;
    const airTime = nowSec - state.airStart;
    const flips = state.airRot / (Math.PI * 2);
    if (flips > 1.6) {
      hud.showStunt(`${Math.max(1, Math.round(flips))}x FLIP!`);
    } else if (airTime > 1.4) {
      hud.showStunt('BIG AIR!');
    } else if (airTime > 0.7) {
      hud.showStunt(`AIR ${airTime.toFixed(1)}s`);
    }
  }
}

function handleGlobalInput() {
  if (input.wasActionPressed('pause')) {
    if (state.mode === 'playing') {
      state.mode = 'paused';
      menus.show('pause');
    } else if (state.mode === 'paused') {
      state.mode = 'playing';
      menus.show('hud');
    }
  }
}

function handleGameplayInput() {
  if (input.wasActionPressed('camera')) gameCamera.cycle();
  if (input.wasActionPressed('reset')) state.vehicle.resetUpright();
  if (input.wasActionPressed('horn')) carAudio.playHorn();
}

// --- main loop ------------------------------------------------------------------
let last = performance.now();
function animate() {
  requestAnimationFrame(animate);
  const now = performance.now();
  let dt = (now - last) / 1000;
  last = now;
  dt = Math.min(dt, 1 / 30);

  handleGlobalInput();

  if (state.mode === 'playing' && state.vehicle) {
    handleGameplayInput();
    world.step(1 / 60, dt, 5);
    state.vehicle.update(dt, input);
    syncCarVisual();

    const telem = state.vehicle.getTelemetry();
    updateStuntTracking(dt, telem, now / 1000);
    carAudio.update(estimateRpm(telem), input.isDown('throttle') ? 1 : 0, telem.speedMs, telem.slip);
    gameCamera.update(dt, state.carGroup, telem);
    hud.tick(dt);
    hud.draw(telem, settings.units, state.carGroup, state.mapBounds);

    if (state.vehicle.isStuck) {
      // gentle nudge: auto-respawn if truly wedged for a long time
    }
  }

  input.endFrame();
  composer.render();
}
animate();

window.addEventListener('beforeunload', saveSettings);
