/**
 * teach.js — the pieces every explanatory figure is built from.
 *
 * Three editorial rules are enforced here rather than left to each widget:
 *
 *   1. Plain language first. A teaching figure says "he barely crosses your
 *      screen" with a bar. The exact units per second sit behind a disclosure.
 *   2. Both cameras, always. Every figure can be swapped, because a fight has
 *      two monitors and the whole point of a form is what it does to his.
 *   3. Predict, then look. A reader who has committed to an answer learns
 *      more from the figure than one who is only watching it.
 */

import { el } from './dom.js';

// ── vocabulary ────────────────────────────────────────────────────────────
/**
 * Canonical term, plain-language translation, and the one diagnostic question
 * that makes the term usable in a game. The tooltips on the page come from
 * here, so a reader never has to remember a definition from twenty screens ago.
 */
export const TERMS = {
  strafeaim: {
    name: 'strafe aiming', plain: 'change direction when he does',
    tip: 'Changing your own direction whenever, and only whenever, the target changes his.',
    ask: 'Did he just turn? Then so do I, and not otherwise.',
  },
  form: {
    name: 'strafe aim form', plain: 'a pair of keys',
    tip: 'Which key you hold while he goes left, and which you hold while he goes right. That pair is the whole form.',
    ask: 'What am I holding for each of his two directions?',
  },
  viewangle: {
    name: 'view-angle', plain: 'where the crosshair points',
    tip: 'The direction your crosshair points. Your keys are named relative to it, so it decides where a key takes you.',
    ask: 'Where am I looking, and so where does W actually go?',
  },
  relative: {
    name: 'relative speed', plain: 'how fast he crosses your screen',
    tip: 'The part of your speed and his that runs across the line of sight, added together. It is what your mouse has to follow.',
    ask: 'How fast does the body slide, not how fast does he run?',
  },
  inward: {
    name: 'inward-directed', plain: 'the gap closes',
    tip: 'A change of direction that shrinks the distance between crosshair and body while you are correcting.',
    ask: 'Does my new direction follow him across, or fight him?',
  },
  outward: {
    name: 'outward-directed', plain: 'the gap opens',
    tip: 'A change of direction that grows the distance between crosshair and body while you are correcting.',
    ask: 'Am I making my own correction bigger?',
  },
  reactivity: {
    name: 'reactivity', plain: 'notice, then fix',
    tip: 'The time from him changing direction to your crosshair being back on him. Two parts: noticing, and correcting.',
    ask: 'How long was I off him, and which half was the problem?',
  },
  reading: {
    name: 'reading', plain: 'seeing where things are',
    tip: 'Knowing where your crosshair is relative to the target, how often you refresh that, and what a change of direction demands of the mouse.',
    ask: 'Can I actually see the gap, or am I guessing?',
  },
  connection: {
    name: 'connection', plain: 'a shared key',
    tip: 'Two forms that prescribe the same key for the same enemy direction. You can pass from one to the other through it.',
    ask: 'Do these two forms agree anywhere? Then I can switch there.',
  },
  bias: {
    name: 'global bias', plain: 'going somewhere',
    tip: 'Ending the fight somewhere other than where you started it, instead of oscillating on the spot.',
    ask: 'Over the last few seconds, did I actually travel?',
  },
  hsw: {
    name: 'half-sideways', plain: 'on a diagonal',
    tip: 'A form built on the diagonals, so only part of your speed runs across the sight line and the rest opens or closes the range.',
    ask: 'Is my movement across him, or partly towards him?',
  },
  longdodge: {
    name: 'long dodge', plain: 'keep going',
    tip: 'Holding a direction through his change of direction instead of answering it. Legitimate movement, but it is not strafe aiming.',
    ask: 'Am I answering him, or going my own way?',
  },
};

/** Attach tooltips to every <span class="t" data-t="..."> already in the page. */
export function wireTerms(root = document) {
  for (const node of root.querySelectorAll('.t[data-t]')) {
    const term = TERMS[node.dataset.t];
    if (!term || node.querySelector('.tip')) continue;
    node.setAttribute('tabindex', '0');
    node.setAttribute('role', 'note');
    node.setAttribute('aria-label', `${term.name}: ${term.tip}`);
    node.appendChild(el('span.tip', term.tip));
  }
}

// ── epistemic labels ──────────────────────────────────────────────────────
/**
 * A reader should always know which kind of claim they are looking at:
 * something true by definition, something visible, something transferable,
 * something the solver produced, or something supplied rather than found.
 */
export const chip = (kind, text) => el(`span.chip.${kind}`, text ?? {
  definition: 'Definition', observation: 'Observation', rule: 'Rule',
  model: 'Model result', assumption: 'Assumption',
  approximation: 'Approximation', modifier: 'Game-specific modifier',
}[kind]);

/** The transferable conclusion at the end of a scenario. */
export const rulebox = (text, why) => el('div.rulebox',
  chip('rule', 'Transferable rule'),
  el('p', text),
  why ? el('p.why', why) : null,
);

// ── plain-language magnitude ──────────────────────────────────────────────
const WORDS = ['none', 'tiny', 'small', 'moderate', 'large', 'very large'];

/** Turn a measurement into a word, relative to a reference value. */
export function describe(value, reference) {
  if (!(reference > 0)) return WORDS[0];
  const r = value / reference;
  if (r <= 0.002) return WORDS[0];
  if (r < 0.15) return WORDS[1];
  if (r < 0.4) return WORDS[2];
  if (r < 0.7) return WORDS[3];
  if (r < 1.15) return WORDS[4];
  return WORDS[5];
}

/**
 * A labelled bar that reads in words by default, and in the figure's own
 * units only when the reader asks for them.
 */
export function gauge(label, opts = {}) {
  const word = el('span.gauge-word', '—');
  const num = el('span.gauge-num');
  const fill = el('i');
  const row = el('div.gauge-row',
    el('span.gauge-lbl', opts.swatch ? el('i', { class: `swatch sw-${opts.swatch}` }) : null, label),
    el('span', word, num),
    el('span.gauge-track', fill),
  );
  fill.style.background = opts.color ?? 'var(--ink-2)';
  row.set = (value, reference, showNumbers) => {
    const frac = reference > 0 ? Math.min(1, value / reference) : 0;
    fill.style.width = `${frac * 100}%`;
    word.textContent = describe(value, reference);
    num.textContent = showNumbers ? `  ${value.toFixed(value < 10 ? 2 : 1)}${opts.unit ? ' ' + opts.unit : ''}` : '';
  };
  return row;
}

/** A disclosure for exact figures, solver settings, and other machinery. */
export function advanced(summary, ...body) {
  return el('details.adv',
    el('summary', summary ?? 'Exact figures'),
    el('div.adv-body', body),
  );
}

// ── predict, then look ────────────────────────────────────────────────────
/**
 * Options are shuffled on every load. Written in source order the correct
 * answer tends to land in the same slot, and a reader who notices that can
 * score full marks without reading a single question.
 */
function shuffled(items) {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * @param {Object} spec { question, options:[{label, correct, why}] }
 */
export function predict({ question, options }) {
  const verdict = el('p.verdict');
  options = shuffled(options);
  const buttons = options.map((o) => el('button', {
    type: 'button', 'aria-pressed': 'false',
    onclick: () => {
      buttons.forEach((b, i) => b.setAttribute('aria-pressed', String(options[i] === o)));
      box.classList.add('answered');
      verdict.className = `verdict ${o.correct ? 'right' : 'wrong'}`;
      verdict.textContent = (o.correct ? 'Yes. ' : 'Not quite. ') + o.why;
    },
  }, o.label));
  const box = el('div.predict',
    el('span.q', question),
    el('div.opts', buttons),
    verdict,
  );
  return box;
}

// ── both cameras ──────────────────────────────────────────────────────────
/**
 * The swap control that belongs on every figure. `onchange` receives 'you'
 * or 'enemy'; the caller re-renders from the other eye.
 */
export function povSwap(initial, onchange) {
  let pov = initial ?? 'you';
  const label = el('span', pov === 'you' ? 'Your camera' : "Enemy's camera");
  const btn = el('button.swap', {
    type: 'button',
    title: 'See the same moment from the other player',
    onclick: () => {
      pov = pov === 'you' ? 'enemy' : 'you';
      label.textContent = pov === 'you' ? 'Your camera' : "Enemy's camera";
      btn.className = `swap ${pov === 'you' ? 'pov-you' : 'pov-enemy'}`;
      onchange(pov);
    },
  }, 'Swap camera');
  const head = el('span', label);
  return { button: btn, label: head, get pov() { return pov; } };
}

