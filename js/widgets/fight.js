/**
 * fight.js — the part where the other player is a person.
 *
 * Everything up to here treats him as a dodge script. He is not one. These
 * figures are about what a form does to *his* fight: whether it hands him
 * free damage, whether it leverages the mouse control you actually have, and
 * what happens when both of you are choosing.
 */

import { el, slider, segmented, readout, versus, rafLoop } from '../ui/dom.js';
import { manage, dropCanvas } from '../ui/lifecycle.js';
import { duelFigure } from '../ui/duelfig.js';
import { C, alpha, fitCanvas, MONO, UI } from '../ui/palette.js';
import { DIR, form as makeForm, FUNDAMENTAL, BLOCKS, allForms, KEYS } from '../core/forms.js';
import { createDuel } from '../core/sim.js';
import { chip, rulebox, predict } from '../ui/teach.js';

/* ═══════════════════════════════════════════════════ global bias ═════ */
/**
 * The same dodge, arriving somewhere.
 *
 * On the left he spends as long going one way as the other, so he ends where
 * he began and his middle never moves. A crosshair parked on that middle
 * collects him twice a cycle for nothing. On the right one side lasts longer
 * than the other, the middle walks away from the crosshair, and the free hits
 * stop.
 */
export function biasFigure(node) {
  let bias = 0;
  let style = 'center';
  const canvas = el('canvas');
  const rFree = readout('Free hits from the middle', { swatch: 'orange' });
  const rSwept = readout('They have relocated', { unit: '°' });
  const rSpan = readout('Angle you must cover', { unit: '°' });

  // A short dodge, because the free-hits argument is about ad-spam: the
  // faster he reverses, the more of his time is spent passing through his
  // own middle.
  const sim = () => createDuel({
    form: { onLeft: '-', onRight: '-' }, dodge: 'short', seed: 18,
    bias, params: { aimStyle: style, range: 16 },
  });
  let d = sim();
  const history = [];
  const view = { cx: 8, cy: 0, span: 46 };

  function reset() { d = sim(); history.length = 0; }

  const controls = el('div.controls',
    slider({
      label: 'Their drift', min: 0, max: 0.55, step: 0.01, value: 0,
      format: (v) => (v < 0.03 ? 'none: dodging on the spot' : v < 0.25 ? 'some' : 'strong'),
      hint: 'How much longer one side of their dodge lasts than the other.',
      oninput: (v) => { bias = v; reset(); },
    }),
    segmented({
      label: 'What you are doing about it', value: style,
      options: [
        { value: 'center', label: 'Under-aiming the middle' },
        { value: 'track', label: 'Tracking them properly' },
      ],
      onchange: (v) => { style = v; reset(); },
    }),
  );

  node.appendChild(el('div.lab',
    el('div.lab-main',
      el('div.scope', el('div.scope-head', el('span', 'Their ground track, from above'), el('b', 'bias')), canvas),
      el('p.fig-cap', el('b', 'Set the drift to zero'), ' and watch how a crosshair can simply wait near the center of the dodge. Then add drift and watch that fixed point stop being useful.'),
    ),
    el('div.lab-side',
      el('div.panel', el('div.panel-head', el('span', 'Controls')), el('div.panel-body', controls)),
      el('div.panel', el('div.panel-head', el('span', 'Measured')), el('div.panel-body', el('div.readouts', rFree, rSwept, rSpan))),
    ),
  ));

  // rafLoop parks this the moment the figure leaves the screen. The old
  // version ran a bare requestAnimationFrame chain, which kept the whole
  // simulation stepping for as long as the page stayed open.
  let last = performance.now();
  const step = () => {
    const now = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    for (let i = 0; i < Math.round(dt * 240); i++) d.step(1 / 240);
    const s = d.state;
    history.push(s.him.x, s.him.y, s.yourOn ? 1 : 0);
    if (history.length > 3000) history.splice(0, 300);

    const cssW = canvas.parentElement.clientWidth || 460;
    const { ctx, w, h } = fitCanvas(canvas, cssW, 260);
    ctx.fillStyle = C.scope; ctx.fillRect(0, 0, w, h);

    // The camera fits everything the figure is about: both players and the
    // whole recorded track. A drifting or circling enemy used to walk
    // straight out of a fixed frame; now the frame follows, smoothly enough
    // that the motion still reads as theirs rather than the camera's.
    let minX = Math.min(s.you.x, s.him.x), maxX = Math.max(s.you.x, s.him.x);
    let minY = Math.min(s.you.y, s.him.y), maxY = Math.max(s.you.y, s.him.y);
    for (let i = 0; i < history.length; i += 3) {
      if (history[i] < minX) minX = history[i]; else if (history[i] > maxX) maxX = history[i];
      if (history[i + 1] < minY) minY = history[i + 1]; else if (history[i + 1] > maxY) maxY = history[i + 1];
    }
    const ratio = h / w;
    const want = Math.max(30, maxX - minX + 8, (maxY - minY + 5) / ratio);
    view.cx += ((minX + maxX) / 2 - view.cx) * 0.1;
    view.cy += ((minY + maxY) / 2 - view.cy) * 0.1;
    view.span += (want - view.span) * 0.08;
    const scale = w / view.span;
    const X = (x) => w / 2 + (x - view.cx) * scale;
    const Y = (y) => h / 2 - (y - view.cy) * scale;

    ctx.strokeStyle = alpha('#ffffff', 0.05);
    ctx.beginPath();
    const g0x = Math.floor((view.cx - view.span / 2) / 5) * 5;
    const g0y = Math.floor((view.cy - view.span * ratio / 2) / 5) * 5;
    for (let g = g0x; g < view.cx + view.span / 2 + 5; g += 5) { ctx.moveTo(X(g), 0); ctx.lineTo(X(g), h); }
    for (let g = g0y; g < view.cy + view.span * ratio / 2 + 5; g += 5) { ctx.moveTo(0, Y(g)); ctx.lineTo(w, Y(g)); }
    ctx.stroke();

    for (let i = 3; i < history.length; i += 3) {
      ctx.strokeStyle = history[i + 2] ? alpha(C.orangeLit, 0.85) : alpha(C.red, 0.45);
      ctx.lineWidth = history[i + 2] ? 3 : 1.6;
      ctx.beginPath();
      ctx.moveTo(X(history[i - 3]), Y(history[i - 2]));
      ctx.lineTo(X(history[i]), Y(history[i + 1]));
      ctx.stroke();
    }
    ctx.fillStyle = C.blue;
    ctx.beginPath(); ctx.arc(X(s.you.x), Y(s.you.y), 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.red;
    ctx.beginPath(); ctx.arc(X(s.him.x), Y(s.him.y), 6, 0, Math.PI * 2); ctx.fill();
    ctx.font = MONO(9.5, 500); ctx.fillStyle = alpha(C.scopeInk2, 0.85);
    ctx.fillText('thick orange is where your crosshair was on them', 10, h - 10);
    ctx.fillStyle = alpha(C.blueLit, 0.9); ctx.fillText('YOU', X(s.you.x) - 10, Y(s.you.y) - 12);

    const acc = s.shotsYou ? s.hitsYou / s.shotsYou : 0;
    rFree.set(`${Math.round(acc * 100)}%`);
    const swept = Math.abs(Math.atan2(s.him.y - s.you.y, s.him.x - s.you.x)) * 180 / Math.PI;
    rSwept.set(swept.toFixed(0), '°');
    let lo = 1e9, hi = -1e9;
    for (let i = 0; i < history.length; i += 3) {
      const a = Math.atan2(history[i + 1] - s.you.y, history[i] - s.you.x) * 180 / Math.PI;
      lo = Math.min(lo, a); hi = Math.max(hi, a);
    }
    rSpan.set(history.length > 60 ? (hi - lo).toFixed(0) : '…', '°');
  };
  // The dt clamp inside step() already absorbs the long gap after a pause.
  rafLoop(canvas, step);
  manage(canvas, { sharpen: step, release: () => dropCanvas(canvas) });
}

/* ═══════════════════════════════════════════ whose fight is it ═══════ */
/**
 * A form does not make you hit more. It decides whose hands the fight is
 * about.
 *
 * Every bar is the same twenty seconds run twice over: your time on target
 * minus theirs. Give yourself a steadier hand and the fast forms swing your way
 * while mirroring stays stubbornly level, because a fight where neither mouse
 * has to move is a fight neither of you can win with your mouse.
 */
export function formTrade(node) {
  const canvas = el('canvas');
  let mine = 0.010, theirs = 0.016, hisStyle = 'track';
  const rBest = readout('Biggest edge', { swatch: 'green' });
  const rWorst = readout('Worst for you', { swatch: 'red' });
  const status = el('p', { class: 'dim', style: { fontSize: 'var(--step--2)', fontFamily: 'var(--mono)', margin: '0.5rem 0 0' } });

  let lastOut = null;
  function run() {
    status.textContent = 'running eight fights…';
    const out = FUNDAMENTAL.map((id) => {
      const f = makeForm(id);
      let you = 0, him = 0;
      const RUNS = 3;
      for (let k = 0; k < RUNS; k++) {
        const d = createDuel({
          form: { onLeft: f.onLeft, onRight: f.onRight },
          dodge: 'metronome', seed: 3 + k * 29,
          params: { range: 16, jitterRate: mine },
          enemyParams: { jitterRate: theirs, aimStyle: hisStyle },
        });
        for (let i = 0; i < 240 * 14; i++) d.step(1 / 240);
        you += d.accuracy.you; him += d.accuracy.him;
      }
      return { f, you: you / RUNS, him: him / RUNS };
    });
    lastOut = out;
    draw(out);
    const sorted = [...out].sort((a, b) => (b.you - b.him) - (a.you - a.him));
    const short = (n) => n.replace('Half-sideways', 'Hsw').replace('Anti-mirroring', 'Anti-mirror');
    rBest.set(`${short(sorted[0].f.name)} +${Math.round((sorted[0].you - sorted[0].him) * 100)}`);
    const last = sorted[sorted.length - 1];
    rWorst.set(`${short(last.f.name)} ${Math.round((last.you - last.him) * 100)}`);
    status.textContent = 'Bars to the right show a modeled time-on-target advantage for you; bars to the left favor the opponent. This is not a prediction of who wins a real match.';
  }

  function draw(out) {
    const cssW = canvas.parentElement.clientWidth || 460;
    const { ctx, w, h } = fitCanvas(canvas, cssW, 290);
    ctx.fillStyle = C.scope; ctx.fillRect(0, 0, w, h);
    const padL = 150, padR = 20, padT = 18, padB = 24;
    const rowH = (h - padT - padB) / out.length;
    const mid = padL + (w - padL - padR) / 2;
    const maxDiff = Math.max(0.12, ...out.map((o) => Math.abs(o.you - o.him)));
    const sc = ((w - padL - padR) / 2) / (maxDiff * 1.1);

    ctx.strokeStyle = alpha(C.scopeInk, 0.5);
    ctx.beginPath(); ctx.moveTo(mid, padT - 4); ctx.lineTo(mid, h - padB + 2); ctx.stroke();

    out.forEach((o, i) => {
      const y = padT + i * rowH;
      const diff = o.you - o.him;
      ctx.fillStyle = alpha(diff >= 0 ? C.greenLit : C.redLit, 0.8);
      const bw = diff * sc;
      ctx.fillRect(Math.min(mid, mid + bw), y + rowH * 0.22, Math.abs(bw), rowH * 0.5);
      ctx.font = UI(10.5, 600);
      ctx.fillStyle = alpha(C.scopeInk, 0.92);
      ctx.textAlign = 'right';
      ctx.fillText(o.f.name.length > 24 ? o.f.name.slice(0, 23) + '…' : o.f.name, padL - 10, y + rowH * 0.55);
      ctx.font = MONO(9, 500);
      ctx.fillStyle = alpha(C.scopeInk2, 0.9);
      ctx.textAlign = 'left';
      ctx.fillText(`${Math.round(o.you * 100)} / ${Math.round(o.him * 100)}`, mid + Math.max(0, bw) + 6, y + rowH * 0.55);
    });
    ctx.font = MONO(9.5, 500); ctx.fillStyle = alpha(C.scopeInk2, 0.75);
    ctx.textAlign = 'center';
    ctx.fillText('modeled advantage: theirs   ·   yours', mid, h - 6);
    ctx.textAlign = 'left';
  }

  node.appendChild(el('div.lab',
    el('div.lab-main',
      el('div.scope', el('div.scope-head', el('span', 'Same fight, eight ways'), el('b', 'the trade')), canvas),
      el('p.fig-cap', el('b', 'Change the mouse-control settings'), ' and compare how sensitive each form is to them. In this simplified setup, mirroring changes least, because there is little lateral motion to track.'),
    ),
    el('div.lab-side',
      el('div.panel', el('div.panel-head', el('span', 'The two hands')), el('div.panel-body', el('div.controls',
        slider({
          label: 'Your mouse control', min: 0.004, max: 0.03, step: 0.001, value: 0.010,
          format: (v) => (v < 0.009 ? 'excellent' : v < 0.016 ? 'good' : v < 0.023 ? 'ordinary' : 'poor'),
          hint: 'How much your tracking wanders, and how fast that grows with mouse speed.',
          oninput: (v) => { mine = v; run(); },
        }),
        slider({
          label: 'Their mouse control', min: 0.004, max: 0.03, step: 0.001, value: 0.016,
          format: (v) => (v < 0.009 ? 'excellent' : v < 0.016 ? 'good' : v < 0.023 ? 'ordinary' : 'poor'),
          oninput: (v) => { theirs = v; run(); },
        }),
        segmented({
          label: 'What they do about you', value: hisStyle,
          options: [
            { value: 'track', label: 'Tracks you' },
            { value: 'center', label: 'Sits on your middle' },
          ],
          onchange: (v) => { hisStyle = v; run(); },
        }),
      ))),
      el('div.panel', el('div.panel-head', el('span', 'Result')), el('div.panel-body', el('div.readouts', rBest, rWorst), status)),
    ),
  ));
  requestAnimationFrame(() => setTimeout(run, 30));
  manage(canvas, { sharpen: () => { if (lastOut) draw(lastOut); }, release: () => dropCanvas(canvas) });
  // A resize keeps the cached results and only repaints them.
  window.addEventListener('resize', () => { if (lastOut) draw(lastOut); });
}

/* ══════════════════════════════════════════════════════ the lab ══════ */
/**
 * Everything at once, with nothing decided for you.
 *
 * Any of the fifty-six forms, any dodge, both hands adjustable, both cameras.
 * The reason it is at the bottom of the page rather than the top is that the
 * numbers only mean something once you know which two of them matter.
 */
export function lab(node) {
  let id = 'FR/BL';
  let fig = null;
  const mount = el('div');
  const params = { range: 16, react: 0.20, flick: 9, jitterRate: 0.012 };
  const enemy = { react: 0.20, jitterRate: 0.016, aimStyle: 'track' };
  let dodge = 'long';
  let bias = 0;

  const rTrade = versus('time on target');
  const rReact = readout('Your reactivity', { unit: 'ms' });
  const rGap = readout('Worst gap per change', { unit: '°' });
  const rAcross = readout('They cross your screen at', { unit: 'ups' });
  const rRange = readout('Range', { unit: 'u' });

  const pickerRow = el('div.formpick.compact');
  function fillPicker() {
    pickerRow.innerHTML = '';
    for (const fid of [...FUNDAMENTAL, ...BLOCKS, 'FR/B', 'FR/L', 'R/B']) {
      const f = makeForm(fid);
      pickerRow.appendChild(el('button', {
        type: 'button', 'aria-pressed': String(fid === id), 'data-form': fid,
        onclick: () => { id = fid; build(); },
        title: f.name,
      }, el('b', `${DIR[f.onLeft].keys}/${DIR[f.onRight].keys}`), el('span', f.name)));
    }
  }

  function build() {
    if (fig) fig.stop();
    mount.innerHTML = '';
    fillPicker();
    fig = duelFigure({
      formId: id, dodge, seed: 61, params: { ...params }, enemyParams: { ...enemy },
      bias,
      title: 'The lab',
      aspect: 0.5, monitorAspect: 0.34, span: 26, swap: true, trace: true,
      readouts: [],
      layers: { rose: 'both' },
      onFrame: (s) => {
        const a = s.shotsYou ? s.hitsYou / s.shotsYou : 0;
        const b = s.shotsHim ? s.hitsHim / s.shotsHim : 0;
        rTrade.set(a, b, (v) => `${Math.round(v * 100)}%`, true);
        if (s.lastReacq) {
          rReact.set(Math.round(s.lastReacq.total * 1000), 'ms');
          rGap.set(s.lastReacq.gap.toFixed(1), '°');
        }
        rAcross.set(Math.abs(s.across).toFixed(1), 'ups');
        rRange.set(s.range.toFixed(1), 'u');
      },
    });
    fig.sim.setBias(bias);
    mount.appendChild(fig.node);
  }

  const controls = el('div.controls',
    segmented({
      label: 'Their dodge', value: dodge,
      options: [
        { value: 'long', label: 'Long' }, { value: 'medium', label: 'Medium' },
        { value: 'short', label: 'Short' }, { value: 'metronome', label: 'Metronome' },
      ],
      onchange: (v) => { dodge = v; build(); },
    }),
    slider({ label: 'Their bias', min: 0, max: 0.5, step: 0.02, value: 0, format: (v) => (v < 0.03 ? 'none' : v.toFixed(2)), oninput: (v) => { bias = v; fig.sim.setBias(v); } }),
    slider({ label: 'Range', min: 5, max: 45, step: 1, value: 16, format: (v) => `${v} u`, oninput: (v) => { params.range = v; fig.sim.setParam('range', v); fig.reset(); } }),
    slider({ label: 'Your reaction', min: 100, max: 340, step: 10, value: 200, format: (v) => `${v} ms`, oninput: (v) => { params.react = v / 1000; fig.sim.setParam('react', v / 1000); } }),
    slider({ label: 'Your correction speed', min: 3, max: 20, step: 0.5, value: 9, format: (v) => (v < 6 ? 'smooth' : v < 13 ? 'balanced' : 'snappy'), oninput: (v) => { params.flick = v; fig.sim.setParam('flick', v); } }),
    slider({ label: 'Your mouse control', min: 0.004, max: 0.03, step: 0.001, value: 0.012, format: (v) => (v < 0.009 ? 'excellent' : v < 0.016 ? 'good' : v < 0.023 ? 'ordinary' : 'poor'), oninput: (v) => { params.jitterRate = v; fig.sim.setParam('jitterRate', v); } }),
    slider({ label: 'Their mouse control', min: 0.004, max: 0.03, step: 0.001, value: 0.016, format: (v) => (v < 0.009 ? 'excellent' : v < 0.016 ? 'good' : v < 0.023 ? 'ordinary' : 'poor'), oninput: (v) => { enemy.jitterRate = v; fig.sim.setEnemyParam('jitterRate', v); } }),
    slider({ label: 'Their reaction', min: 100, max: 340, step: 10, value: 200, format: (v) => `${v} ms`, oninput: (v) => { enemy.react = v / 1000; fig.sim.setEnemyParam('react', v / 1000); } }),
  );

  build();
  node.appendChild(el('div.lab',
    el('div.lab-main', mount,
      el('div.panel', el('div.panel-head', el('span', 'Form')), el('div.panel-body', pickerRow)),
      el('p.fig-cap', el('b', 'Everything here is adjustable.'), ' Compare how the relationships change between setups rather than reading any single number as a verdict. A smaller correction is not automatically an advantage if the same movement also makes the enemy\u2019s aim easier.'),
    ),
    el('div.lab-side',
      el('div.panel', el('div.panel-head', el('span', 'The fight')), el('div.panel-body',
        rTrade, el('div.readouts', { style: { marginTop: '0.7rem' } }, rReact, rGap, rAcross, rRange))),
      el('div.panel', el('div.panel-head', el('span', 'Conditions')), el('div.panel-body', controls)),
    ),
  ));
}
