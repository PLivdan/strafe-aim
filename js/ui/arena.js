/**
 * arena.js — the map view.
 *
 * A duel seen from above, drawn as an instrument rather than a diagram: dark
 * ground, a hairline grid in real units, and only the things the sentence
 * beside it is about. Blue is you and Red is the enemy, everywhere on the
 * site, in the map and on the monitor and in the prose.
 *
 * Three layers are optional because they are each the subject of exactly one
 * section: the key rose (which of the eight you are holding), the view wedge
 * (where the crosshair points, and so which way the keys point), and the
 * ground tracks (what the form draws on the floor over a whole fight).
 */

import { C, alpha, fitCanvas, MONO } from './palette.js';
import { DIRS, DIR, yourVec } from '../core/forms.js';

const TAU = Math.PI * 2;

export function createArena(canvas, opts = {}) {
  let view = { cx: opts.cx ?? 8, cy: opts.cy ?? 0, span: opts.span ?? 26 };

  /**
   * A figure that is wider than the screen is not more informative for being
   * taller as well. The aspect sets the shape; the cap stops a wide column
   * turning a map into half a page of scrolling.
   */
  function frame() {
    const cssW = opts.width || canvas.parentElement.clientWidth || 420;
    const cssH = opts.height || Math.min(opts.maxHeight ?? 320, Math.round(cssW * (opts.aspect ?? 0.62)));
    return fitCanvas(canvas, cssW, cssH);
  }

  function draw(s, o = {}) {
    const { ctx, w, h } = frame();
    const k = Math.min(w / view.span, h / (view.span * (h / w)));
    const scale = w / view.span;
    const X = (x) => (x - view.cx) * scale + w / 2;
    const Y = (y) => h / 2 - (y - view.cy) * scale;

    ctx.fillStyle = C.scope;
    ctx.fillRect(0, 0, w, h);

    // ── ground grid, in units of the guide's speed ───────────────────
    ctx.strokeStyle = alpha('#ffffff', 0.05);
    ctx.lineWidth = 1;
    const g = view.span > 40 ? 10 : 5;
    ctx.beginPath();
    for (let x = Math.ceil((view.cx - view.span / 2) / g) * g; x < view.cx + view.span / 2; x += g) {
      ctx.moveTo(X(x), 0); ctx.lineTo(X(x), h);
    }
    const yHalf = (view.span * h) / w / 2;
    for (let y = Math.ceil((view.cy - yHalf) / g) * g; y < view.cy + yHalf; y += g) {
      ctx.moveTo(0, Y(y)); ctx.lineTo(w, Y(y));
    }
    ctx.stroke();

    // ── ground tracks ────────────────────────────────────────────────
    if (o.trails !== false) {
      trail(ctx, s.trailHim, X, Y, C.red, 0.42);
      trail(ctx, s.trailYou, X, Y, C.blue, 0.55);
    }

    // ── the sight line ───────────────────────────────────────────────
    ctx.strokeStyle = alpha(C.scopeInk2, 0.32);
    ctx.setLineDash([3, 4]);
    ctx.beginPath();
    ctx.moveTo(X(s.you.x), Y(s.you.y));
    ctx.lineTo(X(s.him.x), Y(s.him.y));
    ctx.stroke();
    ctx.setLineDash([]);

    if (o.rose !== false) keyRose(ctx, s, X, Y, scale, o);
    if (o.wedge) viewWedge(ctx, s, X, Y, scale, o);
    if (o.velocity !== false) {
      arrow(ctx, X(s.you.x), Y(s.you.y), s.you.vx * scale * 0.28, -s.you.vy * scale * 0.28, C.blueLit);
      arrow(ctx, X(s.him.x), Y(s.him.y), s.him.vx * scale * 0.28, -s.him.vy * scale * 0.28, C.redLit);
    }

    body(ctx, X(s.him.x), Y(s.him.y), scale, C.red, s.hisOn && o.showHits !== false);
    body(ctx, X(s.you.x), Y(s.you.y), scale, C.blue, s.yourOn && o.showHits !== false);

    if (o.label !== false) {
      ctx.font = MONO(9.5, 500);
      ctx.fillStyle = alpha(C.blueLit, 0.9);
      ctx.textAlign = 'center';
      ctx.fillText('YOU', X(s.you.x), Y(s.you.y) - Math.max(scale * 0.85, 14));
      ctx.fillStyle = alpha(C.redLit, 0.9);
      ctx.fillText('ENEMY', X(s.him.x), Y(s.him.y) - Math.max(scale * 0.85, 14));
      ctx.textAlign = 'left';
    }
    if (o.overlay) o.overlay(ctx, { X, Y, scale, w, h });
    return { X, Y, scale, w, h };
  }

  return {
    draw,
    /**
     * Keep both players comfortably inside the frame as the fight travels.
     *
     * The span is a width, so the vertical extent has to be divided by the
     * aspect before it can be compared against it. Without that division a
     * fight that drifts sideways stays framed and a fight that circles walks
     * straight out of the top of the picture.
     */
    follow(s, pad = 1.5) {
      const box = canvas.getBoundingClientRect();
      const ratio = box.width > 0 ? box.height / box.width : (opts.aspect ?? 0.62);
      const minX = Math.min(s.you.x, s.him.x), maxX = Math.max(s.you.x, s.him.x);
      const minY = Math.min(s.you.y, s.him.y), maxY = Math.max(s.you.y, s.him.y);
      // Generous margins, and a fifth of breathing room on top: the players
      // should never be near an edge, because the edge is where the labels
      // and the movement arrows live.
      const want = Math.max(maxX - minX + pad * 6, (maxY - minY + pad * 4) / Math.max(0.2, ratio)) * 1.2;
      // Quick enough to keep up with a form that travels; the remaining lag
      // reads as smoothing rather than as the camera losing the fight.
      view.cx += ((minX + maxX) / 2 - view.cx) * 0.16;
      view.cy += ((minY + maxY) / 2 - view.cy) * 0.16;
      view.span += (Math.max(want, opts.minSpan ?? 18) - view.span) * 0.14;
    },
    set(v) { Object.assign(view, v); },
    get view() { return view; },
  };
}

function trail(ctx, pts, X, Y, color, a) {
  if (!pts || pts.length < 4) return;
  const n = pts.length / 2;
  ctx.lineWidth = 1.4;
  ctx.lineJoin = 'round';
  for (let i = 1; i < n; i++) {
    const f = i / n;
    ctx.strokeStyle = alpha(color, a * f * f);
    ctx.beginPath();
    ctx.moveTo(X(pts[(i - 1) * 2]), Y(pts[(i - 1) * 2 + 1]));
    ctx.lineTo(X(pts[i * 2]), Y(pts[i * 2 + 1]));
    ctx.stroke();
  }
}

function body(ctx, x, y, scale, color, lit) {
  const r = Math.max(3.5, scale * 0.5);
  if (lit) {
    ctx.fillStyle = alpha(C.orangeLit, 0.22);
    ctx.beginPath(); ctx.arc(x, y, r * 2.1, 0, TAU); ctx.fill();
  }
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  ctx.strokeStyle = alpha('#ffffff', 0.55);
  ctx.lineWidth = 1;
  ctx.stroke();
}

function arrow(ctx, x, y, dx, dy, color) {
  const len = Math.hypot(dx, dy);
  if (len < 2) return;
  ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dx, y + dy); ctx.stroke();
  const a = Math.atan2(dy, dx);
  ctx.beginPath();
  ctx.moveTo(x + dx, y + dy);
  ctx.lineTo(x + dx - 7 * Math.cos(a - 0.4), y + dy - 7 * Math.sin(a - 0.4));
  ctx.lineTo(x + dx - 7 * Math.cos(a + 0.4), y + dy - 7 * Math.sin(a + 0.4));
  ctx.fill();
}

/**
 * The eight keys around a player, in that player's own frame, with the one
 * they are holding lit. The rose is the reason the same word means opposite
 * world directions for the two of them: it is drawn rotated by each player's
 * own view.
 */
function keyRose(ctx, s, X, Y, scale, o) {
  const R = Math.max(16, scale * 1.7);
  const both = o.rose === 'both';
  const draw = (px, py, yaw, held, color) => {
    ctx.lineWidth = 1;
    for (const d of DIRS) {
      const a = -(yaw + d.a * Math.PI / 180);
      const on = d.key === held;
      ctx.strokeStyle = on ? color : alpha(C.scopeInk2, 0.22);
      ctx.lineWidth = on ? 2.2 : 1;
      ctx.beginPath();
      ctx.moveTo(px + Math.cos(a) * R * 0.42, py + Math.sin(a) * R * 0.42);
      ctx.lineTo(px + Math.cos(a) * R, py + Math.sin(a) * R);
      ctx.stroke();
      if (on) {
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(px + Math.cos(a) * R, py + Math.sin(a) * R, 2.6, 0, TAU); ctx.fill();
      }
    }
  };
  draw(X(s.you.x), Y(s.you.y), s.yourYaw ?? 0, s.you.key, C.blueLit);
  if (both) draw(X(s.him.x), Y(s.him.y), s.hisYaw ?? Math.PI, s.him.key, C.redLit);
}

/** Where the crosshair points, and how far the body has fallen out of it. */
function viewWedge(ctx, s, X, Y, scale, o) {
  const fov = (o.fov ?? 90) * Math.PI / 180;
  const L = Math.max(40, scale * 12);
  const px = X(s.you.x), py = Y(s.you.y);
  const yaw = -(s.yourYaw ?? 0);
  ctx.fillStyle = alpha(C.blueLit, 0.07);
  ctx.beginPath();
  ctx.moveTo(px, py);
  ctx.arc(px, py, L, yaw - fov / 2, yaw + fov / 2);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = alpha(C.blueLit, 0.75);
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(yaw) * L, py + Math.sin(yaw) * L); ctx.stroke();
}
