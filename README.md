# Portfolio

A cinematic, scroll-driven 3D portfolio experience built with [Three.js](https://threejs.org/).

## Features

- **Scroll-driven 3D navigation** — scroll through a 5000vh container to fly through a starfield and project cards
- **3D bubble letter title** — "ARYAMAN" rendered as glass/transmission materials with per-letter hue variation
- **Live GitHub integration** — fetches real repo data from the GitHub API and renders project cards dynamically
- **Bloom post-processing** — UnrealBloomPass gives stars and letters a soft glow
- **Particle systems** — three star layers (white, blue-white, violet), nebula clouds, and floating dust
- **Physics animation** — letters wobble, float, and shake with randomized per-letter physics
- **Reactive mouse parallax** — star fields subtly react to cursor position
- **GitHub-native UI chrome** — top bar mimics GitHub Dark's design language; stars/forks/language stats
- **Tech chips** — auto-detected from repo topics and language
- **Code snippet preview** — language-aware mock snippets per project card
- **Responsive** — canvas scales to full viewport, fog creates natural depth fade

## Tech Stack

- **Three.js** (v0.164.1) — 3D rendering, post-processing, geometry, lighting
- **GLSL / WebGL** — custom shaders via Three.js shader passes
- **Vanilla JS (ES modules)** — no framework, single-page app
- **Google Fonts** — Inter + JetBrains Mono

## Structure

```
index.html   — HTML shell with import map for Three.js CDN
app.js       — All Three.js logic: scene, particles, text, scroll, GitHub API, card rendering
style.css    — UI overlay styles (topbar, scroll hint, project panel, buttons)
```

## Setup

No build step required. Open `index.html` directly in a browser, or serve locally:

```bash
npx serve .
```

## How It Works

1. A transparent scroll container (5000vh) captures scroll events
2. Camera position and letter-group transforms are driven by scroll progress
3. Camera travels through 11 waypoints, each revealing a project card
4. GitHub repos are fetched via `fetchGithubProjects()`, sorted by stars, capped at 11
5. Each project card is rendered to an offscreen Canvas texture and applied to a 3D plane in the scene
6. Bloom post-processing is applied via `UnrealBloomPass` on the EffectComposer

## Screenshots

> The site displays your GitHub username and live stats as you scroll through your repos in 3D space.