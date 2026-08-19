/**
 * monitor.js — what the fight actually looks like from behind the crosshair.
 *
 * The map view is where the argument is made and this is where it is felt.
 * Everything the guide calls hard or easy is a claim about this picture: how
 * fast the body slides, how far the crosshair falls behind when he turns, and
 * how long it takes to get back.
 *
 * The body is drawn at its true angular size for the range, and its position
 * is the aim error in radians — no fudge factor, so a figure that says the
 * target is nearly motionless is showing you a target that is nearly
 * motionless.
 */

import { C, alpha, fitCanvas, MONO, UI } from './palette.js';

export function createMonitor(canvas, opts = {}) {
  const fov = (opts.fov ?? 90) * Math.PI / 180;
  const smear = [];

  function draw(s, o = {}) {
    const cssW = opts.width || canvas.parentElement.clientWidth || 380;
    const cssH = opts.height || Math.min(opts.maxHeight ?? 230, Math.round(cssW * (opts.aspect ?? 0.42)));
    const { ctx, w, h } = fitCanvas(canvas, cssW, cssH);
    const ppr = w / fov;                      // pixels per radian

    // ── the room ─────────────────────────────────────────────────────
    const sky = ctx.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, '#0b1114');
    sky.addColorStop(0.52, '#131c21');
    sky.addColorStop(0.54, '#1b262c');
    sky.addColorStop(1, '#0d1418');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, w, h);

    // Which chair this is. A fight has two monitors and half the point of a
    // form is what it does to the other one.
    const pov = o.pov ?? 'you';
    const err = pov === 'him' ? (s.hisErr ?? 0) : (s.yourErr ?? 0);
    const on = pov === 'him' ? s.hisOn : s.yourOn;
    const bodyColour = pov === 'him' ? C.blue : C.red;
    const bodyLit = pov === 'him' ? C.blueLit : C.redLit;

    // Wall seams, parallaxing with the yaw, so your own movement is visible
    // on the monitor rather than only in the map.
    const yaw = (pov === 'him' ? s.hisYaw : s.yourYaw) ?? 0;
    ctx.strokeStyle = alpha('#ffffff', 0.055);
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = -8; i <= 8; i++) {
      const a = i * 0.28 - (yaw % (Math.PI * 2));
      const x = w / 2 + a * ppr;
      if (x < -20 || x > w + 20) continue;
      ctx.moveTo(x, 0); ctx.lineTo(x, h * 0.54);
    }
    ctx.stroke();
    ctx.strokeStyle = alpha('#ffffff', 0.09);
    ctx.beginPath(); ctx.moveTo(0, h * 0.535); ctx.lineTo(w, h * 0.535); ctx.stroke();

    // ── the body ─────────────────────────────────────────────────────
    const half = s.halfAngle ?? 0.03;
    const bx = w / 2 - err * ppr;
    const bw = Math.max(3, half * 2 * ppr);
    const bh = bw * 2.1;
    const by = h * 0.535 - bh;

    // The smear is the apparent motion made visible: where the body has been
    // over the last fraction of a second, which is exactly the quantity the
    // relative-speed arithmetic is about.
    if (o.smear !== false) {
      smear.push(bx, by, bw, bh);
      if (smear.length > 4 * (o.smearFrames ?? 16)) smear.splice(0, 4);
      for (let i = 0; i < smear.length; i += 4) {
        const f = i / smear.length;
        ctx.fillStyle = alpha(bodyLit, 0.1 * f * f);
        ctx.fillRect(smear[i] - smear[i + 2] / 2, smear[i + 1], smear[i + 2], smear[i + 3]);
      }
    }

    ctx.fillStyle = on ? bodyLit : bodyColour;
    ctx.fillRect(bx - bw / 2, by, bw, bh);
    ctx.fillStyle = alpha('#ffffff', 0.16);
    ctx.fillRect(bx - bw / 2, by, bw, bh * 0.3);

    // ── the crosshair ────────────────────────────────────────────────
    const cx = w / 2, cy = h * 0.535 - bh * 0.62;
    ctx.strokeStyle = on ? C.orangeLit : alpha(C.scopeInk, 0.85);
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx - 9, cy); ctx.lineTo(cx - 3, cy);
    ctx.moveTo(cx + 3, cy); ctx.lineTo(cx + 9, cy);
    ctx.moveTo(cx, cy - 9); ctx.lineTo(cx, cy - 3);
    ctx.moveTo(cx, cy + 3); ctx.lineTo(cx, cy + 9);
    ctx.stroke();
    ctx.fillStyle = on ? C.orangeLit : alpha(C.scopeInk, 0.9);
    ctx.fillRect(cx - 1, cy - 1, 2, 2);

    // ── the gap, named ───────────────────────────────────────────────
    if (o.gap !== false && Math.abs(err) > half) {
      const gx0 = cx, gx1 = bx + (err > 0 ? bw / 2 : -bw / 2);
      ctx.strokeStyle = alpha(C.yellowLit, 0.85);
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 3]);
      ctx.beginPath(); ctx.moveTo(gx0, cy + 16); ctx.lineTo(gx1, cy + 16); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = MONO(9.5, 500);
      ctx.fillStyle = alpha(C.yellowLit, 0.95);
      ctx.textAlign = 'center';
      ctx.fillText(`${(Math.abs(err) * 180 / Math.PI).toFixed(1)}°`, (gx0 + gx1) / 2, cy + 29);
      ctx.textAlign = 'left';
    }

    if (o.hud !== false) {
      ctx.font = MONO(9.5, 500);
      ctx.fillStyle = alpha(C.scopeInk2, 0.85);
      ctx.fillText(o.hudLeft ?? `${(fov * 180 / Math.PI).toFixed(0)}° fov`, 8, 14);
      if (o.hudRight) {
        ctx.textAlign = 'right';
        ctx.fillStyle = alpha(C.scopeInk, 0.9);
        ctx.fillText(o.hudRight, w - 8, 14);
        ctx.textAlign = 'left';
      }
    }
    if (o.overlay) o.overlay(ctx, { w, h, ppr, bx, by, bw, bh, cx, cy });
    return { w, h, ppr };
  }

  return { draw, clear() { smear.length = 0; } };
}

/**
 * The mouse trace: where the crosshair has been, as a strip of time.
 *
 * This is the picture people mean when they say a form "moves the mouse a
 * lot". A flat line is a form that does not ask for mouse control; a steep
 * sawtooth is one that asks for a great deal of it.
 */
export function drawMouseTrace(canvas, series, opts = {}) {
  const cssW = opts.width || canvas.parentElement.clientWidth || 380;
  const cssH = opts.height ?? 92;
  const { ctx, w, h } = fitCanvas(canvas, cssW, cssH);
  ctx.fillStyle = C.scope;
  ctx.fillRect(0, 0, w, h);

  const n = series.length / 2;
  if (n < 3) return;
  const t1 = series[series.length - 2];
  const t0 = Math.max(series[0], t1 - (opts.window ?? 3));
  let lo = Infinity, hi = -Infinity;
  for (let i = 0; i < n; i++) {
    if (series[i * 2] < t0) continue;
    lo = Math.min(lo, series[i * 2 + 1]); hi = Math.max(hi, series[i * 2 + 1]);
  }
  const span = Math.max(opts.minSpan ?? 0.25, (hi - lo) * 1.25);
  const mid = (lo + hi) / 2;
  const X = (t) => ((t - t0) / Math.max(1e-6, t1 - t0)) * (w - 8) + 4;
  const Y = (v) => h / 2 - ((v - mid) / span) * (h - 16);

  ctx.strokeStyle = alpha('#ffffff', 0.06);
  ctx.beginPath();
  for (let i = 1; i < 4; i++) { ctx.moveTo(0, (h * i) / 4); ctx.lineTo(w, (h * i) / 4); }
  ctx.stroke();

  ctx.strokeStyle = opts.color ?? C.blueLit;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  let started = false;
  for (let i = 0; i < n; i++) {
    const t = series[i * 2];
    if (t < t0) continue;
    const x = X(t), y = Y(series[i * 2 + 1]);
    if (!started) { ctx.moveTo(x, y); started = true; } else ctx.lineTo(x, y);
  }
  ctx.stroke();

  if (opts.label) {
    ctx.font = MONO(9.5, 500);
    ctx.fillStyle = alpha(C.scopeInk2, 0.85);
    ctx.fillText(opts.label, 8, 13);
  }
  if (opts.right) {
    ctx.font = MONO(9.5, 500);
    ctx.textAlign = 'right';
    ctx.fillStyle = alpha(C.scopeInk, 0.9);
    ctx.fillText(opts.right, w - 8, 13);
    ctx.textAlign = 'left';
  }
}

/**
 * A hit strip: one pixel column per frame, lit when the crosshair was on the
 * body. Accuracy as a texture rather than a percentage.
 */
export function drawHitStrip(canvas, hits, opts = {}) {
  const cssW = opts.width || canvas.parentElement.clientWidth || 380;
  const cssH = opts.height ?? 20;
  const { ctx, w, h } = fitCanvas(canvas, cssW, cssH);
  ctx.fillStyle = C.scope2;
  ctx.fillRect(0, 0, w, h);
  const n = hits.length;
  if (!n) return;
  const bw = w / n;
  for (let i = 0; i < n; i++) {
    if (!hits[i]) continue;
    ctx.fillStyle = opts.color ?? C.orangeLit;
    ctx.fillRect(i * bw, 0, Math.max(1, bw), h);
  }
}
