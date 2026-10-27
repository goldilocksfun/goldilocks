# Goldilocks

A live planet formation simulation where every wallet is a world.

Each holder is a planet with a real orbit around a real star type. Only planets inside the habitable zone earn. Every planet that reaches full life within a season shares the Life jackpot by mass. Seasons last one calendar quarter, and the jackpot resets each season. Free planets go live at launch and, like holders, earn only after 24 hours. Rewards are paid in $LAUNCH. Payouts below 50 $LAUNCH carry over and are swept weekly. Outcomes come from orbital mechanics, not a lottery.

Website: https://goldilockszone.fun  
X: https://x.com/playgoldilocks  
GitHub: https://github.com/goldilocksfun/goldilocks

This repository contains the static site, served by GitHub Pages at the custom domain above, and the claim API.

- `index.html` scroll-driven story of one system forming, from cold cloud to first life
- `orbits.html` observatory: every claimed planet on its orbit, a planet close-up view with a spec sheet, and wallet search
- `claim.html` free planet claim for the first 200 wallets
- `play.html` live dashboard: planet status, thruster, earnings in $LAUNCH, leaderboard and payout ledger
- `api/` Node API (claims, game engine, $LAUNCH payouts), deployed on Render

## Free planet claim

Pre-launch: follow @playgoldilocks on X, connect and sign with a Solana wallet (message signature only, no transaction, no funds move), and invite friends with a personal link. The first 200 wallets get a free planet with a base mass. `config.js` holds `API_BASE` and `X_HANDLE`.

## Launch

$GOLDILOCKS launches on [uselaunch.fun](https://uselaunch.fun) (X: @_LaunchX), built on Raydium LaunchLab.

- The coin is created by the uselaunch master wallet in a private bundle, so nobody buys in the creation block.
- Every trade pays a 3 percent fee: 1 percent buys back and burns $GOLDILOCKS, 1 percent buys back and burns $LAUNCH,
  1 percent goes to the uselaunch treasury. Raydium adds 0.25 percent.
- The creator receives no trading fees. Goldilocks rewards are therefore not funded by fees: they are paid in $LAUNCH
  from a public treasury, as described below.

## Season rules

The game engine in `api/` applies these rules. How the daily pool is measured on chain, split and paid, and how to verify every epoch yourself, is documented in [docs/PAYOUTS.md](docs/PAYOUTS.md); the launch steps are in [docs/LAUNCH.md](docs/LAUNCH.md).

- Free planets: the first 200 wallets to complete the claim get a planet with mass 1. There is no token airdrop.
- Holder planets: any wallet holding at least 0.01 percent of supply gets a planet, even without a claim.
- Mass scales linearly with holdings, from 1 at 0.01 percent of supply up to 25 at the 0.25 percent cap. Holdings above 0.25 percent add no mass.
- Holdings count after they have been held for 24 hours.
- Rewards: every reward is paid in $LAUNCH (SPL token), never in SOL.
- Funding: the treasury starts with an initial $LAUNCH seed bought at launch. Thruster fees (0.01 SOL per burn) collect in the treasury and are swapped into $LAUNCH through Jupiter before each daily close; the swap signature is published with the epoch.
- Pool: at 12:00 UTC each day, 10 percent of the treasury's available $LAUNCH is released. Available means not already promised to anyone (Life pool, carried-over rewards, unmoved operations share, unpaid rows). Anyone can recompute it from the treasury token account.
- Split: 70 percent to planets inside the habitable zone (by mass multiplied by time in zone), 20 percent to the Life jackpot (paid once per season), 10 percent to operations.
- Minimum payout: 50 $LAUNCH. Smaller amounts carry over and are paid at the weekly sweep.
- Interventions: the first thruster burn each day is free, after that each burn costs 0.01 SOL. Burn SOL above a 0.1 SOL reserve is converted to $LAUNCH daily; the reserve pays network fees and new token account rent.
- All times are UTC. Seasons are calendar quarters.

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
