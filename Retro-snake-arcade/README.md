# Retro Snake Arcade Dashboard

## Project Overview

A playable Snake game embedded in a responsive, arcade-style dashboard. The dashboard shows live score, level, speed, and length alongside the game canvas, with keyboard controls on desktop and a touch D-pad on mobile. Built entirely with vanilla web technologies — no frameworks, no build step, no game engine.

## Technology Used

- **HTML5** — semantic markup, `<canvas>` for rendering
- **CSS3** — CSS Grid (dashboard shell) + Flexbox (panel internals), media queries, `aspect-ratio`
- **Vanilla JavaScript** — game logic, input handling, DOM updates
- **Canvas 2D API** — all game rendering
- **`requestAnimationFrame()`** — the main loop

Explicitly **not** used: React, Vue, Angular, Phaser, Three.js, Bootstrap, Tailwind, any game engine, any canvas library.

## How to Install

There is nothing to install and no build step. Clone or download the repository:

```bash
git clone <your-repo-url>
cd retro-snake-arcade
```

The project is two files, `index.html` and `game.js`, that run directly in any modern browser.

## How to Run

Because mobile testing and relative paths behave more consistently over HTTP than `file://`, serving locally is recommended over opening `index.html` directly:

```bash
python3 -m http.server 8000
# or
npx serve .
```

Then open `http://localhost:8000` in a browser. To test on a phone on the same network, use your machine's local IP instead of `localhost`, e.g. `http://192.168.x.x:8000`.

## Controls

| Input | Action |
|---|---|
| `↑ ↓ ← →` | Change direction |
| `Space` | Start / pause / resume / restart |
| On-screen D-pad (touch or coarse-pointer devices) | Change direction |
| Swipe on canvas | Change direction |
| Tap pause button on D-pad | Pause / resume / start |

Touch listeners use `{ passive: false }` with `preventDefault()` on the canvas and D-pad, so gameplay never triggers page scrolling or pull-to-refresh.

## Game Architecture

```
Keyboard / Touch
       ↓
Input Handler        (changeDirection, togglePause, D-pad + swipe listeners)
       ↓
Game State            (snake array, direction, score, level, stepTime)
       ↓
Snake Coordinates     (grid-based head/tail movement in updateSnake)
       ↓
Collision Detection   (checkCollisions: walls + self-intersection)
       ↓
Canvas Renderer       (render: clearCanvas → drawGrid → drawFood → drawSnake → drawHUD)
       ↓
requestAnimationFrame
       ↓
Browser
```

`update()` and `render()` are kept fully separate. `update()` never touches the canvas; `render()` never mutates game state. This is what lets the render step run at the display's native refresh rate while the snake still moves at a fixed, framerate-independent speed via an accumulator.

Direction input is queued into `pendingDirection` and only committed on the next grid step. The reversal guard checks new input against `pendingDirection` (not the stale, already-committed `direction`), which closes a same-tick exploit: without this, two rapid inputs before the next step commits — e.g. Up then Down — could sneak a 180° reversal past the guard and cause an unfair instant self-collision.

## Performance

- **Fixed-timestep updates, variable-rate rendering.** Game logic advances in discrete grid steps via an accumulator, decoupled from however fast `requestAnimationFrame` fires (60Hz, 120Hz, or a throttled tab). Speed is identical across all displays.
- **`deltaTime` clamp.** A single frame can never inject more than 5 steps' worth of accumulated time, so a stalled frame can't cause a burst of instant, unfair collisions.
- **`visibilitychange` auto-pause.** If the tab is backgrounded mid-game, the game pauses itself, so a player can never return to a stale tab and instantly lose to a wall of queued moves.
- **Resolution-matched canvas.** `syncCanvasResolution()` keeps the canvas's internal drawing-buffer size matched to its actual on-screen size (accounting for `devicePixelRatio`), so rendering stays crisp without wasted overdraw at any screen size.
- **Minimal per-frame allocation.** `render()` redraws primitives directly (`fillRect`, grid lines) without creating new objects per frame, keeping garbage collection pressure low during continuous play.

## Responsive Design

The dashboard shell is CSS Grid:

```css
.dashboard {
    display: grid;
    grid-template-columns: 220px minmax(0, 1fr) 220px;
    grid-template-rows: auto minmax(0, 1fr) auto;
    min-height: 100vh;
}

@media (max-width: 900px) {
    .dashboard {
        grid-template-columns: 1fr;
        grid-template-rows: auto auto minmax(0, 1fr) auto;
    }
}
```

`minmax(0, 1fr)` on the game column/row stops the canvas column from blowing out the grid track on narrow viewports — without it, a fixed-size canvas can force a horizontal scrollbar. Inside each panel, content is laid out with Flexbox (`.panel-body`, `.stat-block`, `.dpad`, etc.).

The `<canvas>` itself is never given fixed pixel dimensions in CSS — it's sized fluidly (`width: 100%; height: 100%` inside an `aspect-ratio: 1/1` wrapper), while `syncCanvasResolution()` keeps its internal resolution matched to its rendered size.

Below 900px width, the desktop-only Controls sidebar hides and the on-screen D-pad in the footer takes over. The D-pad also appears on any touch/coarse-pointer device regardless of width (e.g. a tablet in landscape), via `(hover: none) and (pointer: coarse)`.

## Game Loop Explanation

```js
function gameLoop(timestamp) {
    if (lastTime === null || lastTime === undefined) {
        lastTime = timestamp;
    }
    const deltaTime = timestamp - lastTime;
    lastTime = timestamp;

    update(deltaTime);
    render();

    animationId = requestAnimationFrame(gameLoop);
}

requestAnimationFrame(gameLoop);
```

`update()` uses a fixed-timestep accumulator so the snake's move speed is decoupled from the monitor's refresh rate:

```js
function update(deltaTime) {
    if (!gameRunning || gamePaused || gameOver) return;

    // Clamp deltaTime so a backgrounded tab / stalled frame doesn't dump a
    // huge accumulator and burn through many steps instantly on return.
    const clampedDelta = Math.min(deltaTime, stepTime * 5);
    accumulator += clampedDelta;

    while (accumulator >= stepTime) {
        updateSnake();
        checkCollisions();
        checkFood();
        accumulator -= stepTime;

        if (gameOver) {
            accumulator = 0;
            break;
        }
    }

    updateHud();
}

function render() {
    clearCanvas();
    drawGrid();
    drawFood();
    drawSnake();
    drawHUD();
}
```

Walking through it: each animation frame computes `deltaTime` (time since the last frame), adds it to a running `accumulator`, then drains that accumulator in fixed-size chunks of `stepTime` milliseconds — each chunk advancing the snake exactly one grid cell and running collision checks. Any leftover time smaller than one step carries over to the next frame instead of being dropped, so the simulation doesn't drift. `render()` runs once per animation frame regardless of how many (or how few) logic steps happened, keeping visuals smooth even while the underlying grid movement stays locked to a constant speed.

## Limitations

- **Single local high score.** Best score is stored per-browser via `localStorage`; there's no server, accounts, or cross-device leaderboard.
- **No sound.** The game is visual-only; no Web Audio effects are implemented.
- **Square grid only.** The board is fixed at 24×24 and always renders as a square; there's no support for rectangular or resizable grid dimensions.
- **Basic food placement.** Food spawns on a random empty cell with a bounded number of retry attempts; on an extremely full board this could very rarely accept a slower placement rather than guaranteeing an optimal one.
- **No difficulty/theme settings.** Level speed-up is fixed (5 food items per level, floor of 55ms/step) and isn't user-configurable from the UI.
- **Single-player only.** No multiplayer or shared-session mode.
- **Swipe gesture is basic.** Swipe detection uses a simple distance threshold on touch start/end, not full gesture velocity or trajectory smoothing.

## Deployment URL

_Not yet deployed._ Once pushed to a public GitHub repository and deployed, add the live link here:

- **GitHub Pages:** ` https://susheel929.github.io/retro-snake-arcade/`
- **Vercel / Netlify:** `retro-snake-arcade.vercel.app`

### Deploying

**GitHub Pages**
1. Push this folder to a public GitHub repo.
2. Repo Settings → Pages → Deploy from branch → select `main` / root.
3. Live URL appears at `https://<username>.github.io/<repo>/`.

**Vercel / Netlify**
- Both auto-detect a static site with no build command needed — connect the repo and deploy with defaults (build command: none, output directory: `/`).
