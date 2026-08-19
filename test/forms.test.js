/**
 * The guide's checkable claims, pinned. If the arithmetic stops reproducing
 * Strafe Aiming 101, nothing ships.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  form, allForms, census, FUNDAMENTAL, BLOCKS, connects, connections,
  relativeAcross, directedness, EXACT, SPEED, viewOffset,
} from '../js/core/forms.js';
import { probeChange, createDuel, opposite } from '../js/core/sim.js';

const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

test('the five relative speeds are the guide\'s numbers', () => {
  close(form('R/L').across, 0);                       // mirroring
  close(form('L/R').across, 20);                      // anti-mirroring
  close(form('FL/BR').across, 10 * (1 + Math.SQRT2 / 2)); // hsw anti: 17.07
  close(form('FR/BL').across, 10 * (1 - Math.SQRT2 / 2)); // hsw mirror: 2.93
  close(form('F/B').across, 10);                      // back and forth
});

test('there are 56 forms: 8 at 180, 16 each at 135, 90 and 45', () => {
  assert.equal(allForms().length, 56);
  assert.deepEqual(census(), { 45: 16, 90: 16, 135: 16, 180: 8 });
});

test('the 180-forms carry the guide\'s directedness labels (§2.3)', () => {
  assert.equal(form('R/L').directed, 'inward');       // mirroring
  assert.equal(form('L/R').directed, 'outward');      // anti-mirroring
  assert.equal(form('FL/BR').directed, 'outward');    // hsw anti
  assert.equal(form('BL/FR').directed, 'outward');
  assert.equal(form('FR/BL').directed, 'inward');     // hsw mirror
  assert.equal(form('BR/FL').directed, 'inward');
  assert.equal(form('F/B').directed, 'mixed');        // back and forth
  assert.equal(form('B/F').directed, 'mixed');
});

test('back and forth is mixed the right way round: forward is outward (§2.3)', () => {
  const f = form('F/B');
  const fwdHalf = f.halves.find((h) => h.mine === 'F');
  const backHalf = f.halves.find((h) => h.mine === 'B');
  assert.equal(fwdHalf.directed, 'outward');
  assert.equal(backHalf.directed, 'inward');
});

test('the 90-blocks carry the guide\'s labels (§3.1)', () => {
  assert.equal(form('FR/FL').directed, 'inward');     // forward triangle, mirror
  assert.equal(form('FL/FR').directed, 'outward');    // forward triangle, anti
  assert.equal(form('BR/BL').directed, 'inward');     // backward triangle, mirror
  assert.equal(form('BL/BR').directed, 'outward');    // backward triangle, anti
  for (const id of ['FR/BR', 'BR/FR', 'FL/BL', 'BL/FL']) {
    assert.equal(form(id).directed, 'mixed');         // back-and-forth triangles
  }
});

test('the named advanced forms are inward-directed (§3.2)', () => {
  assert.equal(form('FR/B').directed, 'inward');      // back to forward-hsw
  assert.equal(form('FR/L').directed, 'inward');      // forward-hsw to mirroring
  assert.equal(form('R/B').directed, 'inward');       // back to right mirroring rectangle
});

test('every 180-form is globally static; the 90-blocks travel (§2.3, §3.1)', () => {
  for (const id of FUNDAMENTAL) close(form(id).drift.mag, 0);
  for (const id of BLOCKS) assert.ok(form(id).drift.mag > 5);
});

test('no two different 180-forms are connected (§3.1)', () => {
  const fund = FUNDAMENTAL.map(form);
  for (const a of fund) for (const b of fund) {
    if (a.id !== b.id) assert.equal(connects(a, b), null);
  }
});

test('every form connects to twelve others', () => {
  // Six other choices for each half: 2 x 6 = 12, no double counting because
  // a form cannot share both halves without being the same form.
  const pool = allForms();
  for (const f of pool) assert.equal(connections(f, pool).length, 12);
});

test('the view-angle offsets are 0, 45/135, 90, 180 (§2.3)', () => {
  assert.equal(viewOffset('F'), 0);
  assert.equal(viewOffset('B'), 180);
  assert.equal(viewOffset('L'), 90);
  assert.equal(viewOffset('FL'), 45);
  assert.equal(viewOffset('BR'), 135);
});

test('the frozen-mouse probe agrees with the component classification', () => {
  for (const f of allForms()) {
    for (const [key, his] of [[f.onLeft, 'L'], [f.onRight, 'R']]) {
      const derived = directedness(key, his);
      const probed = probeChange(key, his).verdict;
      assert.equal(probed, derived, `${key} vs ${his}: probe ${probed}, derived ${derived}`);
    }
  }
});

test('opposite() is an involution over the eight keys', () => {
  for (const k of ['F', 'B', 'L', 'R', 'FL', 'FR', 'BL', 'BR']) {
    assert.equal(opposite(opposite(k)), k);
  }
});
