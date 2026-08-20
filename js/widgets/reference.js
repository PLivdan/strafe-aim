/**
 * reference.js — the back of the book.
 *
 * Routines you can actually run, the vocabulary in one place, what the
 * scoring systems in aim trainers reward instead of what you want, and an
 * honest note about the two places this site's arithmetic and the guide's
 * prose part company.
 */

import { el, segmented, readout } from '../ui/dom.js';
import { C } from '../ui/palette.js';
import { TERMS } from '../ui/teach.js';
import { DIR, form as makeForm, FUNDAMENTAL, census, EXACT, SPEED } from '../core/forms.js';

/* ═══════════════════════════════════════════════════ the routines ════ */
/**
 * The three routines, with a clock.
 *
 * The guide gives them as lists of scenarios and minutes. A list of minutes
 * is a thing people read and then do not do, so this one adds up, keeps time,
 * and says what each block is for.
 */
export function routines(node) {
  const ROUTINES = {
    beginner: {
      warmup: 'Bind the aimbot to your fire key and load Horizontal Bounce Dodge in free play. Change direction in time with the bot and try every fundamental form. The aimbot has perfect mouse control, so it shows you exactly what the mouse should do for each one.',
      items: [
        { name: 'Pole Long Dodge', mins: 5, why: 'Learn to correct through a change of direction and to live with the acceleration. Take the left-right changes, then the diagonal ones. Play with the range, circle the bot, see what happens.' },
        { name: 'Horizontal Bounce Dodge', alt: 'Vertical Bounce Dodge', mins: 5, why: 'Anti-mirroring and both half-sideways forms. On the vertical version, change direction at every bounce (a bounce is a change of direction, even though it is vertical) and at least once in between.' },
        { name: 'Rhombus Dodge', mins: 10, why: 'Fundamental forms, going for score. Try different angles of the rhombus and watch what each one does to the relative speed.' },
        { name: 'Rhombus Vertical Dodge', alt: 'XY Tracking Dodge', mins: 10, why: 'Fundamental forms again, at different ranges. You will press forward as the bot rises and backward as it falls; make yourself invert that too.' },
        { name: 'Close LS Easy Dodge', alt: 'Close FS Easy Dodge', mins: 10, why: 'Everything so far, for score.' },
      ],
    },
    intermediate: {
      warmup: 'Same as before: aimbot in free play, but now with the intermediate forms. For a taste of the advanced ones, play Close LS Easy Dodge, where you can circle the bot and push it.',
      items: [
        { name: 'Pole Med Dodge', mins: 5, why: 'Fundamental forms, even when the bot is not moving. Change direction before the bar fills.' },
        { name: 'Pole Long Dodge', mins: 5, why: 'Intermediate forms: forward and backward triangles, back-and-forth triangles, rhombi. Change direction before the bar fills.' },
        { name: 'Horizontal Bounce Dodge', alt: 'Vertical Bounce Dodge', mins: 10, why: 'Every intermediate form you know. The fundamental ones are part of the intermediate ones.' },
        { name: 'Rhombus Dodge', alt: 'Rhombus Vertical Dodge', mins: 10, why: 'Intermediate forms, for score, at different angles.' },
        { name: 'Close LS Easy Dodge', alt: 'High Ground / Low Ground / Close LS Dodge', mins: 10, why: 'Everything, for score.' },
        { name: 'LGC3 Reborn Easy', alt: 'Close FS Easy Dodge / XY Tracking Dodge', mins: 10, why: 'Everything, for score.' },
      ],
    },
    advanced: {
      warmup: 'Aimbot and test things, as always. For scoring, here is a heuristic: try to get 95% of nick’s score. That is not a joke.',
      items: [
        { name: 'Pole Short Dodge', mins: 5, why: 'Fundamental forms, even when the bot is not moving. Change direction before the bar fills.' },
        { name: 'Pole Med Dodge', mins: 5, why: 'Intermediate forms. Change direction before the bar fills.' },
        { name: 'Pole Long Dodge', mins: 5, why: 'Every form you know, connected into an advanced form you could actually use in a game.' },
        { name: 'Rhombus Dodge', alt: 'Rhombus Vertical Dodge / Close LS Dodge', mins: 10, why: 'Intermediate and advanced forms, at different rhombus angles.' },
        { name: 'Close FS Easy Dodge', alt: 'High Ground / Low Ground', mins: 10, why: 'For score.' },
        { name: 'LGC3 Reborn', alt: 'Varied / Air Dodge / XY Tracking Dodge Hard / Close FS Dodge', mins: 10, why: 'For score.' },
      ],
    },
  };

  let which = 'beginner';
  const listEl = el('div.routine-list');
  const totalEl = el('span');
  const timer = { id: 0, left: 0, idx: -1 };
  const clockEl = el('div.clock', el('b', '—'), el('span', 'no block running'));

  function stop() { clearInterval(timer.id); timer.id = 0; timer.idx = -1; clockEl.querySelector('b').textContent = '—'; clockEl.querySelector('span').textContent = 'no block running'; render(); }

  function start(i) {
    const r = ROUTINES[which];
    clearInterval(timer.id);
    timer.idx = i; timer.left = r.items[i].mins * 60;
    clockEl.querySelector('span').textContent = r.items[i].name;
    tick();
    timer.id = setInterval(tick, 1000);
    render();
  }
  function tick() {
    if (timer.left <= 0) {
      const r = ROUTINES[which];
      if (timer.idx + 1 < r.items.length) return start(timer.idx + 1);
      return stop();
    }
    timer.left--;
    const m = Math.floor(timer.left / 60), s = timer.left % 60;
    clockEl.querySelector('b').textContent = `${m}:${String(s).padStart(2, '0')}`;
  }

  function render() {
    const r = ROUTINES[which];
    listEl.innerHTML = '';
    listEl.appendChild(el('p', { class: 'dim', style: { fontSize: 'var(--step--1)', margin: '0 0 1rem' } },
      el('strong', 'Before you start. '), r.warmup));
    r.items.forEach((it, i) => {
      listEl.appendChild(el('div', { class: 'routine-item' + (timer.idx === i ? ' on' : '') },
        el('div.routine-when', el('b', `${it.mins}`), el('span', 'min')),
        el('div.routine-what',
          el('h4', it.name),
          it.alt ? el('span.alt', `or ${it.alt}`) : null,
          el('p', it.why),
        ),
        el('button.btn.ghost', { type: 'button', onclick: () => (timer.idx === i ? stop() : start(i)) }, timer.idx === i ? 'Stop' : 'Start'),
      ));
    });
    totalEl.textContent = `${r.items.reduce((a, b) => a + b.mins, 0)} minutes`;
  }

  node.appendChild(el('div.stack',
    el('div.panel',
      el('div.panel-head', el('span', 'Routine'), totalEl),
      el('div.panel-body',
        segmented({
          value: which,
          options: [
            { value: 'beginner', label: 'Beginner' },
            { value: 'intermediate', label: 'Intermediate' },
            { value: 'advanced', label: 'Advanced' },
          ],
          onchange: (v) => { which = v; stop(); },
        }),
        clockEl,
        listEl,
      ),
    ),
    el('p.fig-cap', el('b', 'These need KovaaK’s'), ', and the guide is candid that most of the scenarios were built for it and had not been tested by anyone at the time. Treat the scores as loose and the intent as exact.'),
  ));
  render();
}

/* ══════════════════════════════════════════ what scoring rewards ═════ */
/**
 * Three scoring systems, and what each one pays you to do.
 *
 * This matters more than it sounds. A scoring system is a training partner
 * that never gets tired and never changes its mind, so if it rewards the
 * wrong movement you will learn the wrong movement very efficiently.
 */
export function scoring(node) {
  const SYS = [
    {
      name: 'Distance traveled',
      how: 'Points for ground covered, whichever way you go.',
      pays: 'Long dodging: keep going through the bot\u2019s change of direction. That is a real and useful movement form, but it is the opposite of strafe aiming.',
      cheese: 'Hold back and forth. Full marks, no learning.',
      verdict: 'bad',
    },
    {
      name: 'Movement-based',
      how: 'A bar fills while you hold a direction and banks when you change. Hold too long and it caps; change too early and you bank less.',
      pays: 'Short dodging, and changing direction sooner than you meant to. It also makes you static.',
      cheese: 'Strafe into a wall. The bar does not know you are not moving.',
      verdict: 'mixed',
    },
    {
      name: 'Conditional movement',
      how: 'Points only for following a prescription: this key while the bot goes left, that key while it goes right.',
      pays: 'Exactly the form you set out to train, and nothing else.',
      cheese: 'None available, which is the point. Award nothing for the first 200 ms after the bot\u2019s change and prediction stops paying too.',
      verdict: 'good',
    },
  ];

  node.appendChild(el('div.cols-3', SYS.map((s) => el('div.panel',
    el('div.panel-head', el('span', s.name), el('span', { class: `tag ${s.verdict}` }, s.verdict === 'good' ? 'what we want' : s.verdict === 'mixed' ? 'partly' : 'no')),
    el('div.panel-body',
      el('p', { style: { fontSize: 'var(--step--1)' } }, el('strong', 'How it scores. '), s.how),
      el('p', { style: { fontSize: 'var(--step--1)' } }, el('strong', 'What it pays you to do. '), s.pays),
      el('p', { style: { fontSize: 'var(--step--1)', marginBottom: 0 } }, el('strong', 'How to cheat it. '), s.cheese),
    ),
  ))));
}

/* ═══════════════════════════════════════════════════ glossary ════════ */
export function glossary(node) {
  const EXTRA = [
    ['Mouse control', 'the hand', 'Smoothness, straight lines and curves at any speed, flicks of any length, micro-corrections. Testable standing still, and it transfers to Paint.'],
    ['Precision reading', 'how finely you see', 'How exactly you can tell where the crosshair sits relative to the body.'],
    ['Fast-strafes reading', 'how often you see', 'How quickly you refresh that judgement. A continuous reaction time. When it is poor the scene stays blurry long after your click-test says it should not.'],
    ['Movement reading', 'what a change means', 'Knowing how much mouse a given change of direction demands, given how both of you are moving. This is the one the whole guide trains.'],
    ['Reactive part', 'noticing', 'From the enemy\u2019s change of direction to your realising it. Nothing you press changes it much.'],
    ['Correcting part', 'the flick back', 'From realising to being back on them. Its size is set by how far off you got, which is set by what you pressed.'],
    ['Short dodge', 'ad-spam', 'Reversing faster than anyone can answer. Unbeatable by strafe aiming and easy to punish by waiting in the middle. Fine as a fake, awful as a habit.'],
    ['Rhombus', 'the closed shape', 'What a chain of four quarter turns draws on the ground. In games where the diagonals are slower it is a rhombus rather than a square.'],
  ];

  const items = [
    ...Object.values(TERMS).map((t) => [t.name, t.plain, t.tip + (t.ask ? ` Ask: ${t.ask}` : '')]),
    ...EXTRA,
  ].sort((a, b) => a[0].localeCompare(b[0]));

  node.appendChild(el('dl.glossary', items.map(([name, plain, def]) => el('div',
    el('dt', name, el('small', plain)),
    el('dd', def),
  ))));
}

/* ══════════════════════════════════════ where we differ, honestly ════ */
export function disagreements(node) {
  const ITEMS = [
    {
      claim: 'The two advanced forms are called 45-forms.',
      guide: 'Section 3.2 calls back-to-forward-hsw and forward-hsw-to-mirroring \u201c45-strafe aim forms (hence triangles)\u201d.',
      ours: 'Measured as the guide defines the classification, the angle made by your change of direction, both are 135°. Forward-right to backward is a 135° turn. The 45° is the corner of the triangle the shape draws, which is 180° minus the turn.',
      why: 'Both readings are useful and they are not the same number. This site classifies by the turn throughout, because that is the number that predicts the relative speed and the classification into inward and outward. The census on the matrix, 8 at 180° and 16 each at 135°, 90° and 45°, only comes out to 56 under that reading.',
    },
    {
      claim: 'Back and forth is a mixed form.',
      guide: 'Section 2.3: changing from backward to forward is outward-directed and forward to backward is inward-directed.',
      ours: 'Agreed, and worth saying why, because the transverse test that decides every other form is silent here: neither direction moves you across the sight line at all. What separates the two halves is the range. Pushing in shortens it, and the same speed across the sight line becomes a faster sweep across your screen.',
      why: 'The probe figure measures this rather than asserting it: hold forward for one reaction time and the gap is larger than standing still, hold backward and it is smaller. The margin is small, which is a fair description of a form the guide calls almost the same as standing still.',
    },
    {
      claim: 'Mirroring means neither of you needs to move the mouse.',
      guide: 'Section 2.3, and it is exactly right about the steady state.',
      ours: 'The simulation puts mirroring at a hundred per cent time on target for both players, which is the strongest agreement anywhere on this page. But it gets there with a nonzero mouse: through each change of direction the relative speed rises to twenty and falls back, and the crosshair has to ride that.',
      why: 'Nothing turns on it. It is only worth flagging because \u201cyou do not have to move your mouse\u201d is the sentence people quote, and the thing they then fail to do is the small movement in between.',
    },
  ];

  node.appendChild(el('div.trio', ITEMS.map((it) => el('div.panel',
    el('div.panel-head', el('span', it.claim)),
    el('div.panel-body',
      el('p', el('strong', 'The guide says. '), it.guide),
      el('p', el('strong', 'This site measures. '), it.ours),
      el('p', { style: { marginBottom: 0 } }, el('strong', 'Why it matters, or does not. '), it.why),
    ),
  ))));
}

/* ═══════════════════════════════════════════════ the exact numbers ═══ */
export function exactNumbers(node) {
  const r2 = Math.SQRT2 / 2;
  const rows = [
    ['Mirror', '10 − 10', EXACT.mirror],
    ['Hsw mirror', '10 − 10cos45°', EXACT.hswMirror],
    ['Back & forth', '10 − 0', EXACT.backForth],
    ['Hsw anti', '10 + 10cos45°', EXACT.hswAnti],
    ['Anti-mirror', '10 + 10', EXACT.antiMirror],
  ];
  node.appendChild(el('div.panel',
    el('div.panel-head', el('span', 'How fast they cross your screen'), el('span', '±10 ups')),
    el('div.panel-body', el('div.scroll-x', el('table.data',
      el('thead', el('tr', el('th', 'Form'), el('th', 'Across'), el('th', 'ups'), el('th', '°/s at 16 u'), el('th', 'cm/s'))),
      el('tbody', rows.map(([name, expr, v]) => el('tr',
        el('td', name),
        el('td', expr),
        el('td', v.toFixed(2)),
        el('td', ((v / 16) * 180 / Math.PI).toFixed(0)),
        el('td', (((v / 16) * 180 / Math.PI) / 360 * 30).toFixed(1)),
      ))),
    )),
    el('p', { class: 'dim', style: { fontSize: 'var(--step--2)', fontFamily: 'var(--mono)', margin: '0.6rem 0 0' } },
      'cm/s of mousepad assumes 30 cm per full turn.')),
  ));
}
