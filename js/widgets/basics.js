/**
 * basics.js — the opening figures.
 *
 * These four carry the part of the guide before any form is named: that the
 * fight you are in is a picture your own movement drew, that a change of
 * direction costs a measurable amount of time in two measurable halves, that
 * seeing is a rate and not just an acuity, and that a key is named relative
 * to where you are looking.
 */

import { el, slider, segmented, readout, rafLoop, $$ } from '../ui/dom.js';
import { duelFigure } from '../ui/duelfig.js';
import { C, alpha, fitCanvas, MONO, UI } from '../ui/palette.js';
import { DIRS, DIR, form as makeForm, relativeAcross, viewOffset, directedness, yourVec, hisVec, SPEED } from '../core/forms.js';
import { probeChange, DEFAULTS } from '../core/sim.js';
import { predict, advanced, chip } from '../ui/teach.js';

/* ═══════════════════════════════════════════════════════════ hero ════ */
/**
 * The same enemy, the same dodge, the same second of the fight, twice. The
 * only difference between the two pictures is which keys you are holding.
 */
export function hero(node) {
  const spec = (id, title) => ({
    formId: id,
    dodge: 'metronome',
    params: { range: 16 },
    seed: 4,
    title,
    aspect: 0.42,
    monitorAspect: 0.4,
    span: 22,
    readouts: ['across', 'accuracy'],
    monitorOpts: { smearFrames: 22 },
  });

  const bad = duelFigure({ ...spec('L/R', 'Fight one: you move against them'), formId: { onLeft: 'L', onRight: 'R', name: '' } });
  const good = duelFigure({ ...spec('FR/BL', 'Fight two: you move with them'), formId: { onLeft: 'FR', onRight: 'BL', name: '' } });

  node.appendChild(el('div.lab-scopes',
    el('div.stack', bad.node, el('p.fig-cap', el('b', 'Fight one.'), ' Your movement opposes theirs. They cross your whole screen, and your mouse has to travel with them.')),
    el('div.stack', good.node, el('p.fig-cap', el('b', 'Fight two.'), ' Your movement travels with theirs. Same enemy, same speed, and they have almost stopped moving.')),
  ));
}

/* ═══════════════════════════════════════════════ reactivity clock ════ */
/**
 * The cost of a change of direction, split the way the guide splits it.
 *
 * The bar under the fight is the last change, measured: the stretch where
 * nothing happened because you had not noticed yet, and the stretch where the
 * mouse was traveling back. You cannot make the first one much shorter. What
 * you move changes the size of the second one, and that is the entire lever
 * this guide is about.
 */
export function reactivityClock(node) {
  const params = { react: 0.20, flick: 9, range: 16 };
  let fig = null;
  const barCanvas = el('canvas');
  const rReactive = readout('Reactive part', { unit: 'ms' });
  const rCorrect = readout('Correcting part', { unit: 'ms' });
  const rGap = readout('Worst gap', { unit: '°' });
  const rOn = readout('Time on target', { swatch: 'blue' });

  const mount = el('div');
  const FORMS = [
    { value: '-/-', label: 'Stand still' },
    { value: 'R/L', label: 'Move with them' },
    { value: 'FR/BL', label: 'With them, diagonally' },
    { value: 'L/R', label: 'Move against them' },
  ];
  let current = '-/-';

  function build() {
    if (fig) { fig.stop(); mount.innerHTML = ''; }
    const [a, b] = current.split('/');
    fig = duelFigure({
      formId: { onLeft: a, onRight: b, name: FORMS.find((f) => f.value === current).label },
      dodge: 0.95,
      params: { ...params },
      seed: 21,
      title: 'One change of direction, over and over',
      aspect: 0.4,
      monitorAspect: 0.42,
      span: 22,
      readouts: [],
      onFrame: (s) => {
        const r = s.lastReacq;
        if (r) {
          rReactive.set((r.reactive * 1000).toFixed(0), 'ms');
          rCorrect.set((r.correcting * 1000).toFixed(0), 'ms');
          rGap.set(r.gap.toFixed(1), '°');
        }
        drawBar(barCanvas, s, params);
        const acc = s.shotsYou ? s.hitsYou / s.shotsYou : 0;
        rOn.set(`${(acc * 100).toFixed(0)}%`);
      },
    });
    mount.appendChild(fig.node);
  }

  const controls = el('div.controls',
    segmented({
      label: 'What you are doing', value: current,
      options: FORMS,
      onchange: (v) => { current = v; build(); },
    }),
    slider({
      label: 'Your reaction time', min: 100, max: 320, step: 10, value: 200,
      format: (v) => `${v} ms`,
      hint: 'How long before you notice they turned. Nothing happens during it.',
      oninput: (v) => { params.react = v / 1000; fig.sim.setParam('react', v / 1000); },
    }),
    slider({
      label: 'Correction speed', min: 3, max: 20, step: 0.5, value: 9,
      format: (v) => (v < 6 ? 'smooth' : v < 13 ? 'balanced' : 'snappy'),
      hint: 'How hard you snap the mouse back. Snappier closes the gap sooner and costs smoothness.',
      oninput: (v) => { params.flick = v; fig.sim.setParam('flick', v); },
    }),
    slider({
      label: 'Range', min: 6, max: 40, step: 1, value: 16,
      format: (v) => `${v} u`,
      hint: 'The same relative speed is a bigger sweep across your screen up close.',
      oninput: (v) => { params.range = v; fig.sim.setParam('range', v); fig.reset(); },
    }),
  );

  build();
  node.appendChild(el('div.lab',
    el('div.lab-main', mount,
      el('div.scope', el('div.scope-head', el('span', 'The last change of direction, measured'), el('b', 'reactivity')), barCanvas),
      el('p.fig-cap', el('b', 'Read it left to right.'), ' The clock starts when the enemy changes direction. The first block is time you were off them without knowing it. The second is the mouse traveling back. Only the second block responds to what you are pressing.'),
    ),
    el('div.lab-side',
      el('div.panel', el('div.panel-head', el('span', 'Controls')), el('div.panel-body', controls)),
      el('div.panel', el('div.panel-head', el('span', 'Measured')), el('div.panel-body',
        el('div.readouts', rReactive, rCorrect, rGap, rOn))),
    ),
  ));
}

function drawBar(canvas, s, params) {
  const cssW = canvas.parentElement.clientWidth || 420;
  const { ctx, w, h } = fitCanvas(canvas, cssW, 96);
  ctx.fillStyle = C.scope; ctx.fillRect(0, 0, w, h);
  const r = s.lastReacq;
  const full = 0.6;                                   // seconds across the bar
  const X = (t) => 14 + (t / full) * (w - 28);
  const y = 40, bh = 22;

  ctx.strokeStyle = alpha('#ffffff', 0.09);
  ctx.font = MONO(9.5, 400); ctx.fillStyle = alpha(C.scopeInk2, 0.8);
  ctx.textAlign = 'center';
  for (let t = 0; t <= full + 1e-9; t += 0.1) {
    ctx.beginPath(); ctx.moveTo(X(t), y - 8); ctx.lineTo(X(t), y + bh + 8); ctx.stroke();
    ctx.fillText(`${Math.round(t * 1000)}`, X(t), y + bh + 20);
  }
  ctx.textAlign = 'left';
  ctx.fillText('ms since they changed direction', 14, h - 6);

  if (!r) return;
  const seg = (t0, t1, color, label) => {
    const x0 = X(t0), x1 = Math.min(w - 14, X(t1));
    if (x1 <= x0) return;
    ctx.fillStyle = alpha(color, 0.85);
    ctx.fillRect(x0, y, x1 - x0, bh);
    ctx.fillStyle = C.scope;
    ctx.font = UI(10, 600);
    const txt = `${Math.round((t1 - t0) * 1000)} ms`;
    if (x1 - x0 > ctx.measureText(txt).width + 10) ctx.fillText(txt, x0 + 5, y + 15);
    ctx.font = MONO(9.5, 500);
    ctx.fillStyle = alpha(color, 0.95);
    ctx.textAlign = 'center';
    ctx.fillText(label, (x0 + x1) / 2, y - 12);
    ctx.textAlign = 'left';
  };
  seg(0, r.reactive, C.yellowLit, 'not noticed yet');
  seg(r.reactive, r.total, C.orangeLit, 'mouse traveling back');
  ctx.strokeStyle = alpha(C.greenLit, 0.9);
  ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(X(r.total), y - 6); ctx.lineTo(X(r.total), y + bh + 6); ctx.stroke();
  ctx.font = MONO(9.5, 600); ctx.fillStyle = C.greenLit;
  ctx.fillText('back on them', Math.min(w - 90, X(r.total) + 5), y + bh + 4);
}

/* ═════════════════════════════════════════════════ reading demo ══════ */
/**
 * Fast-strafes reading, as a frame rate rather than an adjective.
 *
 * The top strip is the target. The bottom strip is what a player who refreshes
 * the picture a few times a second actually has to work with. Slow the refresh
 * or speed up the dodge and the bottom strip stops being a position at all —
 * which is what the guide means when it says the scene goes blurry long after
 * your reaction-time test says it should.
 */
export function readingDemo(node) {
  const canvas = el('canvas');
  const state = { dodge: 1.2, refresh: 12, t: 0 };
  const rVerdict = readout('What you can see');
  const rRatio = readout('Refreshes per change', { unit: '×' });

  const controls = el('div.controls',
    slider({
      label: 'How fast they change direction', min: 0.4, max: 6, step: 0.1, value: 1.2,
      format: (v) => `${v.toFixed(1)}/s`,
      hint: 'A long dodge is about one per second. Short-dodging is four or five.',
      oninput: (v) => { state.dodge = v; },
    }),
    slider({
      label: 'How fast you refresh the picture', min: 3, max: 24, step: 1, value: 12,
      format: (v) => `${v}/s`,
      hint: 'Not your reaction time. How often you actually re-read where the crosshair sits against them.',
      oninput: (v) => { state.refresh = v; },
    }),
  );

  node.appendChild(el('div.lab',
    el('div.lab-main',
      el('div.scope',
        el('div.scope-head', el('span', 'What is there, and what you have'), el('b', 'reading')),
        canvas,
      ),
      el('p.fig-cap', el('b', 'Top:'), ' where they actually are. ', el('b', 'Bottom:'), ' the last picture you took, held until you take the next one. When the two stop resembling each other you are aiming at a memory.'),
    ),
    el('div.lab-side',
      el('div.panel', el('div.panel-head', el('span', 'Controls')), el('div.panel-body', controls)),
      el('div.panel', el('div.panel-head', el('span', 'Verdict')), el('div.panel-body', el('div.readouts', rRatio, rVerdict))),
    ),
  ));

  let lastSample = 0, held = 0, heldPrev = 0;
  rafLoop(node, (t) => {
    state.t = t;
    const cssW = canvas.parentElement.clientWidth || 420;
    const { ctx, w, h } = fitCanvas(canvas, cssW, 220);
    ctx.fillStyle = C.scope; ctx.fillRect(0, 0, w, h);

    // A square-wave dodge, integrated, so the target reverses cleanly.
    const pos = triangle(t * state.dodge) * (w * 0.34);
    const cx = w / 2;
    if (t - lastSample > 1 / state.refresh) { heldPrev = held; held = pos; lastSample = t; }

    const lane = (y, label) => {
      ctx.strokeStyle = alpha('#ffffff', 0.07);
      ctx.beginPath(); ctx.moveTo(20, y + 34); ctx.lineTo(w - 20, y + 34); ctx.stroke();
      ctx.font = MONO(9.5, 500); ctx.fillStyle = alpha(C.scopeInk2, 0.85);
      ctx.fillText(label, 20, y - 22);
    };

    lane(46, 'where they are');
    ctx.fillStyle = C.red;
    ctx.fillRect(cx + pos - 9, 46 - 16, 18, 46);

    lane(146, 'what you have to aim at');
    // Everything between two samples arrives at once, so it arrives smeared.
    const blur = Math.abs(held - heldPrev);
    const steps = 14;
    for (let i = 0; i < steps; i++) {
      const f = i / (steps - 1);
      const x = heldPrev + (held - heldPrev) * f;
      ctx.fillStyle = alpha(C.redLit, 0.10 + 0.5 * f * f);
      ctx.fillRect(cx + x - 9, 146 - 16, 18, 46);
    }

    const ratio = state.refresh / (state.dodge * 2);
    rRatio.set(ratio.toFixed(1), '×');
    const verdict = ratio > 5 ? 'clean' : ratio > 2.6 ? 'readable' : ratio > 1.5 ? 'smearing' : 'unreadable';
    rVerdict.set(verdict);
    rVerdict.classList.toggle('is-hot', ratio <= 1.5);

    ctx.font = MONO(9.5, 500);
    ctx.fillStyle = blur > 40 ? C.yellowLit : alpha(C.scopeInk2, 0.8);
    ctx.fillText(verdict === 'unreadable'
      ? 'you cannot tell which way they are going'
      : verdict === 'smearing' ? 'the picture arrives already stale' : 'the picture keeps up', 20, h - 12);
  });
}

/** A triangle wave in [-1, 1]: constant speed, clean reversals. */
function triangle(x) {
  const u = ((x % 1) + 1) % 1;
  return u < 0.5 ? 4 * u - 1 : 3 - 4 * u;
}

/* ═══════════════════════════════════════════════ direction wheel ═════ */
/**
 * The eight keys, once, properly.
 *
 * Two things are easy to say and hard to hold on to: a key is named in the
 * frame of whoever presses it, so his left and your left are opposite
 * directions in the world; and holding a key fixes the angle between where
 * you move and where you look, which is what the guide calls the view-angle.
 * Both are visible here at the same time.
 */
export function directionWheel(node) {
  const canvas = el('canvas');
  let mine = 'R', his = 'L';

  const rView = readout('Your view-angle', { unit: '°' });
  const rAcross = readout('You, across the sight line', { unit: 'ups' });
  const rAlong = readout('You, along it', { unit: 'ups' });
  const rRel = readout('They cross your screen at', { unit: 'ups', big: true });
  const rDir = readout('This change is');

  const keyButtons = DIRS.map((d) => el('button', {
    type: 'button', class: 'keycap', 'aria-pressed': String(d.key === mine),
    title: d.label,
    onclick: () => { mine = d.key; sync(); },
  }, el('b', d.keys), el('span', d.short)));

  const sideSeg = segmented({
    label: 'They are going', value: his,
    options: [{ value: 'L', label: 'their left (right on your screen)' }, { value: 'R', label: 'their right (left on your screen)' }],
    onchange: (v) => { his = v; sync(); },
  });

  node.appendChild(el('div.lab',
    el('div.lab-main',
      el('div.scope',
        el('div.scope-head', el('span', 'Both roses, in the world'), el('b', 'the eight keys')),
        canvas,
        el('div.scope-foot',
          el('span', el('i', { class: 'swatch sw-blue' }), ' your keys'),
          el('span', el('i', { class: 'swatch sw-red' }), ' their keys'),
          el('span', 'the dashed line is the sight line'),
        ),
      ),
      el('p.fig-cap', el('b', 'Try every key.'), ' Watch the relative speed at the bottom right. Two of the eight keys leave the enemy nearly motionless on your screen, two make them cross it at twice their own speed, and the rest are in between.'),
    ),
    el('div.lab-side',
      el('div.panel', el('div.panel-head', el('span', 'You are holding')), el('div.panel-body',
        el('div.keypad', keyButtons), el('div', { style: { marginTop: '0.7rem' } }, sideSeg))),
      el('div.panel', el('div.panel-head', el('span', 'Measured')), el('div.panel-body',
        el('div.readouts', rRel, rDir, rView, rAcross, rAlong))),
    ),
  ));

  function sync() {
    keyButtons.forEach((b, i) => b.setAttribute('aria-pressed', String(DIRS[i].key === mine)));
    const mv = yourVec(mine), hv = hisVec(his);
    rView.set(viewOffset(mine).toFixed(0), '°');
    rAcross.set((mv.y * SPEED).toFixed(2), 'ups');
    rAlong.set((mv.x * SPEED).toFixed(2), 'ups');
    rRel.set(relativeAcross(mine, his).toFixed(2), 'ups');
    const d = directedness(mine, his);
    rDir.setHTML(`<span class="tag ${d === 'inward' ? 'good' : 'bad'}">${d}-directed</span>`);
    draw();
  }

  function draw() {
    const cssW = canvas.parentElement.clientWidth || 420;
    const { ctx, w, h } = fitCanvas(canvas, cssW, Math.max(230, Math.min(330, cssW * 0.46)));
    ctx.fillStyle = C.scope; ctx.fillRect(0, 0, w, h);

    const yx = w * 0.24, hx = w * 0.76, cy = h * 0.52;
    ctx.strokeStyle = alpha(C.scopeInk2, 0.35);
    ctx.setLineDash([4, 5]);
    ctx.beginPath(); ctx.moveTo(yx, cy); ctx.lineTo(hx, cy); ctx.stroke();
    ctx.setLineDash([]);

    const R = Math.min(74, h * 0.31);
    rose(ctx, yx, cy, 0, mine, C.blueLit, R, 'YOU');
    rose(ctx, hx, cy, Math.PI, his, C.redLit, R, 'ENEMY');

    // The two world velocities, side by side, so "we both pressed left" is
    // visibly two different directions.
    const mv = yourVec(mine), hv = hisVec(his);
    vec(ctx, yx, cy, mv.x, mv.y, R * 1.05, C.blue);
    vec(ctx, hx, cy, hv.x, hv.y, R * 1.05, C.red);

    // The part that matters: what is left after you cancel along the line.
    const rel = (hv.y - mv.y);
    ctx.font = MONO(10, 500);
    ctx.fillStyle = alpha(C.yellowLit, 0.95);
    ctx.textAlign = 'center';
    const midx = (yx + hx) / 2;
    ctx.fillText('relative motion across your screen', midx, h - 30);
    const barW = Math.min(w * 0.4, Math.abs(rel) * SPEED * 8);
    ctx.fillStyle = alpha(C.yellowLit, 0.28);
    ctx.fillRect(midx - barW / 2, h - 24, barW, 9);
    ctx.fillStyle = C.yellowLit;
    ctx.font = MONO(11, 600);
    ctx.fillText(`${(Math.abs(rel) * SPEED).toFixed(2)} ups`, midx, h - 3);
    ctx.textAlign = 'left';
  }

  function rose(ctx, x, y, facing, held, color, R, label) {
    for (const d of DIRS) {
      const a = -(facing + d.a * Math.PI / 180);
      const on = d.key === held;
      ctx.strokeStyle = on ? color : alpha(C.scopeInk2, 0.2);
      ctx.lineWidth = on ? 2.4 : 1;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * R * 0.34, y + Math.sin(a) * R * 0.34);
      ctx.lineTo(x + Math.cos(a) * R, y + Math.sin(a) * R);
      ctx.stroke();
      ctx.font = MONO(8.5, on ? 600 : 400);
      ctx.fillStyle = on ? color : alpha(C.scopeInk2, 0.45);
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(d.keys, x + Math.cos(a) * (R + 12), y + Math.sin(a) * (R + 12));
    }
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.font = MONO(9.5, 600);
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y + R + 34);
    ctx.textAlign = 'left';
  }

  function vec(ctx, x, y, dx, dy, len, color) {
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = 3;
    const ex = x + dx * len, ey = y - dy * len;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(ex, ey); ctx.stroke();
    const a = Math.atan2(-dy, dx);
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - 9 * Math.cos(a - 0.4), ey - 9 * Math.sin(a - 0.4));
    ctx.lineTo(ex - 9 * Math.cos(a + 0.4), ey - 9 * Math.sin(a + 0.4));
    ctx.fill();
  }

  sync();
  window.addEventListener('resize', () => draw());
}

/* ═══════════════════════════════════════════════ with or against ═════ */
/**
 * The first discovery, before any name is attached to it.
 *
 * The enemy dodges left and right. The reader has exactly two choices: move
 * the same way through the world, or the opposite way. Everything the rest
 * of the page builds on is visible in the difference, and no term has been
 * introduced yet.
 */
export function withAgainst(node) {
  let mode = 'with';
  let fig = null;
  const mount = el('div');

  function build() {
    if (fig) fig.stop();
    mount.innerHTML = '';
    fig = duelFigure({
      formId: mode === 'with'
        ? { onLeft: 'R', onRight: 'L', name: 'moving with them' }
        : { onLeft: 'L', onRight: 'R', name: 'moving against them' },
      dodge: 'metronome', seed: 6, params: { range: 16 },
      title: 'Same enemy, same dodge',
      aspect: 0.42, monitorAspect: 0.42, span: 22,
      readouts: ['across', 'accuracy'],
      monitorOpts: { smearFrames: 22 },
    });
    mount.appendChild(fig.node);
  }

  const seg = segmented({
    value: mode,
    options: [
      { value: 'with', label: 'Move with them', title: 'Travel the same way through the world as they do' },
      { value: 'against', label: 'Move against them', title: 'Travel the opposite way' },
    ],
    onchange: (v) => { mode = v; build(); },
  });

  build();
  node.appendChild(el('div.lab',
    el('div.lab-main', mount),
    el('div.lab-side',
      el('div.panel', el('div.panel-head', el('span', 'Your choice')), el('div.panel-body',
        seg,
        el('p', { class: 'dim', style: { fontSize: 'var(--step--1)', margin: '0.8rem 0 0' } },
          'The enemy dodges left and right on their own. You only decide one thing: when they move, do you travel the same way through the world, or the opposite way?'),
      )),
      el('div.panel', el('div.panel-head', el('span', 'Watch one number')), el('div.panel-body',
        el('p', { style: { fontSize: 'var(--step--1)', margin: 0 } },
          el('strong', 'How fast they cross your screen.'), ' Ignore accuracy for now. Switch between the two choices a few times and watch what happens to that speed, and to the red smear on the monitor.'),
      )),
    ),
  ));
}
