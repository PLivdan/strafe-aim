/**
 * formsui.js — the forms themselves.
 *
 * The guide lists eight fundamental forms, then a set of building blocks,
 * then says the building blocks are in fact all fifty-six. These figures let
 * a reader hold any one of them, watch it run from either chair, and read off
 * the two numbers that decide everything about it: how fast the target
 * crosses the screen, and which way the gap moves while you are correcting.
 */

import { el, slider, segmented, readout, $$ } from '../ui/dom.js';
import { duelFigure } from '../ui/duelfig.js';
import { C, alpha, fitCanvas, MONO, UI } from '../ui/palette.js';
import {
  DIRS, DIR, KEYS, allForms, form as makeForm, FUNDAMENTAL, BLOCKS,
  turnAngle, relativeAcross, directedness, SPEED, census, yourVec,
} from '../core/forms.js';
import { probeChange, createDuel, steady } from '../core/sim.js';
import { chip, advanced, rulebox } from '../ui/teach.js';

/* ═════════════════════════════════════════════════ form explorer ═════ */
/**
 * The instrument the whole middle of the page hangs off.
 *
 * One fight, any form, either camera, with the mouse trace underneath so the
 * claim "this one asks a lot of your mouse control" is a picture rather than
 * an adjective.
 */
export function formExplorer(node, opts = {}) {
  const list = opts.list ?? FUNDAMENTAL;
  let id = opts.start ?? list[0];
  let f = makeForm(id);
  let range = 16;
  let dodgeKey = 'metronome';

  const fig = duelFigure({
    formId: id, dodge: dodgeKey, seed: 8, params: { range },
    title: 'The fight, from above',
    aspect: 0.5, monitorAspect: 0.36, span: 24, swap: true,
    trace: true,
    readouts: ['across', 'omega', 'cm', 'accuracy', 'hisAccuracy'],
    layers: { rose: 'both', wedge: false },
  });

  const nameEl = el('h3.h-sub', f.name);
  const varEl = el('p', { class: 'dim', style: { margin: '0.15rem 0 0.6rem', fontFamily: 'var(--mono)', fontSize: 'var(--step--2)', letterSpacing: '0.08em', textTransform: 'uppercase' } });
  const tagsEl = el('p', { style: { margin: '0 0 0.7rem', display: 'flex', gap: '0.4rem', flexWrap: 'wrap' } });
  const noteEl = el('p', { style: { margin: 0, fontSize: 'var(--step--1)' } });
  const keysEl = el('div.prescription');

  const picker = el('div.formpick', list.map((fid) => {
    const ff = makeForm(fid);
    return el('button', {
      type: 'button', 'aria-pressed': String(fid === id), 'data-form': fid,
      onclick: () => select(fid),
      title: `${ff.name} — ${ff.across.toFixed(2)} ups across your screen`,
    },
      el('b', ff.name),
      el('span', ff.variant ? ff.variant : `${DIR[ff.onLeft].keys} / ${DIR[ff.onRight].keys}`),
      el('i', { class: `dot ${ff.directed}` }),
    );
  }));

  function select(fid) {
    id = fid; f = fig.setForm(fid);
    $$('button', picker).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.form === fid)));
    nameEl.textContent = f.name;
    varEl.textContent = f.variant ? f.variant : `${f.turn}° between your two directions`;
    tagsEl.innerHTML = '';
    tagsEl.appendChild(el('span', { class: `tag ${f.directed === 'inward' ? 'good' : f.directed === 'outward' ? 'bad' : 'mixed'}` }, `${f.directed}-directed`));
    tagsEl.appendChild(el('span.tag', `${f.turn}° turn`));
    tagsEl.appendChild(el('span.tag', f.family ? f.family : 'mixed'));
    if (f.drift.mag > 0.01) tagsEl.appendChild(el('span', { class: 'tag good' }, 'travels'));
    else tagsEl.appendChild(el('span', { class: 'tag none' }, 'stays put'));
    noteEl.textContent = f.note || '';
    keysEl.innerHTML = '';
    keysEl.appendChild(prescription('They go left', f.onLeft, f.halves[0]));
    keysEl.appendChild(prescription('They go right', f.onRight, f.halves[1]));
  }

  const controls = el('div.controls',
    segmented({
      label: 'Their dodge', value: dodgeKey,
      options: [
        { value: 'metronome', label: 'Metronome', title: 'Equal halves, so nothing drifts and the only difference between forms is your keys' },
        { value: 'long', label: 'Long dodge' },
        { value: 'medium', label: 'Medium' },
        { value: 'short', label: 'Short' },
      ],
      onchange: (v) => { dodgeKey = v; fig.sim.setParam('dodgeKey', v); rebuildDodge(v); },
    }),
    slider({
      label: 'Range', min: 6, max: 40, step: 1, value: 16,
      format: (v) => `${v} u`,
      hint: 'The same relative speed is a far bigger sweep across your screen up close.',
      oninput: (v) => { range = v; fig.sim.setParam('range', v); fig.reset(); },
    }),
  );

  // The dodge is baked into the simulation at construction, so changing it
  // means a new one. Cheap, and it keeps the sim honest about its own state.
  function rebuildDodge() { fig.reset(); }

  select(id);
  node.appendChild(el('div.lab',
    el('div.lab-main', fig.node,
      el('p.fig-cap', el('b', 'Swap the camera.'), ' A form is a claim about two monitors. The half-sideways mirror that nearly freezes the enemy on your screen is also nearly freezing you on theirs, and the question is always which of you that suits.')),
    el('div.lab-side',
      el('div.panel', el('div.panel-head', el('span', 'Pick a form')), el('div.panel-body', picker)),
      el('div.panel', el('div.panel-head', el('span', 'What you are holding')), el('div.panel-body',
        nameEl, varEl, tagsEl, keysEl, noteEl)),
      el('div.panel', el('div.panel-head', el('span', 'Conditions')), el('div.panel-body', controls)),
    ),
  ));
}

function prescription(when, key, half) {
  const d = DIR[key];
  return el('div.presc-row',
    el('span.presc-when', when),
    el('span.keycap.static', el('b', d.keys), el('span', d.short)),
    el('span.presc-num',
      el('b', half.across.toFixed(2)), ' ups across',
      el('i', { class: `dot ${half.directed}` }),
      el('span', half.directed),
    ),
  );
}

/* ═══════════════════════════════════════════════ the 56, as a grid ═══ */
/**
 * Every strafe aim form there is.
 *
 * Eight choices for what you hold while he goes left, seven for the other
 * half, and the whole space fits in one table. The diagonal is empty because
 * a form has to change direction; that is the definition.
 */
export function formMatrix(node) {
  const detail = el('div.matrix-detail');
  const counts = census();

  const cells = [];
  const table = el('table.matrix',
    el('thead', el('tr',
      el('th', el('small', 'you hold →'), el('br'), 'while they go right'),
      KEYS.map((k) => el('th', el('b', DIR[k].keys), el('small', DIR[k].short))),
    )),
    el('tbody', KEYS.map((a) => el('tr',
      el('th', el('b', DIR[a].keys), el('small', `they go left`)),
      KEYS.map((b) => {
        if (a === b) return el('td', { class: 'nil', title: 'A form has to change direction' }, '—');
        const f = makeForm(`${a}/${b}`);
        const td = el('td', {
          class: `t${f.turn} ${f.directed}${f.tier !== 'other' ? ' named' : ''}`,
          'data-id': f.id,
          title: `${f.name} · ${f.turn}° · ${f.directed}-directed`,
          onclick: () => show(f.id),
          onmouseenter: () => show(f.id),
        }, f.across.toFixed(1));
        cells.push(td);
        return td;
      }),
    ))),
  );

  const legend = el('div.legend',
    el('span', el('i', { class: 'swatch', style: { background: shade(180) } }), '180°, eight of them'),
    el('span', el('i', { class: 'swatch', style: { background: shade(135) } }), '135°, sixteen'),
    el('span', el('i', { class: 'swatch', style: { background: shade(90) } }), '90°, sixteen'),
    el('span', el('i', { class: 'swatch', style: { background: shade(45) } }), '45°, sixteen'),
    el('span', el('b', '56'), ' in total'),
  );

  function show(fid) {
    const f = makeForm(fid);
    cells.forEach((c) => c.classList.toggle('on', c.dataset.id === fid));
    detail.innerHTML = '';
    detail.appendChild(el('div.matrix-head',
      el('h4', f.name),
      el('span.tag', `${f.turn}°`),
      el('span', { class: `tag ${f.directed === 'inward' ? 'good' : f.directed === 'outward' ? 'bad' : 'mixed'}` }, `${f.directed}-directed`),
      f.tier !== 'other' ? el('span', { class: 'tag' }, f.tier) : null,
    ));
    detail.appendChild(el('div.readouts',
      row('They go left, you hold', `${DIR[f.onLeft].keys} — ${DIR[f.onLeft].label}`),
      row('They go right, you hold', `${DIR[f.onRight].keys} — ${DIR[f.onRight].label}`),
      row('They cross your screen at', `${f.across.toFixed(2)} ups`),
      row('Over a full cycle you travel', f.drift.mag < 0.01 ? 'nowhere' : `${f.drift.mag.toFixed(2)} ups`),
    ));
    if (f.note) detail.appendChild(el('p', { class: 'dim', style: { fontSize: 'var(--step--1)', margin: '0.7rem 0 0' } }, f.note));
  }

  node.appendChild(el('div.stack',
    el('div.panel',
      el('div.panel-head', el('span', 'Every form there is'), el('span', `${counts[180]} + ${counts[135]} + ${counts[90]} + ${counts[45]} = 56`)),
      el('div.panel-body',
        el('div.scroll-x', table),
        el('div', { style: { marginTop: '0.7rem' } }, legend),
      ),
    ),
    el('div.panel', el('div.panel-head', el('span', 'The one you are pointing at')), el('div.panel-body', detail)),
    el('p.fig-cap', el('b', 'The number in each cell'), ' is how fast the enemy crosses your screen while you hold that form, in units per second, against their own ten. Zero is mirroring. Twenty is anti-mirroring. Everything else is somewhere between.'),
  ));
  show('R/L');
}

const row = (a, b) => el('div.readout', el('span.lbl', a), el('span.val', b));
const shade = (turn) => ({ 180: '#2e4a5c', 135: '#3d5a52', 90: '#5b5638', 45: '#5e4038' }[turn]);

/* ══════════════════════════════════════════ inward and outward ═══════ */
/**
 * The classification, measured instead of asserted.
 *
 * For each of the eight keys: freeze the mouse at the instant he reverses,
 * hold that key for one reaction time, and see how far the crosshair has
 * fallen from the body. Standing still is the baseline. Whatever leaves you
 * closer than standing still is inward-directed. There is no case analysis in
 * this figure, only a distance.
 */
export function inwardOutward(node) {
  const canvas = el('canvas');
  let react = 0.20, range = 16;
  const rBest = readout('Best key', { swatch: 'green' });
  const rWorst = readout('Worst key', { swatch: 'red' });
  const rSpread = readout('Between them', { unit: '°' });

  function draw() {
    const data = KEYS.map((k) => ({ key: k, ...probeChange(k, 'L', { params: { react }, range }) }));
    const base = data[0].baseline;
    const max = Math.max(base, ...data.map((d) => d.gap)) * 1.12;

    const cssW = canvas.parentElement.clientWidth || 460;
    const { ctx, w, h } = fitCanvas(canvas, cssW, 250);
    ctx.fillStyle = C.scope; ctx.fillRect(0, 0, w, h);

    const padL = 58, padR = 16, padT = 26, padB = 34;
    const bw = (w - padL - padR) / data.length;
    const Y = (v) => h - padB - (v / max) * (h - padT - padB);

    // the baseline: what standing still would have cost you
    ctx.strokeStyle = alpha(C.scopeInk, 0.55);
    ctx.setLineDash([4, 4]);
    ctx.beginPath(); ctx.moveTo(padL, Y(base)); ctx.lineTo(w - padR, Y(base)); ctx.stroke();
    ctx.setLineDash([]);
    ctx.font = MONO(9.5, 500);
    ctx.fillStyle = alpha(C.scopeInk, 0.8);
    ctx.fillText('standing still', padL + 4, Y(base) - 5);

    data.forEach((d, i) => {
      const x = padL + i * bw + bw * 0.16, ww = bw * 0.68;
      const inward = d.gap < base - 1e-3;
      ctx.fillStyle = alpha(inward ? C.greenLit : C.redLit, 0.78);
      ctx.fillRect(x, Y(d.gap), ww, h - padB - Y(d.gap));
      ctx.font = MONO(9, 600);
      ctx.fillStyle = alpha(C.scopeInk, 0.95);
      ctx.textAlign = 'center';
      ctx.fillText(`${d.gap.toFixed(1)}°`, x + ww / 2, Y(d.gap) - 5);
      ctx.font = MONO(9.5, 500);
      ctx.fillStyle = alpha(C.scopeInk2, 0.95);
      ctx.fillText(DIR[d.key].keys, x + ww / 2, h - padB + 14);
      ctx.font = MONO(8, 400);
      ctx.fillStyle = alpha(inward ? C.greenLit : C.redLit, 0.9);
      ctx.fillText(inward ? 'inward' : 'outward', x + ww / 2, h - padB + 26);
      ctx.textAlign = 'left';
    });

    ctx.save();
    ctx.translate(13, padT + 2); ctx.rotate(-Math.PI / 2);
    ctx.font = MONO(9.5, 500); ctx.fillStyle = alpha(C.scopeInk2, 0.9);
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillText('how far off them, one reaction later', 0, 0);
    ctx.restore();
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

    const sorted = [...data].sort((a, b) => a.gap - b.gap);
    rBest.set(`${DIR[sorted[0].key].keys} — ${sorted[0].gap.toFixed(1)}°`);
    rWorst.set(`${DIR[sorted[sorted.length - 1].key].keys} — ${sorted[sorted.length - 1].gap.toFixed(1)}°`);
    rSpread.set((sorted[sorted.length - 1].gap - sorted[0].gap).toFixed(1), '°');
  }

  node.appendChild(el('div.lab',
    el('div.lab-main',
      el('div.scope',
        el('div.scope-head', el('span', 'They have just reversed. Your mouse is frozen.'), el('b', 'measured')),
        canvas,
      ),
      el('p.fig-cap', el('b', 'Every bar is the same experiment.'), ' The enemy changes direction, you hold one key for one reaction time, and nobody touches the mouse. Shorter is better: it is the correction you will owe when you finally notice.'),
    ),
    el('div.lab-side',
      el('div.panel', el('div.panel-head', el('span', 'Conditions')), el('div.panel-body', el('div.controls',
        slider({
          label: 'Your reaction time', min: 100, max: 320, step: 10, value: 200,
          format: (v) => `${v} ms`, hint: 'A slower reader pays more for the same choice of key.',
          oninput: (v) => { react = v / 1000; draw(); },
        }),
        slider({
          label: 'Range', min: 6, max: 40, step: 1, value: 16,
          format: (v) => `${v} u`, hint: 'Close range magnifies every one of these.',
          oninput: (v) => { range = v; draw(); },
        }),
      ))),
      el('div.panel', el('div.panel-head', el('span', 'Result')), el('div.panel-body', el('div.readouts', rBest, rWorst, rSpread))),
    ),
  ));
  draw();
  window.addEventListener('resize', draw);
}

/* ══════════════════════════════════════════════ the comparison ═══════ */
/**
 * The eight fundamental forms, run rather than described.
 *
 * Each row is twenty seconds of simulated fight against the same dodge, with
 * the same reaction time on both sides. The last two columns are the guide's
 * central point: a form is not good or bad, it decides whose mouse control
 * the fight is about.
 */
export function compareForms(node) {
  const body = el('tbody');
  const status = el('p', { class: 'dim', style: { fontSize: 'var(--step--2)', fontFamily: 'var(--mono)', margin: '0.6rem 0 0' } }, 'running…');

  const table = el('table.data',
    el('thead', el('tr',
      el('th', 'Form'),
      el('th', 'Keys'),
      el('th', 'Across your screen'),
      el('th', 'Directed'),
      el('th', 'You hit'),
      el('th', 'They hit'),
      el('th', 'Trade'),
    )),
    body,
  );

  node.appendChild(el('div.stack',
    el('div.panel',
      el('div.panel-head', el('span', 'Eight forms, twenty seconds each'), el('span', 'simulated')),
      el('div.panel-body', el('div.scroll-x', table), status),
    ),
    el('p.fig-cap', el('b', 'Both players have the same reaction time and the same hands.'), ' Where a row is close to even, the form has made the fight symmetric and you are trading. Where it is lopsided, the form has handed the fight to whoever aims better.'),
  ));

  // Run it after paint so a long section does not block the scroll.
  requestAnimationFrame(() => setTimeout(() => {
    for (const id of FUNDAMENTAL) {
      const f = makeForm(id);
      const r = trial(f, 20, 6);
      const diff = r.you - r.him;
      body.appendChild(el('tr',
        el('td', f.name + (f.variant ? ` (${f.variant})` : '')),
        el('td', `${DIR[f.onLeft].keys} / ${DIR[f.onRight].keys}`),
        el('td', f.across.toFixed(2)),
        el('td', el('span', { class: `tag ${f.directed === 'inward' ? 'good' : f.directed === 'outward' ? 'bad' : 'mixed'}` }, f.directed)),
        el('td', `${Math.round(r.you * 100)}%`),
        el('td', `${Math.round(r.him * 100)}%`),
        el('td', Math.abs(diff) < 0.04 ? el('span.tag.even', 'even') : el('span', { class: `tag ${diff > 0 ? 'good' : 'bad'}` }, `${diff > 0 ? '+' : ''}${Math.round(diff * 100)}`)),
      ));
    }
    status.textContent = 'Same dodge, same seed, both players reacting in 200 ms. The trade column is your time on target minus his.';
  }, 30));
}

/** Average a form over several seeds so a single unlucky run cannot speak. */
export function trial(f, seconds = 20, runs = 4, params = {}) {
  let you = 0, him = 0;
  for (let k = 0; k < runs; k++) {
    const d = createDuel({
      form: { onLeft: f.onLeft, onRight: f.onRight },
      dodge: 'metronome', seed: 5 + k * 37, params: { range: 16, ...params },
    });
    const steps = Math.round(seconds * 240);
    for (let i = 0; i < steps; i++) d.step(1 / 240);
    you += d.accuracy.you; him += d.accuracy.him;
  }
  return { you: you / runs, him: him / runs };
}

/* ═══════════════════════════════════════════ the shared weakness ═════ */
/**
 * What all eight have in common, drawn as ground tracks.
 *
 * A 180-form spends every second undoing the second before it. The tracks are
 * the argument: nobody who plays one of these ever arrives anywhere, and a
 * fight you cannot leave is a fight somebody else gets to join.
 */
export function staticWeakness(node) {
  const canvas = el('canvas');
  let ids = ['R/L', 'FR/BL', 'FR/BR'];
  const rows = ids.map((id) => makeForm(id));

  function draw() {
    const cssW = canvas.parentElement.clientWidth || 460;
    const { ctx, w, h } = fitCanvas(canvas, cssW, 250);
    ctx.fillStyle = C.scope; ctx.fillRect(0, 0, w, h);
    const cell = w / rows.length;

    rows.forEach((f, i) => {
      const cx = cell * (i + 0.5), cy = h * 0.5;
      const scale = Math.min(cell * 0.34, h * 0.3) / 5;
      // Walk the form for eight half-cycles of 0.5 s each, in the view frame.
      let x = 0, y = 0;
      const pts = [[0, 0]];
      for (let n = 0; n < 8; n++) {
        const key = n % 2 === 0 ? f.onLeft : f.onRight;
        const v = yourVec(key);
        for (let t = 0; t < 12; t++) { x += v.x * SPEED * 0.5 / 12; y += v.y * SPEED * 0.5 / 12; pts.push([x, y]); }
      }
      ctx.strokeStyle = alpha('#ffffff', 0.07);
      ctx.beginPath(); ctx.moveTo(cx - cell * 0.4, cy); ctx.lineTo(cx + cell * 0.4, cy);
      ctx.moveTo(cx, cy - h * 0.34); ctx.lineTo(cx, cy + h * 0.34); ctx.stroke();

      ctx.strokeStyle = f.drift.mag > 0.01 ? C.greenLit : C.blueLit;
      ctx.lineWidth = 2;
      ctx.beginPath();
      pts.forEach(([px, py], k) => {
        const sx = cx + py * scale, sy = cy - px * scale;   // +x is towards him: draw it up
        k ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy);
      });
      ctx.stroke();
      const last = pts[pts.length - 1];
      ctx.fillStyle = f.drift.mag > 0.01 ? C.greenLit : C.blueLit;
      ctx.beginPath(); ctx.arc(cx + last[1] * scale, cy - last[0] * scale, 4, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = alpha(C.scopeInk, 0.35);
      ctx.beginPath(); ctx.arc(cx, cy, 3, 0, Math.PI * 2); ctx.fill();

      ctx.font = UI(11, 600); ctx.textAlign = 'center';
      ctx.fillStyle = alpha(C.scopeInk, 0.95);
      ctx.fillText(f.name, cx, h - 30);
      ctx.font = MONO(9.5, 500);
      ctx.fillStyle = f.drift.mag > 0.01 ? C.greenLit : alpha(C.scopeInk2, 0.9);
      ctx.fillText(f.drift.mag > 0.01 ? `travels ${f.drift.mag.toFixed(1)} ups` : 'ends where it began', cx, h - 14);
      ctx.textAlign = 'left';
    });
    ctx.font = MONO(9.5, 500); ctx.fillStyle = alpha(C.scopeInk2, 0.8);
    ctx.fillText('four seconds of each, seen from above, enemy upwards', 10, 16);
  }

  node.appendChild(el('div.stack',
    el('div.scope', el('div.scope-head', el('span', 'Where four seconds of each form leaves you'), el('b', 'ground tracks')), canvas),
    el('p.fig-cap', el('b', 'The first two are 180-forms'), ' and they return to the dot they started on, every cycle, for as long as you hold them. The third is a 90-form and it goes somewhere.'),
  ));
  draw();
  window.addEventListener('resize', draw);
}
