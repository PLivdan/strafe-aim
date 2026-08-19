/**
 * duelfig.js — the standard figure on this site.
 *
 * A running fight, drawn twice: from above, where the form is visible, and
 * from behind the crosshair, where its consequences are. Underneath, only the
 * numbers the figure actually measured this frame.
 *
 * Every explanatory figure on the page is built from this, which is what
 * keeps the editorial rules from being re-decided widget by widget:
 *
 *   · the fight is always running, because a form is a thing that happens
 *     over time and a still picture of one is a still picture of nothing
 *   · Blue is you and Red is the enemy, in the map, on the monitor, in the
 *     prose, everywhere
 *   · the readouts are measured from the same simulation the pictures are
 *     drawn from, never quoted from the guide
 */

import { el, rafLoop, readout } from './dom.js';
import { povSwap } from './teach.js';
import { manage, dropCanvas } from './lifecycle.js';
import { createArena } from './arena.js';
import { createMonitor, drawMouseTrace } from './monitor.js';
import { createDuel } from '../core/sim.js';
import { form as makeForm } from '../core/forms.js';

const STEP = 1 / 240;

/**
 * @param {Object} spec
 *   formId      'R/L' etc, or {onLeft,onRight}
 *   dodge       'long' | 'medium' | 'short' | 'metronome' | 'spam' | seconds
 *   title       caption in the scope head
 *   monitor     show the first-person view (default true)
 *   trace       show the mouse trace strip (default false)
 *   layers      passed to the arena
 *   readouts    array of keys: 'across' | 'omega' | 'cm' | 'accuracy' | 'range' | 'gap' | 'hisAccuracy'
 *   params      simulation overrides
 *   speed       playback rate, 1 = real time
 *   height      arena height in px
 */
export function duelFigure(spec = {}) {
  const f = typeof spec.formId === 'string' ? makeForm(spec.formId) : spec.formId;
  const sim = createDuel({
    form: { onLeft: f.onLeft, onRight: f.onRight },
    dodge: spec.dodge ?? 'long',
    enemyKeys: spec.enemyKeys ?? undefined,
    params: spec.params,
    enemyParams: spec.enemyParams,
    bias: spec.bias ?? 0,
    moveDelay: spec.moveDelay ?? 0,
    seed: spec.seed ?? 11,
  });

  const arenaCanvas = el('canvas');
  const monCanvas = spec.monitor === false ? null : el('canvas');
  const traceCanvas = spec.trace ? el('canvas') : null;

  const arena = createArena(arenaCanvas, {
    aspect: spec.aspect ?? 0.58, span: spec.span ?? 26,
    cx: spec.params?.range ? spec.params.range / 2 : 8,
    maxHeight: spec.arenaMax ?? 330,
  });
  const monitor = monCanvas
    ? createMonitor(monCanvas, { aspect: spec.monitorAspect ?? 0.34, fov: spec.fov ?? 90, maxHeight: spec.monitorMax ?? 215 })
    : null;

  const headName = el('b', f.name || '');
  const swap = spec.swap ? povSwap('you', (v) => { pov = v; if (monitor) monitor.clear(); }) : null;
  let pov = 'you';
  const head = el('div.scope-head',
    el('span', spec.title ?? 'The fight, from above'),
    swap ? el('span', { style: { display: 'flex', alignItems: 'center', gap: '0.6rem' } }, swap.label, swap.button) : headName);

  const rows = {};
  const wanted = spec.readouts ?? ['across', 'omega', 'accuracy'];
  const defs = {
    across:      () => readout('Crosses your screen at', { unit: 'ups' }),
    omega:       () => readout('Mouse must sweep', { unit: '°/s' }),
    cm:          () => readout('Mousepad', { unit: 'cm/s' }),
    range:       () => readout('Range', { unit: 'u' }),
    gap:         () => readout('Crosshair off by', { unit: '°' }),
    accuracy:    () => readout('Your time on target', { swatch: 'blue' }),
    hisAccuracy: () => readout('Their time on target', { swatch: 'red' }),
    closing:     () => readout('Closing at', { unit: 'ups' }),
  };
  for (const k of wanted) if (defs[k]) rows[k] = defs[k]();
  const readoutBlock = wanted.length ? el('div.readouts', Object.values(rows)) : null;

  const scope = el('div.scope',
    head,
    el('div.map-wrap', arenaCanvas),
    monCanvas ? monCanvas : null,
    traceCanvas ? traceCanvas : null,
    el('div.scope-foot',
      el('span', el('i', { class: 'swatch sw-blue' }), ' you'),
      el('span', el('i', { class: 'swatch sw-red' }), ' enemy'),
      el('span', el('i', { class: 'swatch sw-orange' }), ' on target'),
      spec.footNote ? el('span', spec.footNote) : null,
    ),
  );

  const node = el('div.stack', scope, readoutBlock);

  // Smoothed readouts. The instantaneous relative speed swings through the
  // acceleration ramp at every change of direction, and a number that flickers
  // is a number nobody reads.
  const smooth = { across: 0, omega: 0 };
  let acc = 0, live = true;
  const rate = spec.speed ?? 1;

  let last = performance.now();
  const runner = rafLoop(node, () => {
    const now = performance.now();
    let dt = Math.min(0.06, (now - last) / 1000) * rate;
    last = now;
    if (!live) dt = 0;
    acc += dt;
    let guard = 0;
    while (acc >= STEP && guard++ < 60) { sim.step(STEP); acc -= STEP; }
    render();
  });

  function render() {
    const s = sim.state;
    s.yourYaw = 0; s.hisYaw = Math.PI;
    // The arena needs each player's actual view to draw their key rose.
    s.yourYaw = yawOf(s.you, s.him);
    s.hisYaw = yawOf(s.him, s.you);
    if (spec.follow !== false) arena.follow(s, spec.pad ?? 1.5);
    arena.draw(s, { ...(spec.layers || {}) });
    if (monitor) monitor.draw(s, { pov, hudLeft: pov === 'him' ? 'their monitor' : 'your monitor', hudRight: spec.monitorHud ? spec.monitorHud(s) : null, ...(spec.monitorOpts || {}) });
    if (traceCanvas) {
      drawMouseTrace(traceCanvas, s.mouseYou, {
        height: 84, window: 3.2, label: 'your mouse, last 3 seconds',
        right: `${Math.abs(s.omegaNow * 180 / Math.PI).toFixed(0)}°/s`,
      });
    }

    const k = 0.08;
    smooth.across += (Math.abs(s.across) - smooth.across) * k;
    smooth.omega += (Math.abs(s.omegaNow * 180 / Math.PI) - smooth.omega) * k;
    const a = sim.accuracy;
    if (rows.across) rows.across.set(smooth.across.toFixed(1), 'ups');
    if (rows.omega) rows.omega.set(smooth.omega.toFixed(0), '°/s');
    if (rows.cm) rows.cm.set((smooth.omega / 360 * (spec.cm360 ?? 30)).toFixed(1), 'cm/s');
    if (rows.range) rows.range.set(s.range.toFixed(1), 'u');
    if (rows.gap) rows.gap.set((Math.abs(s.yourErr) * 180 / Math.PI).toFixed(1), '°');
    if (rows.accuracy) rows.accuracy.set(`${(a.you * 100).toFixed(0)}%`);
    if (rows.hisAccuracy) rows.hisAccuracy.set(`${(a.him * 100).toFixed(0)}%`);
    if (spec.onFrame) spec.onFrame(s, { rows, arena, monitor });
  }

  function yawOf(a, b) { return Math.atan2(b.y - a.y, b.x - a.x); }

  // Far from the reader, the canvases give their backing stores back. The
  // next render call reallocates them through fitCanvas, and the pinned
  // height keeps the page from shifting while they are gone. The animation
  // loop is already parked by then; rafLoop pauses well before this fires.
  const life = manage(node, {
    sharpen: () => { if (monitor) monitor.clear(); render(); },
    release: () => { dropCanvas(arenaCanvas); if (monCanvas) dropCanvas(monCanvas); if (traceCanvas) dropCanvas(traceCanvas); },
  });

  return {
    node, sim, arena, monitor, rows, render,
    setForm(id) {
      const nf = typeof id === 'string' ? makeForm(id) : id;
      sim.setForm({ onLeft: nf.onLeft, onRight: nf.onRight });
      sim.reset();
      if (monitor) monitor.clear();
      if (!swap) headName.textContent = nf.name || '';
      return nf;
    },
    setTitle(t) { head.firstChild.textContent = t; },
    get pov() { return pov; },
    pause() { live = false; },
    play() { live = true; last = performance.now(); },
    get live() { return live; },
    reset() { sim.reset(); if (monitor) monitor.clear(); },
    stop() { runner.stop(); life.stop(); },
  };
}
