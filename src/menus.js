import { CARS } from './cars.js';
import { MAPS } from './maps/index.js';
import { settings, saveSettings, applyPreset, GRAPHICS_PRESETS, BINDING_LABELS, DEFAULT_BINDINGS } from './storage.js';
import { input } from './input.js';
import { carAudio } from './audio.js';

const $ = (sel) => document.querySelector(sel);
const screens = {
  loading: $('#loading-screen'),
  main: $('#main-menu'),
  select: $('#select-screen'),
  settings: $('#settings-screen'),
  hud: $('#hud'),
  pause: $('#pause-menu'),
};

function statRange(key, getVal) {
  const vals = CARS.map(getVal);
  return { min: Math.min(...vals), max: Math.max(...vals) };
}

const RANGES = {
  speed: statRange('speed', (c) => c.engineForce / c.mass),
  grip: statRange('grip', (c) => c.frictionSlip),
  stability: statRange('stability', (c) => c.mass),
  handling: statRange('handling', (c) => c.maxSteer),
};

function pct(val, range) {
  return Math.round(((val - range.min) / (range.max - range.min || 1)) * 100);
}

export class Menus {
  constructor({ onStart, onResume, onRespawn, onQuit, onGraphicsChange }) {
    this.onStart = onStart;
    this.onResume = onResume;
    this.onRespawn = onRespawn;
    this.onQuit = onQuit;
    this.onGraphicsChange = onGraphicsChange;
    this.selectedMap = settings.lastMap;
    this.selectedCar = settings.lastCar;
    this.settingsReturnTo = 'main';
    this._wire();
  }

  show(name) {
    for (const key in screens) screens[key].classList.add('hidden');
    screens[name].classList.remove('hidden');
  }

  setLoadProgress(pct, label) {
    $('#load-fill').style.width = `${pct}%`;
    if (label) $('#load-label').textContent = label;
  }

  _wire() {
    $('#btn-play').addEventListener('click', () => { carAudio.unlock(); this._renderSelect(); this.show('select'); });
    $('#btn-settings').addEventListener('click', () => { this.settingsReturnTo = 'main'; this._renderSettings(); this.show('settings'); });
    $('#btn-back-menu').addEventListener('click', () => this.show('main'));
    $('#btn-start').addEventListener('click', () => {
      settings.lastMap = this.selectedMap;
      settings.lastCar = this.selectedCar;
      saveSettings();
      this.onStart(this.selectedMap, this.selectedCar);
    });
    $('#btn-settings-done').addEventListener('click', () => this.show(this.settingsReturnTo));

    $('#btn-resume').addEventListener('click', () => this.onResume());
    $('#btn-pause-settings').addEventListener('click', () => { this.settingsReturnTo = 'pause'; this._renderSettings(); this.show('settings'); });
    $('#btn-respawn').addEventListener('click', () => this.onRespawn());
    $('#btn-quit').addEventListener('click', () => this.onQuit());

    document.querySelectorAll('.tab-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
        document.querySelectorAll('.tab-panel').forEach((p) => p.classList.add('hidden'));
        btn.classList.add('active');
        document.querySelector(`.tab-panel[data-tab="${btn.dataset.tab}"]`).classList.remove('hidden');
      });
    });

    $('#preset-group').addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      applyPreset(btn.dataset.preset);
      this._renderSettings();
      this.onGraphicsChange();
    });

    $('#unit-group').addEventListener('click', (e) => {
      const btn = e.target.closest('button');
      if (!btn) return;
      settings.units = btn.dataset.unit;
      saveSettings();
      this._renderSettings();
    });

    $('#opt-shadows').addEventListener('change', (e) => { settings.shadows = e.target.checked; saveSettings(); this.onGraphicsChange(); });
    $('#opt-bloom').addEventListener('change', (e) => { settings.bloom = e.target.checked; saveSettings(); this.onGraphicsChange(); });
    $('#opt-drawdist').addEventListener('input', (e) => { settings.drawDistance = Number(e.target.value); saveSettings(); this.onGraphicsChange(); });
    $('#opt-pixelratio').addEventListener('input', (e) => { settings.pixelRatioPct = Number(e.target.value); saveSettings(); this.onGraphicsChange(); });
    $('#opt-vol-engine').addEventListener('input', (e) => { settings.engineVolume = Number(e.target.value); saveSettings(); });
    $('#opt-vol-fx').addEventListener('input', (e) => { settings.fxVolume = Number(e.target.value); saveSettings(); });

    $('#btn-reset-binds').addEventListener('click', () => {
      settings.bindings = { ...DEFAULT_BINDINGS };
      saveSettings();
      this._renderRebindList();
    });
  }

  _renderSelect() {
    const mapList = $('#map-list');
    mapList.innerHTML = '';
    for (const m of MAPS) {
      const el = document.createElement('div');
      const mapColorHex = '#' + m.META.color.toString(16).padStart(6, '0');
      el.className = 'select-item' + (m.META.id === this.selectedMap ? ' active' : '');
      el.innerHTML = `<div class="swatch" style="background:${mapColorHex}"></div><div class="name">${m.META.name}</div><div class="desc">${m.META.desc}</div>`;
      el.addEventListener('click', () => { this.selectedMap = m.META.id; this._renderSelect(); });
      mapList.appendChild(el);
    }

    const carList = $('#car-list');
    carList.innerHTML = '';
    for (const c of CARS) {
      const el = document.createElement('div');
      el.className = 'select-item' + (c.id === this.selectedCar ? ' active' : '');
      const colorHex = '#' + c.color.toString(16).padStart(6, '0');
      el.innerHTML = `<div class="swatch" style="background:${colorHex}"></div><div class="name">${c.name}</div><div class="desc">${c.desc}</div>`;
      el.addEventListener('click', () => { this.selectedCar = c.id; this._renderSelect(); });
      carList.appendChild(el);
    }

    const car = CARS.find((c) => c.id === this.selectedCar);
    const stats = $('#car-stats');
    const rows = [
      ['Speed', pct(car.engineForce / car.mass, RANGES.speed)],
      ['Grip', pct(car.frictionSlip, RANGES.grip)],
      ['Stability', pct(car.mass, RANGES.stability)],
      ['Handling', pct(car.maxSteer, RANGES.handling)],
    ];
    stats.innerHTML = rows.map(([label, v]) => `
      <div class="stat-row"><div class="stat-label">${label}</div><div class="stat-bar"><div class="stat-fill" style="width:${v}%"></div></div></div>
    `).join('') + `<div class="stat-row"><div class="stat-label">Top Speed</div><div style="font-weight:700">${car.topSpeedKmh} km/h</div></div>`;
  }

  _renderSettings() {
    document.querySelectorAll('#preset-group button').forEach((b) => b.classList.toggle('active', b.dataset.preset === settings.graphicsPreset));
    document.querySelectorAll('#unit-group button').forEach((b) => b.classList.toggle('active', b.dataset.unit === settings.units));
    $('#opt-shadows').checked = settings.shadows;
    $('#opt-bloom').checked = settings.bloom;
    $('#opt-drawdist').value = settings.drawDistance;
    $('#opt-pixelratio').value = settings.pixelRatioPct;
    $('#opt-vol-engine').value = settings.engineVolume;
    $('#opt-vol-fx').value = settings.fxVolume;
    this._renderRebindList();
  }

  _renderRebindList() {
    const list = $('#rebind-list');
    list.innerHTML = '';
    for (const action of Object.keys(BINDING_LABELS)) {
      const row = document.createElement('div');
      row.className = 'rebind-row';
      const keyLabel = input.constructor.keyLabel(settings.bindings[action]);
      row.innerHTML = `<span>${BINDING_LABELS[action]}</span><span class="rebind-key" data-action="${action}">${keyLabel}</span>`;
      list.appendChild(row);
    }
    list.querySelectorAll('.rebind-key').forEach((el) => {
      el.addEventListener('click', () => {
        list.querySelectorAll('.rebind-key').forEach((e2) => e2.classList.remove('listening'));
        el.classList.add('listening');
        el.textContent = 'press a key…';
        input.listenForKey((code) => {
          if (code === 'Escape') {
            el.textContent = input.constructor.keyLabel(settings.bindings[el.dataset.action]);
          } else {
            input.rebind(el.dataset.action, code);
            el.textContent = input.constructor.keyLabel(code);
          }
          el.classList.remove('listening');
        });
      });
    });
  }
}
