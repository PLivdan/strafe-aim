/**
 * sim.js — two players, a mouse each, and a clock.
 *
 * The guide argues about strafe aiming in prose and asks you to picture it.
 * This runs it. Both players move on the ground with the same eight keys and
 * the same acceleration, both hold a crosshair that lags reality by a
 * reaction time, and both are scored by whether that crosshair is on a body.
 *
 * The model has exactly four ideas in it:
 *
 *   1. Keys are named in your view frame, so where you look decides where a
 *      key takes you. This is why the ground tracks curve.
 *   2. What your mouse has to do is the apparent angular velocity of the
 *      target, which is the relative speed across the sight line divided by
 *      the range. Not the speed on the map — the speed on the monitor.
 *   3. You cannot see the present. Everything the aim controller reacts to is
 *      one reaction time old, so a change of direction is always paid for.
 *   4. Smoothness is not free at speed. Tracking error grows with how fast
 *      the mouse is moving, which is the whole reason a fast form leans on
 *      mouse control and a slow one does not.
 *
 * Nothing here knows what mirroring is. The forms are inputs.
 */

import { SPEED, DIR, yourVec, hisVec } from './forms.js';

/** Deterministic noise, so a figure looks the same on every load. */
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const DEFAULTS = {
  /** Units per second on the ground. The guide's round number. */
  speed: SPEED,
  /** Seconds from a standing start to full speed. Overwatch is nearly zero. */
  accel: 0.08,
  /** Half the width of a body, in the same units. A Quake player is about 1. */
  bodyHalf: 0.5,
  /** Starting range between the two players. */
  range: 16,

  /** The reactive part: how long before a change of direction is noticed. */
  react: 0.20,
  /** The correcting part, as a speed: how fast the flick back can be, rad/s. */
  flick: 9,
  /** How badly the flick lands. 0.08 means it misses by 8% of its own size. */
  precision: 0.075,
  /** Tracking wobble that does not depend on speed, radians. */
  jitter: 0.0022,
  /** Extra wobble per radian per second of mouse motion. Mouse control. */
  jitterRate: 0.016,
  /** Gentle trim applied while tracking, per second. */
  trim: 2.2,
  /**
   * 'track' follows him. 'center' does the other thing the guide describes:
   * park the crosshair in the middle of his dodge and take the free hits as
   * he passes through it, which is what you do to someone changing direction
   * faster than anyone can answer.
   */
  aimStyle: 'track',
  /** Static friction: below this commanded rate the mouse does not break loose. */
  stiction: 0.03,
  /**
   * Which facing the movement keys are resolved against.
   *
   * 'bearing' points each player squarely at the other. This is the guide's
   * frame: the view-angle is defined relative to the target, and W is a
   * direction relative to him. 'crosshair' resolves the keys against the
   * player's actual crosshair instead, lag and all, which is more literal but
   * introduces a slow outward spiral in an empty plane — every reacquisition
   * leaves the facing a few degrees behind the travel, and a few degrees of
   * a ten-unit-per-second run adds up. That drift is an artifact of a map
   * with no walls in it, not a fact about strafe aiming, so it is off unless
   * a figure is specifically about it.
   */
  keyFrame: 'bearing',
};

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/**
 * A crosshair with a reaction time and a hand.
 *
 * The guide is precise about what happens when a target changes direction,
 * and the model follows it rather than borrowing a control loop:
 *
 *   · there are two delays, and they are different things. Vision-to-hand
 *     latency is short — tracking runs on data about seventy milliseconds
 *     old. Noticing that the target has *changed direction* is cognitive and
 *     slow: that is the reaction time, and it is the one the sliders set.
 *   · while nothing surprising is happening, the hand matches the rate it
 *     believes the target is moving at, with a gentle trim on the error.
 *     On a form where that rate is near zero, this costs almost nothing.
 *   · when the target's rate jumps, the belief does not. For one reaction
 *     time the hand keeps playing the old rhythm while the gap opens at the
 *     full relative speed. That is the reactive part, and no key shortens
 *     it — but the keys chose the relative speed the gap opens at.
 *   · then a flick: ballistic, aimed once at the current gap, its length set
 *     by how fast the mouse can travel. That is the correcting part. It
 *     misses by a fraction of its own size, so a bigger correction is also
 *     a worse one.
 *
 * Nothing in here knows which form is being played.
 */
const SENSE = 0.07;            // visuomotor latency, not a personality trait

export function makeAim(p) {
  const hist = [];             // [t, bearing]
  let yaw = 0, rate = 0, wob = 0, started = false;
  let mode = 'track';
  let flick = null, lastFlick = null, mid = null;
  let held = 0;                // the rate the player believes the target has
  let surprise = 0;            // when the belief was contradicted, 0 if never

  return {
    get yaw() { return yaw; },
    get rate() { return rate; },
    get mode() { return mode; },
    get lastFlick() { return lastFlick; },
    init(bearing) {
      yaw = bearing; hist.length = 0; started = true;
      mode = 'track'; flick = null; mid = null; held = 0; surprise = 0;
    },
    /**
     * @param {number} half  angular half-width of the body, for deciding when
     *                       the gap is worth a flick at all
     * @returns {number} signed angular error, crosshair minus target
     */
    step(t, dt, bearing, rand, half = 0.02) {
      if (!started) this.init(bearing);
      hist.push(t, bearing);
      if (hist.length > 3000) hist.splice(0, 600);

      // What the eye delivers: position and rate, one visuomotor latency old,
      // carried forward to now at that rate.
      const seen = sample(hist, t - SENSE);
      const before = sample(hist, t - SENSE - 0.04);
      const rateNow = seen === null || before === null ? 0 : wrap(seen - before) / 0.04;
      const errNow = seen === null ? 0 : wrap(yaw - (seen + rateNow * SENSE));

      if (p.aimStyle === 'center') {
        // The other thing the guide describes: park on the middle of his
        // dodge and let him walk through the crosshair. No belief, no flicks.
        const guess = seen === null ? bearing : seen;
        mid = mid === null ? guess : mid + wrap(guess - mid) * Math.min(1, dt / 0.75);
        let cmd = clamp(-2.6 * wrap(yaw - mid), -6, 6);
        const Sc = p.jitter + p.jitterRate * Math.abs(cmd);
        wob += -8 * wob * dt + Sc * 4 * Math.sqrt(dt) * (rand() - 0.5) * 3.464;
        rate = cmd;
        yaw = wrap(yaw + cmd * dt);
        return wrap(yaw + wob - bearing);
      }

      // ── noticing ─────────────────────────────────────────────────────
      // The belief is contradicted when the delivered rate has jumped away
      // from it. Nothing happens for one reaction time: the player has seen
      // it and has not yet realised it.
      if (!surprise && Math.abs(rateNow - held) > 0.22 + 0.55 * Math.abs(held)) surprise = t;
      const noticing = surprise && t - surprise < Math.max(0, p.react - SENSE);
      if (surprise && !noticing) {
        // Realised. Accept the new rhythm, and fix the accumulated gap with
        // one flick if it is worth one.
        held = rateNow;
        surprise = 0;
        if (Math.abs(errNow) > half * 0.9) {
          const dur = estDur(errNow, p);
          mode = 'flick';
          flick = { t0: t, dur, amp: -errNow * (1 + (rand() - 0.5) * 2 * p.precision) };
          lastFlick = { t, gap: Math.abs(errNow), dur };
        }
      }
      if (!surprise) held += (rateNow - held) * Math.min(1, dt / 0.12);

      let cmd;
      if (mode === 'flick') {
        const u = (t - flick.t0) / flick.dur;
        if (u >= 1) { mode = 'track'; flick = null; cmd = held; }
        else {
          // Minimum-jerk velocity profile, riding on the believed rate, so
          // the flick closes the gap while the hand keeps the rhythm.
          cmd = flick.amp * (30 * u * u * (1 - u) * (1 - u) / flick.dur) + held;
        }
      } else if (noticing) {
        // Playing the old rhythm. This is where the reactive part is paid.
        cmd = held;
      } else if (Math.abs(errNow) > half * 0.9) {
        // Drifted off without any surprise — wobble, or a slow ramp. The fix
        // is a flick too, just a small one.
        const dur = estDur(errNow, p);
        mode = 'flick';
        flick = { t0: t, dur, amp: -errNow * (1 + (rand() - 0.5) * 2 * p.precision) };
        lastFlick = { t, gap: Math.abs(errNow), dur };
        cmd = held;
      } else {
        cmd = held - p.trim * errNow;
      }

      // Below stiction the mouse does not break loose at all, which is what
      // makes a micro-correction on a motionless target so annoying.
      if (mode === 'track' && Math.abs(cmd) < p.stiction) cmd = 0;

      // Wobble, as a settling random walk rather than snow: it wanders and is
      // pulled back, the way an unsteady hand does. Its size grows with how
      // fast the mouse is being asked to move, which is the entire reason a
      // fast form leans on mouse control and a slow one does not.
      const S = p.jitter + p.jitterRate * Math.abs(cmd);
      wob += -8 * wob * dt + S * 4 * Math.sqrt(dt) * (rand() - 0.5) * 3.464;

      rate = cmd;
      yaw = wrap(yaw + cmd * dt);
      return wrap(yaw + wob - bearing);
    },
  };
}

/** How long a correction of this size takes, at this flick speed. */
const estDur = (err, p) => clamp(Math.abs(err) / Math.max(0.5, p.flick), 0.035, 0.30);

/** Linear interpolation into a flat [t, v, t, v, …] history. */
function sample(hist, t) {
  if (!hist.length || t < hist[0]) return null;
  for (let i = hist.length - 2; i >= 0; i -= 2) {
    if (hist[i] <= t) {
      if (i + 2 >= hist.length) return hist[i + 1];
      const f = (t - hist[i]) / Math.max(1e-6, hist[i + 2] - hist[i]);
      return hist[i + 1] + wrap(hist[i + 3] - hist[i + 1]) * f;
    }
  }
  return hist[1];
}

/**
 * The enemy's dodge: a sequence of direction changes. `mode` sets how long he
 * holds each one, and every mode is one the guide names.
 */
export const DODGES = {
  long:   { label: 'Long dodge',  lo: 0.55, hi: 0.95 },
  medium: { label: 'Medium dodge', lo: 0.35, hi: 0.55 },
  short:  { label: 'Short dodge', lo: 0.13, hi: 0.24 },
  metronome: { label: 'Metronome', lo: 0.5, hi: 0.5 },
  spam:   { label: 'AD spam', lo: 0.09, hi: 0.15 },
};

/**
 * @param {Object} spec
 *   form      {onLeft, onRight} your key for each of his directions
 *   dodge     key of DODGES, or a fixed period in seconds
 *   enemyKeys which two keys his dodge alternates between, default left/right
 *   params    overrides of DEFAULTS
 *   seed      noise seed
 */
export function createDuel(spec = {}) {
  const p = { ...DEFAULTS, ...(spec.params || {}) };
  const rand = rng(spec.seed ?? 7);

  const state = {
    t: 0,
    you:  { x: 0, y: 0, vx: 0, vy: 0, key: spec.form?.onLeft ?? 'R', hp: 100 },
    him:  { x: p.range, y: 0, vx: 0, vy: 0, key: 'L', hp: 100 },
    hisSide: 'R',
    /** His current key drives which half of your form applies. */
    nextChange: 0,
    /** Your movement is allowed to be as late as your reaction. */
    pending: null,
    yourErr: 0, hisErr: 0,
    yourOn: false, hisOn: false,
    shotsYou: 0, hitsYou: 0, shotsHim: 0, hitsHim: 0,
    trailYou: [], trailHim: [], mouseYou: [], omega: [],
    reacq: [], lastReacq: null, pendingReacq: null,
  };

  const aimYou = makeAim(p);
  const hp = { ...p, ...(spec.enemyParams || {}) };
  const aimHim = makeAim(hp);
  let form = spec.form ?? { onLeft: 'R', onRight: 'L' };
  let enemyKeys = spec.enemyKeys ?? { L: 'L', R: 'R' };
  let moveDelay = spec.moveDelay ?? 0;
  let strafeAiming = spec.strafeAiming !== false;

  /**
   * How long he holds each direction. `bias` makes one side last longer than
   * the other, which is the whole of global bias: the same left-right dodge,
   * except that over a few seconds it arrives somewhere.
   */
  let bias = spec.bias ?? 0;
  let dodgeSpec = spec.dodge ?? 'long';
  function period(side) {
    const d = typeof dodgeSpec === 'string' ? (DODGES[dodgeSpec] || DODGES.long) : null;
    const base = d ? d.lo + rand() * (d.hi - d.lo) : dodgeSpec;
    return base * (1 + (side === 'L' ? bias : -bias));
  }

  /**
   * Move a player's velocity toward the key they are holding.
   *
   * The ramp is carried in the player's own frame rather than the world's,
   * so a held key keeps meaning the same thing as the view turns. Integrated
   * in the world instead, a player circling an opponent has a velocity that
   * permanently lags the direction they are asking for, by the turn rate
   * times the acceleration time, and every figure on the page slowly drifts
   * apart for reasons that have nothing to do with strafe aiming. Ground
   * movement in these games is clamped hard to the wish direction anyway;
   * this is the same statement, without the artifact.
   */
  function drive(pl, key, yaw, dt) {
    const v = key === '-' ? { x: 0, y: 0 } : yourVec(key);
    const k = p.accel <= 0 ? 1 : Math.min(1, dt / p.accel);
    pl.lx = (pl.lx ?? 0) + (v.x * p.speed - (pl.lx ?? 0)) * k;
    pl.ly = (pl.ly ?? 0) + (v.y * p.speed - (pl.ly ?? 0)) * k;
    const c = Math.cos(yaw), sn = Math.sin(yaw);
    pl.vx = pl.lx * c - pl.ly * sn;
    pl.vy = pl.lx * sn + pl.ly * c;
    pl.x += pl.vx * dt;
    pl.y += pl.vy * dt;
  }

  function step(dt) {
    const s = state;
    s.t += dt;

    // ── his dodge ─────────────────────────────────────────────────────
    if (s.t >= s.nextChange) {
      s.hisSide = s.hisSide === 'L' ? 'R' : 'L';
      s.him.key = enemyKeys[s.hisSide];
      s.nextChange = s.t + period(s.hisSide);
      // Strafe aiming: change direction whenever, and only whenever, he does.
      if (strafeAiming) s.pending = { at: s.t + moveDelay, key: s.hisSide === 'L' ? form.onLeft : form.onRight };
      s.lastChange = s.t;
      // Every change of direction opens a measurement: how long you were off
      // him because of it, and how far off you got. This is reactivity, and
      // the figure that names its two halves reads it straight out of here.
      s.pendingReacq = { t0: s.t, gap: 0, flickAt: null, off: false };
    }
    if (s.pending && s.t >= s.pending.at) { s.you.key = s.pending.key; s.pending = null; }

    // ── where each of them is looking ────────────────────────────────
    const bearingYou = Math.atan2(s.him.y - s.you.y, s.him.x - s.you.x);
    const bearingHim = Math.atan2(s.you.y - s.him.y, s.you.x - s.him.x);
    if (s.t <= dt * 1.5) { aimYou.init(bearingYou); aimHim.init(bearingHim); }

    // ── movement, in each player's own view frame ────────────────────
    const yawYou = p.keyFrame === 'crosshair' ? aimYou.yaw : bearingYou;
    const yawHim = p.keyFrame === 'crosshair' ? aimHim.yaw : bearingHim;
    drive(s.you, s.you.key, yawYou, dt);

    // His keys are named in his frame too, and inFrame rotates them by his
    // own view, which is what makes "he goes left" the opposite world
    // direction from "you go left".
    drive(s.him, s.him.key, yawHim, dt);

    // ── aim ──────────────────────────────────────────────────────────
    const dYou = Math.hypot(s.him.x - s.you.x, s.him.y - s.you.y);
    const halfAngle = Math.atan2(p.bodyHalf, Math.max(0.5, dYou));
    s.yourErr = aimYou.step(s.t, dt, bearingYou, rand, halfAngle);
    s.hisErr = aimHim.step(s.t, dt, bearingHim, rand, halfAngle);
    s.yourMode = aimYou.mode; s.hisMode = aimHim.mode;
    s.range = dYou;
    s.halfAngle = halfAngle;
    s.yourOn = Math.abs(s.yourErr) < halfAngle;
    s.hisOn = Math.abs(s.hisErr) < halfAngle;
    s.shotsYou++; if (s.yourOn) s.hitsYou++;
    s.shotsHim++; if (s.hisOn) s.hitsHim++;

    // ── the number the whole guide is about ──────────────────────────
    const rel = { x: s.him.vx - s.you.vx, y: s.him.vy - s.you.vy };
    const ux = (s.him.x - s.you.x) / dYou, uy = (s.him.y - s.you.y) / dYou;
    s.across = rel.x * -uy + rel.y * ux;        // relative speed across the sight line
    s.closing = -(rel.x * ux + rel.y * uy);
    s.omegaNow = s.across / dYou;

    // ── reactivity, measured ─────────────────────────────────────────
    const pr = s.pendingReacq;
    if (pr) {
      pr.gap = Math.max(pr.gap, Math.abs(s.yourErr));
      if (pr.flickAt === null && s.yourMode === 'flick') pr.flickAt = s.t;
      if (!s.yourOn) pr.off = true;
      // A change of direction that never knocked you off him cost nothing,
      // and closing the measurement on the frame it opened would report that
      // as a heroic zero. It is only reactivity once there is something to
      // react to.
      if (pr.off && s.yourOn) {
        s.lastReacq = {
          total: s.t - pr.t0,
          reactive: (pr.flickAt ?? s.t) - pr.t0,
          correcting: pr.flickAt === null ? 0 : s.t - pr.flickAt,
          gap: pr.gap * 180 / Math.PI,
        };
        s.reacq.push(s.lastReacq);
        if (s.reacq.length > 40) s.reacq.shift();
        s.pendingReacq = null;
      } else if (s.t - pr.t0 > 2) s.pendingReacq = null;
    }

    // Bodies are solid. Without this a form that closes the range walks one
    // player through the other, which is not a lesson about anything.
    const minGap = p.bodyHalf * 2.4;
    if (dYou < minGap) {
      const ux2 = (s.him.x - s.you.x) / (dYou || 1), uy2 = (s.him.y - s.you.y) / (dYou || 1);
      const push2 = (minGap - dYou) / 2;
      s.you.x -= ux2 * push2; s.you.y -= uy2 * push2;
      s.him.x += ux2 * push2; s.him.y += uy2 * push2;
    }

    push(s.trailYou, s.you.x, s.you.y, 700);
    push(s.trailHim, s.him.x, s.him.y, 700);
    push(s.mouseYou, s.t, aimYou.yaw, 900);
    push(s.omega, s.t, s.omegaNow, 900);
    return s;
  }

  return {
    state, params: p,
    step,
    get accuracy() { return { you: state.shotsYou ? state.hitsYou / state.shotsYou : 0, him: state.shotsHim ? state.hitsHim / state.shotsHim : 0 }; },
    setForm(f) { form = f; },
    setEnemyKeys(k) { enemyKeys = k; },
    setStrafeAiming(v) { strafeAiming = v; },
    /** For the figure where the reader is the one pressing the keys. */
    setYourKey(k) { state.you.key = k; state.yourChanges = (state.yourChanges || 0) + 1; state.lastYourChange = state.t; },
    get form() { return form; },
    setMoveDelay(v) { moveDelay = v; },
    setParam(k, v) { p[k] = v; if (!(k in (spec.enemyParams || {}))) hp[k] = v; },
    setEnemyParam(k, v) { hp[k] = v; },
    setBias(v) { bias = v; },
    setDodge(v) { dodgeSpec = v; },
    reset() {
      Object.assign(state, {
        t: 0, nextChange: 0, pending: null, hisSide: 'R',
        lastReacq: null, pendingReacq: null,
        shotsYou: 0, hitsYou: 0, shotsHim: 0, hitsHim: 0,
      });
      state.you = { x: 0, y: 0, vx: 0, vy: 0, key: form.onLeft, hp: 100 };
      state.him = { x: p.range, y: 0, vx: 0, vy: 0, key: enemyKeys.L, hp: 100 };
      state.hisSide = 'R';
      state.reacq.length = 0;
      state.trailYou.length = 0; state.trailHim.length = 0;
      state.mouseYou.length = 0; state.omega.length = 0;
      aimYou.init(0); aimHim.init(Math.PI);
    },
  };
}

function push(arr, a, b, cap) {
  arr.push(a, b);
  if (arr.length > cap * 2) arr.splice(0, 200);
}

/**
 * The measured version of inward and outward.
 *
 * Freeze the mouse at the instant he changes direction, hold a candidate key
 * for one reaction time, and see how far the crosshair has fallen from the
 * body. Standing still is the baseline. Anything that leaves you closer than
 * standing still is inward-directed; anything that leaves you further away is
 * outward-directed. No sign convention, no cases — a distance, in degrees.
 *
 * @returns {{gap:number, baseline:number, verdict:string}}
 */
export function probeChange(yourKey, hisNewKey, opts = {}) {
  const p = { ...DEFAULTS, ...(opts.params || {}) };
  const dt = 1 / 600;
  const d0 = opts.range ?? p.range;

  const run = (key) => {
    // You at the origin looking along +x, he is at (d0, 0) looking back.
    const you = { x: 0, y: 0, vx: 0, vy: 0 };
    const him = { x: d0, y: 0, vx: 0, vy: 0 };
    // He is already at speed in his old direction and reverses now.
    const old = hisNewKey === 'L' ? 'R' : 'L';
    const ov = hisVec(old); him.vx = ov.x * p.speed; him.vy = ov.y * p.speed;
    const nv = hisVec(hisNewKey);
    // You were already at speed in the direction the form's other half asks
    // for, which is the opposite of the key under test for a 180-form.
    const yv = key ? yourVec(key) : { x: 0, y: 0 };
    const start = key ? yourVec(opposite(key)) : { x: 0, y: 0 };
    you.vx = start.x * p.speed; you.vy = start.y * p.speed;

    const yaw0 = 0;                              // the frozen crosshair
    for (let t = 0; t < p.react; t += dt) {
      const k = p.accel <= 0 ? 1 : Math.min(1, dt / p.accel);
      him.vx += (nv.x * p.speed - him.vx) * k; him.vy += (nv.y * p.speed - him.vy) * k;
      you.vx += (yv.x * p.speed - you.vx) * k; you.vy += (yv.y * p.speed - you.vy) * k;
      him.x += him.vx * dt; him.y += him.vy * dt;
      you.x += you.vx * dt; you.y += you.vy * dt;
    }
    const bearing = Math.atan2(him.y - you.y, him.x - you.x);
    return Math.abs(wrap(bearing - yaw0)) * 180 / Math.PI;
  };

  const gap = run(yourKey);
  const baseline = run(null);
  const verdict = gap < baseline - 1e-3 ? 'inward' : gap > baseline + 1e-3 ? 'outward' : 'neutral';
  return { gap, baseline, verdict, saved: baseline - gap };
}

const OPP = { F: 'B', B: 'F', L: 'R', R: 'L', FL: 'BR', BR: 'FL', FR: 'BL', BL: 'FR' };
export const opposite = (k) => OPP[k];

/**
 * Steady-state numbers for a form at a given range, with no clock involved.
 * Everything the readouts quote when the figure is not running.
 */
export function steady(formSpec, range = DEFAULTS.range, half = 'left') {
  const key = half === 'left' ? formSpec.onLeft : formSpec.onRight;
  const his = half === 'left' ? 'L' : 'R';
  const mine = yourVec(key), theirs = hisVec(his);
  const across = Math.abs(theirs.y - mine.y) * SPEED;
  const closing = (mine.x - theirs.x) * SPEED;
  const omega = across / range;
  return {
    across, closing, omega,
    degPerSec: omega * 180 / Math.PI,
    /** Centimetres of mousepad per second, at a given centimetres per 360. */
    cmPerSec: (cm360 = 30) => (omega * 180 / Math.PI) / 360 * cm360,
    /** Half-width of the body on screen, in degrees. */
    targetDeg: Math.atan2(DEFAULTS.bodyHalf, range) * 360 / Math.PI,
  };
}
