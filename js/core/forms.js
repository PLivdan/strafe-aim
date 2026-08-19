/**
 * forms.js — the algebra of strafe aim forms.
 *
 * Everything the guide says about a form follows from two facts: which of the
 * eight keys you hold when the enemy goes left, and which you hold when he
 * goes right. This module turns that pair into every quantity the page ever
 * quotes — the turn angle, the relative speed, whether each change is
 * inward-directed, what the form is called — and it derives them rather than
 * listing them, so the guide's own classifications become claims that can be
 * checked instead of copy.
 *
 * Frames, once, so nothing below has to think about them again.
 *
 *   The world is two-dimensional and the line of sight lies along +x. You
 *   stand at the origin looking along +x. The enemy stands at (d, 0) looking
 *   back along -x. Your left hand points at +y. Because he faces you, his
 *   left hand points at -y.
 *
 *   A key is named in the frame of the player pressing it, and turned into a
 *   world vector by that player's facing. So "he goes left" and "you go left"
 *   are opposite world directions, which is the whole reason mirroring and
 *   anti-mirroring are different things.
 *
 *   +y  (your left, his right)
 *    ^
 *    |        you ->            <- him
 *    +---------------------------------> +x   (the line of sight)
 */

/** Ground speed, in units per second. The guide's convenient round number. */
export const SPEED = 10;

const RAD = Math.PI / 180;
const r2 = Math.SQRT2 / 2;

/**
 * The eight directions, in the frame of whoever presses them. `a` is the
 * angle from that player's own forward, positive towards their left.
 */
export const DIRS = [
  { key: 'F',  a: 0,    keys: 'W',  label: 'forward',        short: 'fwd' },
  { key: 'FL', a: 45,   keys: 'WA', label: 'forward+left',   short: 'fwd+L' },
  { key: 'L',  a: 90,   keys: 'A',  label: 'left',           short: 'left' },
  { key: 'BL', a: 135,  keys: 'SA', label: 'backward+left',  short: 'back+L' },
  { key: 'B',  a: 180,  keys: 'S',  label: 'backward',       short: 'back' },
  { key: 'BR', a: -135, keys: 'SD', label: 'backward+right', short: 'back+R' },
  { key: 'R',  a: -90,  keys: 'D',  label: 'right',          short: 'right' },
  { key: 'FR', a: -45,  keys: 'WD', label: 'forward+right',  short: 'fwd+R' },
];

export const DIR = Object.fromEntries(DIRS.map((d) => [d.key, d]));
export const KEYS = DIRS.map((d) => d.key);

/** Your key as a world vector: you look along +x, your left is +y. */
export function yourVec(key) {
  const a = DIR[key].a * RAD;
  return { x: Math.cos(a), y: Math.sin(a) };
}

/** His key as a world vector: he looks along -x, so his left is -y. */
export function hisVec(key) {
  const a = DIR[key].a * RAD;
  return { x: -Math.cos(a), y: -Math.sin(a) };
}

/**
 * The view-angle is the direction the crosshair points, and the keys are
 * named relative to it, so holding a key fixes the angle between where you
 * move and where you look. Forward is zero, backward is a half turn, and the
 * diagonals are the quarter and three-quarter turns the guide names.
 */
export const viewOffset = (key) => Math.abs(DIR[key].a);

/** Smallest angle between two directions, in degrees: 45, 90, 135 or 180. */
export function turnAngle(k1, k2) {
  let t = Math.abs(DIR[k1].a - DIR[k2].a) % 360;
  if (t > 180) t = 360 - t;
  return t;
}

/**
 * Transverse and radial components of a player's velocity, in the only frame
 * that matters for aim: across the line of sight, and along it.
 *
 * Transverse is what your mouse has to follow. Radial changes the range, and
 * so changes how much mouse a given transverse speed costs.
 */
export const yourComponents = (key) => {
  const v = yourVec(key);
  return { across: v.y * SPEED, along: v.x * SPEED };
};
export const hisComponents = (key) => {
  const v = hisVec(key);
  return { across: v.y * SPEED, along: -v.x * SPEED };  // `along` positive = closing
};

/**
 * Relative speed across the line of sight, which is the number the guide
 * quotes for every fundamental form: 0 for mirroring, 20 for anti-mirroring,
 * 17.07 and 2.93 for the two half-sideways families.
 */
export function relativeAcross(yourKey, hisKey) {
  return Math.abs(yourComponents(yourKey).across - hisComponents(hisKey).across);
}

/** Rate of change of range: how fast the two of you close or separate. */
export function closingSpeed(yourKey, hisKey) {
  return yourComponents(yourKey).along + hisComponents(hisKey).along;
}

/**
 * Inward-directed or outward-directed, for one change of direction.
 *
 * The guide's test is what your view-angle does relative to the target if you
 * freeze the mouse: drift towards where he is now going and the correction
 * you owe gets smaller, drift away and it gets larger. Written in components
 * that is simply whether you move across the sight line the same way he now
 * does. Follow him across and the gap closes; go the other way and it opens.
 *
 * Pure forward and pure backward move nothing across, so the sight line does
 * not turn at all and the transverse test is silent. There the range decides:
 * pushing in shortens the range, which magnifies the same transverse speed
 * into a faster sweep across your screen and a bigger correction, so forward
 * is outward-directed and backward is inward-directed.
 */
export function directedness(yourKey, hisKey) {
  const mine = yourComponents(yourKey).across;
  const his = hisComponents(hisKey).across;
  if (Math.abs(mine) > 1e-9) return Math.sign(mine) === Math.sign(his) ? 'inward' : 'outward';
  return yourComponents(yourKey).along > 0 ? 'outward' : 'inward';
}

/**
 * A form is the pair (what you hold while he goes left, what you hold while
 * he goes right). `left`/`right` are named for *his* keys, so the enemy going
 * left appears to move right across your monitor.
 */
export function makeForm(onLeft, onRight) {
  const halves = [
    { his: 'L', mine: onLeft },
    { his: 'R', mine: onRight },
  ].map((h) => ({
    ...h,
    across: relativeAcross(h.mine, h.his),
    closing: closingSpeed(h.mine, h.his),
    directed: directedness(h.mine, h.his),
    view: viewOffset(h.mine),
  }));

  const dirs = halves.map((h) => h.directed);
  const directed = dirs[0] === dirs[1] ? dirs[0] : 'mixed';
  const meta = CATALOGUE[`${onLeft}/${onRight}`] || {};

  return {
    id: `${onLeft}/${onRight}`,
    onLeft, onRight, halves,
    turn: turnAngle(onLeft, onRight),
    directed,
    across: (halves[0].across + halves[1].across) / 2,
    symmetric: Math.abs(halves[0].across - halves[1].across) < 1e-9,
    /** Where the two half-cycles leave you: zero means the form cannot travel. */
    drift: driftOf(onLeft, onRight),
    name: meta.name || `${DIR[onLeft].short} / ${DIR[onRight].short}`,
    family: meta.family || null,
    tier: meta.tier || 'other',
    note: meta.note || null,
    ...meta,
  };
}

/**
 * Net ground displacement over one full cycle, per second of cycle, if the
 * two halves are held for equal time. This is the arithmetic behind "all the
 * fundamental forms are globally static": opposite directions cancel exactly.
 */
function driftOf(onLeft, onRight) {
  const a = yourVec(onLeft), b = yourVec(onRight);
  const x = (a.x + b.x) / 2 * SPEED, y = (a.y + b.y) / 2 * SPEED;
  return { x, y, mag: Math.hypot(x, y) };
}

/**
 * Names. Every one of these is the guide's, in the guide's words, keyed by
 * the pair of keys its own sentence prescribes. Nothing here is computed;
 * everything else on the page is.
 */
export const CATALOGUE = {
  // ── the eight fundamental (180) forms, §2.2 ──────────────────────────
  'R/L':   { name: 'Mirroring', family: 'mirroring', tier: 'fundamental',
             note: 'You press the opposite keys to his, so you both travel the same way through the world and neither of you appears to move.' },
  'L/R':   { name: 'Anti-mirroring', family: 'anti-mirroring', tier: 'fundamental',
             note: 'You press the same keys he does, so you travel opposite ways and the relative speed is the highest there is.' },
  'FL/BR': { name: 'Half-sideways anti-mirroring', variant: 'front-left', family: 'anti-mirroring', tier: 'fundamental',
             note: 'The anti-mirror pulled onto a diagonal: still opposing him across the sight line, but now also opening and closing the range.' },
  'BL/FR': { name: 'Half-sideways anti-mirroring', variant: 'back-left', family: 'anti-mirroring', tier: 'fundamental',
             note: 'The mirror image of the other half-sideways anti-mirror.' },
  'FR/BL': { name: 'Half-sideways mirroring', variant: 'front-right', family: 'mirroring', tier: 'fundamental',
             note: 'Almost cancels him. The target is nearly motionless, which is exactly why it is the hardest one to read.' },
  'BR/FL': { name: 'Half-sideways mirroring', variant: 'back-right', family: 'mirroring', tier: 'fundamental',
             note: 'The mirror image of the other half-sideways mirror.' },
  'F/B':   { name: 'Back and forth', variant: 'forward first', family: 'mixed', tier: 'fundamental',
             note: 'Nothing across the sight line at all. Almost the same as standing still, and about as easy to hit.' },
  'B/F':   { name: 'Back and forth', variant: 'backward first', family: 'mixed', tier: 'fundamental',
             note: 'The same form started on the other foot.' },

  // ── the 90 building blocks, §3.1 ─────────────────────────────────────
  'FR/FL': { name: 'Forward triangle', variant: 'mirroring', family: 'mirroring', tier: 'block',
             note: 'Both halves push in. It cannot be repeated forever because you arrive.' },
  'FL/FR': { name: 'Forward triangle', variant: 'anti-mirroring', family: 'anti-mirroring', tier: 'block' },
  'BR/BL': { name: 'Backward triangle', variant: 'mirroring', family: 'mirroring', tier: 'block',
             note: 'Both halves back out. It cannot be repeated forever because you leave.' },
  'BL/BR': { name: 'Backward triangle', variant: 'anti-mirroring', family: 'anti-mirroring', tier: 'block' },
  'FR/BR': { name: 'Back-and-forth triangle', variant: 'clockwise, right', family: 'mixed', tier: 'block',
             note: 'Both halves carry right. Held properly the ground track is a circle around him, and your crosshair stays on its centre.' },
  'BR/FR': { name: 'Back-and-forth triangle', variant: 'anticlockwise, right', family: 'mixed', tier: 'block' },
  'FL/BL': { name: 'Back-and-forth triangle', variant: 'anticlockwise, left', family: 'mixed', tier: 'block' },
  'BL/FL': { name: 'Back-and-forth triangle', variant: 'clockwise, left', family: 'mixed', tier: 'block' },

  // ── named advanced forms, §3.2 ───────────────────────────────────────
  'FR/B':  { name: 'Back to forward-hsw', variant: 'right', family: 'mirroring', tier: 'advanced',
             note: 'Backward as he goes right, forward-right as he goes left. Close range, and it turns his own change of direction outward-directed.' },
  'FL/B':  { name: 'Back to forward-hsw', variant: 'left', family: 'mirroring', tier: 'advanced' },
  'FR/L':  { name: 'Forward-hsw to mirroring', variant: 'right', family: 'mirroring', tier: 'advanced',
             note: 'One of the best ways to push someone: the half-sideways half is brutal on his precision, and the mirror half punishes the direction change it provokes.' },
  'FL/R':  { name: 'Forward-hsw to mirroring', variant: 'left', family: 'mirroring', tier: 'advanced' },
  'R/B':   { name: 'Back to right mirroring rectangle', family: 'mirroring', tier: 'advanced',
             note: 'Backward while he goes right, right while he goes left. He must flick left and stop dead on you, because by then you are mirroring.' },
  'L/B':   { name: 'Back to left mirroring rectangle', family: 'anti-mirroring', tier: 'advanced' },
};

/**
 * Two forms are connected when they prescribe the same key for the same one
 * of his directions. That shared key is the connection, and it is the door
 * between them: you can leave one form and enter the other without ever
 * breaking the rule, because at the moment you pass through, both forms want
 * exactly what you are already holding.
 *
 * No two of the eight fundamental forms are connected, which is precisely why
 * you cannot get anywhere by playing them.
 */
export function connects(a, b) {
  if (a.id === b.id) return null;
  if (a.onLeft === b.onLeft) return { on: 'left', key: a.onLeft };
  if (a.onRight === b.onRight) return { on: 'right', key: a.onRight };
  return null;
}

/** Everything that connects to this form. */
export function connections(f, pool = allForms()) {
  return pool.map((g) => ({ form: g, via: connects(f, g) })).filter((x) => x.via);
}

/** All 56 forms: eight choices for the first half, seven for the second. */
export function allForms() {
  const out = [];
  for (const a of KEYS) for (const b of KEYS) if (a !== b) out.push(makeForm(a, b));
  return out;
}

/** The eight 180-forms, in the guide's order. */
export const FUNDAMENTAL = ['R/L', 'L/R', 'FL/BR', 'BL/FR', 'FR/BL', 'BR/FL', 'F/B', 'B/F'];

/** The 90-forms the intermediate forms are built from. */
export const BLOCKS = ['FR/FL', 'FL/FR', 'BR/BL', 'BL/BR', 'FR/BR', 'BR/FR', 'FL/BL', 'BL/FL'];

export const form = (id) => {
  const [a, b] = id.split('/');
  return makeForm(a, b);
};

/**
 * How many forms sit at each turn angle. Each direction has two neighbours at
 * 45, two at 90, two at 135 and one opposite, so the census is 16/16/16/8.
 */
export function census() {
  const by = { 45: 0, 90: 0, 135: 0, 180: 0 };
  for (const f of allForms()) by[f.turn]++;
  return by;
}

/** Exact values the page quotes, kept here so the prose and the code agree. */
export const EXACT = {
  mirror: 0,
  antiMirror: 2 * SPEED,
  hswAnti: SPEED * (1 + r2),
  hswMirror: SPEED * (1 - r2),
  backForth: SPEED,
};
