/* ========== ЗАЩИТА ОТ ПАДЕНИЙ ========== */
console.log("[pong] script.js загружен");

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

const colorDots   = document.querySelectorAll(".color-dot");
const colorModal  = document.getElementById("colorModal");
const colorOptions= document.getElementById("colorOptions");

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

/* ========== СОСТОЯНИЕ ИГРЫ ========== */
const state = {
  paddle: { x: 0, y: 0, w: 90, h: 14, targetX: 0 },
  ball:   { x: 0, y: 0, vx: 0, vy: 0, r: 9 },
  trail: [],
  score: 0,
  best: 0,
  baseSpeed: 320,
  speedMul: 1,
  phase: "idle",
  modalOpen: false,
};

try { state.best = Number(localStorage.getItem("pong_best") || 0); } catch(e) {}

function placeBall() {
  const b = state.ball;
  b.x = W / 2;
  b.y = Math.max(40, H * 0.28);
  const angle = Math.PI / 2 + (Math.random() - 0.5) * 0.6;
  const speed = state.baseSpeed * state.speedMul;
  b.vx = Math.cos(angle) * speed;
  b.vy = Math.sin(angle) * speed;
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
    placeBall();
  }
}

/* ResizeObserver может не быть — фолбэк */
if (typeof ResizeObserver !== "undefined" && stage) {
  try { new ResizeObserver(() => resize()).observe(stage); } catch(e) {}
}
window.addEventListener("resize", resize);
window.addEventListener("orientationchange", () => setTimeout(resize, 100));

/* ========== HUD ========== */
const scoreEl = document.getElementById("score");
const bestEl  = document.getElementById("best");

function updateHUD() {
  if (scoreEl) scoreEl.textContent = state.score;
  if (bestEl)  bestEl.textContent  = state.best;
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
  if (overlayBtn)   overlayBtn.textContent   = btn;
  if (overlay)      overlay.hidden = false;
}
function hideOverlay() { if (overlay) overlay.hidden = true; }

/* ========== СТАРТ / КОНЕЦ ========== */
function startGame() {
  console.log("[pong] startGame");
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
    try { localStorage.setItem("pong_best", state.best); } catch(e) {}
  }
  updateHUD();
  showOverlay("Игра окончена", `Счёт: ${state.score}`, "Играть снова");
  tg?.HapticFeedback?.notificationOccurred?.("error");
}

/* обработчик overlay — клик И тап */
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

/* ========== ОБНОВЛЕНИЕ ========== */
function update(dt) {
  if (state.modalOpen) return;

  const p = state.paddle;
  p.x += (p.targetX - p.x) * Math.min(1, dt * 20);
  p.x = Math.max(0, Math.min(W - p.w, p.x));

  if (state.phase !== "playing") return;

  const b = state.ball;
  const targetSpeed = state.baseSpeed * state.speedMul;
  const mag = Math.hypot(b.vx, b.vy) || 1;
  b.vx = (b.vx / mag) * targetSpeed;
  b.vy = (b.vy / mag) * targetSpeed;

  const prevY = b.y;
  b.x += b.vx * dt;
  b.y += b.vy * dt;

  if (b.x - b.r < 0) { b.x = b.r;     b.vx =  Math.abs(b.vx); }
  if (b.x + b.r > W) { b.x = W - b.r; b.vx = -Math.abs(b.vx); }
  if (b.y - b.r < 0) { b.y = b.r;     b.vy =  Math.abs(b.vy); }

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
    updateHUD();
    tg?.HapticFeedback?.impactOccurred?.("light");
  }

  if (b.y - b.r > H + 10) { gameOver(); return; }

  state.trail.push({ x: b.x, y: b.y });
  if (state.trail.length > 16) state.trail.shift();
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

  c.strokeStyle = colors.accent;
  c.globalAlpha = 0.12;
  c.setLineDash([4, 10]);
  c.lineWidth = 1;
  c.beginPath();
  c.moveTo(W / 2, 16);
  c.lineTo(W / 2, H - 16);
  c.stroke();
  c.setLineDash([]);
  c.globalAlpha = 1;

  state.trail.forEach((t, i) => {
    const a = ((i + 1) / state.trail.length) * 0.35;
    const r = state.ball.r * (i / state.trail.length);
    c.globalAlpha = a;
    c.fillStyle = colors.accent;
    c.beginPath();
    c.arc(t.x, t.y, r, 0, Math.PI * 2);
    c.fill();
  });
  c.globalAlpha = 1;

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

  const b = state.ball;
  if (state.phase !== "over") {
    c.save();
    const ballGrad = c.createRadialGradient(
      b.x - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.15,
      b.x, b.y, b.r
    );
    ballGrad.addColorStop(0, "#ffffff");
    ballGrad.addColorStop(1, colors.accent);
    c.fillStyle = ballGrad;
    c.shadowBlur = 24;
    c.shadowColor = colors.accent;
    c.beginPath();
    c.arc(b.x, b.y, b.r, 0, Math.PI * 2);
    c.fill();
    c.restore();
  }
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
const restartBtn = document.getElementById("restartBtn");
const themeBtn   = document.getElementById("themeBtn");
const closeBtn   = document.getElementById("closeColors");

function bindTap(el, handler) {
  if (!el) return;
  let touched = false;
  el.addEventListener("touchstart", () => { touched = true; }, { passive: true });
  el.addEventListener("touchend", (e) => {
    e.preventDefault();
    if (touched) { touched = false; handler(); }
  }, { passive: false });
  el.addEventListener("click", (e) => {
    e.preventDefault();
    if (touched) { touched = false; return; }
    handler();
  });
}

bindTap(restartBtn, () => {
  console.log("[pong] restart");
  startGame();
  tg?.HapticFeedback?.selectionChanged?.();
});

bindTap(themeBtn, () => {
  console.log("[pong] theme открыт");
  state.modalOpen = true;
  if (colorModal) colorModal.hidden = false;
  tg?.HapticFeedback?.selectionChanged?.();
});

bindTap(closeBtn, () => {
  console.log("[pong] theme закрыт");
  state.modalOpen = false;
  if (colorModal) colorModal.hidden = true;
});

colorDots.forEach(dot => {
  bindTap(dot, () => {
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
