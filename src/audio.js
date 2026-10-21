import { settings } from './storage.js';

// Default engine sound ladder — used by any car that doesn't define its own
// `engineSoundSet` (e.g. the Challenger's real Hellcat recordings). Four
// loops spread across the RPM range, crossfaded by `at` (0..1), plus a
// startup/shutdown one-shot.
export const DEFAULT_ENGINE_SOUND_SET = {
  layers: [
    { key: 'idle', url: './assets/audio/generic/idle.mp3', at: 0 },
    { key: 'low', url: './assets/audio/generic/low.mp3', at: 0.33 },
    { key: 'med', url: './assets/audio/generic/med.mp3', at: 0.66 },
    { key: 'high', url: './assets/audio/generic/high.mp3', at: 1 },
  ],
  startup: './assets/audio/generic/startup.mp3',
  stop: './assets/audio/generic/stop.mp3',
};

/**
 * Engine/tire/wind audio. Every car plays a real recorded engine sample
 * ladder (loops crossfaded by RPM, see `engineSoundSet` — `DEFAULT_ENGINE_SOUND_SET`
 * unless a car defines its own, like the Challenger's Hellcat recordings);
 * a fully procedural synth engine (no samples at all) is kept as a fallback
 * path. Wind, tire screech, horn, and impact thump are always procedural.
 */
export class CarAudio {
  constructor() {
    this.ctx = null;
    this.started = false;
    this.sampleMode = false;
    this._bufferSetCache = new Map();
    this._layerNodes = [];
  }

  _ensureStarted() {
    if (this.started) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    this.ctx = new Ctx();
    const ctx = this.ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 1;
    this.master.connect(ctx.destination);

    this.engineBus = ctx.createGain();
    this.engineBus.connect(this.master);
    this.fxBus = ctx.createGain();
    this.fxBus.connect(this.master);
    this._applyVolumes();

    // Engine: two detuned sawtooth oscillators through a lowpass for body,
    // plus a square for the "growl". Mixed, then pitched by RPM.
    this.oscA = ctx.createOscillator();
    this.oscA.type = 'sawtooth';
    this.oscB = ctx.createOscillator();
    this.oscB.type = 'sawtooth';
    this.oscB.detune.value = 9;
    this.oscC = ctx.createOscillator();
    this.oscC.type = 'square';

    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 900;
    this.filter.Q.value = 0.7;

    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.0001;

    this.oscA.connect(this.filter);
    this.oscB.connect(this.filter);
    this.oscC.connect(this.filter);
    this.filter.connect(this.engineGain);
    this.engineGain.connect(this.engineBus);

    this.oscA.start();
    this.oscB.start();
    this.oscC.start();

    // Wind noise bed — filtered white noise, volume scales with speed.
    const bufSize = 2 * ctx.sampleRate;
    const noiseBuf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = noiseBuf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    this.windSource = ctx.createBufferSource();
    this.windSource.buffer = noiseBuf;
    this.windSource.loop = true;
    this.windFilter = ctx.createBiquadFilter();
    this.windFilter.type = 'highpass';
    this.windFilter.frequency.value = 600;
    this.windGain = ctx.createGain();
    this.windGain.gain.value = 0;
    this.windSource.connect(this.windFilter);
    this.windFilter.connect(this.windGain);
    this.windGain.connect(this.fxBus);
    this.windSource.start();

    // Tire screech — filtered noise, gated by slip amount.
    this.screechSource = ctx.createBufferSource();
    this.screechSource.buffer = noiseBuf;
    this.screechSource.loop = true;
    this.screechFilter = ctx.createBiquadFilter();
    this.screechFilter.type = 'bandpass';
    this.screechFilter.frequency.value = 2200;
    this.screechFilter.Q.value = 2.2;
    this.screechGain = ctx.createGain();
    this.screechGain.gain.value = 0;
    this.screechSource.connect(this.screechFilter);
    this.screechFilter.connect(this.screechGain);
    this.screechGain.connect(this.fxBus);
    this.screechSource.start();

    this.started = true;
  }

  _applyVolumes() {
    if (!this.ctx) return;
    this.engineBus.gain.setTargetAtTime((settings.engineVolume / 100) * 0.5, this.ctx.currentTime, 0.05);
    this.fxBus.gain.setTargetAtTime(settings.fxVolume / 100, this.ctx.currentTime, 0.05);
  }

  /** Call once on first user gesture (menu click) — browsers require this. */
  unlock() {
    this._ensureStarted();
    if (this.ctx.state === 'suspended') this.ctx.resume();
  }

  /** Switches the engine sound ladder for the given car (its own `engineSoundSet`, or the default). */
  setCar(def) {
    this._ensureStarted();
    this._enableSampleEngine(def.engineSoundSet || DEFAULT_ENGINE_SOUND_SET);
  }

  async _loadSoundSet(soundSet) {
    if (this._bufferSetCache.has(soundSet)) return this._bufferSetCache.get(soundSet);
    const loadOne = async (url) => {
      const res = await fetch(url);
      const arrayBuffer = await res.arrayBuffer();
      return this.ctx.decodeAudioData(arrayBuffer);
    };
    const promise = (async () => {
      const layers = await Promise.all(
        soundSet.layers.map(async (layer) => ({ ...layer, buffer: await loadOne(layer.url) }))
      );
      const startup = soundSet.startup ? await loadOne(soundSet.startup) : null;
      const stop = soundSet.stop ? await loadOne(soundSet.stop) : null;
      return { layers, startup, stop };
    })();
    this._bufferSetCache.set(soundSet, promise);
    return promise;
  }

  _stopSampleSources() {
    for (const node of this._layerNodes) {
      try { node.source.stop(); } catch { /* already stopped */ }
    }
    this._layerNodes = [];
  }

  /** Call when leaving/respawning out of a sample-engine car, if a shutdown clip exists. */
  playEngineStop() {
    if (!this._currentStopBuffer) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this._currentStopBuffer;
    const g = ctx.createGain();
    g.gain.value = (settings.engineVolume / 100) * 0.6;
    src.connect(g);
    g.connect(this.engineBus);
    src.start();
  }

  async _enableSampleEngine(soundSet) {
    const requestId = (this._sampleRequestId = (this._sampleRequestId || 0) + 1);
    const { layers, startup, stop } = await this._loadSoundSet(soundSet);
    if (requestId !== this._sampleRequestId) return; // a newer car was selected while this was loading

    const ctx = this.ctx;
    this._stopSampleSources();
    this._currentStopBuffer = stop;

    this._layerNodes = layers.map(({ key, at, buffer }) => {
      const gain = ctx.createGain();
      gain.gain.value = 0.0001;
      gain.connect(this.engineBus);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(gain);
      source.start();
      return { key, at, gain, source };
    });
    this._layerNodes.sort((a, b) => a.at - b.at);

    if (startup) {
      const startupSrc = ctx.createBufferSource();
      startupSrc.buffer = startup;
      const g = ctx.createGain();
      g.gain.value = (settings.engineVolume / 100) * 0.6;
      startupSrc.connect(g);
      g.connect(this.engineBus);
      startupSrc.start();
    }

    this.sampleMode = true;
    this.engineGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05);
  }

  /**
   * @param rpm 0..1 normalized engine speed
   * @param throttle 0..1
   * @param speedMs current speed in m/s
   * @param slip 0..1 wheel slip amount
   */
  update(rpm, throttle, speedMs, slip) {
    if (!this.started) return;
    this._applyVolumes();
    const t = this.ctx.currentTime;

    if (this.sampleMode && this._layerNodes.length) {
      // rpm already tracks actual speed (see estimateRpm in main.js) — crossfade
      // across the layer ladder off it so the sample doesn't sound maxed-out early.
      const nodes = this._layerNodes;
      for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        const prev = nodes[i - 1];
        const next = nodes[i + 1];
        let gain;
        if (prev && rpm < node.at) gain = (rpm - prev.at) / (node.at - prev.at);
        else if (next && rpm > node.at) gain = 1 - (rpm - node.at) / (next.at - node.at);
        else gain = 1;
        node.gain.gain.setTargetAtTime(Math.max(0, Math.min(1, gain)), t, 0.08);
      }
    } else {
      const baseFreq = 38 + rpm * 165;
      this.oscA.frequency.setTargetAtTime(baseFreq, t, 0.03);
      this.oscB.frequency.setTargetAtTime(baseFreq * 1.004, t, 0.03);
      this.oscC.frequency.setTargetAtTime(baseFreq * 0.5, t, 0.03);
      this.filter.frequency.setTargetAtTime(500 + rpm * 2600 + throttle * 250, t, 0.05);
      const vol = 0.18 + rpm * 0.55 + throttle * 0.12;
      this.engineGain.gain.setTargetAtTime(vol, t, 0.04);
    }

    const windVol = Math.min(1, speedMs / 55) * 0.35;
    this.windGain.gain.setTargetAtTime(windVol, t, 0.1);

    this.screechGain.gain.setTargetAtTime(Math.min(1, slip) * 0.22, t, 0.03);
  }

  playHorn() {
    if (!this.started) return;
    const ctx = this.ctx;
    const osc1 = ctx.createOscillator();
    osc1.type = 'sawtooth';
    osc1.frequency.value = 370;
    const osc2 = ctx.createOscillator();
    osc2.type = 'sawtooth';
    osc2.frequency.value = 440;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.linearRampToValueAtTime(0.25, ctx.currentTime + 0.03);
    g.gain.setValueAtTime(0.25, ctx.currentTime + 0.32);
    g.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + 0.4);
    osc1.connect(g);
    osc2.connect(g);
    g.connect(this.fxBus);
    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + 0.42);
    osc2.stop(ctx.currentTime + 0.42);
  }

  playThump(intensity) {
    if (!this.started) return;
    const ctx = this.ctx;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = 70;
    const g = ctx.createGain();
    const amt = Math.min(1, intensity) * 0.6;
    g.gain.setValueAtTime(amt, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
    osc.connect(g);
    g.connect(this.fxBus);
    osc.start();
    osc.stop(ctx.currentTime + 0.26);
  }
}

export const carAudio = new CarAudio();
