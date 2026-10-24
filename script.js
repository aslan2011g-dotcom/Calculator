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

const colorDots = document.querySelectorAll(".color-dot");
const colorModal = document.getElementById("colorModal");

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
  localStorage.setItem("theme", theme);

  colorDots.forEach(dot => {
    dot.classList.toggle("selected", dot.dataset.theme === theme);
  });

  tg?.setHeaderColor?.(THEME_COLORS[theme]);
  tg?.setBackgroundColor?.(THEME_COLORS[theme]);

  readColors();
}

applyTheme(localStorage.getItem("theme") || "black");

/* ========== КАНВАС ========== */
const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const stage = document.getElementById("stage");

let W = 0, H = 0, DPR = 1;

function resize() {
  const rect = stage.getBoundingClientRect();
  W = Math.max(1, Math.floor(rect.width));
  H = Math.max(1, Math.floor(rect.height));
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width  = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width  = W + "px";
  canvas.style.height = H + "px";
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  // размеры платформы
  state.paddle.w = Math.round(Math.max(70, Math.min(W * 0.3, 130)));
  state.paddle.h = 14;
  state.paddle.y = H - 30;

  // не даём уехать за края
  state.paddle.x = Math.max(0, Math.min(W - state.paddle.w, state.paddle.x));
  state.paddle.targetX = state.paddle.x;

  if (state.phase === "idle") {
    state.paddle.x = (W - state.paddle.w) / 2;
    state.paddle.targetX = state.paddle.x;
    placeBall();
  }
}

new ResizeObserver(() => resize()).observe(stage);

/* ========== СОСТОЯНИЕ ИГРЫ ========== */
const state = {
  paddle: { x: 0, y: 0, w: 90, h: 14, targetX: 0 },
  ball:   { x: 0, y: 0, vx: 0, vy: 0, r: 9 },
  trail: [],
  score: 0,
  best: Number(localStorage.getItem("pong_best") || 0),
  baseSpeed: 340,       // px/сек
  speedMul: 1,
  phase: "idle",        // idle | playing | over
  modalOpen: false,
};

function placeBall() {
  const b = state.ball;
  b.x = W / 2;
  b.y = H * 0.28;
  const angle = Math.PI / 2 + (Math.random() - 0.5) * 0.6; // вниз ±17°
  const speed = state.baseSpeed * state.speedMul;
  b.vx = Math.cos(angle) * speed;
  b.vy = Math.sin(angle) * speed;
  state.trail = [];
}

/* ========== HUD ========== */
const scoreEl = document.getElementById("score");
const bestEl  = document.getElementById("best");

function updateHUD() {
  scoreEl.textContent = state.score;
  bestEl.textContent  = state.best;
}
updateHUD();

/* ========== OVERLAY ========== */
const overlay      = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlaySub   = document.getElementById("overlaySub");
const overlayBtn   = document.getElementById("overlayBtn");

function showOverlay(title, sub, btn) {
  overlayTitle.textContent = title;
  overlaySub.textContent   = sub;
  overlayBtn.textContent   = btn;
  overlay.hidden = false;
}
function hideOverlay() { overlay.hidden = true; }

/* ========== СТАРТ / КОНЕЦ ========== */
function startGame() {
  state.score = 0;
  state.speedMul = 1;
  state.phase = "playing";
  state.paddle.x = (W - state.paddle.w) / 2;
  state.paddle.targetX = state.paddle.x;
  placeBall();
  updateHUD();
  hideOverlay();
  tg?.HapticFeedback?.impactOccurred?.("medium");
}

function gameOver() {
  state.phase = "over";
  state.speedMul = 1;
  if (state.score > state.best) {
    state.best = state.score;
    localStorage.setItem("pong_best", state.best);
  }
  updateHUD();
  showOverlay("Игра окончена", `Счёт: ${state.score}`, "Играть снова");
  tg?.HapticFeedback?.notificationOccurred?.("error");
}

overlay.addEventListener("click", () => {
  if (state.phase === "idle" || state.phase === "over") startGame();
});

/* ========== УПРАВЛЕНИЕ ========== */
window.addEventListener("pointermove", (e) => {
  if (state.phase !== "playing" && state.phase !== "idle") return;
  const rect = stage.getBoundingClientRect();
  const x = e.clientX - rect.left;
  state.paddle.targetX = x - state.paddle.w / 2;
});

window.addEventListener("keydown", (e) => {
  const step = 40;
  if (e.key === "ArrowLeft"  || e.key === "a") state.paddle.targetX -= step;
  if (e.key === "ArrowRight" || e.key === "d") state.paddle.targetX += step;
  if (e.key === " " && (state.phase === "idle" || state.phase === "over")) startGame();
});

/* ========== ОБНОВЛЕНИЕ ========== */
function update(dt) {
  if (state.modalOpen) return;

  const p = state.paddle;

  // плавное движение платформы
  p.x += (p.targetX - p.x) * Math.min(1, dt * 20);
  p.x = Math.max(0, Math.min(W - p.w, p.x));

  if (state.phase !== "playing") return;

  const b = state.ball;

  // стабилизация скорости (шарик летит с постоянной скоростью)
  const targetSpeed = state.baseSpeed * state.speedMul;
  const mag = Math.hypot(b.vx, b.vy) || 1;
  b.vx = (b.vx / mag) * targetSpeed;
  b.vy = (b.vy / mag) * targetSpeed;

  const prevY = b.y;
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  // стены
  if (b.x - b.r < 0)     { b.x = b.r;     b.vx =  Math.abs(b.vx); }
  if (b.x + b.r > W)     { b.x = W - b.r; b.vx = -Math.abs(b.vx); }
  if (b.y - b.r < 0)     { b.y = b.r;     b.vy =  Math.abs(b.vy); }

  // столкновение с платформой
  if (
    b.vy > 0 &&
    prevY + b.r <= p.y &&          // был выше платформы
    b.y + b.r >= p.y &&            // и пересёк её верх
    b.x + b.r >= p.x &&
    b.x - b.r <= p.x + p.w
  ) {
    // угол отскока зависит от места попадания
    const rel = ((b.x - p.x) / p.w) * 2 - 1; // -1..1
    const angle = rel * 1.05;                 // до ±60°
    state.speedMul = Math.min(2.2, state.speedMul * 1.03);
    const speed = state.baseSpeed * state.speedMul;
    b.vx = Math.sin(angle) * speed;
    b.vy = -Math.cos(angle) * speed;
    b.y = p.y - b.r;

    state.score += 1;
    updateHUD();
    tg?.HapticFeedback?.impactOccurred?.("light");
  }

  // шар упал
  if (b.y - b.r > H + 10) {
    gameOver();
    return;
  }

  // след
  state.trail.push({ x: b.x, y: b.y });
  if (state.trail.length > 16) state.trail.shift();
}

/* ========== ОТРИСОВКА ========== */
function draw() {
  ctx.clearRect(0, 0, W, H);

  // центральная линия
  ctx.strokeStyle = colors.accent;
  ctx.globalAlpha = 0.12;
  ctx.setLineDash([4, 10]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W / 2, 16);
  ctx.lineTo(W / 2, H - 16);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // след шарика
  state.trail.forEach((t, i) => {
    const a = ((i + 1) / state.trail.length) * 0.35;
    const r = state.ball.r * (i / state.trail.length);
    ctx.globalAlpha = a;
    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    ctx.arc(t.x, t.y, r, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // платформа
  const p = state.paddle;
  ctx.save();
  roundRect(p.x, p.y, p.w, p.h, p.h / 2);
  const grd = ctx.createLinearGradient(p.x, 0, p.x + p.w, 0);
  grd.addColorStop(0,   colors.accent2);
  grd.addColorStop(0.5, colors.accent);
  grd.addColorStop(1,   colors.accent2);
  ctx.fillStyle = grd;
  ctx.shadowBlur = 22;
  ctx.shadowColor = colors.accent;
  ctx.fill();
  ctx.restore();

  // шарик
  const b = state.ball;
  if (state.phase !== "over") {
    ctx.save();
    const ballGrad = ctx.createRadialGradient(
      b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.15,
      b.x, b.y, b.r
    );
    ballGrad.addColorStop(0, "#ffffff");
    ballGrad.addColorStop(1, colors.accent);
    ctx.fillStyle = ballGrad;
    ctx.shadowBlur = 24;
    ctx.shadowColor = colors.accent;
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

/* ========== ЦИКЛ ========== */
let lastT = 0;
function loop(t) {
  const dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0.016;
  lastT = t;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

/* ========== КНОПКИ ========== */
document.getElementById("restartBtn").addEventListener("click", () => {
  startGame();
  tg?.HapticFeedback?.selectionChanged?.();
});

document.getElementById("themeBtn").addEventListener("click", () => {
  state.modalOpen = true;
  colorModal.hidden = false;
  tg?.HapticFeedback?.selectionChanged?.();
});

document.getElementById("closeColors").addEventListener("click", () => {
  state.modalOpen = false;
  colorModal.hidden = true;
});

colorDots.forEach(dot => {
  dot.addEventListener("click", () => {
    applyTheme(dot.dataset.theme);
    tg?.HapticFeedback?.selectionChanged?.();
  });
});

/* ========== СТАРТ ========== */
readColors();
requestAnimationFrame(() => {
  resize();
  updateHUD();
  showOverlay("PING PONG", "Двигай платформу — отбивай шарик", "Играть");
  requestAnimationFrame(loop);
});
