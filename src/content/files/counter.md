---
title: CLAUDE.md
description: Claude Code project instructions for the Colourful Counter application.
---

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `yarn dev` — start the Vite dev server with HMR
- `yarn build` — type-check the whole project (`tsc -b`) then produce a production build in `dist/`
- `yarn lint` — run ESLint over the repo
- `yarn preview` — serve the built `dist/` locally

There is no test runner configured. Per `DESIGN.md`, the verification bar for changes is: production build and lint pass, plus a manual interaction check of both increment and decrement.

## Architecture

A single-screen "Counter" — React 19 + TypeScript, bundled by Vite, styled with plain CSS. No router, no state library, no runtime dependencies beyond `react`/`react-dom`.

- `src/main.tsx` — entry point; mounts `<App>` in `<StrictMode>` into `#root`.
- `src/App.tsx` — the entire app. Holds two pieces of `useState`: `count` and `direction` (`'up' | 'down'`). `changeCount(amount)` sets the direction from the sign of `amount` and updates the count.
- `src/index.css` — all styling and animation. This is where the app's visual identity lives.

### Key mechanism: direction-aware animation

The count animation is driven by two things working together, not by JS animation:
1. `direction` state selects the CSS class `count--up` or `count--down` (different `@keyframes`).
2. The `<span>` uses `key={count}` so React remounts the element on every change, re-triggering the CSS animation.

If you change how the count updates, preserve both the `key={count}` remount and the direction class, or the rise/fall animation breaks.

### Accessibility & motion are load-bearing

`DESIGN.md` is the source of truth for design intent and treats accessibility as a requirement, not a nice-to-have. When editing UI, keep: the `aria-live="polite"` number region, explicit button `aria-label`s, the `:focus-visible` outline, and the `prefers-reduced-motion` block in `index.css` that neutralizes all animation. Read `DESIGN.md` before non-trivial visual changes.

## TypeScript config

Uses project references: `tsconfig.json` composes `tsconfig.app.json` (app code under `src/`) and `tsconfig.node.json` (Vite config). `yarn build` runs `tsc -b`, so type errors block the build.
