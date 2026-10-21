export class Hud {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.popupEl = document.getElementById('stunt-popup');
    this.popupTimer = 0;
  }

  resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = window.innerWidth * dpr;
    this.canvas.height = window.innerHeight * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = window.innerWidth;
    this.h = window.innerHeight;
  }

  showStunt(text) {
    this.popupEl.textContent = text;
    this.popupEl.classList.add('show');
    this.popupTimer = 1.9;
  }

  tick(dt) {
    if (this.popupTimer > 0) {
      this.popupTimer -= dt;
      if (this.popupTimer <= 0) this.popupEl.classList.remove('show');
    }
  }

  draw(telemetry, units, carGroup, bounds) {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.w, this.h);
    this._drawMinimap(ctx, carGroup, bounds);
    this._drawSpeedo(ctx, telemetry, units);
    this._drawAirIndicator(ctx, telemetry);
  }

  _drawSpeedo(ctx, telemetry, units) {
    const r = 92;
    const cx = this.w - r - 36;
    const cy = this.h - r - 30;
    const maxSpeed = units === 'mph' ? 190 : 310;
    const speedVal = units === 'mph' ? telemetry.speedMph : telemetry.speedKmh;
    const frac = Math.min(1, speedVal / maxSpeed);
    const startAngle = Math.PI * 0.72;
    const sweep = Math.PI * 1.56;

    ctx.save();
    ctx.translate(cx, cy);

    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(12,15,20,0.58)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.stroke();

    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.arc(0, 0, r - 12, startAngle, startAngle + sweep);
    ctx.stroke();

    const grad = ctx.createLinearGradient(-r, 0, r, 0);
    grad.addColorStop(0, '#2fd1c7');
    grad.addColorStop(0.65, '#ff7a1a');
    grad.addColorStop(1, '#ff4d5e');
    ctx.strokeStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, r - 12, startAngle, startAngle + sweep * frac);
    ctx.stroke();

    for (let i = 0; i <= 10; i++) {
      const a = startAngle + sweep * (i / 10);
      const inner = r - 22;
      const outer = r - 12;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
      ctx.lineTo(Math.cos(a) * outer, Math.sin(a) * outer);
      ctx.strokeStyle = 'rgba(255,255,255,0.35)';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    const needleAngle = startAngle + sweep * frac;
    ctx.beginPath();
    ctx.moveTo(Math.cos(needleAngle + Math.PI) * 10, Math.sin(needleAngle + Math.PI) * 10);
    ctx.lineTo(Math.cos(needleAngle) * (r - 26), Math.sin(needleAngle) * (r - 26));
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#e8ecf1';
    ctx.font = '700 34px "Chakra Petch", sans-serif';
    ctx.fillText(Math.round(speedVal).toString(), 0, 10);
    ctx.font = '600 12px "Rajdhani", sans-serif';
    ctx.fillStyle = '#8a93a1';
    ctx.fillText(units === 'mph' ? 'MPH' : 'KM/H', 0, 28);

    ctx.font = '700 15px "Chakra Petch", sans-serif';
    ctx.fillStyle = telemetry.grounded ? '#2fd1c7' : '#ff7a1a';
    ctx.fillText(telemetry.grounded ? `GEAR ${telemetry.gear}` : 'AIRBORNE', 0, -34);

    ctx.restore();
  }

  _drawMinimap(ctx, carGroup, bounds) {
    const size = 150;
    const margin = 22;
    const cx = margin + size / 2;
    const cy = margin + size / 2;

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(12,15,20,0.58)';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255,255,255,0.14)';
    ctx.stroke();
    ctx.clip();

    const scale = (size * 0.46) / bounds;
    const px = cx + carGroup.position.x * scale;
    const py = cy + carGroup.position.z * scale;

    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let gx = -4; gx <= 4; gx++) {
      ctx.fillRect(cx + gx * 30 - 0.5, 0, 1, size + margin * 2);
    }

    const forward = { x: Math.sin(this._yawFrom(carGroup)), y: Math.cos(this._yawFrom(carGroup)) };
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(Math.atan2(forward.x, forward.y));
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 6);
    ctx.lineTo(-5, 6);
    ctx.closePath();
    ctx.fillStyle = '#ff7a1a';
    ctx.fill();
    ctx.restore();

    ctx.restore();
  }

  _yawFrom(carGroup) {
    const q = carGroup.quaternion;
    return Math.atan2(2 * (q.w * q.y + q.x * q.z), 1 - 2 * (q.y * q.y + q.x * q.x));
  }

  _drawAirIndicator(ctx, telemetry) {
    if (telemetry.grounded) return;
    ctx.save();
    ctx.textAlign = 'center';
    ctx.font = '600 13px "Rajdhani", sans-serif';
    ctx.fillStyle = 'rgba(255,122,26,0.85)';
    ctx.fillText('air control: steer to flip', this.w / 2, this.h - 36);
    ctx.restore();
  }
}
