# Jeffrey Jone · Portfolio Version

A Pokémon-inspired, retro RPG portfolio. Open a spinning Poké Ball, explore a clickable town map, collect four projects, play “Who’s that project?”, inspect achievement badges, and meet the trainer behind the pixels.

## Run locally

Open `index.html` directly, or serve the project with:

```sh
python3 -m http.server 8000
```

Visit `http://localhost:8000`. The site has no build step or production dependencies. GitHub Pages can serve it from the repository root.

## Structure

```text
index.html                   # Accessible markup and portfolio content
assets/
  css/
    styles.css               # Retro game interface and responsive layouts
    entrance.css             # Poké Ball landing and opening animation
  js/
    app.js                   # Entrance, routing, dialogs, optional sound
    game.js                  # Project Dex, quiz, profiles, badges, hobbies
    integrations.js          # Spotify player, Plano clock, weather
  images/
    jeffrey-portrait.jpg      # Original cropped portrait
    jeffrey-pixel.png         # Generated 8-bit-style portrait
    favicon.svg
  documents/Resume.pdf
docs/                       # Design and asset notes
tests/browser.cjs           # Browser regression checks
```

## Game features

- Keyboard-accessible navigation and native modal dialogs, including Escape to close and focus return.
- The portrait opens the original photograph and a short profile. The map portrait provides the same interaction on small screens.
- Project catches persist locally on the visitor’s device. If storage is blocked, the game works for the current visit.
- Reduced-motion settings skip the opening animation and stop decorative motion. Sound is off until explicitly enabled.
- Without JavaScript, all portfolio sections remain readable and résumé/social links work.
- Section links support browser history and direct URLs, including the old `#about` and `#top` aliases.

## Integrations

The radio accepts public Spotify playlist, album, track, and artist URLs. It validates the host and resource ID, creates an official Spotify embed, and offers an external fallback link. Nothing autoplays. To feature an owner-selected playlist, set `featuredSpotifyUrl` in `assets/js/integrations.js`. The default provides soundtrack discovery and lets visitors choose a station; it does not claim to show Jeffrey’s personal listening history.

The Plano clock uses `America/Chicago`, including daylight-saving time. The weather button calls Open-Meteo for Plano (no location permission or API key) with a timeout and retry support. External services and Google Fonts need an internet connection; local fallback fonts and all core portfolio content remain available.

Reference documentation: [Spotify embeds](https://developer.spotify.com/documentation/embeds), [Open-Meteo](https://open-meteo.com/en/docs).

## SignDex guestbook

SignDex adds required Pokémon preferences, optional profile details, unique themed signature cards, and a moderated shared book. Its prepared backend uses Cloudflare Workers + D1. Until the deployed API is connected, the static site clearly labels SignDex as preview-only.

Run the complete local feature with `npm run signdex:dev` (Node 22.13+), then open `http://127.0.0.1:8788/#signdex`. See [SignDex setup and moderation](docs/signdex.md) for Cloudflare provisioning, the review commands, API behavior, and test details.

Source files: `assets/js/signdex*.js`, `assets/css/signdex.css`, `server/signdex/`, and `scripts/signdex-review.mjs`. The local `.signdex-data/` database and private environment files are excluded from Git.

## Browser checks

```sh
npm ci
npx playwright install chromium
npm test
```

To use an existing Chrome installation instead of downloading a browser:

```sh
CHROME_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" npm test
```

The test starts its own local server and covers entry, navigation, portrait/focus behavior, collecting and persistence, filtering, quizzes, badges, Spotify URL validation, weather success/failure, mobile overflow, reduced motion, and no-JavaScript access. External integration responses are mocked for reproducibility.

## Links

[GitHub](https://github.com/Jeffjone) · [LinkedIn](https://www.linkedin.com/in/jeffreyjone/) · [Résumé](assets/documents/Resume.pdf)

This is an independent fan-inspired portfolio, not an official Pokémon product. No original game sprites, game audio, or game fonts are bundled.
