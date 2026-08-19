# Strafe Aiming

**A simulator and visual guide for AIMER7's *Strafe Aiming 101* (25 August 2019).**

Built by Philip L (Clocktock). The ideas are AIMER7's, the arithmetic is mine.
A companion to [geometric-positioning](https://github.com/PLivdan/geometric-positioning).

The guide defines strafe aiming in one sentence — change direction whenever, and only
whenever, the target does — and then spends twelve pages on what follows from it. It argues
in prose, which is the right choice for a guide. This project runs it instead: two players,
two crosshairs and a clock, with every figure on the page read off the same simulation it
is drawing.

The writing also draws on Sam's (@400apm) *Fundamentals of Strafe* (July 2022) for the
sections on purpose, global bias, control and calm.

---

## What it computes

| The guide says | This site measures |
| --- | --- |
| **56 strafe aim forms**, 8 directions × 7 answers | the full catalogue, classified by turn angle: 8 + 16 + 16 + 16 |
| **Relative speed** of each fundamental form | 0 / 2.93 / 10 / 17.07 / 20 ups, derived from key vectors |
| **Inward- vs outward-directed** | a frozen-mouse probe: hold a key for one reaction time, measure the gap |
| **Reactivity** and its two parts | a two-delay aim model: visuomotor latency plus a cognitive reaction time |
| **Connections** between forms | the shared-key graph; every form connects to exactly twelve others |
| **Global bias** | dodge asymmetry, and what it does to a parked crosshair |
| Whose fight a form makes it | the trade: both accuracies under unequal hands |

## What it reproduces

Pinned by `npm test` (`node --test`):

- the five relative speeds, exactly (§2.3)
- the census: 8×7 = 56 forms, 8 at 180°, 16 each at 135°, 90°, 45°
- every inward/outward/mixed label in §2.3, §3.1 and §3.2, derived and probed
- no two 180-forms are connected, so none of them can travel (§3.1)
- mirroring is free for both players, whatever the hands (§2.3)
- the accuracy ranking follows relative speed
- anti-mirroring leverages a mouse-control edge; mirroring throws it away
- parking on the middle beats tracking a short dodge, and loses to a long one (§2.2)
- a biased dodge starves the parked crosshair (Sam §5)

## Running it

Static, no dependencies.

```
npm start        # serves on :5174
npm test
```

## Where it differs from the guide

Stated on the page rather than smoothed over — see the appendix. The largest one: the
guide calls the two worked advanced forms "45-strafe aim forms" after the corner of the
triangle they draw; classified by the guide's own metric (the angle of your change of
direction) they are 135° forms, and the site classifies by the turn throughout.
