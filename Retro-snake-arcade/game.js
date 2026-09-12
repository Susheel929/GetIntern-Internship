/* =========================================================
   RETRO SNAKE ARCADE DASHBOARD
   Vanilla JS + Canvas 2D. No frameworks, no engines.

   Architecture:
     Input (keyboard/touch) -> Input Handler
        -> Game State (direction queue, position, score)
        -> Snake Coordinates (grid-based movement)
        -> Collision Detection (walls, self, food)
        -> Canvas Renderer (draw only, no logic)
        -> requestAnimationFrame -> Browser
   ========================================================= */

(function () {
  "use strict";

  // ---------------------------------------------------------
  // CONFIG
  // ---------------------------------------------------------
  const GRID_SIZE = 24;              // 24x24 logical grid
  const BASE_STEP_MS = 140;          // ms per snake move at level 1
  const MIN_STEP_MS = 55;            // fastest allowed step time
  const STEP_DECREASE_PER_LEVEL = 8; // ms shaved off per level
  const POINTS_PER_FOOD = 10;
  const FOOD_PER_LEVEL = 5;          // food eaten to level up
  const STORAGE_KEY = "retroSnakeBestScore";

  // ---------------------------------------------------------
  // DOM REFS
  // ---------------------------------------------------------
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");

  const headerScoreEl = document.getElementById("headerScore");
  const liveDot = document.getElementById("liveDot");
  const liveLabel = document.getElementById("liveLabel");

  const statScoreEl = document.getElementById("statScore");
  const statLevelEl = document.getElementById("statLevel");
  const statSpeedEl = document.getElementById("statSpeed");
  const statLengthEl = document.getElementById("statLength");
  const bestScoreEl = document.getElementById("bestScore");

  const footerGridEl = document.getElementById("footerGrid");
  const footerStateEl = document.getElementById("footerState");
  const footerBestEl = document.getElementById("footerBest");

  const startOverlay = document.getElementById("startOverlay");
  const pauseOverlay = document.getElementById("pauseOverlay");
  const gameOverOverlay = document.getElementById("gameOverOverlay");
  const finalScoreText = document.getElementById("finalScoreText");

  const startBtn = document.getElementById("startBtn");
  const resumeBtn = document.getElementById("resumeBtn");
  const restartBtn = document.getElementById("restartBtn");
  const dpad = document.getElementById("dpad");
  const dpadPause = document.getElementById("dpadPause");

  footerGridEl.textContent = `${GRID_SIZE}×${GRID_SIZE}`;

  // ---------------------------------------------------------
  // GAME STATE
  // ---------------------------------------------------------
  let snake;              // array of {x,y}, index 0 = head
  let direction;           // current committed direction
  let pendingDirection;    // next direction from input, applied on step
  let food;                // {x,y}
  let score;
  let level;
  let foodEatenThisLevel;
  let stepTime;            // ms per grid step at current level
  let accumulator;         // ms accumulated since last step
  let lastTime;
  let animationId;
  let gameRunning;         // true once "start" pressed
  let gamePaused;
  let gameOver;

  let bestScore = Number(localStorage.getItem(STORAGE_KEY) || 0);
  bestScoreEl.textContent = bestScore;
  footerBestEl.textContent = bestScore;

  function resetState() {
    const mid = Math.floor(GRID_SIZE / 2);
    snake = [
      { x: mid - 1, y: mid },
      { x: mid - 2, y: mid },
      { x: mid - 3, y: mid },
    ];
    direction = "right";
    pendingDirection = "right";
    score = 0;
    level = 1;
    foodEatenThisLevel = 0;
    stepTime = BASE_STEP_MS;
    accumulator = 0;
    gameOver = false;
    gamePaused = false;
    food = spawnFood();
    updateHud();
  }

  // ---------------------------------------------------------
  // INPUT HANDLER
  // ---------------------------------------------------------
  const OPPOSITE = { up: "down", down: "up", left: "right", right: "left" };

  function changeDirection(newDir) {
    if (!gameRunning || gamePaused || gameOver) {
      // Allow direction pre-selection only if game hasn't started acting on it;
      // ignore stray input when overlays are covering the canvas.
      return;
    }
    // Prevent reversing directly into the snake's own neck. Checked against
    // pendingDirection (not the stale committed `direction`) so that two
    // rapid inputs in the same grid step — e.g. Up then Down before the next
    // step commits — can't sneak a 180-degree reversal past this guard.
    if (OPPOSITE[newDir] === pendingDirection) return;
    pendingDirection = newDir;
  }

  function togglePause() {
    if (!gameRunning || gameOver) return;
    gamePaused = !gamePaused;
    if (gamePaused) {
      lastTime = null; // avoid a huge deltaTime jump on resume
      pauseOverlay.classList.add("visible");
    } else {
      pauseOverlay.classList.remove("visible");
    }
    updateHud();
  }

  // Keyboard
  window.addEventListener(
    "keydown",
    (e) => {
      const key = e.key;
      const movementKeys = ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", " ", "Spacebar"];
      if (movementKeys.includes(key)) {
        e.preventDefault(); // stop page scroll on arrow keys / space
      }

      switch (key) {
        case "ArrowUp":
          changeDirection("up");
          break;
        case "ArrowDown":
          changeDirection("down");
          break;
        case "ArrowLeft":
          changeDirection("left");
          break;
        case "ArrowRight":
          changeDirection("right");
          break;
        case " ":
        case "Spacebar":
          if (!gameRunning) {
            beginGame();
          } else if (gameOver) {
            beginGame();
          } else {
            togglePause();
          }
          break;
      }
    },
    { passive: false }
  );

  // Touch D-pad
  function bindDpadButton(el, handler) {
    const press = (e) => {
      e.preventDefault();
      el.classList.add("pressed");
      handler();
    };
    const release = (e) => {
      e.preventDefault();
      el.classList.remove("pressed");
    };
    el.addEventListener("touchstart", press, { passive: false });
    el.addEventListener("touchend", release, { passive: false });
    el.addEventListener("touchcancel", release, { passive: false });
    // Also support mouse for desktop testing of the on-screen pad.
    el.addEventListener("mousedown", press);
    el.addEventListener("mouseup", release);
    el.addEventListener("mouseleave", release);
  }

  dpad.querySelectorAll(".dpad-btn[data-dir]").forEach((btn) => {
    bindDpadButton(btn, () => changeDirection(btn.dataset.dir));
  });
  bindDpadButton(dpadPause, () => {
    if (!gameRunning || gameOver) {
      beginGame();
    } else {
      togglePause();
    }
  });

  // Prevent page scroll while dragging a finger across the canvas / game area.
  canvas.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
    },
    { passive: false }
  );
  canvas.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
    },
    { passive: false }
  );

  // Basic swipe support on the canvas itself (nice-to-have on mobile).
  let touchStartX = 0;
  let touchStartY = 0;
  canvas.addEventListener(
    "touchstart",
    (e) => {
      const t = e.changedTouches[0];
      touchStartX = t.clientX;
      touchStartY = t.clientY;
    },
    { passive: false }
  );
  canvas.addEventListener(
    "touchend",
    (e) => {
      const t = e.changedTouches[0];
      const dx = t.clientX - touchStartX;
      const dy = t.clientY - touchStartY;
      const absDx = Math.abs(dx);
      const absDy = Math.abs(dy);
      const SWIPE_THRESHOLD = 24;
      if (Math.max(absDx, absDy) < SWIPE_THRESHOLD) return;
      if (absDx > absDy) {
        changeDirection(dx > 0 ? "right" : "left");
      } else {
        changeDirection(dy > 0 ? "down" : "up");
      }
    },
    { passive: false }
  );

  // Overlay buttons
  startBtn.addEventListener("click", beginGame);
  resumeBtn.addEventListener("click", togglePause);
  restartBtn.addEventListener("click", beginGame);

  // ---------------------------------------------------------
  // GAME STATE TRANSITIONS
  // ---------------------------------------------------------
  function beginGame() {
    resetState();
    gameRunning = true;
    gamePaused = false;
    gameOver = false;

    startOverlay.classList.remove("visible");
    pauseOverlay.classList.remove("visible");
    gameOverOverlay.classList.remove("visible");

    updateHud();

    if (animationId) cancelAnimationFrame(animationId);
    lastTime = null;
    animationId = requestAnimationFrame(gameLoop);
  }

  function endGame() {
    gameOver = true;
    gameRunning = false;

    if (score > bestScore) {
      bestScore = score;
      localStorage.setItem(STORAGE_KEY, String(bestScore));
    }

    finalScoreText.textContent = `Final score: ${score}  •  Length: ${snake.length}`;
    gameOverOverlay.classList.add("visible");
    updateHud();
  }

  // ---------------------------------------------------------
  // FOOD SPAWNING
  // ---------------------------------------------------------
  function spawnFood() {
    let candidate;
    let attempts = 0;
    do {
      candidate = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
      };
      attempts++;
      // Safety valve: if the board is nearly full, just accept whatever we get.
      if (attempts > 500) break;
    } while (snake.some((seg) => seg.x === candidate.x && seg.y === candidate.y));
    return candidate;
  }

  // ---------------------------------------------------------
  // UPDATE (game logic only — no drawing here)
  // ---------------------------------------------------------
  function updateSnake() {
    direction = pendingDirection;

    const head = snake[0];
    let newHead = { x: head.x, y: head.y };

    switch (direction) {
      case "up":
        newHead.y -= 1;
        break;
      case "down":
        newHead.y += 1;
        break;
      case "left":
        newHead.x -= 1;
        break;
      case "right":
        newHead.x += 1;
        break;
    }

    snake.unshift(newHead);

    const ateFood = newHead.x === food.x && newHead.y === food.y;
    if (ateFood) {
      handleFoodEaten();
      food = spawnFood();
    } else {
      snake.pop(); // move forward: drop tail if nothing eaten
    }
  }

  function handleFoodEaten() {
    score += POINTS_PER_FOOD;
    foodEatenThisLevel += 1;

    if (foodEatenThisLevel >= FOOD_PER_LEVEL) {
      foodEatenThisLevel = 0;
      level += 1;
      stepTime = Math.max(MIN_STEP_MS, BASE_STEP_MS - (level - 1) * STEP_DECREASE_PER_LEVEL);
    }
  }

  function checkCollisions() {
    const head = snake[0];

    // Wall collision
    if (head.x < 0 || head.x >= GRID_SIZE || head.y < 0 || head.y >= GRID_SIZE) {
      endGame();
      return;
    }

    // Self collision (skip the head itself, index 0)
    for (let i = 1; i < snake.length; i++) {
      if (snake[i].x === head.x && snake[i].y === head.y) {
        endGame();
        return;
      }
    }
  }

  function checkFood() {
    // Food-eaten logic is handled inline in updateSnake() for this step-based
    // model since spawning depends on the immediately preceding move. This
    // function stays as a named hook to mirror the documented pipeline
    // (Snake Coordinates -> Collision Detection -> Canvas Renderer) and is
    // where additional food-related rules (e.g. bonus food, decay) would go.
  }

  function update(deltaTime) {
    if (!gameRunning || gamePaused || gameOver) return;

    // Clamp deltaTime so a backgrounded tab / stalled frame (e.g. screen
    // lock, alt-tab) doesn't dump a huge accumulator and burn through many
    // steps instantly on return. Cap at 5 steps worth of catch-up.
    const clampedDelta = Math.min(deltaTime, stepTime * 5);
    accumulator += clampedDelta;

    // Fixed-timestep loop: allows the render to run at display refresh rate
    // while game logic advances in discrete, consistent grid steps.
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

  // ---------------------------------------------------------
  // RENDER (drawing only — no game logic here)
  // ---------------------------------------------------------
  const cellSize = () => canvas.width / GRID_SIZE;

  function clearCanvas() {
    ctx.fillStyle = "#04070a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawGrid() {
    const size = cellSize();
    ctx.strokeStyle = "rgba(57, 255, 136, 0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= GRID_SIZE; i++) {
      const pos = Math.round(i * size) + 0.5;
      ctx.moveTo(pos, 0);
      ctx.lineTo(pos, canvas.height);
      ctx.moveTo(0, pos);
      ctx.lineTo(canvas.width, pos);
    }
    ctx.stroke();
  }

  function drawFood() {
    const size = cellSize();
    const px = food.x * size;
    const py = food.y * size;
    const pad = size * 0.15;

    ctx.fillStyle = "#ff3b5c";
    ctx.shadowColor = "#ff3b5c";
    ctx.shadowBlur = 10;
    ctx.fillRect(px + pad, py + pad, size - pad * 2, size - pad * 2);
    ctx.shadowBlur = 0;
  }

  function drawSnake() {
    const size = cellSize();
    snake.forEach((seg, i) => {
      const px = seg.x * size;
      const py = seg.y * size;
      const isHead = i === 0;
      const pad = size * 0.08;

      if (isHead) {
        ctx.fillStyle = "#a8ffce";
        ctx.shadowColor = "#39ff88";
        ctx.shadowBlur = 12;
      } else {
        const fade = Math.max(0.4, 1 - i / snake.length);
        ctx.fillStyle = `rgba(57, 255, 136, ${fade})`;
        ctx.shadowBlur = 0;
      }

      ctx.fillRect(px + pad, py + pad, size - pad * 2, size - pad * 2);
      ctx.shadowBlur = 0;
    });
  }

  function drawHUD() {
    // In-canvas HUD kept minimal since the dashboard panels already show
    // score/level/speed; this just reinforces state during paused/over frames.
    if (gamePaused) {
      ctx.fillStyle = "rgba(4,7,10,0)"; // overlay div handles the visual; no-op here
    }
  }

  function render() {
    clearCanvas();
    drawGrid();
    drawFood();
    drawSnake();
    drawHUD();
  }

  // ---------------------------------------------------------
  // HUD (DOM text, not canvas) — kept separate from render()
  // ---------------------------------------------------------
  function updateHud() {
    const paddedScore = String(score).padStart(6, "0");
    headerScoreEl.textContent = paddedScore;
    statScoreEl.textContent = score;
    statLevelEl.textContent = level;
    statSpeedEl.textContent = `${(BASE_STEP_MS / stepTime).toFixed(1)}x`;
    statLengthEl.textContent = snake ? snake.length : 3;

    bestScoreEl.textContent = bestScore;
    footerBestEl.textContent = bestScore;

    if (gameOver) {
      liveDot.className = "live-dot over";
      liveLabel.textContent = "OVER";
      footerStateEl.textContent = "GAME OVER";
    } else if (gamePaused) {
      liveDot.className = "live-dot paused";
      liveLabel.textContent = "PAUSED";
      footerStateEl.textContent = "PAUSED";
    } else if (gameRunning) {
      liveDot.className = "live-dot";
      liveLabel.textContent = "LIVE";
      footerStateEl.textContent = "RUNNING";
    } else {
      liveDot.className = "live-dot paused";
      liveLabel.textContent = "READY";
      footerStateEl.textContent = "READY";
    }
  }

  // ---------------------------------------------------------
  // MAIN LOOP
  // ---------------------------------------------------------
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

  // ---------------------------------------------------------
  // INITIAL PAINT (before first game start)
  // ---------------------------------------------------------
  function initialPaint() {
    resetState();
    render();
    gameRunning = false;
    updateHud();
  }

  // Responsive canvas backing store: keep internal resolution crisp
  // regardless of CSS-driven display size (grid squares stay uniform).
  function syncCanvasResolution() {
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const targetSize = Math.round(Math.min(rect.width, rect.height) * dpr);
    if (targetSize > 0 && canvas.width !== targetSize) {
      canvas.width = targetSize;
      canvas.height = targetSize;
      if (typeof render === "function" && snake) render();
    }
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden && gameRunning && !gamePaused && !gameOver) {
      togglePause();
    }
  });

  window.addEventListener("resize", syncCanvasResolution);
  window.addEventListener("orientationchange", () => {
    setTimeout(syncCanvasResolution, 100);
  });

  // Boot
  syncCanvasResolution();
  initialPaint();
})();
