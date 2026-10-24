/* ========== TELEGRAM ========== */
const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

/* ========== ТЕМА ========== */
const THEMES = [
  "black", "blue", "pink", "purple", "green", "orange", "red",
  "yellow", "teal", "indigo", "lime", "cyan", "magenta"
];
const THEME_COLORS = {
  black:   "#000000", blue: "#04101c",   pink: "#14060f",   purple: "#0d0718",
  green:   "#04120a", orange: "#140a05", red: "#140505",    yellow: "#141005",
  teal:    "#04120f", indigo: "#070b18", lime: "#0b1405",   cyan: "#041318",
  magenta: "#140518",
};

const colorDots    = document.querySelectorAll(".color-dot");
const colorModal   = document.getElementById("colorModal");

let colors = { accent: "#ffffff", accent2: "#bdbdbd" };

function readColors() {
  const cs = getComputedStyle(document.body);
  colors.accent  = cs.getPropertyValue("--accent").trim()   || "#fff";
  colors.accent2 = cs.getPropertyValue("--accent-2").trim() || "#bdbdbd";
}

function applyTheme(theme) {
  if (!THEMES.includes(theme)) theme = "black";
  THEMES.forEach(t => document.body.classList.remove("theme-" + t));
  document.body.classList.add("theme-" + theme);
  try { localStorage.setItem("theme", theme); } catch (e) {}

  colorDots.forEach(dot => {
    dot.classList.toggle("selected", dot.dataset.theme === theme);
  });

  tg?.setHeaderColor?.(THEME_COLORS[theme]);
  tg?.setBackgroundColor?.(THEME_COLORS[theme]);
  readColors();
}

applyTheme((() => { try { return localStorage.getItem("theme"); } catch(e) { return null; } })() || "black");

/* ========== КАНВАС ========== */
const canvas = document.getElementById("game");
const stage  = document.getElementById("stage");
let ctx = null;
let W = 0, H = 0, DPR = 1;

function getCtx() {
  if (!ctx && canvas) ctx = canvas.getContext("2d");
  return ctx;
}

/* ========== СОСТОЯНИЕ ========== */
const MAX_BALLS = 12;
const BALL_R = 9;

const state = {
  paddle: { x: 0, y: 0, w: 90, h: 14, targetX: 0 },
  balls: [],
  trail: [],
  score: 0,
  best: 0,
  baseSpeed: 320,
  speedMul: 1,
  phase: "idle",
  modalOpen: false,
};

try { state.best = Number(localStorage.getItem("pong_best") || 0); } catch(e) {}

function createBall(x, y, angle) {
  const speed = state.baseSpeed * state.speedMul;
  return {
    x, y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    r: BALL_R,
  };
}

function placeBalls() {
  state.balls = [];
  const angle = Math.PI / 2 + (Math.random() - 0.5) * 0.5;
  state.balls.push(createBall(W / 2, Math.max(40, H * 0.25), angle));
  state.trail = [];
}

function resize() {
  if (!canvas || !stage) return;
  const rect = stage.getBoundingClientRect();
  W = Math.max(1, Math.floor(rect.width));
  H = Math.max(1, Math.floor(rect.height));
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width  = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width  = W + "px";
  canvas.style.height = H + "px";

  const c = getCtx();
  if (c) c.setTransform(DPR, 0, 0, DPR, 0, 0);

  state.paddle.w = Math.round(Math.max(70, Math.min(W * 0.3, 130)));
  state.paddle.h = 14;
  state.paddle.y = H - 30;

  state.paddle.x = Math.max(0, Math.min(W - state.paddle.w, state.paddle.x));
  state.paddle.targetX = state.paddle.x;

  if (state.phase === "idle") {
    state.paddle.x = (W - state.paddle.w) / 2;
    state.paddle.targetX = state.paddle.x;
    placeBalls();
  }
}

if (typeof ResizeObserver !== "undefined" && stage) {
  try { new ResizeObserver(() => resize()).observe(stage); } catch(e) {}
}
window.addEventListener("resize", resize);
window.addEventListener("orientationchange", () => setTimeout(resize, 100));

/* ========== HUD ========== */
const scoreEl = document.getElementById("score");
const bestEl  = document.getElementById("best");
const ballCountEl = document.getElementById("ballCount");

function updateHUD() {
  if (scoreEl) scoreEl.textContent = state.score;
  if (bestEl)  bestEl.textContent  = state.best;
  if (ballCountEl) ballCountEl.textContent = state.balls.length;
}
updateHUD();

/* ========== OVERLAY ========== */
const overlay      = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlaySub   = document.getElementById("overlaySub");
const overlayBtn   = document.getElementById("overlayBtn");

function showOverlay(title, sub, btn) {
  if (overlayTitle) overlayTitle.textContent = title;
  if (overlaySub)   overlaySub.textContent   = sub;
  if (overlayBtn)   overlayBtn.querySelector("span").textContent = btn;
  if (overlay)      overlay.hidden = false;
}
function hideOverlay() { if (overlay) overlay.hidden = true; }

/* ========== СТАРТ / КОНЕЦ ========== */
function startGame() {
  state.score = 0;
  state.speedMul = 1;
  state.phase = "playing";
  state.paddle.x = (W - state.paddle.w) / 2;
  state.paddle.targetX = state.paddle.x;
  placeBalls();
  updateHUD();
  hideOverlay();
  tg?.HapticFeedback?.impactOccurred?.("medium");
}

function gameOver() {
  state.phase = "over";
  state.speedMul = 1;
  if (state.score > state.best) {
    state.best = state.score;
    try { localStorage.setItem("pong_best", state.best); } catch(e) {}
  }
  updateHUD();
  showOverlay("ИГРА ОКОНЧЕНА", `Счёт: ${state.score} · Рекорд: ${state.best}`, "ИГРАТЬ СНОВА");
  tg?.HapticFeedback?.notificationOccurred?.("error");
}

if (overlay) {
  const onOverlay = (e) => {
    e.preventDefault();
    if (state.phase === "idle" || state.phase === "over") startGame();
  };
  overlay.addEventListener("click", onOverlay);
  overlay.addEventListener("touchend", onOverlay, { passive: false });
}

/* ========== УПРАВЛЕНИЕ ========== */
function movePaddleTo(clientX) {
  if (!stage) return;
  const rect = stage.getBoundingClientRect();
  const x = clientX - rect.left;
  state.paddle.targetX = x - state.paddle.w / 2;
}

window.addEventListener("pointermove", (e) => {
  if (state.modalOpen) return;
  if (state.phase !== "playing" && state.phase !== "idle") return;
  movePaddleTo(e.clientX);
});
window.addEventListener("touchmove", (e) => {
  if (state.modalOpen) return;
  if (state.phase !== "playing" && state.phase !== "idle") return;
  if (e.touches[0]) movePaddleTo(e.touches[0].clientX);
}, { passive: true });

window.addEventListener("keydown", (e) => {
  const step = 40;
  if (e.key === "ArrowLeft"  || e.key === "a") state.paddle.targetX -= step;
  if (e.key === "ArrowRight" || e.key === "d") state.paddle.targetX += step;
  if (e.key === " " && (state.phase === "idle" || state.phase === "over")) startGame();
});

/* ========== ФИЗИКА ========== */
function update(dt) {
  if (state.modalOpen) return;

  const p = state.paddle;
  p.x += (p.targetX - p.x) * Math.min(1, dt * 20);
  p.x = Math.max(0, Math.min(W - p.w, p.x));

  if (state.phase !== "playing") return;

  const targetSpeed = state.baseSpeed * state.speedMul;
  const ballsToAdd = [];
  let anyScored = false;

  for (let i = state.balls.length - 1; i >= 0; i--) {
    const b = state.balls[i];

    // стабилизация скорости
    const mag = Math.hypot(b.vx, b.vy) || 1;
    b.vx = (b.vx / mag) * targetSpeed;
    b.vy = (b.vy / mag) * targetSpeed;

    const prevY = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // стены
    if (b.x - b.r < 0) { b.x = b.r;     b.vx =  Math.abs(b.vx); }
    if (b.x + b.r > W) { b.x = W - b.r; b.vx = -Math.abs(b.vx); }
    if (b.y - b.r < 0) { b.y = b.r;     b.vy =  Math.abs(b.vy); }

    // удар об платформу
    if (
      b.vy > 0 &&
      prevY + b.r <= p.y &&
      b.y + b.r >= p.y &&
      b.x + b.r >= p.x &&
      b.x - b.r <= p.x + p.w
    ) {
      const rel = ((b.x - p.x) / p.w) * 2 - 1;
      const angle = rel * 1.05;
      state.speedMul = Math.min(2.2, state.speedMul * 1.03);
      const speed = state.baseSpeed * state.speedMul;
      b.vx = Math.sin(angle) * speed;
      b.vy = -Math.cos(angle) * speed;
      b.y = p.y - b.r;

      state.score += 1;
      anyScored = true;

      // создать новый шарик, если не достигли лимита
      if (state.balls.length + ballsToAdd.length < MAX_BALLS) {
        // угол: отражённый от текущего, но с разбросом
        const newAngle = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
        ballsToAdd.push(createBall(b.x, b.y - 4, newAngle));
      }

      tg?.HapticFeedback?.impactOccurred?.("light");
    }

    // упал
    if (b.y - b.r > H + 20) {
      state.balls.splice(i, 1);
    }
  }

  // добавить новые шарики
  if (ballsToAdd.length) {
    state.balls.push(...ballsToAdd);
  }

  // если все упали — game over
  if (state.balls.length === 0) {
    gameOver();
    return;
  }

  if (anyScored) updateHUD();

  // след от первого шарика (для красоты)
  if (state.balls.length) {
    const b = state.balls[0];
    state.trail.push({ x: b.x, y: b.y });
    if (state.trail.length > 14) state.trail.shift();
  }
}

/* ========== ОТРИСОВКА ========== */
function roundRect(c, x, y, w, h, r) {
  c.beginPath();
  c.moveTo(x + r, y);
  c.lineTo(x + w - r, y);
  c.arcTo(x + w, y, x + w, y + h, r);
  c.lineTo(x + w, y + h - r);
  c.arcTo(x + w, y + h, x + w - r, y + h, r);
  c.lineTo(x + r, y + h);
  c.arcTo(x, y + h, x, y + h - r, r);
  c.lineTo(x, y + r);
  c.arcTo(x, y, x + r, y, r);
  c.closePath();
}

function draw() {
  const c = getCtx();
  if (!c) return;
  c.clearRect(0, 0, W, H);

  // центральная линия
  c.strokeStyle = colors.accent;
  c.globalAlpha = 0.1;
  c.setLineDash([4, 10]);
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(W / 2, 16);
  c.lineTo(W / 2, H - 16);
  c.stroke();
  c.setLineDash([]);
  c.globalAlpha = 1;

  // след
  state.trail.forEach((t, i) => {
    const a = ((i + 1) / state.trail.length) * 0.3;
    const r = BALL_R * (i / state.trail.length);
    c.globalAlpha = a;
    c.fillStyle = colors.accent;
    c.beginPath();
    c.arc(t.x, t.y, r, 0, Math.PI * 2);
    c.fill();
  });
  c.globalAlpha = 1;

  // платформа
  const p = state.paddle;
  c.save();
  roundRect(c, p.x, p.y, p.w, p.h, p.h / 2);
  const grd = c.createLinearGradient(p.x, 0, p.x + p.w, 0);
  grd.addColorStop(0,   colors.accent2);
  grd.addColorStop(0.5, colors.accent);
  grd.addColorStop(1,   colors.accent2);
  c.fillStyle = grd;
  c.shadowBlur = 22;
  c.shadowColor = colors.accent;
  c.fill();
  c.restore();

  // шарики
  if (state.phase !== "over")
