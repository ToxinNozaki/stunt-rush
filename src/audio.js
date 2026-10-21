import { settings } from './storage.js';

/**
 * Engine/tire/wind audio. Most cars use fully procedural synthesis — no
 * sample files, zero licensing risk. A car can opt into real recorded engine
 * samples via `engineSoundSet` (idle/accelerating loops crossfaded by RPM,
 * plus a one-shot startup clip); everything else (wind, screech, horn,
 * thump) stays procedural either way.
 */
export class CarAudio {
  constructor() {
    this.ctx = null;
    this.started = false;
    this.sampleMode = false;
    this._bufferSetCache = new Map();
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

  /** Switches the engine layer for the given car — sample-based if it has an engineSoundSet, procedural otherwise. */
  setCar(def) {
    this._ensureStarted();
    if (def.engineSoundSet) this._enableSampleEngine(def.engineSoundSet);
    else this._disableSampleEngine();
  }

  async _loadBufferSet(soundSet) {
    const key = soundSet.idle;
    if (this._bufferSetCache.has(key)) return this._bufferSetCache.get(key);
    const promise = Promise.all(
      Object.entries(soundSet).map(async ([name, url]) => {
        const res = await fetch(url);
        const arrayBuffer = await res.arrayBuffer();
        const buffer = await this.ctx.decodeAudioData(arrayBuffer);
        return [name, buffer];
      })
    ).then(Object.fromEntries);
    this._bufferSetCache.set(key, promise);
    return promise;
  }

  _stopSampleSources() {
    for (const src of [this.idleSource, this.accelSource]) {
      if (!src) continue;
      try { src.stop(); } catch { /* already stopped */ }
    }
    this.idleSource = null;
    this.accelSource = null;
  }

  async _enableSampleEngine(soundSet) {
    const requestId = (this._sampleRequestId = (this._sampleRequestId || 0) + 1);
    const buffers = await this._loadBufferSet(soundSet);
    if (requestId !== this._sampleRequestId) return; // a newer car was selected while this was loading

    const ctx = this.ctx;
    this._stopSampleSources();

    this.idleGain = this.idleGain || ctx.createGain();
    this.accelGain = this.accelGain || ctx.createGain();
    this.idleGain.connect(this.engineBus);
    this.accelGain.connect(this.engineBus);

    this.idleSource = ctx.createBufferSource();
    this.idleSource.buffer = buffers.idle;
    this.idleSource.loop = true;
    this.idleSource.connect(this.idleGain);
    this.idleSource.start();

    this.accelSource = ctx.createBufferSource();
    this.accelSource.buffer = buffers.accelerating;
    this.accelSource.loop = true;
    this.accelSource.connect(this.accelGain);
    this.accelSource.start();

    if (buffers.startup) {
      const startupSrc = ctx.createBufferSource();
      startupSrc.buffer = buffers.startup;
      const g = ctx.createGain();
      g.gain.value = (settings.engineVolume / 100) * 0.6;
      startupSrc.connect(g);
      g.connect(this.engineBus);
      startupSrc.start();
    }

    this.sampleMode = true;
    this.engineGain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.05);
  }

  _disableSampleEngine() {
    this._sampleRequestId = (this._sampleRequestId || 0) + 1;
    this._stopSampleSources();
    this.sampleMode = false;
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

    if (this.sampleMode && this.idleSource && this.accelSource) {
      // rpm already tracks actual speed (see estimateRpm in main.js) — crossfade
      // and pitch straight off it so the sample doesn't sound maxed-out early.
      this.idleGain.gain.setTargetAtTime((1 - rpm) * 0.9, t, 0.08);
      this.accelGain.gain.setTargetAtTime(rpm * 0.95, t, 0.08);
      const rate = 0.8 + rpm * 0.55;
      this.idleSource.playbackRate.setTargetAtTime(rate, t, 0.08);
      this.accelSource.playbackRate.setTargetAtTime(rate, t, 0.08);
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
