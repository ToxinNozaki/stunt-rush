const KEY = 'stuntrush.save.v1';

export const DEFAULT_BINDINGS = {
  throttle: 'KeyW',
  brake: 'KeyS',
  left: 'KeyA',
  right: 'KeyD',
  handbrake: 'Space',
  camera: 'KeyC',
  reset: 'KeyR',
  horn: 'KeyH',
  pause: 'Escape',
};

export const ALT_BINDINGS = {
  throttle: 'ArrowUp',
  brake: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
};

export const BINDING_LABELS = {
  throttle: 'Throttle',
  brake: 'Brake / Reverse',
  left: 'Steer Left',
  right: 'Steer Right',
  handbrake: 'Handbrake',
  camera: 'Change Camera',
  reset: 'Respawn Car',
  horn: 'Horn',
  pause: 'Pause',
};

const DEFAULT_SETTINGS = {
  graphicsPreset: 'high',
  shadows: true,
  bloom: true,
  drawDistance: 420,
  pixelRatioPct: 100,
  units: 'kmh',
  engineVolume: 70,
  fxVolume: 80,
  bindings: { ...DEFAULT_BINDINGS },
  lastCar: 'raptor',
  lastMap: 'stuntpark',
};

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_SETTINGS, bindings: { ...DEFAULT_BINDINGS } };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_SETTINGS,
      ...parsed,
      bindings: { ...DEFAULT_BINDINGS, ...(parsed.bindings || {}) },
    };
  } catch {
    return { ...DEFAULT_SETTINGS, bindings: { ...DEFAULT_BINDINGS } };
  }
}

export const settings = load();

export function saveSettings() {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* localStorage unavailable (private mode) — settings just won't persist */
  }
}

export const GRAPHICS_PRESETS = {
  low: { shadows: false, bloom: false, drawDistance: 180, pixelRatioPct: 70 },
  medium: { shadows: true, bloom: false, drawDistance: 300, pixelRatioPct: 85 },
  high: { shadows: true, bloom: true, drawDistance: 420, pixelRatioPct: 100 },
  ultra: { shadows: true, bloom: true, drawDistance: 600, pixelRatioPct: 100 },
};

export function applyPreset(name) {
  const preset = GRAPHICS_PRESETS[name];
  if (!preset) return;
  settings.graphicsPreset = name;
  Object.assign(settings, preset);
  saveSettings();
}
