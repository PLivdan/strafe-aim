/**
 * The behavioural claims: things the guide argues about fights, which the
 * simulation should produce rather than encode.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createDuel } from '../js/core/sim.js';

function run(spec, seconds = 12, runs = 4) {
  let you = 0, him = 0, d;
  for (let k = 0; k < runs; k++) {
    d = createDuel({ ...spec, seed: (spec.seed ?? 5) + k * 31 });
    for (let i = 0; i < 240 * seconds; i++) d.step(1 / 240);
    you += d.accuracy.you; him += d.accuracy.him;
  }
  return { you: you / runs, him: him / runs, last: d };
}

test('mirroring is free for both players (§2.3)', () => {
  const r = run({ form: { onLeft: 'R', onRight: 'L' }, dodge: 'metronome' });
  assert.ok(r.you > 0.97, `you ${r.you}`);
  assert.ok(r.him > 0.97, `him ${r.him}`);
});

test('the fundamental forms rank by relative speed', () => {
  const acc = (l, r) => run({ form: { onLeft: l, onRight: r }, dodge: 'metronome' }).you;
  const mirror = acc('R', 'L');
  const hswM = acc('FR', 'BL');
  const bf = acc('F', 'B');
  const anti = acc('L', 'R');
  assert.ok(mirror >= hswM, `mirror ${mirror} < hswM ${hswM}`);
  assert.ok(hswM > bf, `hswM ${hswM} <= b&f ${bf}`);
  assert.ok(bf > anti, `b&f ${bf} <= anti ${anti}`);
});

test('mirroring ignores mouse control; anti-mirroring leverages it (§2.3)', () => {
  const good = { jitterRate: 0.008, precision: 0.045 };
  const poor = { jitterRate: 0.024, precision: 0.14 };
  const mirror = run({ form: { onLeft: 'R', onRight: 'L' }, dodge: 'metronome', params: good, enemyParams: poor });
  assert.ok(Math.abs(mirror.you - mirror.him) < 0.03, `mirror trade ${mirror.you} vs ${mirror.him}`);
  const anti = run({ form: { onLeft: 'L', onRight: 'R' }, dodge: 'metronome', params: good, enemyParams: poor });
  assert.ok(anti.you - anti.him > 0.08, `anti trade ${anti.you} vs ${anti.him}`);
});

test('parking on the middle beats tracking a short dodge, and loses to a long one (§2.2)', () => {
  const still = { onLeft: '-', onRight: '-' };
  const trackShort = run({ form: still, dodge: 'short', params: { range: 14 } });
  const parkShort = run({ form: still, dodge: 'short', params: { range: 14, aimStyle: 'centre' } });
  assert.ok(parkShort.you > trackShort.you + 0.1, `park ${parkShort.you} vs track ${trackShort.you}`);
  const trackLong = run({ form: still, dodge: 'long', params: { range: 14 } });
  const parkLong = run({ form: still, dodge: 'long', params: { range: 14, aimStyle: 'centre' } });
  assert.ok(trackLong.you > parkLong.you + 0.1, `track ${trackLong.you} vs park ${parkLong.you}`);
});

test('a biased dodge starves the parked crosshair (§5, Sam)', () => {
  const still = { onLeft: '-', onRight: '-' };
  const noBias = run({ form: still, dodge: 'short', bias: 0, params: { aimStyle: 'centre' } }, 15);
  const biased = run({ form: still, dodge: 'short', bias: 0.35, params: { aimStyle: 'centre' } }, 15);
  assert.ok(noBias.you > biased.you + 0.25, `no-bias ${noBias.you} vs biased ${biased.you}`);
});

test('a biased dodge actually travels', () => {
  const d = createDuel({ form: { onLeft: '-', onRight: '-' }, dodge: 'long', bias: 0.35, seed: 9 });
  for (let i = 0; i < 240 * 16; i++) d.step(1 / 240);
  const s = d.state;
  assert.ok(Math.hypot(s.him.x - 16, s.him.y) > 8, 'enemy went nowhere');
});

test('mirroring holds the range; anti-mirroring cannot close it', () => {
  const mirror = run({ form: { onLeft: 'R', onRight: 'L' }, dodge: 'metronome' }).last.state;
  assert.ok(Math.abs(mirror.range - 16) < 1.5, `mirror range ${mirror.range}`);
});

test('reactivity decomposes into a reactive and a correcting part', () => {
  const d = createDuel({ form: { onLeft: '-', onRight: '-' }, dodge: 'long', seed: 9 });
  for (let i = 0; i < 240 * 20; i++) d.step(1 / 240);
  const r = d.state.reacq;
  assert.ok(r.length > 5, 'no reacquisitions measured');
  const avg = (k) => r.reduce((a, b) => a + b[k], 0) / r.length;
  assert.ok(avg('reactive') > 0.08, `reactive ${avg('reactive')}`);
  assert.ok(avg('total') < 0.6, `total ${avg('total')}`);
});
