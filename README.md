# Goldilocks

A live planet formation simulation where every wallet is a world.

Each holder is a planet with a real orbit around a real star type. Only planets inside the habitable zone earn. The first planet to reach full life takes the Life jackpot. Seasons last fourteen days. Outcomes come from orbital mechanics, not a lottery.

Website: https://goldilockszone.fun  
X: https://x.com/playgoldilocks  
GitHub: https://github.com/goldilocksfun/goldilocks

This repository contains the static site, served by GitHub Pages at the custom domain above, and the claim API.

- `index.html` scroll-driven story of one system forming, from cold cloud to first life
- `orbits.html` observatory: every claimed planet on its orbit, a planet close-up view with a spec sheet, and wallet search
- `claim.html` free planet claim for the first 200 wallets
- `api/` Node claim API (nonce, signature check, stats, planet list), deployed on Render

## Free planet claim

Pre-launch: follow @playgoldilocks on X, connect and sign with a Solana wallet (message signature only, no transaction, no funds move), and invite friends with a personal link. The first 200 wallets get a free planet with a base mass. `config.js` holds `API_BASE` and `X_HANDLE`.

## Season rules

The game engine that applies these rules is in progress; the site and claim API are live.

- Free planets: the first 200 wallets to complete the claim get a planet with mass 1. There is no token airdrop.
- Holder planets: any wallet holding at least 0.01 percent of supply gets a planet, even without a claim.
- Mass scales linearly with holdings, from 1 at 0.01 percent of supply up to 50 at the 0.5 percent cap. Holdings above 0.5 percent add no mass.
- Holdings count after they have been held for 24 hours.
- Payouts: planets inside the habitable zone share a daily SOL payout at 20:00 Taipei time (12:00 UTC).
- Interventions: the first thruster burn each day is free, after that each burn costs 0.01 SOL.
- Creator fee split: 70 percent to the habitable zone pool (paid daily in SOL by mass multiplied by time in zone), 20 percent to the Life jackpot, 10 percent to operations.

## Planets

`planets.js` derives every planet deterministically from its wallet address, so the claim card and the observatory always show the same world. There are ten types: lava world, dune world, ocean world, glacial world, verdant terra, gas giant, eyeball world, sulfur world, barren rock and ringed super earth, with per wallet palettes, clouds, rings, moons and rare traits.

## Stack

- Three.js with custom GLSL shaders (star surface and corona, procedural planets, clouds, aurora, nebula, habitable zone)
- Post-processing on the story page: bloom, ACES tone mapping, color grading, film grain
- GSAP ScrollTrigger and Lenis for scroll-driven scenes
- All libraries and fonts are vendored locally; no build step

## Run locally

```
python3 -m http.server 8000
```

Then open http://localhost:8000. For the API: `cd api && npm install && node server.js`.

## Structure

- `main.js`, `style.css`, `v9.css` story page
- `orbits.js`, `orbits.css` observatory
- `claim.js`, `claim.css`, `wallet.js` claim page and wallet picker
- `planets.js`, `planet-shaders.js` shared planet classification and shaders
- `sky.js` background sky, galaxies and comets
- `vendor/` three, gsap, lenis
- `fonts/` Newsreader, IBM Plex Sans, IBM Plex Mono (SIL Open Font License)
- `audio/theme.mp3` original score
- `assets/` social preview and icons

## Accessibility

Respects `prefers-reduced-motion`: smooth scrolling, cursor effects and text animations are disabled.

## License

Code is MIT. The soundtrack and brand assets are original works by the project owner, all rights reserved.
