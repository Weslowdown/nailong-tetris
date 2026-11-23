import { COLS, PIECES, ROWS, TetrisGame } from "./tetris.js";

const canvas = document.querySelector("#gameCanvas");
const ctx = canvas.getContext("2d");
const nextCanvas = document.querySelector("#nextCanvas");
const nextCtx = nextCanvas.getContext("2d");
const holdCanvas = document.querySelector("#holdCanvas");
const holdCtx = holdCanvas.getContext("2d");
const scoreValue = document.querySelector("#scoreValue");
const linesValue = document.querySelector("#linesValue");
const levelValue = document.querySelector("#levelValue");
const bestValue = document.querySelector("#bestValue");
const mobileScore = document.querySelector("#mobileScore");
const mobileLines = document.querySelector("#mobileLines");
const mobileLevel = document.querySelector("#mobileLevel");
const statusValue = document.querySelector("#statusValue");
const overlay = document.querySelector("#gameOverlay");
const overlayKicker = document.querySelector("#overlayKicker");
const overlayTitle = document.querySelector("#overlayTitle");
const overlayText = document.querySelector("#overlayText");
const primaryButton = document.querySelector("#primaryButton");
const pauseButton = document.querySelector("#pauseButton");
const soundButton = document.querySelector("#soundButton");
const restartButton = document.querySelector("#restartButton");
const boardShell = document.querySelector(".board-shell");

const BLOCK_IMAGE_URL = new URL("../assets/nailong-block.png", import.meta.url).href;
const FULL_IMAGE_URL = new URL("../assets/nailong-full.png", import.meta.url).href;

const CELL = 32;
const BOARD_WIDTH = COLS * CELL;
const BOARD_HEIGHT = ROWS * CELL;
const BEST_KEY = "nailong-tetris-best";
const DEMO_MODE = new URLSearchParams(window.location.search).get("demo");

const game = new TetrisGame();
let bestScore = readBest();
let lastTime = performance.now();
let dropAccumulator = 0;
let soundEnabled = true;
let audioContext = null;
let imagesReady = false;

const blockImage = new Image();
const fullImage = new Image();
blockImage.src = BLOCK_IMAGE_URL;
fullImage.src = FULL_IMAGE_URL;

const imageReady = Promise.all([
  new Promise((resolve, reject) => {
    blockImage.onload = resolve;
    blockImage.onerror = reject;
  }),
  new Promise((resolve, reject) => {
    fullImage.onload = resolve;
    fullImage.onerror = reject;
  }),
])
  .then(() => {
    imagesReady = true;
    document.querySelectorAll(".nailong-avatar").forEach((image) => {
      image.src = FULL_IMAGE_URL;
    });
  })
  .catch(() => {
    statusValue.textContent = "图片加载失败，将显示彩色方块。";
  });

function readBest() {
  try {
    return Number(localStorage.getItem(BEST_KEY)) || 0;
  } catch {
    return 0;
  }
}

function saveBest() {
  try {
    localStorage.setItem(BEST_KEY, String(bestScore));
  } catch {
    // The game still works when local storage is unavailable.
  }
}

function setupCanvas(element, context, width, height) {
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  element.width = Math.round(width * ratio);
  element.height = Math.round(height * ratio);
  element.style.aspectRatio = `${width} / ${height}`;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
}

setupCanvas(canvas, ctx, BOARD_WIDTH, BOARD_HEIGHT);
setupCanvas(nextCanvas, nextCtx, 168, 112);
setupCanvas(holdCanvas, holdCtx, 168, 112);

function roundedRect(context, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  context.beginPath();
  context.moveTo(x + r, y);
  context.arcTo(x + width, y, x + width, y + height, r);
  context.arcTo(x + width, y + height, x, y + height, r);
  context.arcTo(x, y + height, x, y, r);
  context.arcTo(x, y, x + width, y, r);
  context.closePath();
}

function drawTile(context, px, py, size, type, options = {}) {
  const { ghost = false, alpha = 1 } = options;
  const color = PIECES[type].color;
  context.save();
  context.globalAlpha = alpha;
  roundedRect(context, px + 1.5, py + 1.5, size - 3, size - 3, size * 0.2);

  if (ghost) {
    context.fillStyle = "rgba(255, 255, 255, 0.05)";
    context.fill();
    context.strokeStyle = "rgba(255, 245, 190, 0.58)";
    context.lineWidth = 1.6;
    context.setLineDash([4, 3]);
    context.stroke();
    context.restore();
    return;
  }

  context.fillStyle = color;
  context.fill();
  context.clip();

  if (imagesReady) {
    context.globalCompositeOperation = "multiply";
    context.globalAlpha = 0.9;
    context.drawImage(
      blockImage,
      105,
      8,
      620,
      620,
      px - size * 0.05,
      py - size * 0.14,
      size * 1.08,
      size * 1.15,
    );
    context.globalCompositeOperation = "source-over";
  } else {
    context.fillStyle = "rgba(255,255,255,0.28)";
    context.beginPath();
    context.arc(px + size * 0.5, py + size * 0.48, size * 0.16, 0, Math.PI * 2);
    context.fill();
  }

  context.globalAlpha = alpha;
  context.strokeStyle = "rgba(255, 255, 255, 0.6)";
  context.lineWidth = 1;
  roundedRect(context, px + 2, py + 2, size - 4, size - 4, size * 0.18);
  context.stroke();
  context.restore();
}

function forEachCell(originX, originY, matrix, callback) {
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) callback(originX + x, originY + y);
    });
  });
}

function drawBoard() {
  ctx.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);
  ctx.fillStyle = "#20241e";
  roundedRect(ctx, 0, 0, BOARD_WIDTH, BOARD_HEIGHT, 18);
  ctx.fill();

  ctx.save();
  roundedRect(ctx, 0, 0, BOARD_WIDTH, BOARD_HEIGHT, 18);
  ctx.clip();
  ctx.strokeStyle = "rgba(255,255,255,0.035)";
  ctx.lineWidth = 1;
  for (let col = 1; col < COLS; col += 1) {
    ctx.beginPath();
    ctx.moveTo(col * CELL, 0);
    ctx.lineTo(col * CELL, BOARD_HEIGHT);
    ctx.stroke();
  }
  for (let row = 1; row < ROWS; row += 1) {
    ctx.beginPath();
    ctx.moveTo(0, row * CELL);
    ctx.lineTo(BOARD_WIDTH, row * CELL);
    ctx.stroke();
  }

  game.board.forEach((row, y) => {
    row.forEach((type, x) => {
      if (type) drawTile(ctx, x * CELL, y * CELL, CELL, type);
    });
  });

  if (game.current && game.state !== "gameover") {
    const ghostY = game.ghostY();
    forEachCell(game.current.x, ghostY, game.current.matrix, (x, y) => {
      if (y >= 0) drawTile(ctx, x * CELL, y * CELL, CELL, game.current.type, { ghost: true });
    });
    forEachCell(game.current.x, game.current.y, game.current.matrix, (x, y) => {
      if (y >= 0) drawTile(ctx, x * CELL, y * CELL, CELL, game.current.type);
    });
  }
  ctx.restore();
}

function previewBounds(matrix) {
  let minX = 4;
  let maxX = -1;
  let minY = 4;
  let maxY = -1;
  matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) return;
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
    });
  });
  return { minX, maxX, minY, maxY };
}

function drawPreview(context, type, width, height) {
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#f5f0e3";
  roundedRect(context, 0, 0, width, height, 10);
  context.fill();
  if (!type) return;

  const matrix = PIECES[type].matrix;
  const bounds = previewBounds(matrix);
  const tile = 22;
  const shapeWidth = (bounds.maxX - bounds.minX + 1) * tile;
  const shapeHeight = (bounds.maxY - bounds.minY + 1) * tile;
  const startX = (width - shapeWidth) / 2 - bounds.minX * tile;
  const startY = (height - shapeHeight) / 2 - bounds.minY * tile;
  forEachCell(startX, startY, matrix, (x, y) => {
    drawTile(context, x, y, tile, type);
  });
}

function updateHud() {
  scoreValue.textContent = game.score.toLocaleString();
  linesValue.textContent = String(game.lines);
  levelValue.textContent = String(game.level);
  mobileScore.textContent = game.score.toLocaleString();
  mobileLines.textContent = String(game.lines);
  mobileLevel.textContent = String(game.level);
  if (game.score > bestScore) {
    bestScore = game.score;
    saveBest();
  }
  bestValue.textContent = bestScore.toLocaleString();
  drawPreview(nextCtx, game.queue[0], 168, 112);
  drawPreview(holdCtx, game.holdType, 168, 112);
}

function setOverlay(mode) {
  overlay.hidden = mode === null;
  if (mode === null) return;

  overlayKicker.textContent = mode === "paused" ? "TAKE A BREATH" : mode === "gameover" ? "STACK TOO HIGH" : "READY TO DROP";
  overlayTitle.textContent = mode === "paused" ? "奶龙休息一下" : mode === "gameover" ? "堆不下啦！" : "奶龙方块";
  overlayText.textContent =
    mode === "paused"
      ? "按 P 或点击继续，奶龙会保持队形。"
      : mode === "gameover"
        ? `本局 ${game.score.toLocaleString()} 分，再来一局？`
        : "用方向键移动和旋转，把奶龙们排成完整的一行。";
  primaryButton.textContent = mode === "paused" ? "继续游戏" : mode === "gameover" ? "再来一局" : "开始堆奶龙";
}

function setState(nextState) {
  game.state = nextState;
  boardShell.dataset.state = nextState;
  if (nextState === "playing") {
    setOverlay(null);
    pauseButton.textContent = "暂停";
    statusValue.textContent = "游戏中";
  } else if (nextState === "paused") {
    setOverlay("paused");
    pauseButton.textContent = "继续";
    statusValue.textContent = "已暂停";
  } else if (nextState === "gameover") {
    setOverlay("gameover");
    pauseButton.textContent = "暂停";
    statusValue.textContent = "游戏结束";
  } else {
    setOverlay("ready");
    pauseButton.textContent = "暂停";
    statusValue.textContent = "等待开始";
  }
}

function startGame() {
  ensureAudio();
  game.start();
  dropAccumulator = 0;
  lastTime = performance.now();
  setState("playing");
  updateHud();
  playTone(440, 0.08, 0.035);
}

function togglePause() {
  if (game.state === "playing") setState("paused");
  else if (game.state === "paused") {
    lastTime = performance.now();
    setState("playing");
  }
}

function afterAction(result = {}) {
  if (result.cleared) {
    playTone(660, 0.09, 0.04);
    setTimeout(() => playTone(880, 0.12, 0.035), 70);
  }
  if (game.state === "gameover") {
    setState("gameover");
    saveBest();
    playTone(180, 0.22, 0.045);
  }
  updateHud();
  drawBoard();
}

function move(horizontal) {
  if (game.state !== "playing") return;
  game.move(horizontal, 0);
  drawBoard();
}

function softDrop() {
  if (game.state !== "playing") return;
  const result = game.step();
  afterAction(result);
}

function rotate() {
  if (game.state !== "playing") return;
  game.rotate(1);
  playTone(520, 0.035, 0.02);
  drawBoard();
}

function hardDrop() {
  if (game.state !== "playing") return;
  const result = game.hardDrop();
  playTone(250, 0.05, 0.03);
  afterAction(result);
}

function hold() {
  if (game.state !== "playing") return;
  game.hold();
  playTone(390, 0.05, 0.025);
  updateHud();
  drawBoard();
}

function ensureAudio() {
  if (!soundEnabled || audioContext) return;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (AudioCtx) audioContext = new AudioCtx();
}

function playTone(frequency, duration, volume) {
  if (!soundEnabled) return;
  ensureAudio();
  if (!audioContext) return;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "sine";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(volume, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioContext.currentTime + duration);
  oscillator.connect(gain);
  gain.connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + duration);
}

function gameLoop(now) {
  const delta = Math.min(80, now - lastTime);
  lastTime = now;
  if (game.state === "playing") {
    dropAccumulator += delta;
    if (dropAccumulator >= game.gravityMs()) {
      dropAccumulator = 0;
      const result = game.step();
      if (result.cleared || game.state === "gameover") afterAction(result);
    }
  }
  drawBoard();
  requestAnimationFrame(gameLoop);
}

function bindRepeat(button, action) {
  let delayTimer;
  let repeatTimer;
  const stop = () => {
    clearTimeout(delayTimer);
    clearInterval(repeatTimer);
  };
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    action();
    delayTimer = setTimeout(() => {
      repeatTimer = setInterval(action, 105);
    }, 210);
  });
  for (const eventName of ["pointerup", "pointerleave", "pointercancel"]) {
    button.addEventListener(eventName, stop);
  }
  button.addEventListener("click", (event) => event.preventDefault());
}

primaryButton.addEventListener("click", () => {
  if (game.state === "paused") togglePause();
  else startGame();
});
pauseButton.addEventListener("click", togglePause);
restartButton.addEventListener("click", startGame);
soundButton.addEventListener("click", () => {
  soundEnabled = !soundEnabled;
  soundButton.textContent = soundEnabled ? "声音：开" : "声音：关";
  soundButton.setAttribute("aria-pressed", String(soundEnabled));
});

document.querySelector("#rotateButton").addEventListener("click", rotate);
document.querySelector("#dropButton").addEventListener("click", hardDrop);
document.querySelector("#holdButton").addEventListener("click", hold);

bindRepeat(document.querySelector("#leftButton"), () => move(-1));
bindRepeat(document.querySelector("#rightButton"), () => move(1));
bindRepeat(document.querySelector("#downButton"), softDrop);

window.addEventListener("keydown", (event) => {
  const handled = ["ArrowLeft", "ArrowRight", "ArrowDown", "ArrowUp", " ", "z", "Z", "x", "X", "c", "C", "p", "P", "Enter"];
  if (handled.includes(event.key)) event.preventDefault();
  if (event.repeat && ["ArrowUp", " ", "z", "Z", "x", "X", "c", "C", "p", "P", "Enter"].includes(event.key)) return;

  if (game.state === "ready" || game.state === "gameover") {
    if (event.key === "Enter" || event.key === " ") startGame();
    return;
  }
  if (event.key === "p" || event.key === "P") togglePause();
  if (game.state !== "playing") return;
  if (event.key === "ArrowLeft") move(-1);
  if (event.key === "ArrowRight") move(1);
  if (event.key === "ArrowDown") softDrop();
  if (event.key === "ArrowUp" || event.key === "x" || event.key === "X") rotate();
  if (event.key === "z" || event.key === "Z") {
    game.rotate(-1);
    drawBoard();
  }
  if (event.key === " ") hardDrop();
  if (event.key === "c" || event.key === "C") hold();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && game.state === "playing") setState("paused");
});

imageReady.finally(() => {
  updateHud();
  drawBoard();
  if (DEMO_MODE === "play") {
    startGame();
    setTimeout(() => {
      game.move(-2, 0);
      game.hardDrop();
      game.move(2, 0);
      game.rotate(1);
      game.hardDrop();
      game.hold();
      updateHud();
      drawBoard();
    }, 120);
  }
});
setState("ready");
updateHud();
drawBoard();
requestAnimationFrame(gameLoop);
