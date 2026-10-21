import { settings, ALT_BINDINGS, saveSettings } from './storage.js';

class InputManager {
  constructor() {
    this.keys = new Set();
    this.listenCallback = null;
    this._justPressed = new Set();

    window.addEventListener('keydown', (e) => {
      if (this.listenCallback) {
        e.preventDefault();
        if (e.code !== 'Unidentified') {
          this.listenCallback(e.code);
          this.listenCallback = null;
        }
        return;
      }
      if (!this.keys.has(e.code)) this._justPressed.add(e.code);
      this.keys.add(e.code);
      if (this._isGameKey(e.code)) e.preventDefault();
    });

    window.addEventListener('keyup', (e) => {
      this.keys.delete(e.code);
    });

    window.addEventListener('blur', () => this.keys.clear());
  }

  _isGameKey(code) {
    const bound = Object.values(settings.bindings).includes(code);
    const alt = Object.values(ALT_BINDINGS).includes(code);
    return bound || alt;
  }

  isDown(action) {
    const bound = settings.bindings[action];
    if (bound && this.keys.has(bound)) return true;
    const alt = ALT_BINDINGS[action];
    if (alt && this.keys.has(alt)) return true;
    return false;
  }

  wasJustPressed(code) {
    const v = this._justPressed.has(code);
    return v;
  }

  wasActionPressed(action) {
    const bound = settings.bindings[action];
    if (bound && this._justPressed.has(bound)) return true;
    const alt = ALT_BINDINGS[action];
    if (alt && this._justPressed.has(alt)) return true;
    return false;
  }

  endFrame() {
    this._justPressed.clear();
  }

  /** Begin listening for the next keydown; calls cb(code) once, then stops. */
  listenForKey(cb) {
    this.listenCallback = cb;
  }

  cancelListen() {
    this.listenCallback = null;
  }

  rebind(action, code) {
    settings.bindings[action] = code;
    saveSettings();
  }

  static keyLabel(code) {
    if (!code) return '—';
    if (code === 'Space') return 'Space';
    if (code.startsWith('Key')) return code.slice(3);
    if (code.startsWith('Digit')) return code.slice(5);
    if (code.startsWith('Arrow')) return code.slice(5) + ' Arrow';
    return code;
  }
}

export const input = new InputManager();
