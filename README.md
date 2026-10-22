# Goldilocks

A live planet formation simulation where every wallet is a world.

Each holder is a planet with a real orbit around a real star type. Only planets inside the habitable zone earn. The first planet to reach full life takes the season pot. Seasons last fourteen days. Outcomes come from orbital mechanics, not a lottery.

This repository contains the scroll-driven landing experience.

## Stack

- Three.js with custom GLSL shaders (star surface, procedural planets, clouds, aurora, nebula, habitable zone)
- Post-processing: bloom, ACES tone mapping, color grading, chromatic aberration, lens flare, film grain
- GSAP ScrollTrigger and Lenis for scroll-driven scenes
- Canvas 2D for the intervention cards and the live orbit sandbox
- All libraries and fonts are vendored locally; no build step

## Run locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000

## Structure

- `index.html` markup and copy
- `style.css` layout, typography, motion
- `main.js` 3D scene, scroll story, cards, sandbox, audio
- `vendor/` three, gsap, lenis
- `fonts/` Space Grotesk, Instrument Serif, JetBrains Mono (SIL Open Font License)
- `audio/theme.mp3` original score, The Organ's Crescendo
- `assets/` social preview and icons

## Accessibility

Respects `prefers-reduced-motion`: smooth scrolling, cursor effects and text animations are disabled.

## License

Code is MIT. The soundtrack and brand assets are original works by the project owner, all rights reserved.
