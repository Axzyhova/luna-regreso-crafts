# Lunar Colony Simulator

A lunar colonization simulator built on real engineering: ISRU chemistry, electrostatic dust,
ground stability, closed-loop life support, and a ship fuelled with propellant made on the Moon.
English by default, Spanish available from the menu.

This folder is self-contained and separate from the original game in `src/`.

## Run it

ES modules don't load from `file://`, so serve the folder:

```bash
cd colony
npm start          # node serve.mjs → http://localhost:8080
```

Any static host works (GitHub Pages included). There is no build step and no install:
three.js r160 ships in `vendor/`.

Shortcuts for demos: `?play` (skip the briefing), `?stress` (Artemis Crisis Stress Test),
`?play=fantastico`, `?stress=terrorifico`, `?lang=es`.

## Test it

```bash
cd colony
npm test           # 24 tests on the simulation, the tech tree, the tutorial and the translations
```

## Controls

| Action | Input |
|---|---|
| Walk / select a cell | click, or WASD / arrows |
| Dig by hand | E |
| Melt ice (inside the habitat) | M |
| Data layers: stability, sunlight, dust, networks | 1 – 4 |
| Pause | Space |
| Surface / underground | Tab (after the lava tube is found) |
| Rotate / pan / zoom the camera | drag / Shift-drag / wheel |

## Files

| File | What it holds |
|---|---|
| `js/simulation.js` | The engine. Every rule of the game. Plain JSON state, no DOM. |
| `js/techTree.js` | Five trees, 27 technologies, one "Real NASA Science" card each. |
| `js/gameModes.js` | Realistic, Fantasy and Horror: rules, palettes, audio profiles. |
| `js/tutorial.js` | Which panels are visible when, and the operating manuals. |
| `js/lore.js` | Briefing screens (SVG drawn in code), crew, logs, endings. |
| `js/i18n.js`, `js/lang/es.js` | Language switch and the Spanish text. |
| `js/world3d.js`, `js/models3d.js` | The 3D view (CAD style) and its models. |
| `js/ui.js`, `js/observatory.js`, `js/audio.js`, `js/main.js` | Interface, telescope, procedural sound, game loop. |

## What is real and what is not

Real, and used as written: the electrolysis split (9 : 1 : 8 by mass), the ilmenite reduction masses,
crew consumption per day, the 21 kPa O₂ + 79 kPa N₂ atmosphere, the 6 : 1 engine mixture, the six
subsystems NASA Goddard's Mission Design Lab reviews.

Simplified for play: production rates, building costs, event frequency, a 28-day cycle with a hard
day/night switch, and the departure windows (provisional values, not GMAT trajectories).

Fiction: the crew, the Helium-Plasma Crystals and glowing plants of Fantasy mode, everything in Horror mode.
