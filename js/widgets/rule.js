/**
 * rule.js — the definition, and the two things it immediately rules out.
 *
 * Strafe aiming is one sentence, and the sentence is a constraint on your
 * feet rather than on your hand. These figures make the reader hold to it,
 * then show them the one target it cannot be held against.
 */

import { el, slider, segmented, readout, rafLoop } from '../ui/dom.js';
import { duelFigure } from '../ui/duelfig.js';
import { C, alpha, fitCanvas, MONO, UI } from '../ui/palette.js';
import { form as makeForm } from '../core/forms.js';
import { chip, predict } from '../ui/teach.js';

/* ═══════════════════════════════════════════════ the rule, playable ══ */
/**
 * You press the keys. The figure keeps score against the definition, which
 * has two halves and punishes each of them separately: every change of his
 * you failed to answer, and every change of yours he never asked for.
 */
export function ruleGame(node) {
  let formId = 'R/L';
  let f = makeForm(formId);
  const score = { asked: 0, answered: 0, unprompted: 0, late: [] };
  let side = 'R';                    // which half of the form you are holding

  const fig = duelFigure({
    formId, dodge: 'long', seed: 33, params: { range: 16 },
    title: 'You are driving',
    aspect: 0.42, monitorAspect: 0.4, span: 22,
    readouts: ['accuracy'],
    onFrame: (s) => { tick(s); },
  });
  fig.sim.setStrafeAiming(false);

  const rAsked = readout('He changed direction', { unit: '×' });
  const rAnswered = readout('You answered');
  const rUnprompted = readout('Changes he never asked for', { unit: '×' });
  const rLag = readout('Your average lag', { unit: 'ms' });
  const verdict = el('p', { class: 'dim', style: { margin: '0.6rem 0 0', fontSize: 'var(--step--1)' } },
    'Press ← and → (or A and D). Change direction when he does, and only then.');

  let lastHisSide = null, pendingAnswer = null;

  function tick(s) {
    if (lastHisSide === null) lastHisSide = s.hisSide;
    if (s.hisSide !== lastHisSide) {
      lastHisSide = s.hisSide;
      if (pendingAnswer) score.late.push(0.5);       // never answered the last one
      score.asked++;
      pendingAnswer = { at: s.t, want: s.hisSide };
    }
    if (pendingAnswer && s.t - pendingAnswer.at > 0.5) { pendingAnswer = null; }
    rAsked.set(String(score.asked), '×');
    rAnswered.set(`${score.asked ? Math.round((score.answered / score.asked) * 100) : 0}%`);
    rUnprompted.set(String(score.unprompted), '×');
    rLag.set(score.late.length ? String(Math.round(avg(score.late) * 1000)) : '—', score.late.length ? 'ms' : '');
    const clean = score.asked >= 4 && score.answered / score.asked > 0.8 && score.unprompted <= 1;
    verdict.textContent = score.asked < 3
      ? 'Press ← and → (or A and D). Change direction when he does, and only then.'
      : clean
        ? 'That is strafe aiming: every change answered, nothing invented.'
        : score.unprompted > score.asked * 0.4
          ? 'You are moving on your own initiative. Legitimate, sometimes excellent, but it is not strafe aiming.'
          : 'Some of his changes went unanswered. The rule is every one of them.';
  }

  function press(want) {
    if (want === side) return;
    side = want;
    fig.sim.setYourKey(want === 'L' ? f.onLeft : f.onRight);
    const s = fig.sim.state;
    if (pendingAnswer && pendingAnswer.want === want) {
      score.answered++;
      score.late.push(s.t - pendingAnswer.at);
      pendingAnswer = null;
    } else {
      score.unprompted++;
    }
  }

  const keyHandler = (e) => {
    if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { press('R'); e.preventDefault(); }
    if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { press('L'); e.preventDefault(); }
  };
  window.addEventListener('keydown', keyHandler);

  const buttons = el('div.bigkeys',
    el('button', { type: 'button', onclick: () => press('R'), title: 'He is going left, so you go right' },
      el('b', '←'), el('span', 'answer his left')),
    el('button', { type: 'button', onclick: () => press('L'), title: 'He is going right, so you go left' },
      el('b', '→'), el('span', 'answer his right')),
  );

  const reset = el('button.btn.ghost', { type: 'button', onclick: () => {
    score.asked = 0; score.answered = 0; score.unprompted = 0; score.late.length = 0;
    lastHisSide = null; pendingAnswer = null; fig.reset();
  } }, 'Start again');

  node.appendChild(el('div.lab',
    el('div.lab-main', fig.node,
      el('p.fig-cap', el('b', 'The rule has two halves and the score keeps them apart.'), ' Missing one of his changes is one kind of failure. Inventing one of your own is a different kind, and it is the one nobody counts.')),
    el('div.lab-side',
      el('div.panel', el('div.panel-head', el('span', 'Your feet')), el('div.panel-body',
        buttons,
        segmented({
          label: 'Which pair of keys', value: formId,
          options: [
            { value: 'R/L', label: 'Mirroring' },
            { value: 'L/R', label: 'Anti-mirroring' },
            { value: 'FR/BL', label: 'Hsw mirroring' },
          ],
          onchange: (v) => { formId = v; f = makeForm(v); fig.sim.setForm({ onLeft: f.onLeft, onRight: f.onRight }); },
        }),
        el('div', { style: { marginTop: '0.7rem' } }, reset),
      )),
      el('div.panel', el('div.panel-head', el('span', 'Against the definition')), el('div.panel-body',
        el('div.readouts', rAsked, rAnswered, rUnprompted, rLag), verdict)),
    ),
  ));
}

const avg = (a) => a.reduce((x, y) => x + y, 0) / a.length;

/* ═══════════════════════════════════════════════ the short dodge ═════ */
/**
 * The one target strafe aiming cannot be held against, and what to do instead.
 *
 * Both panels face the same enemy at the same time. The left one tries to
 * answer him. The right one stops trying and parks in the middle of his
 * dodge. The percentages are measured, not asserted, and they cross over
 * somewhere around two changes of direction per second.
 */
export function shortDodge(node) {
  let dodge = 0.18;
  let left = null, right = null;
  const mount = el('div.lab-scopes');
  const rLeft = readout('Chasing him', { swatch: 'blue' });
  const rRight = readout('Sitting in the middle', { swatch: 'orange' });
  const advice = el('p', { class: 'dim', style: { margin: '0.6rem 0 0', fontSize: 'var(--step--1)' } });

  function build() {
    if (left) left.stop();
    if (right) right.stop();
    mount.innerHTML = '';
    const common = {
      formId: { onLeft: '-', onRight: '-', name: '' },
      dodge, seed: 12, params: { range: 14 },
      aspect: 0.4, monitorAspect: 0.44, span: 20, readouts: [], monitor: true,
    };
    left = duelFigure({ ...common, title: 'Answering every change',
      onFrame: (s) => rLeft.set(`${Math.round((s.hitsYou / Math.max(1, s.shotsYou)) * 100)}%`) });
    right = duelFigure({ ...common, title: 'Parked on the middle',
      params: { range: 14, aimStyle: 'centre' },
      onFrame: (s) => rRight.set(`${Math.round((s.hitsYou / Math.max(1, s.shotsYou)) * 100)}%`) });
    mount.appendChild(el('div.stack', left.node));
    mount.appendChild(el('div.stack', right.node));
    advice.textContent = dodge < 0.28
      ? 'At this rate he reverses before you could have noticed the last one. Answering him is not physically available; the middle of his dodge is.'
      : dodge < 0.45
        ? 'Around here it is a genuine choice, and it depends on your reaction time rather than on principle.'
        : 'Now the dodge is long enough to answer, and chasing him is worth more than waiting for him.';
  }

  build();
  node.appendChild(el('div.stack',
    mount,
    el('div.lab',
      el('div.lab-main', el('p.fig-cap', el('b', 'Same enemy, same seed, same second.'), ' The only difference is whether the crosshair is trying to follow him or waiting for him.')),
      el('div.lab-side',
        el('div.panel', el('div.panel-head', el('span', 'How fast he reverses')), el('div.panel-body',
          slider({
            label: 'He holds each direction for', min: 0.1, max: 0.9, step: 0.02, value: 0.18,
            format: (v) => `${Math.round(v * 1000)} ms`,
            hint: 'Under about 250 ms this is what people call short-dodging or ad-spam.',
            oninput: (v) => { dodge = v; build(); },
          }),
          el('div.readouts', { style: { marginTop: '0.7rem' } }, rLeft, rRight),
          advice,
        )),
      ),
    ),
  ));
}
