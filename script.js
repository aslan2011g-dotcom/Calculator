console.log("[pong] start");

const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

/* ---------- ТЕМА ---------- */
const THEMES = ["black","blue","pink","purple","green","orange","red","yellow","teal","indigo","lime","cyan","magenta"];
const THEME_BG = { black:"#000000", blue:"#04101c", pink:"#14060f", purple:"#0d0718", green:"#04120a", orange:"#140a05", red:"#140505", yellow:"#141005", teal:"#04120f", indigo:"#070b18", lime:"#0b1405", cyan:"#041318", magenta:"#140518" };

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
  try { localStorage.setItem("theme", theme); } catch(e) {}
  document.querySelectorAll(".color-dot").forEach(dot => {
    dot.classList.toggle("selected", dot.dataset.theme === theme);
  });
  tg?.setHeaderColor?.(THEME_BG[theme]);
  tg?.setBackgroundColor?.(THEME_BG[theme]);
  readColors();
}

let savedTheme = "black";
try { savedTheme = localStorage.getItem("theme") || "black"; } catch(e) {}
applyTheme(savedTheme);

/* ---------- КАНВАС ---------- */
const canvas = document.getElementById("game");
const stage  = document.getElementById("stage");
const ctx = canvas ? canvas.getContext("2d") : null;

let W = 0, H = 0, DPR = 1;

function resize() {
  if (!canvas || !stage) return;
  const r = stage.getBoundingClientRect();
  W = Math.max(1, Math.floor(r.width));
  H = Math.max(1, Math.floor(r.height));
  DPR = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width  = Math.floor(W * DPR);
  canvas.height = Math.floor(H * DPR);
  canvas.style.width  = W + "px";
  canvas.style.height = H + "px";
  if (ctx) ctx.setTransform(DPR, 0, 0, DPR, 0, 0);

  state.paddle.w = Math.round(Math.max(70, Math.min(W * 0.3, 130)));
  state.paddle.h = 14;
  state.paddle.y = H - 30;
  state.paddle.x = Math.max(0, Math.min(W - state.paddle.w, state.paddle.x));
  state.paddle.targetX = state.paddle.x;
  if (state.phase === "idle") placeBalls();
}

/* ---------- СОСТОЯНИЕ ---------- */
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
  const s = state.baseSpeed * state.speedMul;
  return { x, y, vx: Math.cos(angle)*s, vy: Math.sin(angle)*s, r: BALL_R };
}
function placeBalls() {
  state.balls = [];
  state.balls.push(createBall(W/2, Math.max(40, H*0.25), Math.PI/2 + (Math.random()-0.5)*0.4));
  state.trail = [];
}

/* ---------- HUD ---------- */
const scoreEl = document.getElementById("score");
const bestEl  = document.getElementById("best");
const countEl = document.getElementById("ballCount");

function updateHUD() {
  if (scoreEl) scoreEl.textContent = state.score;
  if (bestEl)  bestEl.textContent  = state.best;
  if (countEl) countEl.textContent = state.balls.length;
}

/* ---------- OVERLAY ---------- */
const overlay      = document.getElementById("overlay");
const overlayTitle = document.getElementById("overlayTitle");
const overlaySub   = document.getElementById("overlaySub");
const overlayBtn   = document.getElementById("overlayBtn");

function showOverlay(title, sub, btn) {
  if (overlayTitle) overlayTitle.textContent = title;
  if (overlaySub)   overlaySub.textContent   = sub;
  if (overlayBtn)   overlayBtn.textContent   = btn;
  if (overlay)      overlay.hidden = false;
}
function hideOverlay() { if (overlay) overlay.hidden = true; }

/* ---------- СТАРТ / КОНЕЦ ---------- */
function startGame() {
  console.log("[pong] startGame");
  state.score = 0;
  state.speedMul = 1;
  state.phase = "playing";
  state.paddle.x = (W - state.paddle.w) / 2;
  state.paddle.targetX = state.paddle.x;
  placeBalls();
  updateHUD();
  hideOverlay();
}

function gameOver() {
  state.phase = "over";
  state.speedMul = 1;
  if (state.score > state.best) {
    state.best = state.score;
    try { localStorage.setItem("pong_best", state.best); } catch(e) {}
  }
  updateHUD();
  showOverlay("ИГРА ОКОНЧЕНА", "Счёт: " + state.score, "ИГРАТЬ СНОВА");
}

/* ---------- КНОПКИ (чистый click) ---------- */
if (overlay) {
  overlay.addEventListener("click", () => {
    console.log("[pong] overlay click, phase =", state.phase);
    if (state.phase === "idle" || state.phase === "over") startGame();
  });
}

const restartBtn = document.getElementById("restartBtn");
if (restartBtn) restartBtn.addEventListener("click", () => {
  console.log("[pong] restart");
  startGame();
});

const themeBtn = document.getElementById("themeBtn");
if (themeBtn) themeBtn.addEventListener("click", () => {
  console.log("[pong] theme open");
  state.modalOpen = true;
  if (colorModal) colorModal.hidden = false;
});

const colorModal = document.getElementById("colorModal");
const closeColors = document.getElementById("closeColors");
if (closeColors) closeColors.addEventListener("click", () => {
  console.log("[pong] theme close");
  state.modalOpen = false;
  if (colorModal) colorModal.hidden = true;
});

document.querySelectorAll(".color-dot").forEach(dot => {
  dot.addEventListener("click", () => {
    console.log("[pong] theme =", dot.dataset.theme);
    applyTheme(dot.dataset.theme);
  });
});

/* ---------- УПРАВЛЕНИЕ ---------- */
function movePaddle(clientX) {
  if (!stage) return;
  const r = stage.getBoundingClientRect();
  state.paddle.targetX = (clientX - r.left) - state.paddle.w / 2;
}

window.addEventListener("pointermove", e => {
  if (state.modalOpen) return;
  if (state.phase === "playing" || state.phase === "idle") movePaddle(e.clientX);
});

window.addEventListener("keydown", e => {
  if (e.key === "ArrowLeft"  || e.key === "a") state.paddle.targetX -= 40;
  if (e.key === "ArrowRight" || e.key === "d") state.paddle.targetX += 40;
  if (e.key === " " && (state.phase === "idle" || state.phase === "over")) startGame();
});

/* ---------- ФИЗИКА ---------- */
function update(dt) {
  if (state.modalOpen) return;
  const p = state.paddle;
  p.x += (p.targetX - p.x) * Math.min(1, dt * 20);
  p.x = Math.max(0, Math.min(W - p.w, p.x));

  if (state.phase !== "playing") return;

  const targetSpeed = state.baseSpeed * state.speedMul;
  const newBalls = [];

  for (let i = state.balls.length - 1; i >= 0; i--) {
    const b = state.balls[i];
    const mag = Math.hypot(b.vx, b.vy) || 1;
    b.vx = (b.vx / mag) * targetSpeed;
    b.vy = (b.vy / mag) * targetSpeed;

    const prevY = b.y;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

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

      if (state.balls.length + newBalls.length < MAX_BALLS) {
        const na = -Math.PI/2 + (Math.random() - 0.5) * 1.6;
        newBalls.push(createBall(b.x, b.y - 4, na));
      }
    }

    if (b.y - b.r > H + 20) state.balls.splice(i, 1);
  }

  if (newBalls.length) state.balls.push(...newBalls);
  if (state.balls.length === 0) { gameOver(); return; }

  updateHUD();

  if (state.balls[0]) {
    state.trail.push({ x: state.balls[0].x, y: state.balls[0].y });
    if (state.trail.length > 14) state.trail.shift();
  }
}

/* ---------- ОТРИСОВКА ---------- */
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
  if (!ctx) return;
  ctx.clearRect(0, 0, W, H);

  // центр
  ctx.strokeStyle = colors.accent;
  ctx.globalAlpha = 0.1;
  ctx.setLineDash([4, 10]);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(W/2, 16);
  ctx.lineTo(W/2, H - 16);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.globalAlpha = 1;

  // след
  state.trail.forEach((t, i) => {
    ctx.globalAlpha = ((i+1) / state.trail.length) * 0.3;
    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    ctx.arc(t.x, t.y, BALL_R * (i / state.trail.length), 0, Math.PI*2);
    ctx.fill();
  });
  ctx.globalAlpha = 1;

  // платформа
  const p = state.paddle;
  ctx.save();
  roundRect(ctx, p.x, p.y, p.w, p.h, p.h/2);
  const g = ctx.createLinearGradient(p.x, 0, p.x + p.w, 0);
  g.addColorStop(0, colors.accent2);
  g.addColorStop(0.5, colors.accent);
  g.addColorStop(1, colors.accent2);
  ctx.fillStyle = g;
  ctx.shadowBlur = 22;
  ctx.shadowColor = colors.accent;
  ctx.fill();
  ctx.restore();

  // шарики
  if (state.phase !== "over") {
    state.balls.forEach(b => {
      ctx.save();
      const bg = ctx.createRadialGradient(b.x - b.r*0.35, b.y - b.r*0.35, b.r*0.15, b.x, b.y, b.r);
      bg.addColorStop(0, "#ffffff");
      bg.addColorStop(1, colors.accent);
      ctx.fillStyle = bg;
      ctx.shadowBlur = 20;
      ctx.shadowColor = colors.accent;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
      ctx.fill();
      ctx.restore();
    });
  }
}

/* ---------- ЦИКЛ ---------- */
let lastT = 0;
function loop(t) {
  const dt = lastT ? Math.min(0.05, (t - lastT) / 1000) : 0.016;
  lastT = t;
  update(dt);
  draw();
  requestAnimationFrame(loop);
}

/* ---------- ЗАПУСК ---------- */
readColors();
resize();
updateHUD();
showOverlay("PING PONG", "Отбивай шарики — они размножаются", "ИГРАТЬ");
requestAnimationFrame(loop);

console.log("[pong] init done");
