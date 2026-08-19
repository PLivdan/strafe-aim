/**
 * chains.js — connections, and what you can build out of them.
 *
 * The fundamental forms are eight sentences, and none of them connects to any
 * other. That is a fact about the eight, not about strafe aiming: bring in the
 * quarter turns and the whole set becomes a graph you can walk. An
 * intermediate form is a walk. An advanced form is a longer walk with a reason
 * behind it.
 */

import { el, segmented, readout, slider } from '../ui/dom.js';
import { duelFigure } from '../ui/duelfig.js';
import { C, alpha, fitCanvas, MONO, UI } from '../ui/palette.js';
import { DIR, KEYS, form as makeForm, connects, connections, allForms, yourVec, SPEED, FUNDAMENTAL, BLOCKS } from '../core/forms.js';
import { chip, rulebox } from '../ui/teach.js';

/* ═══════════════════════════════════════════════ connection map ══════ */
/**
 * Build a chain by hand.
 *
 * Every form you can reach from where you are is offered, with the key you
 * would pass through to get there. The track underneath is the ground you
 * cover playing the chain, half a second per direction. Reachability is the
 * point: a fundamental form on its own is a dead end, and two quarter turns
 * turn it into a triangle, a rhombus, or a circle around him.
 */
export function connectionMap(node) {
  const POOL = allForms();
  let chain = [makeForm('FR/BL')];
  const canvas = el('canvas');
  const optionsEl = el('div.connlist');
  const chainEl = el('div.chainrow');
  const rDrift = readout('Where the chain leaves you', { unit: 'u' });
  const rShape = readout('Shape on the ground');
  const rCycles = readout('Forms in the chain', { unit: '' });

  function options() {
    const cur = chain[chain.length - 1];
    // Offer the named ones first: the guide's building blocks are the useful
    // doors, and a list of fifty-six unlabelled pairs teaches nothing.
    const all = connections(cur, POOL);
    const named = all.filter((x) => x.form.tier !== 'other');
    const rest = all.filter((x) => x.form.tier === 'other');
    return [...named, ...rest].slice(0, 12);
  }

  function render() {
    const cur = chain[chain.length - 1];
    chainEl.innerHTML = '';
    chain.forEach((f, i) => {
      if (i) {
        const via = connects(chain[i - 1], f);
        chainEl.appendChild(el('span.via', el('i', '→'), el('b', DIR[via.key].keys)));
      }
      chainEl.appendChild(el('button', {
        type: 'button', class: 'chainlink' + (i === chain.length - 1 ? ' on' : ''),
        title: 'Cut the chain here',
        onclick: () => { chain = chain.slice(0, i + 1); render(); },
      }, el('b', f.name), el('span', `${DIR[f.onLeft].keys} / ${DIR[f.onRight].keys}`)));
    });

    optionsEl.innerHTML = '';
    for (const { form: g, via } of options()) {
      optionsEl.appendChild(el('button', {
        type: 'button', class: 'connopt' + (g.tier !== 'other' ? ' named' : ''),
        onclick: () => { chain.push(g); if (chain.length > 6) chain.shift(); render(); },
        title: `Pass through ${DIR[via.key].label}`,
      },
        el('b', g.name),
        el('span', `through ${DIR[via.key].keys}`),
        el('i', { class: `dot ${g.directed}` }),
      ));
    }

    const t = track(chain);
    rDrift.set(t.drift.toFixed(1), 'u');
    rShape.set(t.shape);
    rCycles.set(String(chain.length), '');
    draw(t);
  }

  function draw(t) {
    const cssW = canvas.parentElement.clientWidth || 460;
    const { ctx, w, h } = fitCanvas(canvas, cssW, 300);
    ctx.fillStyle = C.scope; ctx.fillRect(0, 0, w, h);

    let lo = [0, 0], hi = [0, 0];
    for (const [x, y] of t.pts) { lo[0] = Math.min(lo[0], x); lo[1] = Math.min(lo[1], y); hi[0] = Math.max(hi[0], x); hi[1] = Math.max(hi[1], y); }
    const spanX = Math.max(2, hi[0] - lo[0]), spanY = Math.max(2, hi[1] - lo[1]);
    const scale = Math.min((w - 90) / Math.max(spanY, 2), (h - 80) / Math.max(spanX, 2)) * 0.9;
    const midX = (lo[0] + hi[0]) / 2, midY = (lo[1] + hi[1]) / 2;
    // +x runs towards him, and he belongs at the top of the picture.
    const SX = (x, y) => w / 2 + (y - midY) * scale;
    const SY = (x, y) => h / 2 - (x - midX) * scale;

    ctx.strokeStyle = alpha('#ffffff', 0.06);
    ctx.beginPath();
    for (let g = -40; g <= 40; g += 5) {
      ctx.moveTo(SX(g, -60), SY(g, -60)); ctx.lineTo(SX(g, 60), SY(g, 60));
      ctx.moveTo(SX(-60, g), SY(-60, g)); ctx.lineTo(SX(60, g), SY(60, g));
    }
    ctx.stroke();

    // The enemy sits up the +x axis, so the shape reads as a shape about him.
    ctx.fillStyle = alpha(C.redLit, 0.9);
    ctx.beginPath(); ctx.arc(SX(hi[0] + 4, midY), SY(hi[0] + 4, midY), 5, 0, Math.PI * 2); ctx.fill();
    ctx.font = MONO(9.5, 500); ctx.fillStyle = alpha(C.redLit, 0.85);
    ctx.textAlign = 'center';
    ctx.fillText('towards the enemy', SX(hi[0] + 4, midY), SY(hi[0] + 4, midY) - 12);
    ctx.textAlign = 'left';

    t.segments.forEach((seg) => {
      ctx.strokeStyle = alpha(seg.colour, 0.92);
      ctx.lineWidth = 2.4; ctx.lineJoin = 'round';
      ctx.beginPath();
      seg.pts.forEach(([x, y], i) => { const sx = SX(x, y), sy = SY(x, y); i ? ctx.lineTo(sx, sy) : ctx.moveTo(sx, sy); });
      ctx.stroke();
    });

    const [ex, ey] = t.pts[t.pts.length - 1];
    ctx.fillStyle = alpha(C.scopeInk, 0.4);
    ctx.beginPath(); ctx.arc(SX(0, 0), SY(0, 0), 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = C.blueLit;
    ctx.beginPath(); ctx.arc(SX(ex, ey), SY(ex, ey), 5, 0, Math.PI * 2); ctx.fill();
    ctx.font = MONO(9.5, 500);
    // A closed chain ends where it began, and two labels on one point are
    // unreadable. Say the interesting thing instead.
    const closed = Math.hypot(SX(ex, ey) - SX(0, 0), SY(ex, ey) - SY(0, 0)) < 12;
    if (closed) {
      ctx.fillStyle = C.blueLit;
      ctx.fillText('start = end: the chain goes nowhere', SX(0, 0) + 9, SY(0, 0) + 4);
    } else {
      ctx.fillStyle = alpha(C.scopeInk2, 0.85);
      ctx.fillText('start', SX(0, 0) + 8, SY(0, 0) + 4);
      ctx.fillStyle = C.blueLit;
      ctx.fillText('end', SX(ex, ey) + 8, SY(ex, ey) + 4);
    }
  }

  node.appendChild(el('div.lab',
    el('div.lab-main',
      el('div.scope', el('div.scope-head', el('span', 'The ground you cover'), el('b', 'the chain, walked')), canvas),
      el('p.fig-cap', el('b', 'Each colour is one form'), ', held for two of the enemy\u2019s direction changes. Chain a forward triangle to a half-sideways mirror to a backward triangle and the track closes into a rhombus. Hold a back-and-forth triangle on its own and it closes into a circle around them.'),
    ),
    el('div.lab-side',
      el('div.panel', el('div.panel-head', el('span', 'Your chain')), el('div.panel-body', chainEl)),
      el('div.panel', el('div.panel-head', el('span', 'Where you can go from here')), el('div.panel-body', optionsEl)),
      el('div.panel', el('div.panel-head', el('span', 'Result')), el('div.panel-body', el('div.readouts', rCycles, rDrift, rShape))),
    ),
  ));
  render();
  window.addEventListener('resize', () => draw(track(chain)));
}

const COLOURS = [C.blueLit, C.greenLit, C.orangeLit, C.purpleLit, C.yellowLit, C.redLit];

/** Walk a chain of forms in the view frame, half a second per direction. */
function track(chain) {
  let x = 0, y = 0;
  const pts = [[0, 0]];
  const segments = [];
  chain.forEach((f, i) => {
    const seg = { colour: COLOURS[i % COLOURS.length], pts: [[x, y]] };
    for (let n = 0; n < 4; n++) {
      const v = yourVec(n % 2 === 0 ? f.onLeft : f.onRight);
      for (let s = 0; s < 10; s++) {
        x += v.x * SPEED * 0.05; y += v.y * SPEED * 0.05;
        seg.pts.push([x, y]); pts.push([x, y]);
      }
    }
    segments.push(seg);
  });
  const drift = Math.hypot(x, y);
  return { pts, segments, drift, shape: nameShape(chain, drift) };
}

function nameShape(chain, drift) {
  if (chain.length === 1) {
    const f = chain[0];
    if (f.turn === 180) return 'a line, back and forth';
    if (f.turn === 90 && f.tier === 'block' && f.name.startsWith('Back-and-forth')) return 'a circle around the enemy';
    if (f.turn === 90) return 'a triangle, travelling';
    return 'a wedge, travelling';
  }
  if (drift < 0.6) return 'a closed shape: a rhombus';
  if (chain.length >= 3) return 'a chain of triangles';
  return 'two forms joined at a key';
}

/* ═══════════════════════════════════════════════ advanced cases ══════ */
/**
 * The three worked advanced forms, each with the fight it is for.
 *
 * These are the only forms in the guide argued from what the *opponent* will
 * do next, so each figure runs both monitors and the prose beside it says
 * which of the two the form is aimed at.
 */
export function advancedCases(node) {
  const CASES = [
    {
      id: 'FR/B',
      when: 'Close range, the enemy is on your right, and they are swapping direction quickly.',
      why: [
        'Go backward as they go right. At close range that opens the angle to their left enormously, and their crosshair falls behind you.',
        'A crosshair that is behind wants help from movement, so they change direction to your left to bring the relative speed up.',
        'The moment they do, you push forward-right, towards them and to their left. Because you are closing the range, their own change of direction now works against them and for you.',
      ],
      close: 'They turn their mouse a long way. You barely turn yours. They chose the change of direction and it still cost them.',
    },
    {
      id: 'FR/L',
      when: 'You want to push someone off a position without trading.',
      why: [
        'The forward-right half is a half-sideways mirror: the enemy is nearly motionless on your screen, which is heavy on precision for them and for you.',
        'Most people answer that by changing direction to raise the relative speed, because speed is where their mouse control lives.',
        'You answer their answer by going left, mirroring them. If you saw it coming, or caused it, they are already late.',
      ],
      close: 'Held properly this form is inward-directed at all times, which is the strongest thing the guide says about any of them.',
    },
    {
      id: 'R/B',
      when: 'You need to be somewhere else, and you would rather not be free damage on the way.',
      why: [
        'While they go right you go backward, so their mouse is tracking a ten-unit sweep to the left.',
        'When they reverse, you go right, towards their left. They have to flick left and stop the flick exactly on you, because from that moment you are mirroring them and the target is not moving.',
        'A flick that has to stop exactly is the flick people miss. When they miss, they will change direction to get the mouse moving again, and so should you.',
      ],
      close: 'This is a repositioning form that happens to be inward-directed. Use it to go somewhere, not to stand still.',
    },
  ];

  const wrap = el('div.stack');
  for (const c of CASES) {
    const f = makeForm(c.id);
    const fig = duelFigure({
      formId: c.id, dodge: 'medium', seed: 44,
      params: { range: c.id === 'FR/B' ? 8 : 14 },
      title: f.name + (f.variant ? `, ${f.variant}` : ''),
      aspect: 0.44, monitorAspect: 0.36, span: 18, swap: true,
      readouts: ['across', 'accuracy', 'hisAccuracy'],
      layers: { rose: 'both' },
    });
    wrap.appendChild(el('div.case',
      el('div.case-text',
        chip('rule', 'Advanced form'),
        el('h3.h-sub', f.name, f.variant ? el('small', ` · ${f.variant}`) : null),
        el('p', { class: 'dim', style: { fontSize: 'var(--step--1)' } }, c.when),
        el('ol.qs', c.why.map((w) => el('li', w))),
        el('p', { style: { marginTop: '0.9rem' } }, el('strong', c.close)),
      ),
      el('div.stack', fig.node),
    ));
  }
  node.appendChild(wrap);
}
